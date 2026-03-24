const { getAiClient } = require("./aiClient");
const { TOOL_SCHEMAS, executeTool } = require("./tools");

const AGENT_CONFIG_KEY = "tomu-quote-agent";
const MAX_TOOL_ROUNDS = 10;

const FALLBACK_INSTRUCTIONS =
  "You are ToMu, a friendly tree shrew who works as an insurance assistant " +
  "for Toggle Mutual Insurance. Help the customer get a quote by collecting " +
  "their address, personal information, and vehicle details. Once you have " +
  "all the information, confirm it with the customer and submit the quote.";

const FALLBACK_CONFIG = {
  enabled: true,
  instructions: FALLBACK_INSTRUCTIONS,
  model: { name: "gpt-4o-mini" },
  tools: Object.values(TOOL_SCHEMAS),
};

const getOpenAiClient = () => {
  const OpenAI = require("openai").default || require("openai").OpenAI;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  return new OpenAI({ apiKey });
};

const buildToolDefinitions = (agentConfig) => {
  if (agentConfig.tools && agentConfig.tools.length > 0) {
    return agentConfig.tools.map((t) => {
      if (t.type === "function") return t;
      const schema = TOOL_SCHEMAS[t.name || t.key];
      if (schema) return schema;
      return {
        type: "function",
        function: {
          name: t.name || t.key,
          description: t.description || "",
          parameters: t.schema || t.parameters || { type: "object", properties: {} },
        },
      };
    });
  }
  return Object.values(TOOL_SCHEMAS);
};

const handleChat = async (messages, sessionId) => {
  const openai = getOpenAiClient();
  if (!openai) {
    return {
      message: {
        role: "assistant",
        content:
          "I'm sorry, the chat service is not configured yet. " +
          "Please use the standard quote form instead.",
      },
    };
  }

  const context = {
    kind: "multi",
    session: { key: sessionId },
    user: { key: "chat_user" },
  };

  let agentConfig = FALLBACK_CONFIG;
  let tracker = null;

  try {
    const aiClient = await getAiClient();
    if (aiClient) {
      const result = await aiClient.agentConfig(
        AGENT_CONFIG_KEY,
        context,
        FALLBACK_CONFIG,
      );
      if (result && result.enabled !== false) {
        agentConfig = result;
        tracker = result.tracker || null;
      }
    }
  } catch (err) {
    console.warn("[AI] agentConfig evaluation failed, using fallback:", err.message);
  }

  const systemMessage = {
    role: "system",
    content: agentConfig.instructions || FALLBACK_INSTRUCTIONS,
  };

  const tools = buildToolDefinitions(agentConfig);
  const modelName =
    (agentConfig.model && agentConfig.model.name) || "gpt-4o-mini";

  let conversationMessages = [systemMessage, ...(messages || [])];
  let quoteResult = null;

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    let response;
    try {
      const callLlm = () =>
        openai.chat.completions.create({
          model: modelName,
          messages: conversationMessages,
          tools: tools.length > 0 ? tools : undefined,
          temperature: 0.7,
        });

      if (tracker && typeof tracker.trackMetricsOf === "function") {
        response = await tracker.trackMetricsOf(
          (result) => {
            const usage = result?.usage;
            if (!usage) return {};
            return {
              inputTokens: usage.prompt_tokens || 0,
              outputTokens: usage.completion_tokens || 0,
            };
          },
          callLlm,
        );
      } else {
        response = await callLlm();
      }
    } catch (err) {
      console.error("[AI] LLM call failed:", err.message);
      if (tracker && typeof tracker.trackError === "function") {
        try { tracker.trackError(); } catch (_) { /* analytics must not break chat */ }
      }
      return {
        message: {
          role: "assistant",
          content:
            "I ran into an issue processing your request. " +
            "Please try again or use the standard quote form.",
        },
      };
    }

    const choice = response.choices && response.choices[0];
    if (!choice) break;

    const assistantMessage = choice.message;
    conversationMessages.push(assistantMessage);

    if (
      choice.finish_reason === "tool_calls" ||
      (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0)
    ) {
      for (const toolCall of assistantMessage.tool_calls) {
        const toolName = toolCall.function.name;
        let toolArgs = {};
        try {
          toolArgs = JSON.parse(toolCall.function.arguments || "{}");
        } catch (_) { /* best effort */ }

        let toolResult;
        try {
          toolResult = await executeTool(toolName, toolArgs, sessionId);
        } catch (err) {
          console.error(`[AI] Tool ${toolName} failed:`, err.message);
          toolResult = { ok: false, error: err.message };
        }

        if (toolName === "submit_quote" && toolResult.ok) {
          quoteResult = toolResult.quote;
        }

        conversationMessages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify(toolResult),
        });
      }
      continue;
    }

    if (tracker && quoteResult) {
      try {
        if (typeof tracker.trackSuccess === "function") tracker.trackSuccess();
      } catch (_) { /* analytics must not break chat */ }
    }

    return {
      message: {
        role: "assistant",
        content: assistantMessage.content || "",
      },
      quoteResult: quoteResult || undefined,
    };
  }

  return {
    message: {
      role: "assistant",
      content:
        "I seem to have gotten a bit turned around. " +
        "Could you try rephrasing your last message?",
    },
    quoteResult: quoteResult || undefined,
  };
};

module.exports = { handleChat };

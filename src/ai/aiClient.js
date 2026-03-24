const { initAi } = require("@launchdarkly/server-sdk-ai");
const { initializeLaunchDarkly } = require("../experiments/launchdarklyClient");

let aiClient = null;

const getAiClient = async () => {
  if (aiClient) return aiClient;
  const ldClient = await initializeLaunchDarkly();
  if (!ldClient) return null;
  aiClient = initAi(ldClient);
  return aiClient;
};

module.exports = { getAiClient };

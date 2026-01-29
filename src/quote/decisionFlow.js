const { eventEmitter } = require("../analytics/eventEmitter");
const { AnalyticsEvents } = require("../analytics/events");
const { evaluateFakeModels } = require("../models/fake");
const { Quote } = require("./quote");
const { constructOffer } = require("./constructOffer");
const {
  getOfferStrategyAssignment,
  getBooleanFlag,
} = require("../experiments/launchdarklyClient");

const initializeQuote = (input) => {
  const quote = new Quote(input);
  eventEmitter.emit(AnalyticsEvents.QUOTE_STARTED, {
    quoteId: quote.id,
    status: quote.status,
  });
  return quote;
};

const evaluateEligibility = (quote) => {
  const applicant = quote.input.applicant ?? {};
  const eligible = applicant.age >= 18;
  const reasons = eligible ? [] : ["applicant_under_18"];

  return {
    eligible,
    reasons,
  };
};

const callFakeModels = (quote) => {
  quote.modelOutputs = evaluateFakeModels(quote.input);
  quote.updateStatus("models_evaluated");
};

const getRiskTier = (riskScore) => {
  if (riskScore >= 70) {
    return "high";
  }
  if (riskScore >= 40) {
    return "medium";
  }
  return "low";
};

const buildLaunchDarklyContext = (quote) => {
  const state = quote.input.applicant?.state ?? "unknown";
  const isReturningCustomer = quote.input.customer?.isReturning ?? false;
  const riskScore = quote.modelOutputs?.riskScore ?? 0;

  return {
    kind: "user",
    key: quote.id,
    state,
    riskTier: getRiskTier(riskScore),
    isReturningCustomer,
  };
};

const applyGuardrails = async (quote, eligibility) => {
  const context = buildLaunchDarklyContext(quote);
  const instantQuoteEnabled = await getBooleanFlag(
    "instant-quote-enabled",
    context,
    true
  );
  const pricingEngineEnabled = await getBooleanFlag(
    "pricing-engine-enabled",
    context,
    true
  );
  const appliedGuardrails = [];

  let updatedEligibility = {
    eligible: eligibility.eligible,
    reasons: [...eligibility.reasons],
  };
  if (!instantQuoteEnabled) {
    updatedEligibility = {
      eligible: false,
      reasons: [
        ...new Set([...updatedEligibility.reasons, "instant_quote_disabled"]),
      ],
    };
    appliedGuardrails.push("instant_quote_disabled");
  }
  if (!pricingEngineEnabled) {
    appliedGuardrails.push("pricing_engine_disabled");
  }

  return {
    eligibility: updatedEligibility,
    forcedOfferStrategy: pricingEngineEnabled ? null : "baseline",
    guardrails: {
      instantQuoteEnabled,
      pricingEngineEnabled,
      applied: appliedGuardrails,
    },
  };
};

const finalizeEligibility = (quote, eligibility) => {
  quote.eligibility = eligibility;
  quote.updateStatus("eligibility_evaluated");

  eventEmitter.emit(AnalyticsEvents.QUOTE_ELIGIBILITY_EVALUATED, {
    quoteId: quote.id,
    eligible: eligibility.eligible,
    reasons: eligibility.reasons,
  });
};

const selectOfferStrategy = async (quote, forcedOfferStrategy) => {
  if (forcedOfferStrategy) {
    quote.offerStrategy = forcedOfferStrategy;
    return forcedOfferStrategy;
  }
  const context = buildLaunchDarklyContext(quote);
  const offerStrategy = await getOfferStrategyAssignment(context);
  quote.offerStrategy = offerStrategy;
  return offerStrategy;
};

const constructOfferStep = (quote, offerStrategy) => {
  const eligible = quote.eligibility?.eligible ?? false;
  if (!eligible) {
    quote.offer = null;
    quote.updateStatus("offer_constructed");
    return;
  }

  quote.offer = constructOffer(quote.modelOutputs, offerStrategy);
  quote.updateStatus("offer_constructed");

  eventEmitter.emit(AnalyticsEvents.QUOTE_OFFER_CONSTRUCTED, {
    quoteId: quote.id,
    offerStrategy,
    coverageTier: quote.offer.coverageTier,
    price: quote.offer.price,
  });
};

const completeQuote = (quote) => {
  quote.updateStatus("completed");
  const completed = quote.eligibility?.eligible ?? false;
  const payload = {
    quoteId: quote.id,
    status: quote.status,
    completed,
  };
  if (!completed) {
    payload.completionReason = "ineligible";
  }
  eventEmitter.emit(AnalyticsEvents.QUOTE_COMPLETED, payload);
};

const runQuoteDecisionFlow = async (input) => {
  const quote = initializeQuote(input);
  callFakeModels(quote);
  const baseEligibility = evaluateEligibility(quote);
  const guardrails = await applyGuardrails(quote, baseEligibility);
  finalizeEligibility(quote, guardrails.eligibility);
  const offerStrategy = await selectOfferStrategy(
    quote,
    guardrails.forcedOfferStrategy
  );
  quote.decisionSummary = {
    eligibility: {
      eligible: guardrails.eligibility.eligible,
      reasons: guardrails.eligibility.reasons,
    },
    guardrails: guardrails.guardrails,
    offerStrategy,
    experimentationInfluenced: offerStrategy !== "baseline",
  };
  constructOfferStep(quote, offerStrategy);
  completeQuote(quote);
  return quote;
};

module.exports = {
  runQuoteDecisionFlow,
  initializeQuote,
  evaluateEligibility,
  callFakeModels,
  applyGuardrails,
  finalizeEligibility,
  selectOfferStrategy,
  constructOfferStep,
  completeQuote,
};

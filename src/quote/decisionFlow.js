const crypto = require("crypto");
const { AnalyticsEvents } = require("../analytics/events");
const { QUOTE_LIFECYCLE } = require("../analytics/lifecycle");
const { trackEvent } = require("../analytics/tracker");
const { evaluateFakeModels } = require("../models/fake");
const { Quote } = require("./quote");
const {
  constructOffer,
  OPTIMIZED_PROPENSITY_THRESHOLD,
} = require("./constructOffer");
const {
  getOfferStrategyAssignment,
  getBooleanFlag,
  getStringFlag,
} = require("../experiments/launchdarklyClient");

const initializeQuote = (input) => {
  const quote = new Quote(input);
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

const getRiskModelVariant = async (quote) => {
  const context = buildLaunchDarklyContext(quote, { includeRiskTier: false });
  const variant = await getStringFlag("risk-model-variant", context, "baseline");
  return variant === "alternate" ? "alternate" : "baseline";
};

const getPricingModelVariant = async (quote) => {
  const context = buildLaunchDarklyContext(quote, { includeRiskTier: false });
  const variant = await getStringFlag(
    "pricing-model-variant",
    context,
    "baseline"
  );
  return variant === "alternate" ? "alternate" : "baseline";
};

const callFakeModels = async (quote) => {
  const riskModelVariant = await getRiskModelVariant(quote);
  const pricingModelVariant = await getPricingModelVariant(quote);
  quote.modelOutputs = evaluateFakeModels(
    quote.input,
    riskModelVariant,
    pricingModelVariant
  );
  quote.updateStatus("models_evaluated");
  return { riskModelVariant, pricingModelVariant };
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

const buildRiskFactors = (quote) => {
  const factors = [];
  const age = quote.input.applicant?.age ?? 0;
  const maritalStatus = quote.input.applicant?.maritalStatus ?? "unknown";
  const numberOfKids = quote.input.applicant?.numberOfKids ?? 0;
  const address = quote.input.address?.fullAddress ?? "";
  const vehicle = quote.input.vehicle ?? {};

  if (age && age < 25) {
    factors.push("Young driver (under 25)");
  } else if (age && age >= 50) {
    factors.push("Experienced driver (50+)");
  }

  if (maritalStatus === "married") {
    factors.push("Married household");
  } else if (maritalStatus === "single") {
    factors.push("Single household");
  }

  if (numberOfKids > 0) {
    factors.push(`${numberOfKids} dependent${numberOfKids > 1 ? "s" : ""}`);
  }

  if (address) {
    factors.push("Location-based rating applied");
  }

  if (vehicle.year && vehicle.year < 2010) {
    factors.push("Older vehicle (pre-2010)");
  } else if (vehicle.year && vehicle.year >= 2020) {
    factors.push("Newer vehicle (2020+)");
  }

  if (vehicle.odometer && vehicle.odometer > 100000) {
    factors.push("High odometer reading");
  }

  if (vehicle.annualMileage && vehicle.annualMileage > 15000) {
    factors.push("High annual mileage");
  }

  if (!vehicle.vin) {
    factors.push("VIN not provided");
  }

  if (vehicle.make && vehicle.model) {
    factors.push(`${vehicle.make} ${vehicle.model}`);
  }

  return factors;
};

const parseAddress = (address) => {
  if (!address) {
    return { street: "", city: "", state: "", zip: "" };
  }
  const match = address.match(/^(.*),\s*([^,]+),\s*([A-Za-z]{2})\s*(\d{5})?$/);
  if (!match) {
    return { street: address, city: "", state: "", zip: "" };
  }
  return {
    street: match[1].trim(),
    city: match[2].trim(),
    state: match[3].toUpperCase(),
    zip: match[4] || "",
  };
};

const getLocationKey = (address) => {
  if (!address) {
    return "loc_unknown";
  }
  const hash = crypto.createHash("sha256").update(address).digest("hex");
  return `loc_${hash.slice(0, 12)}`;
};

const buildLaunchDarklyContext = (quote, options = {}) => {
  const address = quote.input.address?.fullAddress ?? "";
  const addressParts = parseAddress(address);
  const state = addressParts.state || "unknown";
  const isReturningCustomer = quote.input.customer?.isReturning ?? false;
  const includeRiskTier = options.includeRiskTier !== false;
  const riskScore = quote.modelOutputs?.riskScore ?? 0;
  const vehicle = quote.input.vehicle ?? {};
  const sessionKey = quote.input.session?.key || quote.id;
  const userKey = quote.input.user?.key || "user_unknown";

  const context = {
    kind: "multi",
    session: {
      key: sessionKey,
    },
    user: {
      key: userKey,
      name: quote.input.applicant?.fullName ?? "Unknown",
      age: quote.input.applicant?.age ?? 0,
      maritalStatus: quote.input.applicant?.maritalStatus ?? "unknown",
      numberOfKids: quote.input.applicant?.numberOfKids ?? 0,
      isReturningCustomer,
      quoteId: quote.id,
    },
    vehicle: {
      key:
        vehicle.vin ||
        `${vehicle.year || "unknown"}-${vehicle.make || "unknown"}-${
          vehicle.model || "unknown"
        }`,
      year: vehicle.year ?? 0,
      make: vehicle.make ?? "unknown",
      model: vehicle.model ?? "unknown",
      odometer: vehicle.odometer ?? 0,
      annualMileage: vehicle.annualMileage ?? 0,
      vinProvided: Boolean(vehicle.vin),
    },
    location: {
      key: getLocationKey(address),
      address: address || "unknown",
      street: addressParts.street,
      city: addressParts.city,
      state,
      zip: addressParts.zip,
    },
  };
  if (includeRiskTier) {
    context.user.riskTier = getRiskTier(riskScore);
  }
  return context;
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

// ---------------------------------------------------------------------------
// Shadow scoring invariants (decoupled, diagnostic-only)
//
// 1. Shadow risk and shadow pricing are evaluated independently. Shadow risk
//    must never feed into the pricing shadow call; shadow pricing always
//    receives assignedRiskVariant so it uses the assigned risk score.
// 2. Shadow results are diagnostic — they must never affect eligibility,
//    guardrails, offer construction, or lifecycle events.
// 3. derivePropensity exists so propensity can be recomputed from individual
//    shadow dimensions without coupling them through evaluateFakeModels.
// 4. All numeric values in shadowResults are rounded for presentation
//    (riskScore→1 dp, priceFactor/propensityScore→2 dp). Core computations
//    are untouched.
// ---------------------------------------------------------------------------

const derivePropensity = (riskScore, priceFactor) => {
  const nr = 1 - riskScore / 100;
  const np = 1 - (priceFactor - 0.8);
  return Number(Math.min(1, Math.max(0, (nr + np) / 2)).toFixed(2));
};

const computeShadowScoring = async (quote, assignedRiskVariant, assignedPricingVariant) => {
  const context = buildLaunchDarklyContext(quote, { includeRiskTier: false });
  const shadowRiskEnabled =
    process.env.SHADOW_RISK_SCORING_OVERRIDE === "true" ||
    (await getBooleanFlag("shadow-risk-scoring-enabled", context, false));
  const shadowPricingEnabled =
    process.env.SHADOW_PRICING_SCORING_OVERRIDE === "true" ||
    (await getBooleanFlag("shadow-pricing-scoring-enabled", context, false));

  if (!shadowRiskEnabled && !shadowPricingEnabled) {
    return null;
  }

  const assigned = quote.modelOutputs;
  const shadowRiskVariant = shadowRiskEnabled
    ? (assignedRiskVariant === "baseline" ? "alternate" : "baseline")
    : assignedRiskVariant;
  const shadowPricingVariant = shadowPricingEnabled
    ? (assignedPricingVariant === "baseline" ? "alternate" : "baseline")
    : assignedPricingVariant;

  const results = {
    shadowVariants: { risk: shadowRiskVariant, pricing: shadowPricingVariant },
    flags: { risk: shadowRiskEnabled, pricing: shadowPricingEnabled },
  };

  const roundN = (v, d) => Number(v.toFixed(d));

  let shadowRiskScore = assigned.riskScore;
  if (shadowRiskEnabled) {
    const riskShadow = evaluateFakeModels(quote.input, shadowRiskVariant, assignedPricingVariant);
    shadowRiskScore = riskShadow.riskScore;
    const a = roundN(assigned.riskScore, 1);
    const s = roundN(shadowRiskScore, 1);
    results.riskScore = { assigned: a, shadow: s, delta: roundN(s - a, 1) };
    results.riskTier = {
      assigned: getRiskTier(assigned.riskScore),
      shadow: getRiskTier(shadowRiskScore),
    };
  }

  let shadowPriceFactor = assigned.priceFactor;
  if (shadowPricingEnabled) {
    const priceShadow = evaluateFakeModels(quote.input, assignedRiskVariant, shadowPricingVariant);
    shadowPriceFactor = priceShadow.priceFactor;
    const a = roundN(assigned.priceFactor, 2);
    const s = roundN(shadowPriceFactor, 2);
    results.priceFactor = { assigned: a, shadow: s, delta: roundN(s - a, 2) };
  }

  const shadowPropensity = derivePropensity(shadowRiskScore, shadowPriceFactor);
  const pa = roundN(assigned.propensityScore, 2);
  const ps = roundN(shadowPropensity, 2);
  results.propensityScore = { assigned: pa, shadow: ps, delta: roundN(ps - pa, 2) };

  return results;
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
};

const completeQuote = (quote) => {
  quote.updateStatus(QUOTE_LIFECYCLE.COMPLETED);
  const completed = quote.eligibility?.eligible ?? false;
  const payload = {
    quoteId: quote.id,
    status: quote.status,
    completed,
  };
  if (!completed) {
    payload.completionReason = "ineligible";
  }
};

const runQuoteDecisionFlow = async (input) => {
  const quote = initializeQuote(input);
  const getContext = () => buildLaunchDarklyContext(quote);
  trackEvent(
    AnalyticsEvents.QUOTE_STARTED,
    {
      quoteId: quote.id,
      status: quote.status,
    },
    getContext()
  );
  const { riskModelVariant, pricingModelVariant } = await callFakeModels(quote);
  const shadowResults = await computeShadowScoring(quote, riskModelVariant, pricingModelVariant);
  const baseEligibility = evaluateEligibility(quote);
  const guardrails = await applyGuardrails(quote, baseEligibility);
  finalizeEligibility(quote, guardrails.eligibility);
  trackEvent(
    AnalyticsEvents.QUOTE_ELIGIBILITY_EVALUATED,
    {
      quoteId: quote.id,
      status: QUOTE_LIFECYCLE.ELIGIBILITY,
      eligible: guardrails.eligibility.eligible,
      reasons: guardrails.eligibility.reasons,
    },
    getContext()
  );
  const offerStrategy = await selectOfferStrategy(
    quote,
    guardrails.forcedOfferStrategy
  );
  const decisionSummary = {
    eligibility: {
      eligible: guardrails.eligibility.eligible,
      reasons: guardrails.eligibility.reasons,
    },
    guardrails: guardrails.guardrails,
    offerStrategy,
  };
  if (offerStrategy === "optimized") {
    const propensityScore = quote.modelOutputs?.propensityScore ?? 0;
    const upsellTriggered = propensityScore >= OPTIMIZED_PROPENSITY_THRESHOLD;
    decisionSummary.strategyDecision = {
      decision: upsellTriggered ? "upsell_triggered" : "upsell_not_triggered",
      reason: upsellTriggered
        ? "propensity_at_or_above_threshold"
        : "propensity_below_threshold",
      propensityScore,
      propensityThreshold: OPTIMIZED_PROPENSITY_THRESHOLD,
    };
  }
  decisionSummary.riskTier = getRiskTier(quote.modelOutputs?.riskScore ?? 0);
  decisionSummary.modelResultsSummary = {
    riskScore: quote.modelOutputs?.riskScore ?? 0,
    priceFactor: quote.modelOutputs?.priceFactor ?? 0,
    propensityScore: quote.modelOutputs?.propensityScore ?? 0,
    riskTier: decisionSummary.riskTier,
  };
  if (shadowResults) {
    decisionSummary.shadowResults = shadowResults;
  }
  decisionSummary.modelsScored = [
    { model: "risk", variant: riskModelVariant },
    { model: "price", variant: pricingModelVariant },
    { model: "propensity", variant: "baseline" },
  ];
  decisionSummary.modelScores = {
    riskScore: quote.modelOutputs?.riskScore ?? 0,
    priceFactor: quote.modelOutputs?.priceFactor ?? 0,
    propensityScore: quote.modelOutputs?.propensityScore ?? 0,
  };
  decisionSummary.riskFactors = buildRiskFactors(quote);
  quote.decisionSummary = decisionSummary;
  quote.ldContext = getContext();
  constructOfferStep(quote, offerStrategy);
  if (quote.offer) {
    trackEvent(
      AnalyticsEvents.QUOTE_OFFER_CONSTRUCTED,
      {
        quoteId: quote.id,
        status: QUOTE_LIFECYCLE.OFFER,
        offerStrategy,
        riskModelVariant,
        pricingModelVariant,
        coverageTier: quote.offer.coverageTier,
        price: quote.offer.price,
      },
      getContext()
    );
  }
  completeQuote(quote);
  const completed = quote.eligibility?.eligible ?? false;
  const completionPayload = {
    quoteId: quote.id,
    status: quote.status,
    completed,
    offerStrategy,
    riskModelVariant,
    pricingModelVariant,
  };
  if (!completed) {
    completionPayload.completionReason = "ineligible";
  }
  trackEvent(
    AnalyticsEvents.QUOTE_COMPLETED,
    completionPayload,
    getContext()
  );
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

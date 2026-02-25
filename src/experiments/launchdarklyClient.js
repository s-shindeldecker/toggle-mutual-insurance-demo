const DEFAULT_STRATEGY = "baseline";
const FLAG_KEY = "coverage-recommendation-strategy";

let initPromise = null;
let ldClient = null;

const initializeLaunchDarkly = () => {
  if (initPromise) {
    return initPromise;
  }

  const sdkKey = process.env.LAUNCHDARKLY_SDK_KEY;
  if (!sdkKey) {
    // Validation-only: warn when LD cannot initialize due to missing key.
    console.warn("[LD] LaunchDarkly disabled: LAUNCHDARKLY_SDK_KEY is missing.");
    initPromise = Promise.resolve(null);
    return initPromise;
  }

  let ldSdk;
  try {
    ldSdk = require("launchdarkly-node-server-sdk");
  } catch (error) {
    // Validation-only: warn when LD SDK is unavailable.
    console.warn("[LD] LaunchDarkly disabled: SDK module not available.");
    initPromise = Promise.resolve(null);
    return initPromise;
  }

  // Validation-only: log that LD initialization will run.
  console.log("[LD] LaunchDarkly enabled: initializing SDK.");
  ldClient = ldSdk.init(sdkKey);
  initPromise = ldClient
    .waitForInitialization()
    .then(() => ldClient)
    .catch(() => null);

  return initPromise;
};

const getOfferStrategyAssignment = async (context) => {
  const client = await initializeLaunchDarkly();
  if (!client) {
    // Validation-only: log fallback behavior.
    console.log(
      `[LD] Flag ${FLAG_KEY} fallback=${DEFAULT_STRATEGY} sessionKey=${context.session?.key || "unknown"}`
    );
    return DEFAULT_STRATEGY;
  }

  try {
    const variant = await client.variation(FLAG_KEY, context, DEFAULT_STRATEGY);
    // Validation-only: log evaluated value.
    console.log(
      `[LD] Flag ${FLAG_KEY} value=${variant} sessionKey=${context.session?.key || "unknown"}`
    );
    if (variant === "baseline" || variant === "optimized") {
      return variant;
    }
  } catch (error) {
    // Validation-only: log fallback on error.
    console.log(
      `[LD] Flag ${FLAG_KEY} fallback=${DEFAULT_STRATEGY} sessionKey=${context.session?.key || "unknown"}`
    );
    return DEFAULT_STRATEGY;
  }

  return DEFAULT_STRATEGY;
};

const getBooleanFlag = async (flagKey, context, defaultValue = true) => {
  const client = await initializeLaunchDarkly();
  if (!client) {
    // Validation-only: log fallback behavior.
    console.log(
      `[LD] Flag ${flagKey} fallback=${defaultValue} sessionKey=${context.session?.key || "unknown"}`
    );
    return defaultValue;
  }

  try {
    const value = await client.variation(flagKey, context, defaultValue);
    // Validation-only: log evaluated value.
    console.log(
      `[LD] Flag ${flagKey} value=${value} sessionKey=${context.session?.key || "unknown"}`
    );
    return typeof value === "boolean" ? value : defaultValue;
  } catch (error) {
    // Validation-only: log fallback on error.
    console.log(
      `[LD] Flag ${flagKey} fallback=${defaultValue} sessionKey=${context.session?.key || "unknown"}`
    );
    return defaultValue;
  }
};

const getStringFlag = async (flagKey, context, defaultValue = "") => {
  const client = await initializeLaunchDarkly();
  if (!client) {
    // Validation-only: log fallback behavior.
    console.log(
      `[LD] Flag ${flagKey} fallback=${defaultValue} sessionKey=${context.session?.key || "unknown"}`
    );
    return defaultValue;
  }

  try {
    const value = await client.variation(flagKey, context, defaultValue);
    // Validation-only: log evaluated value.
    console.log(
      `[LD] Flag ${flagKey} value=${value} sessionKey=${context.session?.key || "unknown"}`
    );
    return typeof value === "string" ? value : defaultValue;
  } catch (error) {
    // Validation-only: log fallback on error.
    console.log(
      `[LD] Flag ${flagKey} fallback=${defaultValue} sessionKey=${context.session?.key || "unknown"}`
    );
    return defaultValue;
  }
};

module.exports = {
  DEFAULT_STRATEGY,
  FLAG_KEY,
  initializeLaunchDarkly,
  getOfferStrategyAssignment,
  getBooleanFlag,
  getStringFlag,
};

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
    initPromise = Promise.resolve(null);
    return initPromise;
  }

  let ldSdk;
  try {
    ldSdk = require("launchdarkly-node-server-sdk");
  } catch (error) {
    initPromise = Promise.resolve(null);
    return initPromise;
  }

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
    return DEFAULT_STRATEGY;
  }

  try {
    const variant = await client.variation(FLAG_KEY, context, DEFAULT_STRATEGY);
    if (variant === "baseline" || variant === "optimized") {
      return variant;
    }
  } catch (error) {
    return DEFAULT_STRATEGY;
  }

  return DEFAULT_STRATEGY;
};

const getBooleanFlag = async (flagKey, context, defaultValue = true) => {
  const client = await initializeLaunchDarkly();
  if (!client) {
    return defaultValue;
  }

  try {
    const value = await client.variation(flagKey, context, defaultValue);
    return typeof value === "boolean" ? value : defaultValue;
  } catch (error) {
    return defaultValue;
  }
};

module.exports = {
  DEFAULT_STRATEGY,
  FLAG_KEY,
  initializeLaunchDarkly,
  getOfferStrategyAssignment,
  getBooleanFlag,
};

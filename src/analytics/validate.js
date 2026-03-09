const { QUOTE_LIFECYCLE } = require("./lifecycle");

const VALID_STAGES = new Set(Object.values(QUOTE_LIFECYCLE));

const isValidLifecycleStage = (stage) => VALID_STAGES.has(stage);

const assertValidLifecycleStage = (stage) => {
  if (!isValidLifecycleStage(stage)) {
    console.warn(
      `[analytics] Invalid lifecycle stage "${stage}". ` +
      `Allowed: ${[...VALID_STAGES].join(", ")}`
    );
  }
};

module.exports = { isValidLifecycleStage, assertValidLifecycleStage };

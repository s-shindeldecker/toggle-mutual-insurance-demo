// Validation-only: load .env for LaunchDarkly connectivity checks.
require("dotenv").config();

const { runQuoteDecisionFlow } = require("../quote");
const { eventEmitter } = require("../analytics/eventEmitter");

const run = async () => {
  const ldEnabled = Boolean(process.env.LAUNCHDARKLY_SDK_KEY);
  // Validation-only: log LD status on startup.
  console.log(`[LD] LD_ENABLED=${ldEnabled}`);
  console.log(`[LD] LaunchDarkly init will ${ldEnabled ? "" : "not "}run.`);

  const quoteInput = {
    applicant: {
      age: 32,
      state: "CA",
    },
    vehicle: {
      year: 2018,
      annualMileage: 12000,
    },
    customer: {
      isReturning: true,
    },
  };

  const quote = await runQuoteDecisionFlow(quoteInput);
  const events = eventEmitter.getEmittedEvents();

  console.log("Final Quote:");
  console.log(JSON.stringify(quote, null, 2));
  console.log("\nDecision Summary:");
  console.log(JSON.stringify(quote.decisionSummary, null, 2));
  console.log("\nAnalytics Events (in order):");
  console.log(JSON.stringify(events, null, 2));
};

run().catch((error) => {
  console.error("Quote run failed:", error);
  process.exitCode = 1;
});

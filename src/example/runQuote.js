const { runQuoteDecisionFlow } = require("../quote");
const { eventEmitter } = require("../analytics/eventEmitter");

const run = async () => {
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

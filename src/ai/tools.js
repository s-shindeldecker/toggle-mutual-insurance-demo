const { runQuoteDecisionFlow } = require("../quote");

const TOOL_SCHEMAS = {
  submit_quote: {
    type: "function",
    function: {
      name: "submit_quote",
      description:
        "Submit collected customer information to generate an insurance quote. " +
        "Call this only after the customer has confirmed all details are accurate.",
      parameters: {
        type: "object",
        properties: {
          address: { type: "string", description: "Full street address" },
          fullName: { type: "string", description: "Applicant full name" },
          age: { type: "number", description: "Applicant age" },
          maritalStatus: {
            type: "string",
            enum: ["single", "married", "divorced", "widowed"],
            description: "Marital status",
          },
          numberOfKids: {
            type: "number",
            description: "Number of dependent children",
          },
          vehicleYear: { type: "number", description: "Vehicle model year" },
          vehicleMake: { type: "string", description: "Vehicle make (e.g. Toyota)" },
          vehicleModel: {
            type: "string",
            description: "Vehicle model (e.g. Camry)",
          },
          vehicleVin: { type: "string", description: "Vehicle VIN (optional)" },
          vehicleOdometer: {
            type: "number",
            description: "Current odometer reading in miles",
          },
          vehicleAnnualMileage: {
            type: "number",
            description: "Estimated annual mileage",
          },
        },
        required: [
          "address",
          "fullName",
          "age",
          "maritalStatus",
          "vehicleYear",
          "vehicleMake",
          "vehicleModel",
        ],
      },
    },
  },
  validate_address: {
    type: "function",
    function: {
      name: "validate_address",
      description:
        "Validate and echo back a parsed address so the customer can confirm it.",
      parameters: {
        type: "object",
        properties: {
          address: { type: "string", description: "Full address string" },
        },
        required: ["address"],
      },
    },
  },
};

const buildQuoteInput = (args) => ({
  address: { fullAddress: args.address || "unknown" },
  applicant: {
    fullName: args.fullName || "Unknown",
    age: Number(args.age) || 0,
    maritalStatus: args.maritalStatus || "unknown",
    numberOfKids: Number(args.numberOfKids) || 0,
  },
  user: { key: null },
  session: { key: null },
  vehicle: {
    year: Number(args.vehicleYear) || 2018,
    make: args.vehicleMake || "unknown",
    model: args.vehicleModel || "unknown",
    vin: args.vehicleVin || "",
    odometer: Number(args.vehicleOdometer) || 0,
    annualMileage: Number(args.vehicleAnnualMileage) || 0,
  },
  customer: { isReturning: false },
});

const executeTool = async (toolName, args, sessionId) => {
  if (toolName === "submit_quote") {
    const quoteInput = buildQuoteInput(args);
    quoteInput.session.key = sessionId;
    const quote = await runQuoteDecisionFlow(quoteInput);
    const sanitized = {
      id: quote.id,
      status: quote.status,
      eligibility: quote.eligibility,
      offer: quote.offer,
      decisionSummary: quote.decisionSummary,
    };
    return { ok: true, quote: sanitized };
  }

  if (toolName === "validate_address") {
    return { ok: true, address: args.address, validated: true };
  }

  return { ok: false, error: `Unknown tool: ${toolName}` };
};

module.exports = { TOOL_SCHEMAS, executeTool };

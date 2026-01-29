let nextQuoteId = 1;

class Quote {
  constructor(input) {
    this.id = `quote_${nextQuoteId}`;
    nextQuoteId += 1;
    this.input = input;
    this.status = "initialized";
    this.createdAt = new Date().toISOString();
    this.eligibility = null;
    this.modelOutputs = null;
    this.offer = null;
    this.decisionSummary = null;
  }

  updateStatus(status) {
    this.status = status;
  }
}

module.exports = {
  Quote,
};

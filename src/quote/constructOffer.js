const constructOffer = (modelOutputs, offerStrategy = "baseline") => {
  const basePremium = 100;
  const priceFactor = modelOutputs?.priceFactor ?? 1;
  const propensityScore = modelOutputs?.propensityScore ?? 0;
  const optimizedThreshold = 0.6;
  const coverageTier =
    offerStrategy === "optimized" && propensityScore >= optimizedThreshold
      ? "enhanced"
      : "baseline";

  return {
    price: Number((basePremium * priceFactor).toFixed(2)),
    currency: "USD",
    coverageTier,
  };
};

module.exports = {
  constructOffer,
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const deterministicScore = (seed) => {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) % 1000;
  }
  return hash / 10;
};

const riskScoreModel = (quoteInput) => {
  const age = quoteInput.applicant?.age ?? 0;
  const state = quoteInput.applicant?.state ?? "unknown";
  const seed = `${age}-${state}`;
  const score = deterministicScore(seed);
  return clamp(score, 1, 99);
};

const priceFactorModel = (quoteInput) => {
  const vehicleYear = quoteInput.vehicle?.year ?? 2000;
  const mileage = quoteInput.vehicle?.annualMileage ?? 12000;
  const seed = `${vehicleYear}-${mileage}`;
  const base = 0.8 + deterministicScore(seed) / 200;
  return Number(clamp(base, 0.8, 1.8).toFixed(2));
};

const propensityScoreModel = (riskScore, priceFactor) => {
  const normalizedRisk = 1 - riskScore / 100;
  const normalizedPrice = 1 - (priceFactor - 0.8) / 1.0;
  const score = (normalizedRisk + normalizedPrice) / 2;
  return Number(clamp(score, 0, 1).toFixed(2));
};

const evaluateFakeModels = (quoteInput) => {
  const riskScore = riskScoreModel(quoteInput);
  const priceFactor = priceFactorModel(quoteInput);
  const propensityScore = propensityScoreModel(riskScore, priceFactor);

  return {
    riskScore,
    priceFactor,
    propensityScore,
  };
};

module.exports = {
  evaluateFakeModels,
};

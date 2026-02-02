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
  const vehicleType = quoteInput.vehicle?.type ?? "sedan";
  const annualMileage = quoteInput.vehicle?.annualMileage ?? 8000;
  const typeBase = {
    sedan: 20,
    suv: 30,
    truck: 35,
    sports: 50,
  }[vehicleType] ?? 25;
  const mileageFactor = annualMileage > 10000 ? 20 : annualMileage >= 5000 ? 10 : 0;
  const ageFactor = age < 25 ? 15 : age < 40 ? 5 : 0;
  const seed = `${state}-${vehicleType}-${annualMileage}`;
  const stateNudge = deterministicScore(seed) % 10;
  const score = typeBase + mileageFactor + ageFactor + stateNudge;
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

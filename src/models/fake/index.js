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
  const maritalStatus = quoteInput.applicant?.maritalStatus ?? "unknown";
  const numberOfKids = quoteInput.applicant?.numberOfKids ?? 0;
  const address = quoteInput.address?.fullAddress ?? "unknown";
  const vehicleYear = quoteInput.vehicle?.year ?? 2015;
  const vehicleMake = quoteInput.vehicle?.make ?? "unknown";
  const vehicleModel = quoteInput.vehicle?.model ?? "unknown";
  const vehicleVin = quoteInput.vehicle?.vin ?? "";
  const odometer = quoteInput.vehicle?.odometer ?? 0;
  const annualMileage = quoteInput.vehicle?.annualMileage ?? 0;

  const base = 25;
  const ageFactor = age < 25 ? 18 : age < 35 ? 8 : age < 50 ? 4 : 0;
  const maritalFactor = maritalStatus === "married" ? -4 : maritalStatus === "single" ? 4 : 0;
  const kidsFactor = Math.min(numberOfKids, 3) * -2;
  const vehicleYearFactor = vehicleYear < 2010 ? 10 : vehicleYear < 2015 ? 5 : 0;
  const odometerFactor = odometer > 100000 ? 10 : odometer > 60000 ? 5 : 0;
  const mileageFactor =
    annualMileage > 15000 ? 15 : annualMileage > 10000 ? 8 : annualMileage > 5000 ? 3 : 0;
  const vinFactor = vehicleVin ? 0 : 6;
  const seed = `${address}-${vehicleMake}-${vehicleModel}-${vehicleYear}`;
  const locationNudge = deterministicScore(seed) % 10;

  const score =
    base +
    ageFactor +
    maritalFactor +
    kidsFactor +
    vehicleYearFactor +
    odometerFactor +
    mileageFactor +
    vinFactor +
    locationNudge;
  return clamp(score, 1, 99);
};

const riskScoreModelAlternate = (quoteInput) => {
  const age = quoteInput.applicant?.age ?? 0;
  const maritalStatus = quoteInput.applicant?.maritalStatus ?? "unknown";
  const numberOfKids = quoteInput.applicant?.numberOfKids ?? 0;
  const address = quoteInput.address?.fullAddress ?? "unknown";
  const vehicleYear = quoteInput.vehicle?.year ?? 2015;
  const vehicleMake = quoteInput.vehicle?.make ?? "unknown";
  const vehicleModel = quoteInput.vehicle?.model ?? "unknown";
  const vehicleVin = quoteInput.vehicle?.vin ?? "";
  const odometer = quoteInput.vehicle?.odometer ?? 0;
  const annualMileage = quoteInput.vehicle?.annualMileage ?? 0;

  const base = 30;
  const ageFactor = age < 25 ? 22 : age < 35 ? 12 : age < 50 ? 6 : 2;
  const maritalFactor = maritalStatus === "married" ? -6 : maritalStatus === "single" ? 6 : 1;
  const kidsFactor = Math.min(numberOfKids, 3) * -1;
  const vehicleYearFactor = vehicleYear < 2010 ? 12 : vehicleYear < 2015 ? 6 : 2;
  const odometerFactor = odometer > 120000 ? 12 : odometer > 80000 ? 6 : 2;
  const mileageFactor =
    annualMileage > 18000 ? 18 : annualMileage > 12000 ? 10 : annualMileage > 7000 ? 4 : 1;
  const vinFactor = vehicleVin ? 0 : 8;
  const seed = `${address}-${vehicleMake}-${vehicleModel}-${vehicleYear}-alt`;
  const locationNudge = deterministicScore(seed) % 12;

  const score =
    base +
    ageFactor +
    maritalFactor +
    kidsFactor +
    vehicleYearFactor +
    odometerFactor +
    mileageFactor +
    vinFactor +
    locationNudge;
  return clamp(score, 1, 99);
};

const priceFactorModel = (quoteInput) => {
  const vehicleYear = quoteInput.vehicle?.year ?? 2000;
  const mileage = quoteInput.vehicle?.annualMileage ?? 12000;
  const seed = `${vehicleYear}-${mileage}`;
  const base = 0.8 + deterministicScore(seed) / 200;
  return Number(clamp(base, 0.8, 1.8).toFixed(2));
};

const priceFactorModelAlternate = (quoteInput, riskScore) => {
  const baseFactor = priceFactorModel(quoteInput);
  const riskMultiplier =
    riskScore >= 80
      ? 1.25
      : riskScore >= 60
        ? 1.12
        : riskScore >= 40
          ? 1.02
          : 0.95;
  const adjusted = baseFactor * riskMultiplier;
  return Number(clamp(adjusted, 0.8, 2.0).toFixed(2));
};

const propensityScoreModel = (riskScore, priceFactor) => {
  const normalizedRisk = 1 - riskScore / 100;
  const normalizedPrice = 1 - (priceFactor - 0.8) / 1.0;
  const score = (normalizedRisk + normalizedPrice) / 2;
  return Number(clamp(score, 0, 1).toFixed(2));
};

const evaluateFakeModels = (
  quoteInput,
  riskModelVariant = "baseline",
  pricingModelVariant = "baseline"
) => {
  const riskScore =
    riskModelVariant === "alternate"
      ? riskScoreModelAlternate(quoteInput)
      : riskScoreModel(quoteInput);
  const priceFactor =
    pricingModelVariant === "alternate"
      ? priceFactorModelAlternate(quoteInput, riskScore)
      : priceFactorModel(quoteInput);
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

/* ================================================================
   FINANCE / INSURANCE MATH
   Ported from the original linear assessment (index.html):
   getExShowroom(), updateAffordabilitySliders()/buildFinanceEstimates(),
   buildInsuranceEstimates(). Kept as pure functions here (no DOM), same
   formulas and same rounding behaviour.
================================================================ */

// Budget midpoints as an ex-showroom fallback when there's no selected
// vehicle to price from yet (mirrors the old getExShowroom()'s budgetMap).
export const BUDGET_MIDPOINT_LAKH = {
  under_10: 8.5, '10_15': 11, '15_25': 17, '25_40': 30, above_40: 45,
};

/** Ex-showroom price in lakh — prefers the selected/first vehicle's price_min, falls back to the budget midpoint. */
export function getExShowroomLakh(vehicle, budgetKey) {
  if (vehicle && vehicle.price_min != null) return vehicle.price_min;
  return BUDGET_MIDPOINT_LAKH[budgetKey] || 15;
}

/** On-road = ex-showroom + ~15% (registration, insurance, taxes) — same 1.15 multiplier as the old app. */
export function computeOnRoadLakh(exShowroomLakh) {
  return Math.round(exShowroomLakh * 1.15 * 10) / 10;
}

/** Standard reducing-balance EMI formula, identical to updateAffordabilitySliders()/buildFinanceEstimates(). */
export function computeEmi({ onRoadLakh, downPaymentLakh, tenureYears, ratePct }) {
  const loanAmt = Math.max(onRoadLakh - downPaymentLakh, 0);
  const months = tenureYears * 12;
  const rate = ratePct / 100 / 12;
  if (months <= 0 || loanAmt <= 0) return 0;
  const emi = (loanAmt * 100000 * rate * Math.pow(1 + rate, months)) / (Math.pow(1 + rate, months) - 1);
  return Math.round(emi);
}

/** First-year insurance premium breakdown — identical formula to buildInsuranceEstimates(). */
export function computeInsurancePremium({ onRoadLakh, existingNcb, insurancePreference }) {
  const ncbMap = { yes_high: 0.35, yes_low: 0.2, no: 0, na: 0 };
  const ncb = ncbMap[existingNcb] || 0;
  const isZeroDep = insurancePreference === 'zero_dep';

  const idv = onRoadLakh * 100000;
  let premium = idv * (1.8 / 100);
  premium = premium * (1 - ncb);
  if (isZeroDep) premium = premium * 1.17;
  premium = Math.round(premium / 1000) * 1000;

  const gst = Math.round(premium * 0.18);
  const total = premium + gst;

  const coverageLabel = insurancePreference === 'zero_dep' ? 'Zero Depreciation'
    : insurancePreference === 'basic' ? 'Comprehensive'
      : 'Comprehensive + Zero Dep recommended';

  return { idv, premium, gst, total, ncb, coverageLabel };
}

// Slider defaults — same starting points as the old app's showAffordabilitySliders().
export const DEFAULT_TENURE_YEARS = 5;
export const DEFAULT_RATE_PCT = 8.5;
export const INCOME_BANDS = ['Under ₹50K', '₹50K–₹1L', '₹1–2L', 'Above ₹2L'];
export const INCOME_BAND_KEYS = ['under_50k', '50_1l', '1_2l', 'above_2l'];
export const DEFAULT_INCOME_IDX = 2; // ₹1–2L

/**
 * Overall "buying readiness" score for the Buying Kit — ported from
 * computeReadiness() in index.html. Field-for-field identical where our
 * answers use the same shape (parking, own_rent, residence,
 * charging_confidence, existing_chargers, test_drive, booking_timeline,
 * payment_mode all match exactly).
 *
 * One deliberate adaptation: the original checks a categorical
 * `down_payment` answer ('3_5l' / 'above_5l') that doesn't exist in this
 * app — our Loan/EMI flow captures `down_payment_lakh` as a number from a
 * slider instead. Reworked the same bonus using a numeric threshold
 * (>=3 lakh) that lands on the same two original categories.
 */
export function computeReadiness(answers) {
  const a = answers;
  let score = 45;

  // Parking & charging confidence
  if (a.parking === 'yes_covered' || a.parking === 'yes_open') score += 15;
  if (a.own_rent === 'own' || a.own_rent === 'family') score += 8;
  if (['independent', 'gated_villa'].includes(a.residence)) score += 5;
  if (a.charging_confidence === 'very' || a.charging_confidence === 'some' || a.charging_confidence === 'dealer') score += 7;
  if (a.existing_chargers === 'yes') score += 6;

  // Showroom readiness
  if (a.test_drive === 'yes_multiple') score += 8;
  else if (a.test_drive === 'yes_one') score += 5;
  if (a.booking_timeline === 'this_month') score += 5;
  else if (a.booking_timeline === '3_months') score += 3;

  // Financial readiness
  if (a.payment_mode === 'full_cash') score += 4;
  if (a.down_payment_lakh != null && a.down_payment_lakh >= 3) score += 3;

  return Math.min(score, 97);
}

export function readinessLabel(score) {
  if (score >= 80) return 'Very ready to buy';
  if (score >= 65) return 'Getting close';
  return 'Good start — a few things to sort';
}

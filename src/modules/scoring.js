/* ================================================================
   Mirrors handleRecommend() / formatVehicle() in assessment-v3-worker.js.
   Kept deliberately identical (constants, weights, formula) so results
   here match what the same answers would score server-side — this only
   exists client-side because /api/v3/recommend has no way to restrict
   scoring to a specific set of vehicle ids (the user's 5 ticked picks).
   If the worker's weights/formula ever change, update both places.
================================================================ */

const RANGE_FLOOR = {
  under_30: 75,
  '30_60': 150,
  '60_100': 250,
  above_100: 350,
};

const USAGE_ALIGN = {
  city_commute: ['city_commute'],
  family: ['family', 'mixed'],
  highway: ['highway', 'mixed'],
  mixed: ['mixed', 'city_commute', 'family', 'highway'],
};

const TIER1_CITIES = ['bengaluru', 'mumbai', 'delhi_ncr', 'hyderabad', 'chennai', 'pune'];
const WEIGHTS = { priority: 0.40, usage: 0.30, value: 0.20, city: 0.10 };

function buildWhy(vehicle, answers) {
  const headroom = vehicle.range_realworld_km - (RANGE_FLOOR[answers.daily_distance] || 150);
  const usageLabel = {
    city_commute: 'city commuting',
    family: 'family use',
    highway: 'highway driving',
    mixed: 'mixed city and highway use',
  }[answers.usage] || 'your driving needs';

  const priorityLines = {
    range: `${vehicle.range_realworld_km} km real-world range — ${headroom} km above your daily buffer.`,
    performance: `Strong performance figures and instant torque for a confident drive.`,
    space: `Generous cabin and ${vehicle.boot_litres ? vehicle.boot_litres + ' L boot' : 'practical boot'} for ${usageLabel}.`,
    tech: `${vehicle.score_tech >= 9 ? 'Class-leading' : 'Strong'} tech package with connected features and ADAS.`,
    value: `Excellent value at ₹${vehicle.price_min}–${vehicle.price_max} L with ${vehicle.range_realworld_km} km real-world range.`,
  }[answers.priority] || vehicle.highlight;

  return `${priorityLines} ${vehicle.highlight || ''}`.trim();
}

/**
 * Scores a restricted subset of vehicles (the user's shortlist) against
 * their personalize answers, returning up to 3, ranked, with the same
 * matchPct/topPick/why shape as the worker's formatVehicle().
 */
export function scoreShortlist(vehicles, answers) {
  const { usage, priority, city } = answers;
  const userCity = city || 'other_metro';
  const isTier1 = TIER1_CITIES.includes(userCity);
  const usageKeys = USAGE_ALIGN[usage] || ['mixed'];

  const scored = vehicles.map((v) => {
    const priorityScore = {
      range: v.score_range,
      performance: v.score_performance,
      space: v.score_space,
      tech: v.score_tech,
      value: v.score_value,
    }[priority] ?? 5;

    const goodFor = v.good_for_usage || [];
    const usageMatches = usageKeys.filter((k) => goodFor.includes(k)).length;
    const usageScore = Math.min(10, (usageMatches / Math.max(usageKeys.length, 1)) * 10);

    const valueScore = v.score_value;

    const serviceCities = v.service_cities || [];
    const cityScore = serviceCities.includes(userCity) ? 10 : isTier1 ? 6 : 3;

    const total =
      (priorityScore * WEIGHTS.priority) +
      (usageScore * WEIGHTS.usage) +
      (valueScore * WEIGHTS.value) +
      (cityScore * WEIGHTS.city);

    return { vehicle: v, score: total };
  });

  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, 3);

  const maxPossible = 10;
  return top.map((item, idx) => {
    const rawPct = Math.round((item.score / maxPossible) * 100);
    const matchPct = Math.max(70, Math.min(99, rawPct + (idx === 0 ? 2 : 0)));
    return {
      ...item.vehicle,
      matchPct,
      topPick: idx === 0,
      why: buildWhy(item.vehicle, answers),
    };
  });
}

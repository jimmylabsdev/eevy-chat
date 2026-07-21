const BASE_URL = import.meta.env.VITE_WORKER_BASE_URL || '';

export function genSessionId() {
  return 'eevy_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
}

/** Every response from assessment-v3-worker.js is wrapped { success, result }
 *  or { success:false, error }. Unwrap here once, so callers just get data. */
async function unwrap(res, path) {
  let json;
  try {
    json = await res.json();
  } catch {
    throw new Error(`Worker ${path} returned non-JSON (status ${res.status})`);
  }
  if (!res.ok || json.success === false) {
    throw new Error(json.error || `Worker ${path} failed (${res.status})`);
  }
  return json.result ?? null;
}

async function post(path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return unwrap(res, path);
}

async function get(path, params = {}) {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${BASE_URL}${path}${qs ? `?${qs}` : ''}`);
  return unwrap(res, path);
}

/**
 * Incremental save — POST /api/v3/save
 * Fields must be flat, top-level, matching SAVE_FIELDS allowlist in the
 * worker exactly (budget, city, usage, ... ). Anything not on that
 * allowlist is silently ignored server-side, so no harm sending extra
 * client-only state — just don't nest it under "answers".
 */
export function saveAssessment(sessionId, answers, markComplete = false) {
  return post('/api/v3/save', {
    session_id: sessionId,
    ...answers,
    mark_complete: markComplete,
  });
}

/**
 * POST /api/v3/journey (2026-07-19) — writes ONE row per completed flow to
 * user_journey_events. Only ever called with event_type one of
 * 'variant_reached' | 'emi_calculated' | 'insurance_calculated' — see
 * ChatThread.jsx/VariantsPopup.jsx/AffordabilityScreen.jsx/
 * InsuranceScreen.jsx for exactly where each fires. Fire-and-forget, same
 * as saveAssessment — a failed journey-log should never block or visibly
 * disrupt the person's actual flow.
 */
export function logJourneyEvent(sessionId, event) {
  return post('/api/v3/journey', {
    session_id: sessionId,
    ...event,
  }).catch((e) => {
    console.warn('[eevy] journey event log failed:', e.message);
    return null; // caller checks for a truthy .ref before using it
  });
}

/**
 * POST /api/v3/journey-save (2026-07-19) — called once, right after
 * Firebase confirms the person's phone. ref is the client_ref
 * logJourneyEvent() returned when the emi_calculated/insurance_calculated
 * row was written; phone is the verified E.164 number. Fire-and-forget,
 * same as everything else here — a failed confirm shouldn't block the
 * "you're saved" message from showing (the leads-table push alongside
 * this is the more important of the two writes). Resolves to
 * { matchedCount } on success — 1 means the row was actually found and
 * updated, 0 means the PATCH "succeeded" (200 OK) but touched nothing,
 * which looks identical to a real success unless you check this.
 */
export function confirmJourneySave(ref, phone) {
  return post('/api/v3/journey-save', { ref, phone }).catch((e) => {
    console.warn('[eevy] journey save confirm failed:', e.message);
    return null;
  });
}

/**
 * POST /api/v3/my-journeys (2026-07-21) — the dashboard's read route.
 * Fetches every saved, non-hidden journey row for a phone number. Called
 * only after Firebase OTP verification succeeds — see the worker's own
 * comment on handleMyJourneys for the access-control tradeoff being made.
 * Resolves to { journeys: [...] } — raw rows, no vehicle/variant/partner
 * details joined in (the dashboard cross-references those client-side via
 * fetchVehicles()/fetchVariants()/fetchLoanPartners()/
 * fetchInsurancePartners(), already cached for the session).
 */
export function fetchMyJourneys(phone) {
  return post('/api/v3/my-journeys', { phone });
}

/**
 * POST /api/v3/journey-hide (2026-07-21) — the dashboard's "delete"
 * action. Soft delete only: flips hidden_by_user=true on one row by its
 * client_ref. The row stays intact for Ram's own journey analytics —
 * this only hides it from the person's own saved-journeys list.
 */
export function hideJourney(ref) {
  return post('/api/v3/journey-hide', { ref });
}

/**
 * POST /api/v3/partner-click (2026-07-19) — fires only on an explicit
 * "Select" tap inside a partner's detail popup (PartnerTiles.jsx), in
 * BOTH the standalone directory screens and the calculator flow's
 * lender/provider stage. Deliberately no session_id — this is a raw
 * append-only click count, not a per-session journey row.
 */
export function logPartnerClick(partnerKey, partnerType) {
  return post('/api/v3/partner-click', {
    partner_key: partnerKey,
    partner_type: partnerType,
  }).catch((e) => {
    console.warn('[eevy] partner click log failed:', e.message);
  });
}

/**
 * GET /api/v3/vehicles — raw active catalogue, no session_id, no scoring.
 * Client filters/scores locally from here. Fetch once per session and
 * cache — this is the intended pattern per the worker's own comments.
 */
export function fetchVehicles() {
  return get('/api/v3/vehicles');
}

/**
 * POST /api/v3/recommend — scored top-3, needs budget/usage/daily_distance/
 * priority/city flat at top level (not nested). Marked "no longer called by
 * main flow" in the worker but explicitly left in place and working — used
 * here for the ev-personalize module's reward, which is exactly the point
 * this much signal becomes available.
 */
export function fetchRecommendation(sessionId, answers) {
  const { budget, usage, daily_distance, priority, city } = answers;
  return post('/api/v3/recommend', {
    session_id: sessionId,
    budget, usage, daily_distance, priority, city,
  });
}

/** POST /api/v3/notify — flat fields, forwards to Make.com. No DB write. */
export function notify(sessionId, { name, email, phone, guideHtml }) {
  return post('/api/v3/notify', {
    session_id: sessionId,
    name: name || null,
    email,
    phone: phone || null,
    guide_html: guideHtml || null,
  });
}

/**
 * POST /api/lead — contract confirmed against index.html's saveLeadData().
 * The real endpoint has no "context" field (that was a guess in an earlier
 * pass) — it expects these specific fields, each null if not yet known.
 * `answers` is optional and only meaningfully populated for later calls
 * (e.g. the email-capture gate, by which point some of these have been
 * answered); the very first name-capture call will send them all null,
 * same as index.html does before its own questions are answered.
 */
export function saveLead(sessionId, { name, email, phone, answers } = {}) {
  const a = answers || {};
  return post('/api/lead', {
    session_id: sessionId,
    name: name || null,
    email: email || null,
    phone: phone || null,
    purchase_timeline: a.booking_timeline || null,
    charging_confidence: a.charging_confidence || null,
    ev_shortlisted: !!a.selected_vehicle_id,
    test_driven: a.test_drive || null,
    current_vehicle: a.current_vehicle || null,
    replacement_type: a.replacement_additional || null,
    budget_range: a.budget || null,
  });
}

/**
 * GET /api/partners/loans and /api/partners/insurance — live partner
 * tiles data, same { success, result: [...] } shape as every other worker
 * endpoint, so this reuses the existing get()/unwrap() plumbing rather
 * than the old app's separate hardcoded-URL fetch. Ported from
 * fetchLoanPartners()/fetchInsurancePartners() in index.html — same
 * "no fallback/dummy content, empty array hides the section" behavior on
 * failure, handled by the caller.
 */
// Cached module-level, same as fetchLoanPartners()/fetchInsurancePartners()
// in index.html — without this, every mount of PartnerTiles (i.e. every
// visit to the Loan/EMI or Insurance screen, including each step of a
// Buying Kit run) was hitting the network again for data that's realistically
// static for the whole session. Session-lifetime cache + in-flight-promise
// dedup, so two near-simultaneous mounts don't double-fetch either.
let _loanPartnersCache = null;
let _loanPartnersPromise = null;
export function fetchLoanPartners() {
  if (_loanPartnersCache) return Promise.resolve(_loanPartnersCache);
  if (_loanPartnersPromise) return _loanPartnersPromise;
  _loanPartnersPromise = get('/api/partners/loans')
    .then((result) => { _loanPartnersCache = result; return result; })
    .finally(() => { _loanPartnersPromise = null; });
  return _loanPartnersPromise;
}

let _insurancePartnersCache = null;
let _insurancePartnersPromise = null;
export function fetchInsurancePartners() {
  if (_insurancePartnersCache) return Promise.resolve(_insurancePartnersCache);
  if (_insurancePartnersPromise) return _insurancePartnersPromise;
  _insurancePartnersPromise = get('/api/partners/insurance')
    .then((result) => { _insurancePartnersCache = result; return result; })
    .finally(() => { _insurancePartnersPromise = null; });
  return _insurancePartnersPromise;
}

/**
 * GET /api/v3/variants — full ev_variants table (is_active=true only,
 * server-side filtered), confirmed against the actual assessment-v3-worker.js
 * source (2026-07-19). Wrapped the same way as its sibling /api/v3/vehicles
 * route in that same file — NOT a bare array like the partners routes below:
 *   GET /api/v3/variants -> { success, result: { variants: [
 *     { id, vehicle_id, variant, battery_kwh, claimed_range_km,
 *       ex_showroom_price_lakh, key_features, availability_status }, ...
 *   ] } }
 * Prefetched once and cached for the session (whole table, not scoped to
 * one vehicle_id) — caller unwraps `.variants` and filters by vehicle_id
 * locally, same pattern as ChatThread's getCachedVehicles() does for
 * fetchVehicles()'s `{ vehicles: [...] }`. `vehicle_id` joins to `vehicles.id`.
 */
let _variantsCache = null;
let _variantsPromise = null;
export function fetchVariants() {
  if (_variantsCache) return Promise.resolve(_variantsCache);
  if (_variantsPromise) return _variantsPromise;
  _variantsPromise = get('/api/v3/variants')
    .then((result) => { _variantsCache = result; return result; })
    .finally(() => { _variantsPromise = null; });
  return _variantsPromise;
}

/** Same list/feature window check as isWithinWindow() in index.html. */
export function isWithinWindow(startStr, endStr) {
  const now = new Date();
  if (startStr && new Date(startStr) > now) return false;
  if (endStr && new Date(endStr) < now) return false;
  return true;
}

/** Same isFeaturedNow() as index.html — 'featured' flag gated by an optional feature window. */
export function isFeaturedNow(partner) {
  if (!partner.featured) return false;
  return isWithinWindow(partner.feature_start, partner.feature_end);
}

/* ── Client-side budget filter, mirroring BUDGET_MAX in the worker ──
   Used for the ev-budget / ev-budget-list modules' rewards (raw catalogue
   -> budget-fit list), before enough signal exists for the full /recommend
   scoring pass. Each band has both a floor and a ceiling — a vehicle only
   counts for the band its price_min actually falls into, not every band
   below it too. Bounds are (min, max]: a car priced exactly at a band's
   floor belongs to that band, not the one below. */
const BUDGET_RANGES = {
  under_10: { min: 0, max: 10 },
  '10_15': { min: 10, max: 15 },
  '15_25': { min: 15, max: 25 },
  '25_40': { min: 25, max: 40 },
  above_40: { min: 40, max: Infinity },
};

export function filterVehiclesByBudget(vehicles, budgetKey) {
  const range = BUDGET_RANGES[budgetKey] ?? { min: 0, max: Infinity };
  return vehicles
    // Overlap, not price_min-only: a vehicle counts for this band if any
    // part of its price_min-price_max span falls inside it -- so a model
    // priced ₹24.99-34.49L shows for both 15_25 and 25_40, and one priced
    // entirely below/above the band (e.g. ₹41.5L+ for band 25_40) doesn't.
    .filter((v) => v.price_min <= range.max && v.price_max > range.min)
    .sort((a, b) => a.price_min - b.price_min);
}

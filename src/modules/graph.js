/* ================================================================
   MODULE GRAPH
   Each module = one unit of the conversation. Order is NOT fixed —
   the router (router.js) decides sequencing at runtime based on
   `requires` / `softRequires` and which intent the user picked.

   Question ids are kept IDENTICAL to JOURNEY_STAGES in index.html
   (budget, city, usage, daily_distance, priority, residence,
   payment_mode, first_car, existing_ncb, insurance_preference,
   parking, own_rent, existing_chargers, charging_confidence,
   test_drive, booking_timeline) so answers are drop-in compatible
   with save_assessment_v3 / the recommend engine. Do not rename.
================================================================ */

export const MODULES = {
  'ev-budget': {
    id: 'ev-budget',
    label: 'Find My EV — budget & city',
    requires: [],
    produces: ['budget', 'city'],
    rewardType: 'list',        // renders ListView after completion
    rewardKey: 'topByBudget',
    selectionMode: 'multi',    // tick up to maxSelect, then Continue
    maxSelect: 5,
    entryIntents: ['find_best_ev'],
    questions: [
      {
        id: 'budget',
        opts: [
          { v: 'under_10', l: 'Under ₹10 lakh' },
          { v: '10_15', l: '₹10 – 15 lakh' },
          { v: '15_25', l: '₹15 – 25 lakh' },
          { v: '25_40', l: '₹25 – 40 lakh' },
          { v: 'above_40', l: 'Above ₹40 lakh' },
        ],
      },
      {
        id: 'city',
        opts: [
          { v: 'bengaluru', l: 'Bengaluru' },
          { v: 'mumbai', l: 'Mumbai' },
          { v: 'delhi_ncr', l: 'Delhi NCR' },
          { v: 'hyderabad', l: 'Hyderabad' },
          { v: 'chennai', l: 'Chennai' },
          { v: 'pune', l: 'Pune' },
          { v: 'other_metro', l: 'Another city', freetext: true, freetextField: 'city_freetext' },
        ],
      },
    ],
  },

  // Standalone budget-only flow — a plain, unfiltered-by-selection list of
  // everything in the pool, no ticking required, terminal on this one
  // screen. Deliberately separate from `ev-budget` above (which still feeds
  // ev-personalize/Top 3) so the two welcome chips no longer converge.
  // Same budget/city questions duplicated here rather than shared, since the
  // two modules now diverge in every other respect (selectionMode, reward
  // handling, termination) and keeping them independent avoids one flow's
  // future changes silently affecting the other.
  'ev-budget-list': {
    id: 'ev-budget-list',
    label: 'Find a car for my budget',
    requires: [],
    produces: ['budget', 'city'],
    rewardType: 'list',
    rewardKey: 'budgetListOnly',
    selectionMode: 'none',     // plain list, no ticking, no forced continuation
    entryIntents: ['find_budget_car'],
    questions: [
      {
        id: 'budget',
        opts: [
          { v: 'under_10', l: 'Under ₹10 lakh' },
          { v: '10_15', l: '₹10 – 15 lakh' },
          { v: '15_25', l: '₹15 – 25 lakh' },
          { v: '25_40', l: '₹25 – 40 lakh' },
          { v: 'above_40', l: 'Above ₹40 lakh' },
        ],
      },
      {
        id: 'city',
        opts: [
          { v: 'bengaluru', l: 'Bengaluru' },
          { v: 'mumbai', l: 'Mumbai' },
          { v: 'delhi_ncr', l: 'Delhi NCR' },
          { v: 'hyderabad', l: 'Hyderabad' },
          { v: 'chennai', l: 'Chennai' },
          { v: 'pune', l: 'Pune' },
          { v: 'other_metro', l: 'Another city', freetext: true, freetextField: 'city_freetext' },
        ],
      },
    ],
  },

  'ev-personalize': {
    id: 'ev-personalize',
    label: 'Match My Needs',
    requires: ['budget'],
    produces: ['usage', 'daily_distance', 'priority', 'residence'],
    rewardType: 'list',
    rewardKey: 'top3',
    selectionMode: 'single',  // top-scored pick pre-selected; user can tap another to override
    preselectTopPick: true,
    entryIntents: ['find_best_ev'],
    questions: [
      {
        id: 'usage',
        opts: [
          { v: 'city_commute', l: 'Daily city commute' },
          { v: 'highway', l: 'Regular highway travel' },
          { v: 'mixed', l: 'A mix of city and highways' },
        ],
      },
      {
        id: 'daily_distance',
        opts: [
          { v: 'under_30', l: 'Under 30 km' },
          { v: '30_60', l: '30 – 60 km' },
          { v: '60_100', l: '60 – 100 km' },
          { v: 'above_100', l: 'More than 100 km' },
        ],
      },
      {
        id: 'priority',
        opts: [
          { v: 'range', l: 'Maximum range' },
          { v: 'performance', l: 'Performance' },
          { v: 'space', l: 'Cabin space' },
          { v: 'tech', l: 'ADAS, ReGen, Touchscreen' },
          { v: 'value', l: 'Value for money' },
        ],
      },
      {
        id: 'residence',
        opts: [
          { v: 'apartment', l: 'Apartment' },
          { v: 'independent', l: 'Independent house' },
          { v: 'gated_villa', l: 'Villa' },
          { v: 'farmhouse', l: 'Farmhouse' },
        ],
      },
    ],
  },

  affordability: {
    id: 'affordability',
    label: 'Affordability',
    requires: [],
    softRequires: ['budget'],
    produces: ['payment_mode'],
    rewardType: 'slider',
    rewardKey: 'emiEstimate',
    entryIntents: ['calculate_emi'],
    questions: [
      {
        id: 'payment_mode',
        opts: [
          { v: 'full_cash', l: "100% cash — no loan needed" },
          { v: 'loan', l: "Loan — I'll need financing" },
          { v: 'not_sure', l: "Haven't decided yet" },
        ],
      },
    ],
  },

  insurance: {
    id: 'insurance',
    label: 'Insurance',
    requires: [],
    softRequires: ['budget'],
    produces: ['first_car', 'existing_ncb', 'insurance_preference'],
    rewardType: 'list',
    rewardKey: 'insurancePlans',
    entryIntents: ['suggest_insurance'],
    questions: [
      {
        id: 'first_car',
        opts: [
          { v: 'yes', l: 'Yes — this is my first car' },
          { v: 'no', l: 'No — I already own a car' },
        ],
      },
      // existing_ncb intentionally not asked as its own question anymore —
      // ChatThread.jsx auto-fills it as 'not_provided' right before the
      // first insurance question, so the field/DB column still gets a
      // value (finance.js's ncbMap already treats any unrecognised value
      // as 0% NCB, same as answering "No NCB" here used to).
      {
        id: 'insurance_preference',
        opts: [
          { v: 'basic', l: 'Basic comprehensive' },
          { v: 'zero_dep', l: 'Zero depreciation — no claim deductions' },
          { v: 'not_sure', l: 'Not sure — suggest something' },
        ],
      },
    ],
  },

  charging: {
    id: 'charging',
    label: 'Charging',
    requires: [],
    produces: ['parking', 'own_rent', 'existing_chargers', 'charging_confidence'],
    rewardType: 'score',
    rewardKey: 'chargingReadiness',
    entryIntents: [],
    questions: [
      {
        id: 'parking',
        opts: [
          { v: 'yes_covered', l: 'Yes — covered or basement parking' },
          { v: 'yes_open', l: 'Yes — open parking' },
          { v: 'shared', l: 'Shared parking with others' },
          { v: 'no', l: 'No dedicated parking' },
        ],
      },
      {
        id: 'own_rent',
        opts: [
          { v: 'own', l: 'I own it' },
          { v: 'rent', l: "I'm a tenant" },
          { v: 'family', l: 'Family-owned — I live here' },
        ],
      },
      {
        id: 'existing_chargers',
        opts: [
          { v: 'yes', l: 'Yes — at least one exists' },
          { v: 'no', l: "No — none that I know of" },
          { v: 'dont_know', l: "Haven't checked yet" },
        ],
      },
      {
        id: 'charging_confidence',
        opts: [
          { v: 'very', l: "Very — I've already looked into it" },
          { v: 'some', l: 'Somewhat — I know the basics' },
          { v: 'dealer', l: "Dealer promised they'll handle it" },
          { v: 'not_much', l: 'Not really — still figuring it out' },
          { v: 'none', l: 'No idea where to begin' },
        ],
      },
    ],
  },

  showroom: {
    id: 'showroom',
    label: 'Showroom',
    requires: [],
    produces: ['test_drive', 'booking_timeline'],
    rewardType: 'checklist',
    rewardKey: 'dealerChecklist',
    entryIntents: [],
    questions: [
      {
        id: 'test_drive',
        opts: [
          { v: 'yes_multiple', l: 'Yes — more than one EV' },
          { v: 'yes_one', l: 'Yes — just one so far' },
          { v: 'not_yet', l: 'Not yet — planning to soon' },
        ],
      },
      {
        id: 'booking_timeline',
        opts: [
          { v: 'this_month', l: 'This month' },
          { v: '3_months', l: 'Within 3 months' },
          { v: '6_months', l: 'Within 6 months' },
          { v: 'still_deciding', l: 'Still deciding' },
        ],
      },
    ],
  },
};

// Fixed order used only as a tiebreaker in the router, never as the
// enforced sequence. Keep this list in sync with MODULES keys.
export const MODULE_ORDER = [
  'ev-budget',
  'ev-budget-list',
  'ev-personalize',
  'affordability',
  'insurance',
  'charging',
  'showroom',
];

// Welcome-screen intents. "I already own an EV" intentionally
// omitted for v1 — will plug in a separate rebuilt questionnaire later.
// "find_budget_car" and "find_best_ev" are now two genuinely separate,
// non-interconnecting flows (each ends on its own terminal result screen
// with a single 'eevy' button, per the no-cross-flow-links redesign):
//   find_budget_car -> ev-budget-list (plain list, no ticking, terminal)
//   find_best_ev    -> ev-budget (tick 5) -> ev-personalize -> Top 3 (terminal)
export const ENTRY_INTENTS = [
  { id: 'find_budget_car', label: 'Find a car for my budget', startModule: 'ev-budget-list' },
  { id: 'find_best_ev', label: 'Find the best EV for me', startModule: 'ev-budget' },
  { id: 'calculate_emi', label: 'Calculate my EMI', startModule: 'affordability' },
  { id: 'suggest_insurance', label: 'Suggest insurance plans', startModule: 'insurance' },
  { id: 'browse_all', label: 'Show all EVs', startModule: null }, // special-cased browse flow, not a graph module
  { id: 'buying_kit', label: 'Build my Buying Kit', startModule: null }, // special-cased orchestrator, see handleBuyingKitIntent
];

// The three modules a Buying Kit requires before it can be built — deliberately
// NOT the same as MODULE_ORDER (which also includes ev-budget/ev-budget-list,
// neither of which the Kit itself needs). Checked with isModuleComplete().
export const BUYING_KIT_CORE = ['ev-personalize', 'affordability', 'insurance'];

// Asked (if not already) after the three core modules are done, before the
// Kit is assembled — these never have their own reward screen when run as
// part of a Buying Kit pass; they just feed the readiness score/checklist.
export const BUYING_KIT_READINESS = ['charging', 'showroom'];

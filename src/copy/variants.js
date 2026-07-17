/* ================================================================
   COPY VARIANTS
   2-3 phrasings per question, and templates that reference the
   user's own prior answers. This is the main lever for "sounds
   intelligent" — no model involved, just string templating.
================================================================ */

const CITY_LABELS = {
  bengaluru: 'Bengaluru', mumbai: 'Mumbai', delhi_ncr: 'Delhi NCR',
  hyderabad: 'Hyderabad', chennai: 'Chennai', pune: 'Pune',
};

const BUDGET_LABELS = {
  under_10: 'under ₹10 lakh', '10_15': '₹10–15 lakh', '15_25': '₹15–25 lakh',
  25_40: '₹25–40 lakh', above_40: 'above ₹40 lakh',
};

/** Pick a variant deterministically-ish (rotates per session, not random per render). */
function pick(variants, seed = 0) {
  return variants[seed % variants.length];
}

// question id -> array of phrasing templates. `a` = answers so far.
export const QUESTION_PROMPTS = {
  budget: (a, seed) => pick([
    "What's your budget for the EV?",
    "Roughly what price range are you thinking?",
  ], seed),
  city: (a, seed) => pick([
    'Which city will you primarily drive in?',
    `Got it${a.budget ? ` — ${BUDGET_LABELS[a.budget]} range` : ''}. Which city are you in?`,
  ], seed),
  usage: (a, seed) => pick([
    a.city
      ? `Since you're in ${CITY_LABELS[a.city] || 'your city'} — what will you mainly use the EV for?`
      : 'What will you mainly use the EV for?',
    "What's the EV's main job going to be?",
  ], seed),
  daily_distance: () => 'How far do you typically drive in a day?',
  priority: (a, seed) => pick([
    'What matters most to you in an EV?',
    a.usage === 'highway'
      ? 'For highway driving, what matters most — range, or something else?'
      : 'What matters most to you in an EV?',
  ], seed),
  residence: () => 'What type of home do you live in?',
  payment_mode: (a, seed) => pick([
    'How are you planning to pay for the EV?',
    'Cash, or will you need financing?',
  ], seed),
  first_car: () => 'Is this your first car?',
  existing_ncb: () => 'Do you have an existing No Claim Bonus (NCB) on your current policy?',
  insurance_preference: () => 'What type of insurance coverage are you thinking?',
  parking: () => 'Do you have a dedicated parking spot?',
  own_rent: () => 'Do you own or rent your home?',
  existing_chargers: () => 'Are there any EV chargers already in your building or society?',
  charging_confidence: () => 'How confident are you about getting home charging set up?',
  test_drive: () => 'Have you test-driven any EVs yet?',
  booking_timeline: () => 'How soon do you expect to make a booking?',
};

export function getQuestionPrompt(questionId, answers, seed = 0) {
  const fn = QUESTION_PROMPTS[questionId];
  return fn ? fn(answers, seed) : questionId;
}

/** Bridging line shown when the router inserts a prerequisite before the module the user actually asked for. */
export function getBridgeCopy(targetModuleId, prereqModuleId) {
  const bridges = {
    'affordability->ev-budget': "Quick one before I work out your EMI — roughly what price range are you looking at?",
    'insurance->ev-budget': "One thing first — what segment of EV are you considering? Helps me get the premium estimate right.",
  };
  return bridges[`${targetModuleId}->${prereqModuleId}`]
    || "Just need one more thing first, then I'll get right to it.";
}

/** Transition/nudge copy offered after a module's reward, suggesting the next module. */
export function getNudgeCopy(nextModuleId, answers) {
  const nudges = {
    'ev-budget': "Want me to narrow that shortlist down to your top 3?",
    'ev-personalize': "Want me to narrow that shortlist down to your top 3?",
    affordability: answers.budget
      ? `Want to see what that works out to per month on a loan?`
      : "Want me to work out roughly what this'll cost you a month?",
    insurance: "Want a quick insurance estimate while we're at it?",
    charging: "One more — want to check how ready your home is for charging?",
    showroom: "Last bit — a couple of quick questions to get you showroom-ready.",
  };
  return nudges[nextModuleId] || 'Want to keep going?';
}

/** Copy for the reward/deliverable moment of each module. */
export const REWARD_INTROS = {
  'ev-budget': "Here's what fits your budget:",
  'ev-budget-list': "Here's what fits your budget:",
  'ev-personalize': "Based on what you've told me, here's your shortlist:",
  affordability: "Alright, let's see what this actually costs you each month.",
  insurance: "Let's put a real number on your insurance, not just a guess.",
  charging: "Here's your home charging readiness:",
  showroom: "You're in good shape — here's your showroom checklist:",
};

/** Welcome message variants shown on first load. */
export function getWelcomeMessage(name) {
  return name
    ? `Hey ${name} — where do you want to start?`
    : "Hey — I'm eevy. Where do you want to start?";
}

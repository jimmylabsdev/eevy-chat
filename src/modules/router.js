import { MODULES, MODULE_ORDER } from './graph.js';

/** Which of a module's `requires` are missing from current answers. */
function missingRequires(moduleId, answers) {
  const mod = MODULES[moduleId];
  return mod.requires.filter((k) => answers[k] === undefined);
}

/** Is a module fully answered already? */
export function isModuleComplete(moduleId, answers) {
  return MODULES[moduleId].questions.every((q) => answers[q.id] !== undefined);
}

/**
 * Rank candidate next modules.
 * Score, higher wins:
 *   +100 if it matches the user's original entry intent path
 *   +10  per softRequire already satisfied (more accurate result if we go here now)
 *   -1 * MODULE_ORDER index as a stable tiebreaker (earlier stages nudge first)
 */
function scoreModule(moduleId, { answers, intentPath }) {
  const mod = MODULES[moduleId];
  let score = 0;
  if (intentPath.includes(moduleId)) score += 100;
  const soft = mod.softRequires || [];
  score += soft.filter((k) => answers[k] !== undefined).length * 10;
  score -= MODULE_ORDER.indexOf(moduleId) * 0.1;
  return score;
}

/**
 * Returns the ordered list of next-step suggestions.
 * @param {object} state - { answers, completedModules: Set, intentPath: [] }
 * @param {number} limit - how many chip suggestions to surface (default 2)
 */
export function getNextSuggestions(state, limit = 2) {
  const { answers, completedModules } = state;
  const incomplete = MODULE_ORDER.filter(
    (id) => !completedModules.has(id) && !isModuleComplete(id, answers)
  );

  const ranked = incomplete
    .map((id) => ({ id, score: scoreModule(id, state) }))
    .sort((a, b) => b.score - a.score);

  return ranked.slice(0, limit).map((r) => r.id);
}

/**
 * Given a target module the user (or router) wants to enter,
 * returns a bridging prerequisite module id if one is missing,
 * or null if the target can be entered directly.
 */
export function getPrerequisite(targetModuleId, answers) {
  const missing = missingRequires(targetModuleId, answers);
  if (missing.length === 0) return null;
  // Find which module produces the first missing field.
  for (const modId of MODULE_ORDER) {
    if (MODULES[modId].produces.includes(missing[0])) return modId;
  }
  return null;
}

/** True once every module in MODULE_ORDER is complete. */
export function isJourneyComplete(answers) {
  return MODULE_ORDER.every((id) => isModuleComplete(id, answers));
}

/** Modules still outstanding — used for the final "one last thing" nudge before the Buying Kit. */
export function getOutstandingModules(answers) {
  return MODULE_ORDER.filter((id) => !isModuleComplete(id, answers));
}

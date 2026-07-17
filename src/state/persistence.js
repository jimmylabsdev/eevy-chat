const KEY = 'chat-eevy-session-v1';

/** Loads a previously persisted session, or null if none/corrupt. */
export function loadPersistedSession() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return {
      ...parsed,
      completedModules: new Set(parsed.completedModules || []),
    };
  } catch {
    return null; // corrupt/unavailable storage — just start fresh, non-fatal
  }
}

/** Persists the serializable subset of state. Called on every state change. */
export function persistSession(state) {
  try {
    const snapshot = {
      sessionId: state.sessionId,
      name: state.name,
      contact: state.contact,
      intentId: state.intentId,
      intentPath: state.intentPath,
      answers: state.answers,
      completedModules: Array.from(state.completedModules),
      leadCaptured: state.leadCaptured,
      messages: state.messages,
    };
    localStorage.setItem(KEY, JSON.stringify(snapshot));
  } catch {
    // storage full or unavailable (e.g. private browsing) — non-fatal
  }
}

export function clearPersistedSession() {
  try { localStorage.removeItem(KEY); } catch { /* no-op */ }
}

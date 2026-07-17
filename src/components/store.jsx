import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { genSessionId, saveAssessment } from '../api/worker.js';
import { loadPersistedSession, persistSession } from './persistence.js';

const initialState = {
  sessionId: null,
  name: null,
  contact: { email: null, whatsapp: null },
  intentId: null,       // which welcome-screen option they picked
  answers: {},          // flat map, same keys as index.html
  completedModules: new Set(),
  intentPath: [],        // module ids implied by the chosen intent, for router scoring
  messages: [],          // chat transcript: { id, from: 'bot'|'user', kind, payload }
  leadCaptured: { email: false, whatsapp: false },
};

function buildInitialState() {
  const persisted = loadPersistedSession();
  return persisted ? { ...initialState, ...persisted } : initialState;
}

function reducer(state, action) {
  switch (action.type) {
    case 'INIT_SESSION':
      return { ...state, sessionId: action.sessionId };
    case 'SET_NAME':
      return { ...state, name: action.name };
    case 'SET_INTENT':
      return { ...state, intentId: action.intentId, intentPath: action.intentPath };
    case 'ANSWER': {
      const answers = { ...state.answers, [action.questionId]: action.value };
      return { ...state, answers };
    }
    case 'COMPLETE_MODULE': {
      const next = new Set(state.completedModules);
      next.add(action.moduleId);
      return { ...state, completedModules: next };
    }
    case 'SET_CONTACT':
      return { ...state, contact: { ...state.contact, ...action.contact } };
    case 'LEAD_CAPTURED':
      return { ...state, leadCaptured: { ...state.leadCaptured, ...action.captured } };
    case 'RESET_SESSION':
      // Deliberately builds a fresh object rather than reusing the shared
      // module-level `initialState` — avoids accidentally sharing the same
      // Set/object references across multiple resets in one session.
      return {
        sessionId: action.sessionId,
        name: null,
        contact: { email: null, whatsapp: null },
        intentId: null,
        answers: {},
        completedModules: new Set(),
        intentPath: [],
        messages: [],
        leadCaptured: { email: false, whatsapp: false },
      };
    case 'PUSH_MESSAGE':
      return { ...state, messages: [...state.messages, action.message] };
    default:
      return state;
  }
}

const StoreContext = createContext(null);

export function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, undefined, buildInitialState);

  useEffect(() => {
    if (!state.sessionId) {
      const newSessionId = genSessionId();
      dispatch({ type: 'INIT_SESSION', sessionId: newSessionId });

      // Captured once, right here, since query params are only present on
      // the very first page load a person actually lands on -- not
      // guaranteed to still be in the URL by the time any later save fires.
      const p = new URLSearchParams(window.location.search);
      saveAssessment(newSessionId, {
        referrer: document.referrer || null,
        utm_source: p.get('utm_source') || null,
        utm_medium: p.get('utm_medium') || null,
        utm_campaign: p.get('utm_campaign') || null,
      }).catch((e) => {
        console.error('[eevy] attribution save failed:', e);
      });
    }
  }, [state.sessionId]);

  useEffect(() => {
    persistSession(state);
  }, [state]);

  return (
    <StoreContext.Provider value={{ state, dispatch }}>
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}

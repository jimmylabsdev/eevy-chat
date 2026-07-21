import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useStore } from '../state/store.jsx';
import { MODULES, ENTRY_INTENTS, BUYING_KIT_CORE, BUYING_KIT_READINESS } from '../modules/graph.js';
import { getPrerequisite, isModuleComplete } from '../modules/router.js';
import { scoreShortlist } from '../modules/scoring.js';
import { getQuestionPrompt, getBridgeCopy, REWARD_INTROS, getWelcomeMessage } from '../copy/variants.js';
import ChipGroup from './ChipGroup.jsx';
import LeadCaptureBubble from './LeadCaptureBubble.jsx';
import { saveAssessment, saveLead, notify, genSessionId, fetchVehicles, filterVehiclesByBudget, confirmJourneySave } from '../api/worker.js';
import { buildGuideHtml } from '../modules/guideBuilder.js';
import { getExShowroomLakh, computeOnRoadLakh, computeInsurancePremium, computeEmi } from '../modules/finance.js';
import { computeReadiness, readinessLabel, deriveAssessmentFields } from '../modules/readiness.js';
import { track } from '../modules/analytics.js';
import eevyAvatar from '../assets/eevy-avatar.png';
import { clearPersistedSession } from '../state/persistence.js';

const TYPING_DELAY_MS = 550;

// Reload-safe id — a module-level counter would restart at 0 after a page
// reload and collide with ids already in a persisted message history.
function nextId() { return `m_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`; }

const RESULTS_TITLES = {
  'ev-budget': 'EVs in your budget',
  'ev-budget-list': 'EVs in your budget',
  'ev-personalize': 'Your top 3 matches',
};

export default function ChatThread({ onShowResults, onShowDetail, onShowFinance, onShowBuyingKit, refreshTrigger }) {
  const { state, dispatch } = useStore();
  const [activeModuleId, setActiveModuleId] = useState(null);
  const [activeQuestionIdx, setActiveQuestionIdx] = useState(0);
  const [typing, setTyping] = useState(false);
  const threadEndRef = useRef(null);
  const hasBootstrapped = useRef(false);

  // Synchronous mirrors of context state. dispatch()'d state only updates on
  // next render, but the functions below run inside a single event-handler
  // chain (answer -> save -> next prompt -> reward -> nudge) that needs the
  // "just answered" value immediately, not one render later. Every read of
  // "current answers/completed modules" inside this file should go through
  // these refs, not state.answers / state.completedModules directly.
  const answersRef = useRef({});
  const completedModulesRef = useRef(new Set());
  const nameRef = useRef(null);
  const [savedPhone, setSavedPhone] = useState(null); // whatever phone number was typed into Save the first time this session (2026-07-19, replaces Firebase-verified phone) — lets a later Save on the OTHER calculator reuse it without asking again. Not verified — see SavePhoneGate.jsx for why that trade was made deliberately.
  const leadCapturedRef = useRef({ email: false });
  const pendingPostNameActionRef = useRef(null); // callback to run once name capture resolves
  const postEmailActionRef = useRef(null); // callback to run once email capture resolves (submit or skip)
  const pendingEmailModuleRef = useRef(null); // which module the current email gate belongs to
  const buyingKitDataRef = useRef(null); // cached buildBuyingKitData() output, reused for guide_html
  const shortlistRef = useRef([]); // vehicle ids ticked on the ev-budget multi-select screen
  // Set only when Loan/EMI or Insurance was entered without a confirmed car
  // and the person chose "Find my Top 3" or "Browse all EVs" to pick one.
  // Once a car is selected through that detour, this callback resumes the
  // original Loan/EMI or Insurance intent immediately instead of that
  // detour's own ending — cleared right after it fires.
  const pendingCarSelectionRef = useRef(null);
  // Non-null while a Buying Kit run is in progress — an ordered list of
  // module ids still to complete before the kit itself is assembled. See
  // handleBuyingKitConfirmChoice/advanceBuyingKitQueue.
  const buyingKitQueueRef = useRef(null);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [state.messages, typing]);

  const pushBotMessage = useCallback((kind, payload, delay = TYPING_DELAY_MS) => {
    setTyping(true);
    return new Promise((resolve) => {
      setTimeout(() => {
        setTyping(false);
        dispatch({ type: 'PUSH_MESSAGE', message: { id: nextId(), from: 'bot', kind, payload } });
        resolve();
      }, delay);
    });
  }, [dispatch]);

  const pushUserMessage = useCallback((text) => {
    dispatch({ type: 'PUSH_MESSAGE', message: { id: nextId(), from: 'user', kind: 'text', payload: text } });
  }, [dispatch]);

  function showWelcome(name) {
    // Defensive: if a Buying Kit run gets abandoned partway (user picks a
    // different menu path mid-queue rather than finishing it), this
    // guarantees the queue can't silently linger and hijack some later,
    // unrelated flow's ending.
    buyingKitQueueRef.current = null;
    pushBotMessage('text', getWelcomeMessage(name), 300).then(() => {
      pushBotMessage('intent-chips', ENTRY_INTENTS, 250);
    });
  }

  // ---- Bootstrap: fresh welcome, OR resume a persisted session in place ----
  useEffect(() => {
    if (hasBootstrapped.current) return; // guards against StrictMode's dev-only double-invoke
    hasBootstrapped.current = true;

    // Always sync refs from whatever was loaded from localStorage
    // (persistence.js), whether that's empty (fresh session) or populated.
    answersRef.current = { ...state.answers };
    completedModulesRef.current = new Set(state.completedModules);
    nameRef.current = state.name;
    leadCapturedRef.current = { ...state.leadCaptured };

    // Always land on a fresh main menu on load/refresh (2026-07-19 fix) —
    // previously this tried to reconstruct exactly where the user left off
    // from the last persisted message (re-deriving activeModuleId/
    // activeQuestionIdx if it was a question). That was fragile: App.jsx's
    // screen/resultsPayload/detailItem/financePayload are plain useState,
    // never persisted, so a refresh always resets to screen='chat' — but
    // the chat log itself would still show whatever was on-screen right
    // before the reload (e.g. "here are your matches" with no matching
    // overlay to back it, or a dangling question bubble with no active
    // handler). Always re-showing the welcome message + menu chips avoids
    // that mismatch entirely. Existing message history isn't cleared —
    // this appends, so scrolling up still shows what they did before —
    // and answers/name/completedModules underneath are untouched, so
    // continuing from the fresh menu doesn't lose prior progress.
    showWelcome(state.name);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Returning from a screen that lives outside ChatThread's own flow
  // (currently just the "My Saved Journeys" dashboard, opened via the
  // hamburger menu) should show a fresh main menu, same reasoning as the
  // bootstrap effect above — App.jsx increments refreshTrigger on close,
  // and this reacts to it. Guarded on > 0 so this doesn't ALSO fire on
  // initial mount (refreshTrigger starts at 0, same value the whole time
  // until App.jsx first increments it).
  useEffect(() => {
    if (refreshTrigger > 0) showWelcome(nameRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshTrigger]);

  function askQuestion(moduleId, qIdx) {
    const mod = MODULES[moduleId];
    // existing_ncb was removed from insurance's own question list (no longer
    // asked) but finance.js / saveAssessment still expect a value for it —
    // fill it in silently, once, right before insurance's first question.
    if (moduleId === 'insurance' && qIdx === 0 && answersRef.current.existing_ncb === undefined) {
      answersRef.current = { ...answersRef.current, existing_ncb: 'not_provided' };
      dispatch({ type: 'ANSWER', questionId: 'existing_ncb', value: 'not_provided' });
    }
    const q = mod.questions[qIdx];
    const prompt = getQuestionPrompt(q.id, answersRef.current, qIdx);
    pushBotMessage('question', { moduleId, question: q, prompt });
  }

  function startModule(moduleId) {
    const prereq = getPrerequisite(moduleId, answersRef.current);
    if (prereq && prereq !== moduleId) {
      pushBotMessage('text', getBridgeCopy(moduleId, prereq)).then(() => {
        setActiveModuleId(prereq);
        setActiveQuestionIdx(0);
        askQuestion(prereq, 0);
      });
      return;
    }
    setActiveModuleId(moduleId);
    setActiveQuestionIdx(0);
    askQuestion(moduleId, 0);
  }

  /**
   * Single entry point for "the user wants to go do X module now" —
   * intercepts affordability and insurance to check for a confirmed car
   * first, since both calculators price against a specific vehicle now.
   */
  function enterModule(moduleId) {
    if (moduleId === 'affordability' || moduleId === 'insurance') {
      ensureVehicleSelected(() => startModule(moduleId));
    } else if (moduleId === 'ev-budget' && answersRef.current.budget && answersRef.current.city) {
      confirmBudgetCity(moduleId);
    } else {
      startModule(moduleId);
    }
  }

  function optLabel(mod, questionId, value) {
    const opt = mod.questions.find((q) => q.id === questionId)?.opts.find((o) => o.v === value);
    return opt ? opt.l : value;
  }

  // Shown instead of re-asking budget/city from scratch when the user
  // re-enters "Find the best EV for me" after already answering them once
  // this session (e.g. went back to the menu and picked it again).
  function confirmBudgetCity(moduleId) {
    const mod = MODULES[moduleId];
    const budgetLabel = optLabel(mod, 'budget', answersRef.current.budget);
    const cityLabel = answersRef.current.city === 'other_metro' && answersRef.current.city_freetext
      ? answersRef.current.city_freetext
      : optLabel(mod, 'city', answersRef.current.city);
    setActiveModuleId(moduleId);
    track('budget_confirm_view', { module_id: moduleId });
    pushBotMessage('budget-confirm', {
      moduleId,
      text: `You've already told me a budget of ${budgetLabel} and ${cityLabel} as your city. Want to continue with these, or change them?`,
    });
  }

  async function handleBudgetConfirmChoice(choice, moduleId) {
    pushUserMessage(choice === 'continue' ? 'Continue with these' : 'Change');
    track('budget_confirm_choice', { module_id: moduleId, choice });
    if (choice === 'continue') {
      const mod = MODULES[moduleId];
      setActiveQuestionIdx(mod.questions.length);
      await finishModuleQuestions(moduleId);
      return;
    }
    // Change — clear the stored answers so the module asks fresh, then
    // start it exactly as if this were the first time.
    answersRef.current = { ...answersRef.current, budget: undefined, city: undefined, city_freetext: undefined };
    dispatch({ type: 'ANSWER', questionId: 'budget', value: undefined });
    dispatch({ type: 'ANSWER', questionId: 'city', value: undefined });
    dispatch({ type: 'ANSWER', questionId: 'city_freetext', value: undefined });
    startModule(moduleId);
  }

  function handleIntentSelect(intent) {
    pushUserMessage(intent.label);
    track('intent_select', { intent_id: intent.id });
    dispatch({ type: 'SET_INTENT', intentId: intent.id, intentPath: intent.startModule ? [intent.startModule] : [] });
    if (intent.id === 'browse_all') {
      enterBrowseFlow();
    } else if (intent.id === 'buying_kit') {
      handleBuyingKitIntent();
    } else if (intent.id === 'calculate_emi') {
      enterLenderBrowse();
    } else if (intent.id === 'suggest_insurance') {
      enterInsurerBrowse();
    } else {
      enterModule(intent.startModule);
    }
  }

  /**
   * Main-menu "EV Loan Providers" / "EV Insurance Providers" chips
   * (2026-07-19) — pure directory browsing, no vehicle involved at all:
   * straight to the grid-tile partner screen, tap a tile to see full
   * details, close to return to the main menu. Deliberately does NOT go
   * through enterModule('affordability'/'insurance') — that path (car
   * selection, questions, calculator) stays exactly as-is for Buying Kit
   * and the EMI/Insurance-flow's own car-selection-gate detour.
   */
  async function enterLenderBrowse() {
    track('lender_browse_open');
    await pushBotMessage('text', "Here's who's currently offering EV loans.");
    onShowFinance({
      kind: 'partner-browse',
      partnerType: 'loan',
      onFinish: () => showWelcome(nameRef.current),
    });
  }

  async function enterInsurerBrowse() {
    track('insurer_browse_open');
    await pushBotMessage('text', "Here's who's currently offering EV insurance.");
    onShowFinance({
      kind: 'partner-browse',
      partnerType: 'insurance',
      onFinish: () => showWelcome(nameRef.current),
    });
  }

  // ---- Buying Kit orchestration ----
  // RETIRED (2026-07-19, per Ram: "lost in evolution, retire it") — no
  // main-menu chip calls handleBuyingKitIntent() anymore (removed in the
  // 4-chip reshuffle). Left in place rather than deleted — flagged for a
  // dedicated cleanup pass. Requires ev-personalize (Top 3), affordability
  // (Loan/EMI), and insurance to all be complete first; if any are
  // missing, offers to run through them (in that fixed order), then always
  // asks charging + showroom (whichever aren't already done — they never
  // got their own reward screen elsewhere, this is the only place they're
  // reachable), then assembles the kit.

  function handleBuyingKitIntent() {
    const missingCore = BUYING_KIT_CORE.filter((id) => !isModuleComplete(id, answersRef.current));
    track('buying_kit_intent', { missing_core: missingCore.join(',') || 'none' });
    if (missingCore.length === 0) {
      startBuyingKitQueue();
      return;
    }
    const labels = { 'ev-personalize': 'your Top 3 matches', affordability: 'Loan/EMI', insurance: 'Insurance' };
    const list = missingCore.map((id) => labels[id]).join(', ');
    pushBotMessage('buying-kit-confirm', {
      text: `To build your Buying Kit, you'll need to complete ${list} first. Want to start there?`,
    });
  }

  function handleBuyingKitConfirmChoice(choice) {
    pushUserMessage(choice === 'start' ? "Let's do it" : 'Not now');
    track('buying_kit_confirm_choice', { choice });
    if (choice === 'start') {
      startBuyingKitQueue();
    } else {
      showWelcome(nameRef.current);
    }
  }

  function startBuyingKitQueue() {
    const missingCore = BUYING_KIT_CORE.filter((id) => !isModuleComplete(id, answersRef.current));
    const missingReadiness = BUYING_KIT_READINESS.filter((id) => !isModuleComplete(id, answersRef.current));
    buyingKitQueueRef.current = [...missingCore, ...missingReadiness];
    advanceBuyingKitQueue();
  }

  function advanceBuyingKitQueue() {
    const queue = buyingKitQueueRef.current || [];
    console.log('[eevy] buying kit queue:', queue);
    // One save per module transition within the kit — not per-question, but
    // also not silent for the whole multi-module run until the very end;
    // this is the longest flow in the app, so still worth a checkpoint here.
    saveAssessment(state.sessionId, answersRef.current).catch((e) => {
      console.error('[eevy] buying kit checkpoint save failed:', e);
    });
    if (queue.length === 0) {
      buyingKitQueueRef.current = null;
      finishBuyingKitQuestions();
      return;
    }
    const [next, ...rest] = queue;
    buyingKitQueueRef.current = rest;
    enterModule(next);
  }

  // Once every required + readiness module is answered — gate on email
  // exactly like every other reward (skips if already captured this
  // session), then assemble and show the kit.
  function finishBuyingKitQuestions() {
    saveAssessment(state.sessionId, answersRef.current).catch((e) => {
      console.error('[eevy] buying kit flow-end save failed:', e);
    });
    buildBuyingKitData()
      .then((data) => {
        buyingKitDataRef.current = data;
        // Final completion save -- sets completed_at + the derived/score
        // fields, none of which were ever being sent before. Fires
        // regardless of the email gate outcome below (skip or submit),
        // since "reached the buying kit" is what completion means here,
        // not "gave an email".
        saveAssessment(state.sessionId, {
          ...deriveAssessmentFields(answersRef.current),
          readiness_score: data.readiness.score,
        }, true).catch((e) => {
          console.error('[eevy] buying kit completion save failed:', e);
        });
      })
      .catch((e) => {
        console.error('[eevy] buying kit assembly failed:', e);
        track('buying_kit_error', { message: e.message });
      })
      .finally(() => {
        const proceed = () => showBuyingKitReport();
        if (!tryEmailCapture('buying-kit', proceed)) {
          proceed();
        }
      });
  }

  async function showBuyingKitReport() {
    track('buying_kit_view');
    try {
      const data = buyingKitDataRef.current || await buildBuyingKitData();
      onShowBuyingKit({ ...data, onFinish: () => showWelcome(nameRef.current) });
    } catch (e) {
      console.error('[eevy] buying kit assembly failed:', e);
      track('buying_kit_error', { message: e.message });
      await pushBotMessage('text', "Something went wrong putting your Buying Kit together — mind trying again from the main menu?");
      showWelcome(nameRef.current);
    }
  }

  async function buildBuyingKitData() {
    const a = answersRef.current;
    const vehicles = await getCachedVehicles();
    const vehicle = await resolvePricingVehicle();
    const exShowroom = getExShowroomLakh(vehicle, a.budget);
    const onRoad = computeOnRoadLakh(exShowroom);

    // 1. Recommended EVs — same scoring pass as the ev-personalize reward,
    // recomputed fresh rather than persisted from earlier in the session.
    const shortlisted = vehicles.filter((v) => shortlistRef.current.includes(v.id));
    const pool = shortlisted.length > 0 ? shortlisted : vehicles;
    const scored = scoreShortlist(pool, a).slice(0, 3);
    const kitVehicles = scored.map((v) => ({
      id: v.id,
      title: `${v.brand} ${v.model}${v.variant_label ? ` ${v.variant_label}` : ''}`,
      priceLabel: v.price,
      rangeLabel: `${v.range} range`,
      image: v.image_url,
      topPick: v.topPick || false,
      selected: a.selected_vehicle_id === v.id,
    }));

    // 2. Cost Summary — reuse the actual Loan/EMI figures already captured
    // (or recompute a cash-only card if that's what they chose).
    const isCash = a.payment_mode === 'full_cash';
    const emi = !isCash && a.down_payment_lakh != null
      ? computeEmi({ onRoadLakh: onRoad, downPaymentLakh: a.down_payment_lakh, tenureYears: a.loan_tenure_years, ratePct: a.interest_rate_pct })
      : 0;

    // 3. Insurance Estimate — same computeInsurancePremium() the Insurance
    // screen itself uses.
    const insBreakdown = computeInsurancePremium({
      onRoadLakh: onRoad,
      existingNcb: a.existing_ncb,
      insurancePreference: a.insurance_preference,
    });

    // 4. Running Costs — same per-km assumptions as index.html.
    const dailyMid = { under_30: 20, '30_60': 45, '60_100': 80, above_100: 130 };
    const kmDay = dailyMid[a.daily_distance] || 50;
    const monthlyFuel = Math.round((kmDay * 26 * 8) / 10) * 10;
    const monthlyCharge = Math.round((kmDay * 26 * 1.8) / 10) * 10;

    // 5. Charging Readiness.
    const chargingMap = {
      yes_covered: { label: 'Home charging', charger: '7.2 kW wall charger', install: '₹15K–₹25K', ok: true },
      yes_open: { label: 'Home charging', charger: '3.3 kW portable charger', install: '₹8K–₹15K', ok: true },
      shared: { label: 'Society charging', charger: 'Shared AC charger', install: '₹30K–₹60K (shared)', ok: false },
      no: { label: 'Public/office charging', charger: '3-pin + public stations', install: '₹0', ok: false },
    };
    const charging = chargingMap[a.parking] || chargingMap.no;

    // 6. Dealer Checklist — same conditional groups as index.html, minus
    // the vehicle-waiting-period/forum-specific lines that need live data
    // we don't have here.
    const isApartment = ['apartment', 'gated_villa'].includes(a.residence);
    const noCharger = a.existing_chargers !== 'yes';
    const noDrive = a.test_drive === 'not_yet';
    const cityLabel = a.city === 'other_metro' && a.city_freetext ? a.city_freetext : (a.city || 'your city');
    const checklist = {
      groups: [
        {
          title: 'Questions to ask the dealer',
          items: [
            'Ask about their home charger installation partner and typical installation timeline',
            'Ask for the all-in on-road price — registration, taxes, and accessories included',
            'Ask about extended warranty options for battery and powertrain',
            'Ask about roadside assistance coverage and nearest service centre',
            noCharger ? 'Ask if they can arrange a free site visit for home charger assessment' : null,
          ].filter(Boolean),
        },
        {
          title: 'Things to verify',
          items: [
            'Check applicable state EV subsidy in ' + cityLabel + ' on the transport portal',
            'Confirm the latest central EV subsidy applicability',
            noDrive ? 'Book a test drive before you finalize anything' : 'Compare your top 2 picks back-to-back during test drives',
            isApartment && noCharger ? "Check with your RWA if EV charger installation is permitted — ask your dealer to share an NOC template" : null,
          ].filter(Boolean),
        },
        {
          title: 'Documents to carry',
          items: ['Aadhaar card (original + copy)', 'PAN card', 'Address proof — electricity bill, passport, or ration card'],
        },
      ],
    };

    // 7. Overall readiness + next steps.
    const score = computeReadiness(a);
    const topVehicle = kitVehicles.find((v) => v.selected) || kitVehicles[0];
    const nextSteps = [
      topVehicle ? `Book a test drive for the ${topVehicle.title} — ${topVehicle.selected ? 'your pick' : 'your top match'}` : 'Book test drives for your shortlisted EVs',
      'Ask your dealer about their home charger installation partner and get a quote',
      `Check the EV subsidy available in ${cityLabel} on the state transport portal`,
      'Share this Buying Kit with whoever helps you with big financial decisions',
    ];

    return {
      vehicles: kitVehicles,
      cost: {
        onRoad, isCash,
        downPayment: a.down_payment_lakh || 0,
        emi,
        selectedLoanPartner: a.selected_loan_partner || null,
      },
      insurance: {
        coverageLabel: insBreakdown.coverageLabel,
        totalK: Math.round(insBreakdown.total / 1000),
        selectedInsurancePartner: a.selected_insurance_partner || null,
      },
      running: { monthlyFuel, monthlyCharge, monthlySave: monthlyFuel - monthlyCharge },
      charging,
      checklist,
      readiness: { score, label: readinessLabel(score), nextSteps },
    };
  }

  /**
   * extraFields: optional { fieldName: value } written alongside the main
   * answer — used for freetext (e.g. city_freetext) so typed text isn't
   * thrown away once it's only used as the chat bubble's display label.
   */
  async function handleAnswer(questionId, value, displayLabel, extraFields = null) {
    pushUserMessage(displayLabel);

    answersRef.current = { ...answersRef.current, [questionId]: value, ...(extraFields || {}) };
    dispatch({ type: 'ANSWER', questionId, value });
    if (extraFields) {
      for (const [k, v] of Object.entries(extraFields)) {
        dispatch({ type: 'ANSWER', questionId: k, value: v });
      }
    }

    const mod = MODULES[activeModuleId];
    const nextIdx = activeQuestionIdx + 1;

    // No network save here anymore — batched instead, once per flow, in
    // afterReward(). answersRef.current/dispatch above already keep local
    // state fully accurate in the meantime; this only changes *when* it's
    // pushed to the network, not whether anything is tracked.

    if (nextIdx < mod.questions.length) {
      setActiveQuestionIdx(nextIdx);
      await pushBotMessage('typing-gap', null, 200); // brief natural pause between questions in the same module
      askQuestion(activeModuleId, nextIdx);
      return;
    }

    await finishModuleQuestions(activeModuleId);
  }

  // Shared tail for "this module's questions are all answered" — used both
  // by the normal per-question flow above and by the budget/city confirm
  // flow below (when the user picks "Continue with these" and skips
  // straight past questions that were already answered in an earlier run).
  async function finishModuleQuestions(moduleId) {
    completedModulesRef.current = new Set(completedModulesRef.current).add(moduleId);
    dispatch({ type: 'COMPLETE_MODULE', moduleId });

    // Ask for the user's name once, before the very first reward of any
    // kind is shown — not just vehicle-list results. Everything after this
    // point can then be personalized with it.
    if (!nameRef.current) {
      pendingPostNameActionRef.current = () => deliverReward(moduleId);
      track('lead_view', { field: 'name', module_id: moduleId });
      await pushBotMessage('lead-name', null, 500);
      return; // resumes in handleNameSubmit once they answer
    }

    await deliverReward(moduleId);
  }

  const vehiclesCacheRef = useRef(null); // raw catalogue, fetched once per session

  async function getCachedVehicles() {
    if (vehiclesCacheRef.current) return vehiclesCacheRef.current;
    const result = await fetchVehicles(); // { vehicles: [...] }
    vehiclesCacheRef.current = result.vehicles || [];
    return vehiclesCacheRef.current;
  }

  function toListItem(v) {
    return {
      id: v.id,
      title: `${v.brand} ${v.model}${v.variant_label ? ` ${v.variant_label}` : ''}`,
      subtitle: `${v.range} range · ${v.segment || ''}`.trim(),
      price: v.price,
      image: v.image_url,
      tags: v.matchPct ? [`${v.matchPct}% match`] : undefined,
      topPick: v.topPick || false,
      _raw: v,
    };
  }

  async function deliverReward(moduleId) {
    const mod = MODULES[moduleId];
    track('module_view', { module_id: moduleId, reward_key: mod.rewardKey });

    if (mod.rewardKey === 'topByBudget') {
      await pushBotMessage('text', REWARD_INTROS[moduleId]);
      let items = [];
      let emptyReason = null;
      try {
        const vehicles = await getCachedVehicles();
        // Widened to 10 (not just 5) — the point of this screen is now
        // ticking up to 5 out of a real pool, not just displaying 5.
        items = filterVehiclesByBudget(vehicles, answersRef.current.budget).slice(0, 10).map(toListItem);
      } catch (e) {
        console.error('[eevy] ev-budget reward failed:', e);
        emptyReason = `error: ${e.message}`;
      }

      onShowResults({
        title: RESULTS_TITLES['ev-budget'],
        items,
        emptyReason,
        moduleId,
        selectionMode: 'multi',
        maxSelect: mod.maxSelect || 5,
        onContinue: (selectedItems) => {
          track('module_continue', { module_id: moduleId });
          shortlistRef.current = selectedItems.map((i) => i.id);
          // Forced continuation into personalize — one single unidirectional
          // "find my car" journey, not an optional branch.
          startModule('ev-personalize');
        },
      });
      return;
    }

    if (mod.rewardKey === 'budgetListOnly') {
      // Standalone budget-only flow — plain list, no ticking, terminal on
      // this one screen. Does NOT chain into ev-personalize, and does NOT
      // end at the universal finishJourney/'eevy' terminus either — after
      // the email gate (if not yet captured), it drops straight back to
      // the main menu instead.
      await pushBotMessage('text', REWARD_INTROS[moduleId]);
      let items = [];
      let emptyReason = null;
      try {
        const vehicles = await getCachedVehicles();
        items = filterVehiclesByBudget(vehicles, answersRef.current.budget).map(toListItem);
      } catch (e) {
        console.error('[eevy] ev-budget-list reward failed:', e);
        emptyReason = `error: ${e.message}`;
      }

      const budgetLabel = optLabel(mod, 'budget', answersRef.current.budget);
      onShowResults({
        title: `Price range - ${budgetLabel}`,
        subtitle: items.length > 0
          ? `We found ${items.length} EV${items.length === 1 ? '' : 's'} in that range. Select an EV to learn more.`
          : undefined,
        items,
        emptyReason,
        moduleId,
        selectionMode: 'none',
        // Skips finishJourney entirely — no "That's everything for this
        // one." text, no 'eevy' button. Send/Not now on the email gate
        // drops straight back to the main menu for this flow only.
        onContinue: () => {
          track('module_continue', { module_id: moduleId });
          afterReward('ev-budget-list', () => showWelcome(nameRef.current));
        },
        // From the variants popup's footer — the vehicle is already known
        // (whichever card's popup this was), so set selected_vehicle_id
        // first: enterModule's car-selection gate sees it's already
        // satisfied and skips straight into the calculator, no detour.
        onCalculateEmi: (item, variant) => {
          enterAffordabilityFromVariant(item, variant);
        },
        onCheckInsurance: (item, variant) => {
          enterInsuranceFromVariant(item, variant);
        },
      });
      return;
    }

    if (mod.rewardKey === 'top3') {
      await pushBotMessage('text', REWARD_INTROS[moduleId]);
      let items = [];
      let emptyReason = null;
      try {
        const vehicles = await getCachedVehicles();
        const shortlisted = vehicles.filter((v) => shortlistRef.current.includes(v.id));
        const pool = shortlisted.length > 0 ? shortlisted : vehicles; // safety net if shortlist is somehow empty
        items = scoreShortlist(pool, answersRef.current).map(toListItem);
      } catch (e) {
        console.error('[eevy] ev-personalize reward failed:', e);
        emptyReason = `error: ${e.message}`;
      }

      onShowResults({
        title: RESULTS_TITLES['ev-personalize'],
        items,
        emptyReason,
        moduleId,
        selectionMode: 'single', // top match pre-selected by ResultsView itself
        onContinue: (selectedItem) => {
          track('module_continue', { module_id: moduleId });
          if (selectedItem) {
            answersRef.current = { ...answersRef.current, selected_vehicle_id: selectedItem.id };
            dispatch({ type: 'ANSWER', questionId: 'selected_vehicle_id', value: selectedItem.id });
            saveAssessment(state.sessionId, { selected_vehicle_id: selectedItem.id }).catch((e) => {
              console.error('[eevy] selected_vehicle_id save failed:', e);
            });
          }
          const pending = pendingCarSelectionRef.current;
          if (pending) {
            // This Top 3 run was a detour to get a car for Loan/EMI or
            // Insurance — continue straight into that instead of Top 3's
            // own ending.
            pendingCarSelectionRef.current = null;
            pending();
            return;
          }
          if (buyingKitQueueRef.current) {
            advanceBuyingKitQueue();
            return;
          }
          // Journey ends here — no further chaining. After the email gate
          // (if it fires), drops straight back to the main menu — no
          // "That's everything for this one." text, no 'eevy' button.
          afterReward('ev-personalize', () => showWelcome(nameRef.current));
        },
      });
      return;
    }

    if (moduleId === 'affordability') {
      await deliverAffordabilityReward();
      return;
    }

    if (mod.rewardKey === 'insurancePlans') {
      await deliverInsuranceReward();
      return;
    }

    // charging/showroom have no reward screen of their own — they only
    // exist to feed the Buying Kit's readiness score/checklist. During a
    // Buying Kit run, just move straight to the next queued step.
    if (buyingKitQueueRef.current) {
      advanceBuyingKitQueue();
      return;
    }

    // Standalone case — currently unreachable (entryIntents: [] for both),
    // kept only so MODULES stays fully defined outside a Buying Kit run.
    await pushBotMessage('text', REWARD_INTROS[moduleId]);
    if (mod.rewardType === 'score' || mod.rewardType === 'checklist') {
      await pushBotMessage('text', `(${mod.rewardType} widget — v1 stub, wire to worker data next pass)`, 300);
    }
    afterReward(moduleId);
  }

  /**
   * Ex-showroom/on-road price this calculator estimates from — the
   * selected vehicle's price_min if there is one, else the top vehicle in
   * the cached catalogue, else the budget-band midpoint. Mirrors
   * getExShowroom() in index.html.
   */
  async function resolvePricingVehicle() {
    try {
      const vehicles = await getCachedVehicles();
      const selId = answersRef.current.selected_vehicle_id;
      return (selId && vehicles.find((v) => v.id === selId)) || vehicles[0] || null;
    } catch (e) {
      console.error('[eevy] vehicle lookup for pricing failed:', e);
      return null;
    }
  }

  /**
   * Loan/EMI reward — ported from index.html's showAffordabilitySliders() /
   * showAffordabilityIncome() / the full_cash branch in advanceToNextStage(),
   * now shown as a full-screen calculator (AffordabilityScreen.jsx) rather
   * than inline chat bubbles. Three paths by payment_mode, same as the
   * original:
   *  - full_cash: on-road price card only, no EMI, no loan tiles.
   *  - loan: full down-payment/tenure/rate/income sliders + live EMI.
   *  - not_sure: income-only slider, same 20%/5yr/8.5% defaults as before.
   */
  async function deliverAffordabilityReward(variantPriceOverride, returnTo, variantId) {
    await pushBotMessage('text', REWARD_INTROS.affordability);
    const vehicle = await resolvePricingVehicle();
    const exShowroom = variantPriceOverride != null ? variantPriceOverride : getExShowroomLakh(vehicle, answersRef.current.budget);
    const onRoad = computeOnRoadLakh(exShowroom);
    const pm = answersRef.current.payment_mode;
    const variant = pm === 'full_cash' ? 'cash' : pm === 'loan' ? 'full' : 'incomeOnly';

    onShowFinance({
      kind: 'affordability',
      variant, onRoadLakh: onRoad, exShowroom,
      returnTo, // e.g. 'results' — where handleFinanceFinish navigates on completion/X. Undefined -> App.jsx's existing 'chat' default, unchanged for every other entry point.
      // Journey-log context (2026-07-19) — flowName derived from returnTo
      // since that already uniquely distinguishes Budget vs Browse;
      // vehicleId read from answersRef (set by either entry path before
      // this is called) rather than threaded as its own param.
      sessionId: state.sessionId,
      flowName: returnTo === 'results' ? 'budget' : returnTo === 'detail' ? 'browse' : null,
      vehicleId: answersRef.current.selected_vehicle_id || null,
      variantId: variantId || null,
      onFinish: (result) => handleAffordabilityDone(result),
      // Cross-link (2026-07-19) — "Check Insurance" on the breakdown
      // stage. Reuses enterInsuranceFromVariant() with a minimal
      // reconstructed item/variant (brand+model from the vehicle already
      // resolved above, price/id already known here) — no new plumbing
      // needed from whichever entry point got us here. Hidden entirely if
      // the vehicle couldn't be resolved.
      onCheckInsurance: vehicle ? () => {
        enterInsuranceFromVariant(
          { id: vehicle.id, title: `${vehicle.brand} ${vehicle.model}` },
          { id: variantId, ex_showroom_price_lakh: exShowroom },
          returnTo,
        );
      } : undefined,
      onPhoneSaved: (phone, journeyRowId) => handlePhoneSaved('affordability', phone, journeyRowId),
      knownPhone: savedPhone,
    });
  }

  /**
   * Direct entry from a variants popup's "Calculate EMI" button — used by
   * both the Budget result screen (returnTo: 'results', the default) and
   * now Browse (returnTo: 'detail', 2026-07-19). Skips the payment_mode
   * question entirely (financing is already implied) and prices against
   * the specific variant tapped, not the vehicle's lowest-variant
   * price_min. Every other entry point into affordability (main menu chip,
   * car-selection gate, etc.) is untouched and still goes through
   * startModule('affordability') asking payment_mode as before.
   */
  function enterAffordabilityFromVariant(item, variant, returnTo = 'results') {
    track('calculate_emi_from_variants', { vehicle_id: item.id, variant_id: variant?.id });
    answersRef.current = { ...answersRef.current, selected_vehicle_id: item.id, payment_mode: 'loan' };
    dispatch({ type: 'ANSWER', questionId: 'selected_vehicle_id', value: item.id });
    dispatch({ type: 'ANSWER', questionId: 'payment_mode', value: 'loan' });
    saveAssessment(state.sessionId, { selected_vehicle_id: item.id, payment_mode: 'loan' }).catch((e) => {
      console.error('[eevy] selected_vehicle_id/payment_mode save failed (variants EMI):', e);
    });
    pushUserMessage(`Calculate EMI for ${item.title}`);
    deliverAffordabilityReward(variant?.ex_showroom_price_lakh, returnTo, variant?.id);
  }

  function handleAffordabilityDone(result) {
    track('module_continue', { module_id: 'affordability' });
    const { downPaymentLakh, tenureYears, ratePct, incomeBand, emi, selectedLoanPartner } = result;

    if (downPaymentLakh != null) {
      answersRef.current = {
        ...answersRef.current,
        down_payment_lakh: downPaymentLakh, loan_tenure_years: tenureYears,
        interest_rate_pct: ratePct, income_band: incomeBand,
      };
      for (const [k, v] of Object.entries({
        down_payment_lakh: downPaymentLakh, loan_tenure_years: tenureYears,
        interest_rate_pct: ratePct, income_band: incomeBand,
      })) {
        dispatch({ type: 'ANSWER', questionId: k, value: v });
      }
      saveAssessment(state.sessionId, {
        down_payment_lakh: downPaymentLakh, loan_tenure_years: tenureYears,
        interest_rate_pct: ratePct, income_band: incomeBand,
      }).catch((e) => console.error('[eevy] affordability save failed:', e));
    }
    if (selectedLoanPartner) handlePartnerSelect('loan', selectedLoanPartner);

    pushUserMessage(emi > 0 ? `EMI ≈ ₹${emi.toLocaleString('en-IN')}/mo — looks good` : 'Got it — thanks');
    if (buyingKitQueueRef.current) {
      advanceBuyingKitQueue();
      return;
    }
    afterReward('affordability', () => showWelcome(nameRef.current));
  }

  /**
   * Insurance reward — ported from index.html's buildInsuranceEstimates() +
   * renderInsuranceTiles(), now shown as a full-screen calculator
   * (InsuranceScreen.jsx). Replaces the old v1 stub with a real premium
   * breakdown and live insurance partner tiles.
   */
  async function deliverInsuranceReward(variantPriceOverride, returnTo, variantId) {
    await pushBotMessage('text', REWARD_INTROS.insurance);
    const vehicle = await resolvePricingVehicle();
    const exShowroom = variantPriceOverride != null ? variantPriceOverride : getExShowroomLakh(vehicle, answersRef.current.budget);
    const onRoad = computeOnRoadLakh(exShowroom);
    const breakdown = computeInsurancePremium({
      onRoadLakh: onRoad,
      existingNcb: answersRef.current.existing_ncb,
      insurancePreference: answersRef.current.insurance_preference,
    });

    onShowFinance({
      kind: 'insurance',
      onRoad, exShowroom, ...breakdown,
      returnTo, // e.g. 'results' for the variants-triggered entry — same mechanism as affordability's returnTo.
      sessionId: state.sessionId,
      flowName: returnTo === 'results' ? 'budget' : returnTo === 'detail' ? 'browse' : null,
      vehicleId: answersRef.current.selected_vehicle_id || null,
      variantId: variantId || null,
      insurancePreference: answersRef.current.insurance_preference || null,
      onFinish: (result) => handleInsuranceDone(result),
      // Cross-link (2026-07-19) — "Calculate EMI" on the estimate stage,
      // mirroring deliverAffordabilityReward's onCheckInsurance above.
      onCalculateEmi: vehicle ? () => {
        enterAffordabilityFromVariant(
          { id: vehicle.id, title: `${vehicle.brand} ${vehicle.model}` },
          { id: variantId, ex_showroom_price_lakh: exShowroom },
          returnTo,
        );
      } : undefined,
      onPhoneSaved: (phone, journeyRowId) => handlePhoneSaved('insurance', phone, journeyRowId),
      knownPhone: savedPhone,
    });
  }

  /**
   * Direct entry from a variants popup's "Check Insurance" button — used by
   * both the Budget result screen (returnTo: 'results', the default) and
   * now Browse (returnTo: 'detail', 2026-07-19). Mirrors
   * enterAffordabilityFromVariant(). Skips first_car/insurance_preference
   * entirely: first_car isn't actually read by computeInsurancePremium()
   * (saved for data purposes only, so leaving it unset here is honest, not
   * a fabricated answer); insurance_preference defaults to 'not_sure' (a
   * real, neutral, already-existing option — this avoids skewing toward
   * zero-dep's ~17% premium bump one way or the other). existing_ncb keeps
   * its usual 'not_provided' auto-fill. Prices against the specific
   * variant tapped, not the vehicle's price_min.
   */
  function enterInsuranceFromVariant(item, variant, returnTo = 'results') {
    track('check_insurance_from_variants', { vehicle_id: item.id, variant_id: variant?.id });
    answersRef.current = {
      ...answersRef.current,
      selected_vehicle_id: item.id,
      existing_ncb: 'not_provided',
      insurance_preference: 'not_sure',
    };
    dispatch({ type: 'ANSWER', questionId: 'selected_vehicle_id', value: item.id });
    dispatch({ type: 'ANSWER', questionId: 'existing_ncb', value: 'not_provided' });
    dispatch({ type: 'ANSWER', questionId: 'insurance_preference', value: 'not_sure' });
    saveAssessment(state.sessionId, {
      selected_vehicle_id: item.id,
      existing_ncb: 'not_provided',
      insurance_preference: 'not_sure',
    }).catch((e) => {
      console.error('[eevy] selected_vehicle_id/insurance defaults save failed (variants insurance):', e);
    });
    pushUserMessage(`Check insurance for ${item.title}`);
    deliverInsuranceReward(variant?.ex_showroom_price_lakh, returnTo, variant?.id);
  }

  /**
   * Post-Save write (2026-07-19, renamed from handleSaveVerified — no more
   * Firebase/OTP involved, per Ram's call: verification belongs at the
   * future dashboard LOGIN, not on Save itself). Called by
   * AffordabilityScreen/InsuranceScreen's onPhoneSaved once a phone number
   * is captured — either freshly typed into SavePhoneGate, or reused
   * automatically from savedPhone if this isn't the first Save this
   * session.
   *  - confirmJourneySave: ALWAYS runs — flips is_saved/saved_phone on the
   *    specific emi_calculated/insurance_calculated row (by the ref that
   *    row's own logJourneyEvent() call returned) — every new calculation
   *    is its own row needing its own confirmation, whether or not the
   *    phone was already known. Skipped gracefully if that ref never came
   *    back (e.g. the journey-log insert itself failed).
   *  - saveLead: ONLY on the FIRST Save this session (checked via
   *    savedPhone being empty beforehand) — re-calling /api/lead with the
   *    identical phone on every later Save added nothing and just burned
   *    rate-limit budget for free.
   * Then a plain acknowledgment message into the chat log.
   */
  function handlePhoneSaved(kind, phone, journeyRowId) {
    track('save_verified', { kind });
    const isFirstSave = !savedPhone;
    setSavedPhone(phone);

    if (journeyRowId) {
      confirmJourneySave(journeyRowId, phone).then((res) => {
        if (res?.matchedCount === 1) {
          console.log('[eevy] confirmJourneySave: row updated correctly.');
        } else if (res?.matchedCount === 0) {
          console.warn('[eevy] confirmJourneySave: request succeeded but matched ZERO rows — the ref sent doesn\'t match any client_ref in the table. Check whether client_ref is actually populated on the row this session logged.');
        } else {
          console.warn('[eevy] confirmJourneySave: unexpected response, no matchedCount present:', res);
        }
      }).catch((e) => {
        console.warn('[eevy] confirmJourneySave failed:', e.message);
      });
    } else {
      // If this ever fires: the emi_calculated/insurance_calculated
      // journey row's ref never made it back to the screen before Save
      // was clicked (either that insert failed silently — check for a
      // separate "[eevy] journey event log failed" warning around when
      // the breakdown/estimate first rendered — or it simply hadn't
      // resolved yet). Either way, is_saved/saved_phone can't be updated
      // for a row we never got an id for.
      console.warn('[eevy] confirmJourneySave skipped — no journey row ref was available at Save time.');
    }

    if (isFirstSave) {
      saveLead(state.sessionId, { name: nameRef.current, phone }).catch((e) => {
        console.error('[eevy] saveLead (post-save) failed:', e.message);
      });
    }

    pushBotMessage('text', "We've saved your quote — we'll keep it linked to your number.");
  }

  function handleInsuranceDone(result) {
    track('module_continue', { module_id: 'insurance' });
    if (result?.selectedInsurancePartner) handlePartnerSelect('insurance', result.selectedInsurancePartner);
    pushUserMessage('Got it — thanks');
    if (buyingKitQueueRef.current) {
      advanceBuyingKitQueue();
      return;
    }
    afterReward('insurance', () => showWelcome(nameRef.current));
  }

  function handlePartnerSelect(type, key) {
    track('partner_selected', { type, partner: key });
    const field = type === 'loan' ? 'selected_loan_partner' : 'selected_insurance_partner';
    answersRef.current = { ...answersRef.current, [field]: key };
    saveAssessment(state.sessionId, { [field]: key }).catch((e) => {
      console.warn(`[eevy] ${field} save failed (best-effort, allowlist unconfirmed):`, e.message);
    });
  }

  /**
   * Terminal action for every journey. No suggestions, no chaining into
   * another module, no "start over" option here — a single, unavoidable
   * "return to menu" step. Every journey (budget-list, budget/personalize,
   * Loan/EMI, insurance, browse) ends here, each independently — none of
   * them link into another.
   */
  function afterReward(moduleId, nextFn) {
    // The one save point for a whole flow's worth of answers — replaces the
    // old per-question + per-reward-screen saves (see handleAnswer /
    // deliverReward).
    saveAssessment(state.sessionId, answersRef.current).catch((e) => {
      console.error('[eevy] flow-end save failed:', e);
    });
    // Email gate removed — every flow now goes straight to its ending.
    // Sharing a result (Share button on the result screens) replaces "email
    // me this" as the way to take something away from a journey.
    const next = nextFn || finishJourney;
    next();
  }

  function tryEmailCapture(moduleId, next) {
    // ev-budget (the multi-select flow feeding ev-personalize) deliberately
    // excluded — it always continues straight into ev-personalize now (see
    // deliverReward), never reaches afterReward. ev-budget-list is its own
    // separate terminal flow and does need the gate.
    const deliverableModules = ['ev-budget-list', 'ev-personalize', 'affordability', 'insurance', 'browse', 'buying-kit'];
    if (!deliverableModules.includes(moduleId)) return false;
    if (leadCapturedRef.current.email) return false;
    postEmailActionRef.current = next;
    pendingEmailModuleRef.current = moduleId;
    track('lead_view', { field: 'email', module_id: moduleId });
    pushBotMessage('lead-email', { context: moduleId }, 500);
    return true;
  }

  function finishJourney() {
    pushBotMessage('text', "That's everything for this one.").then(() => {
      pushBotMessage('return-to-menu-cta', null, 250);
    });
  }

  function handleReturnToMenu() {
    pushUserMessage('eevy');
    showWelcome(nameRef.current);
  }

  // ---- Car-selection gate (Loan/EMI and Insurance both need a priced car) ----
  // RETIRED (2026-07-19, per Ram: "lost in evolution, retire it") — this
  // whole section (ensureVehicleSelected/handleCarSelectionChoice/
  // doQuickPick, and the 'top3' branch's ev-personalize dependency) is only
  // ever invoked via enterModule('affordability'/'insurance'), which
  // nothing in the live menu calls anymore (Loan/Insurance chips go
  // straight to PartnerBrowseScreen; Buying Kit, the other caller, has no
  // menu entry either). Left in place rather than deleted — a full removal
  // needs a proper dependency trace, flagged for a dedicated cleanup pass.
  //
  // No forced redirect through find-a-car and back — instead, a genuine
  // choice: quick-pick a brand+model, run the Top 3 flow, or browse. Whichever
  // path they pick, the moment a car is confirmed it drops straight back
  // into whichever calculator they actually asked for.

  function ensureVehicleSelected(onReady) {
    if (answersRef.current.selected_vehicle_id) {
      onReady(); // already have a car from a prior run or just-now selection
      return;
    }
    pendingCarSelectionRef.current = onReady;
    pushBotMessage('text', "First things first — let's get a car on file for you. How do you want to do that?").then(() => {
      pushBotMessage('car-selection-choice', null, 300);
    });
  }

  function handleCarSelectionChoice(choice) {
    const labels = { quickpick: 'I know which one', top3: 'Find my Top 3 first', browse: "Let's browse" };
    pushUserMessage(labels[choice] || choice);
    if (choice === 'top3') {
      startModule('ev-budget');
    } else if (choice === 'browse') {
      enterBrowseFlow();
    } else {
      doQuickPick();
    }
  }

  async function doQuickPick() {
    await pushBotMessage('text', "Good — which one is it?");
    try {
      const vehicles = await getCachedVehicles();
      const options = buildVehicleQuickPickOptions(vehicles);
      await pushBotMessage('vehicle-quickpick', options, 400);
    } catch (e) {
      console.error('[eevy] vehicle quickpick fetch failed:', e);
      await pushBotMessage('text', "I can't reach the vehicle list right now — mind trying again from the main menu in a bit?", 300);
    }
  }

  function handleVehicleQuickPickSelect(vehicleId, label) {
    pushUserMessage(label);
    answersRef.current = { ...answersRef.current, selected_vehicle_id: vehicleId };
    dispatch({ type: 'ANSWER', questionId: 'selected_vehicle_id', value: vehicleId });
    saveAssessment(state.sessionId, { selected_vehicle_id: vehicleId }).catch((e) => {
      console.error('[eevy] selected_vehicle_id save failed:', e);
    });
    const pending = pendingCarSelectionRef.current;
    pendingCarSelectionRef.current = null;
    if (pending) pending();
    else startModule('affordability'); // shouldn't normally happen — safety net
  }

  // ---- "Show all EVs" browse flow ----
  // Make -> model list -> full-screen Detail. Not a graph module — pure
  // catalogue browsing — but still ends through the same name/email gates
  // and the same universal "return to menu" finish as everything else.

  async function enterBrowseFlow() {
    try {
      const vehicles = await getCachedVehicles();
      const makes = buildMakeOptions(vehicles);
      await pushBotMessage('browse-make-chips', makes, 400);
    } catch (e) {
      console.error('[eevy] browse flow fetch failed:', e);
      await pushBotMessage('text', "Hmm, I can't reach the vehicle list right now — want to try the budget-based search instead?", 300);
    }
  }

  async function handleBrowseMakeSelect(brand, label) {
    pushUserMessage(label);
    const vehicles = await getCachedVehicles(); // already cached by this point, resolves instantly
    const models = buildModelOptionsForBrand(vehicles, brand).map(toListItem);
    await pushBotMessage('browse-model-list', models, 400);
  }

  function handleBrowseModelSelect(item) {
    pushUserMessage(item.title);
    track('detail_view', { vehicle_id: item.id });
    if (pendingCarSelectionRef.current) {
      // Detour from the EMI/Insurance car-selection gate — untouched,
      // exactly as before. "Select this one" still completes the
      // originally-pending request via finishBrowseSelection().
      onShowDetail(item, {
        onSelect: (selected) => finishBrowseSelection(selected),
      });
      return;
    }
    // Pure "Browse all EVs" from the main menu (2026-07-19) — no more
    // "Select this one"; landing on a model now offers Check Variants,
    // leading into the same Variants popup / EMI / Insurance flow the
    // Budget result screen already uses. Deliberately does NOT touch the
    // pendingCarSelectionRef detour case above. onClose (2026-07-19 fix)
    // makes the X button show a fresh main menu — same showWelcome() the
    // page-refresh fix uses — instead of silently revealing whatever was
    // already in the chat log.
    onShowDetail(item, {
      onClose: () => showWelcome(nameRef.current),
      onCalculateEmi: (vehicle, variant) => enterAffordabilityFromVariant(vehicle, variant, 'detail'),
      onCheckInsurance: (vehicle, variant) => enterInsuranceFromVariant(vehicle, variant, 'detail'),
    });
  }

  function finishBrowseSelection(item) {
    const proceed = () => {
      answersRef.current = { ...answersRef.current, selected_vehicle_id: item.id };
      dispatch({ type: 'ANSWER', questionId: 'selected_vehicle_id', value: item.id });
      saveAssessment(state.sessionId, { selected_vehicle_id: item.id }).catch((e) => {
        console.error('[eevy] selected_vehicle_id save failed:', e);
      });
      const pending = pendingCarSelectionRef.current;
      if (pending) {
        // This browse run was a detour to get a car for Loan/EMI or
        // Insurance — continue straight into that instead of browse's
        // own ending.
        pendingCarSelectionRef.current = null;
        pending();
        return;
      }
      if (buyingKitQueueRef.current) {
        advanceBuyingKitQueue();
        return;
      }
      // Ends the same way as every other flow now — straight back to the
      // main menu after the email gate, no "That's everything..." text,
      // no 'eevy' button.
      afterReward('browse', () => showWelcome(nameRef.current));
    };

    // Same name-before-first-reward gate as everywhere else — picking a
    // car via browse is just as much a "deliverable moment" as a Top 3 pick.
    if (!nameRef.current) {
      pendingPostNameActionRef.current = proceed;
      track('lead_view', { field: 'name', module_id: 'browse' });
      pushBotMessage('lead-name', null, 500);
      return;
    }
    proceed();
  }

  function handleNameSubmit(name) {
    pushUserMessage(name);
    track('lead_submitted', { field: 'name' });
    nameRef.current = name;
    dispatch({ type: 'SET_NAME', name });
    saveLead(state.sessionId, { name, answers: answersRef.current }).catch((e) => {
      console.error('[eevy] saveLead failed:', e.message);
    });

    const pendingAction = pendingPostNameActionRef.current;
    pendingPostNameActionRef.current = null;
    pushBotMessage('text', `Good to meet you, ${name}.`).then(() => {
      if (pendingAction) {
        pendingAction();
      } else {
        afterReward(activeModuleId);
      }
    });
  }

  function handleEmailSubmit(email) {
    pushUserMessage(email);
    track('lead_submitted', { field: 'email', module_id: activeModuleId });
    leadCapturedRef.current = { ...leadCapturedRef.current, email: true };
    dispatch({ type: 'SET_CONTACT', contact: { email } });
    dispatch({ type: 'LEAD_CAPTURED', captured: { email: true } });
    saveLead(state.sessionId, { name: nameRef.current, email, answers: answersRef.current }).catch((e) => {
      console.error('[eevy] saveLead failed:', e.message);
    });
    if (pendingEmailModuleRef.current === 'buying-kit') {
      const guideHtml = buyingKitDataRef.current
        ? buildGuideHtml(buyingKitDataRef.current, { name: nameRef.current })
        : null;
      notify(state.sessionId, { name: nameRef.current, email, guideHtml }).catch((e) => {
        console.error('[eevy] notify failed:', e.message);
      });
    }
    pendingEmailModuleRef.current = null;
    const next = postEmailActionRef.current;
    postEmailActionRef.current = null;
    pushBotMessage('text', "Perfect, sent it your way.").then(() => {
      if (next) next(); else finishJourney();
    });
  }

  function handleLeadSkip() {
    // Don't re-run tryEmailCapture — it would immediately re-show the same
    // prompt since leadCapturedRef.email is still false. Move straight to
    // finishing; the next journey will ask again.
    track('lead_skip', { field: 'email' });
    const next = postEmailActionRef.current;
    postEmailActionRef.current = null;
    pendingEmailModuleRef.current = null;
    if (next) next(); else finishJourney();
  }

  // Not currently wired to any chip — every journey now ends at
  // "Return to chat with eevy" rather than an explicit reset option. Left
  // in place in case a persistent reset control (e.g. a header button) is
  // wanted later; it's a full session reset (new sessionId, cleared
  // localStorage, fresh refs), not just a "back to menu" nav.
  function resetConversation() {
    clearPersistedSession();
    const newSessionId = genSessionId();
    dispatch({ type: 'RESET_SESSION', sessionId: newSessionId });

    answersRef.current = {};
    completedModulesRef.current = new Set();
    nameRef.current = null;
    leadCapturedRef.current = { email: false };
    pendingPostNameActionRef.current = null;
    postEmailActionRef.current = null;
    pendingEmailModuleRef.current = null;
    buyingKitDataRef.current = null;
    shortlistRef.current = [];
    setActiveModuleId(null);
    setActiveQuestionIdx(0);

    showWelcome(null);
  }
  void resetConversation; // silence unused-function lint until it's wired up somewhere

  return (
    <div className="chat-thread">
      <div className="chat-scroll">
        {state.messages.map((m, idx) => (
          <MessageBubble
            key={m.id}
            message={m}
            isLatest={idx === state.messages.length - 1}
            locked={typing}
            onIntentSelect={handleIntentSelect}
            onAnswer={handleAnswer}
            onVehicleQuickPickSelect={handleVehicleQuickPickSelect}
            onBrowseMakeSelect={handleBrowseMakeSelect}
            onBrowseModelSelect={handleBrowseModelSelect}
            onCarSelectionChoice={handleCarSelectionChoice}
            onNameSubmit={handleNameSubmit}
            onEmailSubmit={handleEmailSubmit}
            onLeadSkip={handleLeadSkip}
            onReturnToMenu={handleReturnToMenu}
            onBudgetConfirmChoice={handleBudgetConfirmChoice}
            onBuyingKitConfirmChoice={handleBuyingKitConfirmChoice}
          />
        ))}
        {typing && <TypingIndicator />}
        <div ref={threadEndRef} />
      </div>
      <div className="chat-footer">
        © 2026 <a href="https://eevy.in" target="_blank" rel="noopener noreferrer">eevy.india</a> · hello@eevy.in
      </div>
      <style>{`
        .chat-thread { display:flex; flex-direction:column; height:100%; }
        .chat-scroll { flex:1; overflow-y:auto; padding: 20px 16px 90px; display:flex; flex-direction:column; gap:14px; }
        .chat-footer {
          flex-shrink:0; text-align:center; padding:6px 0;
          font-size:0.6875rem; color: var(--ink-4);
        }
        .chat-footer a { color: var(--ink-4); text-decoration:underline; }
      `}</style>
    </div>
  );
}

function buildVehicleQuickPickOptions(vehicles) {
  const seen = new Map(); // key: "brand||model" -> cheapest variant representing that model
  for (const v of vehicles) {
    const key = `${v.brand}||${v.model}`;
    if (!seen.has(key) || v.price_min < seen.get(key).price_min) {
      seen.set(key, v);
    }
  }
  return Array.from(seen.values())
    .sort((a, b) => a.price_min - b.price_min)
    .map((v) => ({ v: v.id, l: `${v.brand} ${v.model}` }));
}

function buildMakeOptions(vehicles) {
  const modelsByBrand = new Map(); // brand -> Set(model) for a count label
  for (const v of vehicles) {
    if (!modelsByBrand.has(v.brand)) modelsByBrand.set(v.brand, new Set());
    modelsByBrand.get(v.brand).add(v.model);
  }
  return Array.from(modelsByBrand.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([brand, models]) => ({ v: brand, l: `${brand} (${models.size})` }));
}

function buildModelOptionsForBrand(vehicles, brand) {
  const seen = new Map(); // key: model -> cheapest variant representing that model
  for (const v of vehicles) {
    if (v.brand !== brand) continue;
    if (!seen.has(v.model) || v.price_min < seen.get(v.model).price_min) {
      seen.set(v.model, v);
    }
  }
  return Array.from(seen.values()).sort((a, b) => a.price_min - b.price_min);
}

function MessageBubble({
  message, isLatest, locked,
  onIntentSelect, onAnswer,
  onVehicleQuickPickSelect,
  onBrowseMakeSelect, onBrowseModelSelect,
  onCarSelectionChoice,
  onNameSubmit, onEmailSubmit, onLeadSkip,
  onReturnToMenu, onBudgetConfirmChoice, onBuyingKitConfirmChoice,
}) {
  const isBot = message.from === 'bot';
  const interactionDisabled = !isLatest || locked;
  if (message.kind === 'typing-gap') return null;

  return (
    <div className={`bubble-row ${isBot ? 'bubble-row-bot' : 'bubble-row-user'}`}>
      {isBot && <img className="bubble-avatar" src={eevyAvatar} alt="" />}
      <div className={`bubble ${isBot ? 'bubble-bot' : 'bubble-user'}`}>
        {renderContent()}
      </div>
      <style>{`
        .bubble-row { display:flex; align-items:flex-end; gap:8px; }
        .bubble-row-bot { justify-content:flex-start; }
        .bubble-row-user { justify-content:flex-end; }
        .bubble-avatar { width:28px; height:28px; border-radius:50%; object-fit:cover; flex-shrink:0; margin-bottom:2px; }
        .bubble {
          max-width: calc(90% - 36px); padding: 12px 16px; border-radius: var(--radius-md);
          font-size: 0.925rem; line-height:1.45;
        }
        .bubble-bot {
          background: var(--bubble-bot-bg); border:1px solid var(--bubble-bot-border);
          color: var(--ink-2); border-bottom-left-radius:6px;
        }
        .bubble-user {
          background: var(--bubble-user-bg); color: var(--bubble-user-text);
          border-bottom-right-radius:6px;
        }
      `}</style>
    </div>
  );

  function renderContent() {
    switch (message.kind) {
      case 'text':
        return message.payload;
      case 'intent-chips':
        return <ChipGroup options={message.payload.map((i) => ({ v: i.id, l: i.label, _intent: i }))}
          disabled={interactionDisabled}
          onSelect={(v) => onIntentSelect(message.payload.find((i) => i.id === v))} />;
      case 'question':
        return (
          <div>
            <p style={{ margin: '0 0 2px' }}>{message.payload.prompt}</p>
            <ChipGroup
              options={message.payload.question.opts}
              disabled={interactionDisabled}
              onSelect={(v, l, extraFields) => onAnswer(message.payload.question.id, v, l, extraFields)}
            />
          </div>
        );
      case 'budget-confirm':
        return (
          <div>
            <p style={{ margin: '0 0 2px' }}>{message.payload.text}</p>
            <ChipGroup
              options={[
                { v: 'continue', l: 'Continue with these' },
                { v: 'change', l: 'Change' },
              ]}
              disabled={interactionDisabled}
              onSelect={(v) => onBudgetConfirmChoice(v, message.payload.moduleId)}
            />
          </div>
        );
      case 'buying-kit-confirm':
        return (
          <div>
            <p style={{ margin: '0 0 2px' }}>{message.payload.text}</p>
            <ChipGroup
              options={[
                { v: 'start', l: "Let's do it" },
                { v: 'not_now', l: 'Not now' },
              ]}
              disabled={interactionDisabled}
              onSelect={(v) => onBuyingKitConfirmChoice(v)}
            />
          </div>
        );
      case 'vehicle-quickpick':
        return <ChipGroup
          options={message.payload}
          disabled={interactionDisabled}
          onSelect={(v, l) => onVehicleQuickPickSelect(v, l)}
        />;
      case 'browse-make-chips':
        return <ChipGroup
          options={message.payload}
          disabled={interactionDisabled}
          onSelect={(v, l) => onBrowseMakeSelect(v, l)}
        />;
      case 'browse-model-list':
        return <ChipGroup
          options={message.payload.map((item) => ({ v: item.id, l: `${item.title} · ${item.price}` }))}
          disabled={interactionDisabled}
          onSelect={(v) => onBrowseModelSelect(message.payload.find((i) => i.id === v))}
        />;
      case 'car-selection-choice':
        return <ChipGroup
          options={[
            { v: 'quickpick', l: 'I know which one' },
            { v: 'top3', l: 'Find my Top 3 first' },
            { v: 'browse', l: "Let's browse" },
          ]}
          disabled={interactionDisabled}
          onSelect={(v) => onCarSelectionChoice(v)}
        />;
      case 'lead-name':
        return <LeadCaptureBubble field="name" prompt="What should I call you?" disabled={interactionDisabled} onSubmit={onNameSubmit} />;
      case 'lead-email': {
        const prompt = message.payload.context === 'ev-budget-list'
          ? 'Shall I email you the list?'
          : message.payload.context === 'ev-personalize'
            ? 'Shall I email you your top 3?'
            : message.payload.context === 'affordability'
              ? 'Shall I email you this EMI estimate?'
              : message.payload.context === 'insurance'
                ? 'Shall I email you these insurance options?'
                : 'Where should I send this?';
        return <LeadCaptureBubble field="email" prompt={prompt} disabled={interactionDisabled} onSubmit={onEmailSubmit} />;
      }
      case 'return-to-menu-cta':
        return <ChipGroup
          options={[{ v: 'return', l: 'eevy' }]}
          disabled={interactionDisabled}
          onSelect={() => onReturnToMenu()}
        />;
      default:
        return null;
    }
  }
}

function TypingIndicator() {
  return (
    <div className="bubble-row bubble-row-bot">
      <img className="bubble-avatar" src={eevyAvatar} alt="" />
      <div className="bubble bubble-bot typing-bubble">
        <span className="dot" /><span className="dot" /><span className="dot" />
      </div>
      <style>{`
        .bubble-row { display:flex; align-items:flex-end; gap:8px; }
        .bubble-row-bot { justify-content:flex-start; }
        .bubble-avatar { width:28px; height:28px; border-radius:50%; object-fit:cover; flex-shrink:0; margin-bottom:2px; }
        .typing-bubble { display:flex; gap:4px; padding:14px 16px; }
        .dot { width:6px; height:6px; border-radius:50%; background: var(--ink-4); animation: bounce 1.2s infinite ease-in-out; }
        .dot:nth-child(2) { animation-delay: 0.15s; }
        .dot:nth-child(3) { animation-delay: 0.3s; }
        @keyframes bounce { 0%, 60%, 100% { transform: translateY(0); opacity:0.5; } 30% { transform: translateY(-4px); opacity:1; } }
      `}</style>
    </div>
  );
}

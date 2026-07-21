import React, { useState, useRef, useEffect } from 'react';
import { StoreProvider, useStore } from './state/store.jsx';
import ChatThread from './components/ChatThread.jsx';
import ResultsView from './components/ResultsView.jsx';
import DetailView from './components/DetailView.jsx';
import AffordabilityScreen from './components/AffordabilityScreen.jsx';
import InsuranceScreen from './components/InsuranceScreen.jsx';
import PartnerBrowseScreen from './components/PartnerBrowseScreen.jsx';
import BuyingKitScreen from './components/BuyingKitScreen.jsx';
import SavedJourneysDashboard from './components/SavedJourneysDashboard.jsx';
import NameGateScreen from './components/NameGateScreen.jsx';
import { buildVehicleSpecs } from './modules/vehicleSpecs.js';
import { saveLead } from './api/worker.js';
import { track } from './modules/analytics.js';
import eevyAvatar from './assets/eevy-avatar.png';

function AppInner() {
  const { state, dispatch } = useStore();

  // Fires once whenever a name becomes known — whether just submitted on
  // the landing gate, already known from a resumed session, or set via the
  // in-chat name gate — marking the moment the real chat interface is what
  // the person is actually looking at.
  useEffect(() => {
    if (state.name) track('chat_start');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.name]);

  // 'chat' | 'results' | 'detail' | 'finance' — ChatThread stays mounted
  // underneath at all times (see .app-main display toggle below) so its
  // internal refs/state survive switching screens; the others render as
  // overlays.
  const [screen, setScreen] = useState('chat');
  const [chatRefreshKey, setChatRefreshKey] = useState(0); // incremented whenever a screen that isn't part of ChatThread's own flow (currently just the dashboard) closes back to chat — tells ChatThread to show a fresh welcome instead of revealing whatever was last in the log
  const [resultsPayload, setResultsPayload] = useState(null); // { title, items, emptyReason, moduleId, selectionMode, maxSelect, continueLabel, onContinue }
  const [detailItem, setDetailItem] = useState(null);
  const [financePayload, setFinancePayload] = useState(null); // { kind: 'affordability'|'insurance', ...calculator data, onFinish }
  const [buyingKitData, setBuyingKitData] = useState(null); // pre-computed kit data from ChatThread's buildBuyingKitData()
  // Detail is entered from the Browse flow, in one of two modes decided by
  // ChatThread: the car-selection-gate detour (onSelect set, untouched) or
  // the direct main-menu Browse entry (onCalculateEmi/onCheckInsurance set
  // instead, 2026-07-19) — DetailView itself picks which CTA to render
  // based on which of these is present.
  const detailOnSelectRef = useRef(null);
  const detailOnCloseRef = useRef(null);
  const detailOnCalculateEmiRef = useRef(null);
  const detailOnCheckInsuranceRef = useRef(null);

  function showResults(payload) {
    setResultsPayload(payload);
    setScreen('results');
  }

  function showDetail(item, { onSelect, onClose, onCalculateEmi, onCheckInsurance } = {}) {
    detailOnSelectRef.current = onSelect || null;
    detailOnCloseRef.current = onClose || null;
    detailOnCalculateEmiRef.current = onCalculateEmi || null;
    detailOnCheckInsuranceRef.current = onCheckInsurance || null;
    setDetailItem(item);
    setScreen('detail');
  }

  function showFinance(payload) {
    setFinancePayload(payload);
    setScreen('finance');
  }

  // Called by ResultsView's own Continue button — already shaped correctly
  // (array for multi-select, single item for single-select).
  function handleContinue(selectedItemsOrItem) {
    const onContinue = resultsPayload?.onContinue;
    setScreen('chat');
    setResultsPayload(null);
    if (onContinue) onContinue(selectedItemsOrItem);
  }

  function handleCalculateEmi(item, variant) {
    const onCalculateEmi = resultsPayload?.onCalculateEmi;
    if (onCalculateEmi) onCalculateEmi(item, variant);
  }

  function handleCheckInsurance(item, variant) {
    const onCheckInsurance = resultsPayload?.onCheckInsurance;
    if (onCheckInsurance) onCheckInsurance(item, variant);
  }

  function handleSelectFromDetail(item) {
    const onSelect = detailOnSelectRef.current;
    setScreen('chat');
    setDetailItem(null);
    detailOnSelectRef.current = null;
    detailOnCloseRef.current = null;
    detailOnCalculateEmiRef.current = null;
    detailOnCheckInsuranceRef.current = null;
    if (onSelect) onSelect(item);
  }

  // New close button (2026-07-19 fix) — Detail previously had no way out
  // besides Select this one/Check Variants. Calls the caller-supplied
  // onClose if present (Browse's pure main-menu path wires this to
  // showWelcome() — see handleBrowseModelSelect); the retired
  // car-selection-gate detour never supplies one, so it just falls back to
  // a silent close, unchanged from before.
  function handleCloseDetail() {
    const onClose = detailOnCloseRef.current;
    setScreen('chat');
    setDetailItem(null);
    detailOnSelectRef.current = null;
    detailOnCloseRef.current = null;
    detailOnCalculateEmiRef.current = null;
    detailOnCheckInsuranceRef.current = null;
    if (onClose) onClose();
  }

  // Unlike handleSelectFromDetail, these do NOT tear down detailItem/screen
  // — Detail stays alive underneath (hidden), same principle as
  // resultsPayload above, so returning via financePayload's returnTo:
  // 'detail' resumes exactly the same browsed model + open Variants popup.
  function handleCalculateEmiFromDetail(item, variant) {
    const onCalculateEmi = detailOnCalculateEmiRef.current;
    if (onCalculateEmi) onCalculateEmi(item, variant);
  }

  function handleCheckInsuranceFromDetail(item, variant) {
    const onCheckInsurance = detailOnCheckInsuranceRef.current;
    if (onCheckInsurance) onCheckInsurance(item, variant);
  }

  function handleFinanceFinish(result) {
    const onFinish = financePayload?.onFinish;
    const returnTo = financePayload?.returnTo || 'chat'; // 'results' for the variants-triggered EMI entry; every other/older entry point keeps the existing 'chat' destination, unchanged.
    setScreen(returnTo);
    setFinancePayload(null);
    if (onFinish) onFinish(result);
  }

  function showBuyingKit(data) {
    setBuyingKitData(data);
    setScreen('buying-kit');
  }

  function handleBuyingKitContinue() {
    const onFinish = buyingKitData?.onFinish;
    setScreen('chat');
    setBuyingKitData(null);
    if (onFinish) onFinish();
  }

  function handleNameSubmit(name) {
    track('landing_name_submit');
    dispatch({ type: 'SET_NAME', name });
    saveLead(state.sessionId, { name }).catch((e) => {
      console.error('[eevy] landing gate saveLead failed:', e);
    });
  }

  return (
    <div className="app-shell">
      {state.name && (
        <header className="app-header">
          <img className="app-avatar" src={eevyAvatar} alt="Eevy" />
          <span className="app-logo">Chat with Eevy</span>
          <button className="app-menu-btn" onClick={() => setScreen('dashboard')} aria-label="My Saved Journeys">
            👤
          </button>
        </header>
      )}

      {!state.name ? (
        <main className="app-main">
          <NameGateScreen onSubmit={handleNameSubmit} />
        </main>
      ) : (
        <>
          <main className="app-main" style={{ display: screen === 'chat' ? 'block' : 'none' }}>
            <ChatThread onShowResults={showResults} onShowDetail={showDetail} onShowFinance={showFinance} onShowBuyingKit={showBuyingKit} refreshTrigger={chatRefreshKey} />
          </main>

          {resultsPayload && (
            <div className="app-overlay" style={{ display: screen === 'results' ? 'block' : 'none' }}>
              <ResultsView
                title={resultsPayload.title}
                subtitle={resultsPayload.subtitle}
                items={resultsPayload.items}
                selectionMode={resultsPayload.selectionMode}
                maxSelect={resultsPayload.maxSelect}
                continueLabel={resultsPayload.continueLabel}
                emptyLabel={
                  resultsPayload.emptyReason?.startsWith('error:')
                    ? `Couldn't reach the worker: ${resultsPayload.emptyReason.replace('error: ', '')}`
                    : undefined
                }
                onContinue={handleContinue}
                onCalculateEmi={resultsPayload.onCalculateEmi ? handleCalculateEmi : undefined}
                onCheckInsurance={resultsPayload.onCheckInsurance ? handleCheckInsurance : undefined}
                sessionId={state.sessionId}
              />
            </div>
          )}

          {detailItem && (
            <div className="app-overlay" style={{ display: screen === 'detail' ? 'block' : 'none' }}>
              <DetailView
                item={{
                  ...detailItem,
                  description: detailItem._raw?.why || detailItem._raw?.highlight || undefined,
                  specs: buildVehicleSpecs(detailItem._raw),
                  ctaLabel: 'Select this one',
                }}
                onClose={handleCloseDetail}
                onSelect={detailOnSelectRef.current ? handleSelectFromDetail : undefined}
                onCalculateEmi={detailOnCalculateEmiRef.current ? handleCalculateEmiFromDetail : undefined}
                onCheckInsurance={detailOnCheckInsuranceRef.current ? handleCheckInsuranceFromDetail : undefined}
                sessionId={state.sessionId}
              />
            </div>
          )}

          {screen === 'finance' && financePayload && (
            <div className="app-overlay">
              {financePayload.kind === 'affordability'
                ? <AffordabilityScreen {...financePayload} onFinish={handleFinanceFinish} />
                : financePayload.kind === 'insurance'
                ? <InsuranceScreen {...financePayload} onFinish={handleFinanceFinish} />
                : <PartnerBrowseScreen
                    partnerType={financePayload.partnerType}
                    onClose={() => handleFinanceFinish()}
                  />}
            </div>
          )}

          {screen === 'buying-kit' && buyingKitData && (
            <div className="app-overlay">
              <BuyingKitScreen data={buyingKitData} onContinue={handleBuyingKitContinue} />
            </div>
          )}

          {screen === 'dashboard' && (
            <div className="app-overlay">
              <SavedJourneysDashboard onClose={() => { setScreen('chat'); setChatRefreshKey((k) => k + 1); }} />
            </div>
          )}
        </>
      )}

      <style>{`
        .app-shell { height:100dvh; display:flex; flex-direction:column; max-width:560px; margin:0 auto; position:relative; }
        .app-header {
          padding: 12px 20px; border-bottom:1px solid var(--rule-soft);
          background: rgba(18,18,18,0.8); backdrop-filter: blur(10px);
          position:relative; z-index:2;
          display:flex; align-items:center; gap:10px;
        }
        .app-avatar { width:40px; height:40px; border-radius:50%; object-fit:cover; flex-shrink:0; }
        .app-logo { font-weight:700; font-size:1.05rem; color: var(--ink); letter-spacing:-0.01em; }
        .app-menu-btn {
          margin-left:auto; background:transparent; border:none; color:var(--ink-3);
          font-size:1.3rem; line-height:1; padding:6px; cursor:pointer;
        }
        .app-main { flex:1; overflow:hidden; padding: 0 20px; }
        .app-overlay {
          position:absolute; inset:0; top:65px; /* below header */
          background: var(--bg); z-index:1; overflow-y:auto;
          padding: 0 20px; box-sizing:border-box;
        }
        @media (max-width: 600px) { .app-main, .app-overlay { padding: 0 12px; } }
      `}</style>
    </div>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <AppInner />
    </StoreProvider>
  );
}

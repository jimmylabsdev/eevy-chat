import React, { useState, useRef, useEffect } from 'react';
import { StoreProvider, useStore } from './state/store.jsx';
import ChatThread from './components/ChatThread.jsx';
import ResultsView from './components/ResultsView.jsx';
import DetailView from './components/DetailView.jsx';
import AffordabilityScreen from './components/AffordabilityScreen.jsx';
import InsuranceScreen from './components/InsuranceScreen.jsx';
import BuyingKitScreen from './components/BuyingKitScreen.jsx';
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
  const [resultsPayload, setResultsPayload] = useState(null); // { title, items, emptyReason, moduleId, selectionMode, maxSelect, continueLabel, onContinue }
  const [detailItem, setDetailItem] = useState(null);
  const [financePayload, setFinancePayload] = useState(null); // { kind: 'affordability'|'insurance', ...calculator data, onFinish }
  const [buyingKitData, setBuyingKitData] = useState(null); // pre-computed kit data from ChatThread's buildBuyingKitData()
  // Detail is only ever entered directly from chat (the "Show all EVs"
  // browse flow) and has no back button — "Select this one" is its only
  // exit, forward into the same onSelect callback ChatThread provided.
  const detailOnSelectRef = useRef(null);
  const detailOnWhatsAppInterestRef = useRef(null);

  function showResults(payload) {
    setResultsPayload(payload);
    setScreen('results');
  }

  function showDetail(item, { onSelect, onWhatsAppInterest } = {}) {
    detailOnSelectRef.current = onSelect || null;
    detailOnWhatsAppInterestRef.current = onWhatsAppInterest || null;
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

  function handleFindTop3() {
    const onFindTop3 = resultsPayload?.onFindTop3;
    setScreen('chat');
    setResultsPayload(null);
    if (onFindTop3) onFindTop3();
  }

  function handleSelectFromDetail(item) {
    const onSelect = detailOnSelectRef.current;
    setScreen('chat');
    setDetailItem(null);
    detailOnSelectRef.current = null;
    detailOnWhatsAppInterestRef.current = null;
    if (onSelect) onSelect(item);
  }

  function handleFinanceFinish(result) {
    const onFinish = financePayload?.onFinish;
    setScreen('chat');
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
        </header>
      )}

      {!state.name ? (
        <main className="app-main">
          <NameGateScreen onSubmit={handleNameSubmit} />
        </main>
      ) : (
        <>
          <main className="app-main" style={{ display: screen === 'chat' ? 'block' : 'none' }}>
            <ChatThread onShowResults={showResults} onShowDetail={showDetail} onShowFinance={showFinance} onShowBuyingKit={showBuyingKit} />
          </main>

          {screen === 'results' && resultsPayload && (
            <div className="app-overlay">
              <ResultsView
                title={resultsPayload.title}
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
                onWhatsAppInterest={resultsPayload.onWhatsAppInterest}
                onFindTop3={resultsPayload.onFindTop3 ? handleFindTop3 : undefined}
              />
            </div>
          )}

          {screen === 'detail' && detailItem && (
            <div className="app-overlay">
              <DetailView
                item={{
                  ...detailItem,
                  description: detailItem._raw?.why || detailItem._raw?.highlight || undefined,
                  specs: buildVehicleSpecs(detailItem._raw),
                  ctaLabel: 'Select this one',
                }}
                onSelect={handleSelectFromDetail}
                onWhatsAppInterest={detailOnWhatsAppInterestRef.current}
              />
            </div>
          )}

          {screen === 'finance' && financePayload && (
            <div className="app-overlay">
              {financePayload.kind === 'affordability'
                ? <AffordabilityScreen {...financePayload} onFinish={handleFinanceFinish} />
                : <InsuranceScreen {...financePayload} onFinish={handleFinanceFinish} />}
            </div>
          )}

          {screen === 'buying-kit' && buyingKitData && (
            <div className="app-overlay">
              <BuyingKitScreen data={buyingKitData} onContinue={handleBuyingKitContinue} />
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

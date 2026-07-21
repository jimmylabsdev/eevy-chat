import React, { useState, useEffect } from 'react';
import AffordabilitySliders from './widgets/AffordabilitySliders.jsx';
import EstimateCard from './widgets/EstimateCard.jsx';
import PartnerTiles from './widgets/PartnerTiles.jsx';
import ConfirmContinueGate from './widgets/ConfirmContinueGate.jsx';
import SavePhoneGate from './widgets/SavePhoneGate.jsx';
import { logJourneyEvent } from '../api/worker.js';
import { track } from '../modules/analytics.js';

/**
 * variant: 'cash' | 'full' | 'incomeOnly' — same three payment_mode paths
 * as the original assessment (full_cash / loan / not_sure).
 * onRoadLakh/exShowroom: pre-computed pricing for this screen.
 * onFinish(result): called from the persistent X button, at whichever
 * stage the person is on — see note below.
 *
 * Markup/classes below (t-micro/t-display/t-small, .estimate-cards,
 * .disclaimer) are the same ones index.html uses on #screen-afford-sliders
 * / #screen-reward-finance — same screen, not a re-skinned equivalent.
 *
 * Stages (2026-07-19 restructure): 'lender' -> 'sliders' -> 'result' for
 * loan/incomeOnly paths; cash skips straight to 'result' (no lender to
 * pick). The 'lender' stage is a new dedicated full-page grid
 * (PartnerTiles layout="grid") — picking a lender there feeds that
 * lender's own min_interest_rate/max_tenure into the sliders stage as the
 * rate default / tenure cap, replacing the old fixed 8.5%/2-7yr assumption
 * that applied regardless of who was actually financing it.
 *
 * X button (top-left, present on all three stages) is the ONLY way out —
 * no per-stage "Continue"/"Back to eevy"/Share row anymore, since X
 * already covers that (calls the same onFinish with whatever's been
 * decided so far, exactly as the old bottom button used to, just
 * reachable from anywhere instead of only the last stage). Where X
 * actually navigates to is decided by the caller via financePayload's
 * returnTo field (see App.jsx's handleFinanceFinish) — this component
 * doesn't need to know or care.
 */
export default function AffordabilityScreen({ variant, onRoadLakh, exShowroom, onFinish, sessionId, flowName, vehicleId, variantId, onCheckInsurance, onPhoneSaved, knownPhone }) {
  const [stage, setStage] = useState(variant === 'cash' ? 'result' : 'lender');
  const [sliderResult, setSliderResult] = useState(null);
  const [selectedLoanPartner, setSelectedLoanPartner] = useState(null);
  const [lenderRatePct, setLenderRatePct] = useState(null);
  const [lenderMaxTenure, setLenderMaxTenure] = useState(null);
  const [showConfirmGate, setShowConfirmGate] = useState(false);
  const [showPhoneGate, setShowPhoneGate] = useState(false);
  const [journeyRowId, setJourneyRowId] = useState(null); // the emi_calculated row's ref, once logged — needed to confirm the save against the right row
  const [journeyLogStatus, setJourneyLogStatus] = useState(variant === 'cash' ? 'ready' : 'pending'); // cash never fires a journey log at all, so it's immediately 'ready'; non-cash waits for the insert to resolve
  const [hasSaved, setHasSaved] = useState(!!knownPhone); // starts true if a phone was already captured on the OTHER calculator this session — gates the cross-link confirm popup only
  const [thisRowSaved, setThisRowSaved] = useState(false); // specifically: has THIS calculation's journey row been confirmed — controls the Save button's own visible state

  // Journey log (2026-07-19) — fires once, the moment the breakdown
  // actually renders. Cash never reaches this (no loan tile involved), so
  // deliberately excluded. See handleJourneyEvent in the worker for why
  // this is a single row per completed flow, not a running log. Captures
  // the returned row ref so a later Save can flip is_saved on this exact
  // row — journeyLogStatus exists so Save can't be tapped mid-flight and
  // silently no-op (that gap was the actual bug behind is_saved/saved_phone
  // never updating: the confirm-save call was being skipped before the ref
  // ever arrived, with nothing visibly wrong since no request was even made).
  useEffect(() => {
    if (stage === 'result' && variant !== 'cash' && sliderResult) {
      logJourneyEvent(sessionId, {
        event_type: 'emi_calculated',
        flow_name: flowName,
        vehicle_id: vehicleId,
        variant_id: variantId,
        partner_key: selectedLoanPartner,
        partner_type: 'loan',
        ex_showroom_price_lakh: exShowroom,
        emi_amount: sliderResult.emi,
        down_payment_lakh: sliderResult.downPaymentLakh,
        tenure_years: sliderResult.tenureYears,
        rate_pct: sliderResult.ratePct,
      }).then((res) => {
        if (res?.ref) {
          setJourneyRowId(res.ref);
          setJourneyLogStatus('ready');
        } else {
          setJourneyLogStatus('failed');
        }
      });
      track('emi_calculated', {
        flow: flowName, vehicle_id: vehicleId, variant_id: variantId,
        partner_key: selectedLoanPartner, emi_amount: sliderResult.emi,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  function handleLenderPicked(partner) {
    setLenderRatePct(partner.min_interest_rate ?? null);
    setLenderMaxTenure(partner.max_tenure ?? null);
    setStage('sliders');
  }

  function handleSlidersDone(result) {
    setSliderResult(result);
    setStage('result');
  }

  function handleContinue() {
    onFinish({
      variant, onRoadLakh, exShowroom,
      ...(sliderResult || {}),
      selectedLoanPartner,
    });
  }

  function handleSaveClick() {
    if (knownPhone) {
      // Already captured on the other calculator this session — this new
      // journey row (a fresh emi_calculated for THIS visit) still needs
      // its own is_saved confirmed, but there's no reason to ask again.
      setHasSaved(true);
      setThisRowSaved(true);
      onPhoneSaved?.(knownPhone, journeyRowId);
      return;
    }
    setShowPhoneGate(true);
  }

  function handlePhoneSubmit(phone) {
    setShowPhoneGate(false);
    setHasSaved(true);
    setThisRowSaved(true);
    onPhoneSaved?.(phone, journeyRowId);
  }

  const isCash = variant === 'cash';

  const stageCopy = {
    lender: {
      micro: 'Choose a lender',
      title: 'Compare lenders.',
      small: 'Pick one to see EMI options based on their rates and tenure.',
    },
    sliders: {
      micro: 'Loan details',
      title: "Let's size your loan.",
      small: 'All figures are indicative estimates. Drag the sliders to match your plan.',
    },
    result: {
      micro: 'Cost estimate',
      title: "Here's what it'll cost.",
      small: 'Estimated on-road price and monthly EMI for your shortlisted EV.',
    },
  }[stage];

  return (
    <div className="finance-screen">
      <button className="finance-abort-btn" onClick={handleContinue} aria-label="Close">✕</button>

      <span className="t-micro">{stageCopy.micro}</span>
      <h2 className="t-display">{stageCopy.title}</h2>
      <p className="t-small">{stageCopy.small}</p>

      {stage === 'lender' && (
        <PartnerTiles
          type="loan"
          layout="grid"
          onSelect={setSelectedLoanPartner}
          onSelectPartner={handleLenderPicked}
        />
      )}

      {stage === 'sliders' && (
        <AffordabilitySliders
          mode={variant === 'full' ? 'full' : 'incomeOnly'}
          onRoadLakh={onRoadLakh}
          onDone={handleSlidersDone}
          initialRatePct={lenderRatePct}
          maxTenureYears={lenderMaxTenure}
        />
      )}

      {stage === 'result' && (
        <div className="estimate-cards">
          <EstimateCard
            icon="₹" title="On-Road Price Estimate" badge="Estimated"
            rows={[
              { label: 'Ex-showroom (est.)', value: `₹${exShowroom.toFixed(2)} lakh` },
              { label: 'Registration + taxes + charges (~15%)', value: `₹${(onRoadLakh - exShowroom).toFixed(2)} lakh` },
              { label: 'Estimated on-road total', value: `₹${onRoadLakh.toFixed(2)} lakh`, highlight: true },
            ]}
            callout={isCash ? { ok: true, text: 'Paying cash means no interest cost — a meaningful saving over financing the same amount.' } : null}
          />

          {!isCash && sliderResult && (
            <EstimateCard
              icon="📅" title="Monthly EMI Estimate" badge="Estimated"
              rows={[
                { label: 'Down payment', value: `₹${sliderResult.downPaymentLakh.toFixed(2)} lakh` },
                { label: 'Tenure', value: `${sliderResult.tenureYears} years` },
                { label: 'Interest rate', value: `${sliderResult.ratePct.toFixed(1)}% p.a.` },
                { label: 'Estimated EMI', value: sliderResult.emi > 0 ? `₹${sliderResult.emi.toLocaleString('en-IN')}/month` : '—', highlight: true },
              ]}
              callout={{ ok: false, text: `Rate set at ${sliderResult.ratePct.toFixed(1)}% p.a. Actual rate may vary. Get quotes from at least 2 lenders.` }}
            />
          )}

          <p className="disclaimer">
            All figures are indicative estimates. On-road price varies by city, variant, and applicable subsidies. Verify with your dealer before booking.
          </p>

          <div className="result-actions-row">
            <button className="btn btn-primary" disabled={thisRowSaved || journeyLogStatus === 'pending'} onClick={handleSaveClick}>
              {thisRowSaved ? 'Saved ✓' : 'Save'}
            </button>
            {onCheckInsurance && (
              <button className="btn btn-secondary" onClick={() => { hasSaved ? onCheckInsurance() : setShowConfirmGate(true); }}>Check Insurance</button>
            )}
          </div>

          {thisRowSaved && (
            <p className="save-confirm-text">Saved — we'll keep this linked to your number.</p>
          )}
        </div>
      )}

      {showConfirmGate && (
        <ConfirmContinueGate
          onSave={() => { setShowConfirmGate(false); handleSaveClick(); }}
          onContinue={() => { setShowConfirmGate(false); onCheckInsurance(); }}
        />
      )}

      {showPhoneGate && (
        <SavePhoneGate onSubmit={handlePhoneSubmit} onClose={() => setShowPhoneGate(false)} />
      )}

      <style>{`
        .finance-screen { padding: 44px 0 24px; display:flex; flex-direction:column; gap:4px; max-width:480px; margin:0 auto; position:relative; }
        .finance-abort-btn {
          position:fixed; top:78px; left:12px; z-index:10;
          width:32px; height:32px; border-radius:50%; border:none;
          background: rgba(0,0,0,0.45); color:#fff; font-size:0.9rem;
          display:flex; align-items:center; justify-content:center; cursor:pointer;
        }
        .t-micro { font-size:0.75rem; font-weight:600; letter-spacing:0.08em; text-transform:uppercase; color:var(--ink-4); }
        .t-display { font-size:clamp(1.45rem,4vw,2.2rem); font-weight:700; line-height:1.18; letter-spacing:-0.025em; margin:8px 0 4px; color:var(--ink); }
        .t-small { font-size:0.875rem; line-height:1.55; color:var(--ink-3); margin:0 0 20px; }
        .estimate-cards { display:flex; flex-direction:column; gap:12px; }
        .disclaimer { padding:12px 0; font-size:0.6875rem; color:var(--ink-5); text-align:center; line-height:1.55; }
        .btn {
          display:flex; align-items:center; justify-content:center; gap:8px;
          border-radius:var(--radius-md); font-weight:700; cursor:pointer;
          transition:var(--tr); border:none; text-decoration:none; user-select:none;
        }
        .btn-primary {
          background:var(--orange); color:#fff; font-size:1rem;
          padding:17px 28px; width:100%; box-shadow:var(--shadow-orange);
        }
        .btn-primary:hover { background:var(--orange-dark); }
        .btn-primary:disabled { background:var(--green); cursor:default; opacity:0.9; }
        .save-confirm-text { margin:8px 0 0; font-size:0.8125rem; color:var(--green); text-align:center; }
        .btn-secondary {
          background:transparent; border:1.5px solid var(--rule); color:var(--ink);
          font-size:0.95rem; padding:15.5px 24px; width:100%;
        }
        .result-actions-row { display:flex; gap:10px; margin-top:4px; }
        .result-actions-row .btn { flex:1; width:auto; }
      `}</style>
    </div>
  );
}

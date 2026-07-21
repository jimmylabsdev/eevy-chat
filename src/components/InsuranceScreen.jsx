import React, { useState, useEffect } from 'react';
import EstimateCard from './widgets/EstimateCard.jsx';
import PartnerTiles from './widgets/PartnerTiles.jsx';
import ConfirmContinueGate from './widgets/ConfirmContinueGate.jsx';
import SavePhoneGate from './widgets/SavePhoneGate.jsx';
import { logJourneyEvent } from '../api/worker.js';

/**
 * onRoad/idv/premium/gst/total/ncb/coverageLabel: pre-computed breakdown
 * (see computeInsurancePremium in modules/finance.js). exShowroom: the
 * underlying ex-showroom figure onRoad was computed from (2026-07-19,
 * added alongside the journey-log wiring below — onRoad alone isn't the
 * same figure the loan flow's journey rows use for ex_showroom_price_lakh).
 * onFinish(result): called from the persistent X button, at whichever
 * stage the person is on — see AffordabilityScreen.jsx for the fuller
 * explanation of this pattern (X reuses the same finish logic the old
 * "Back to eevy" button used, just reachable from any stage instead of
 * only the last one; where it navigates to is decided by the caller via
 * financePayload's returnTo field in App.jsx).
 *
 * Markup/classes mirror index.html's #screen-reward-insurance
 * (.estimate-cards, .disclaimer) — same screen, not a re-skinned equivalent.
 *
 * Stages (2026-07-19 restructure): 'provider' -> 'result'. Unlike the loan
 * flow's lender pick, which feeds the rate/tenure sliders, picking an
 * insurer here doesn't change the premium math at all — the estimate is
 * identical regardless of which insurer's tile was tapped. So this stage
 * exists purely to let people browse/compare before seeing the number,
 * not to feed anything forward.
 */
export default function InsuranceScreen({
  onRoad, exShowroom, idv, premium, gst, total, ncb, coverageLabel, onFinish,
  sessionId, flowName, vehicleId, variantId, insurancePreference, onCalculateEmi, onPhoneSaved, knownPhone,
}) {
  const [stage, setStage] = useState('provider');
  const [selectedInsurancePartner, setSelectedInsurancePartner] = useState(null);
  const [showConfirmGate, setShowConfirmGate] = useState(false);
  const [showPhoneGate, setShowPhoneGate] = useState(false);
  const [journeyRowId, setJourneyRowId] = useState(null); // the insurance_calculated row's ref, once logged
  const [journeyLogStatus, setJourneyLogStatus] = useState('pending'); // no "cash" carve-out here — every path through InsuranceScreen fires this log
  const [hasSaved, setHasSaved] = useState(!!knownPhone); // starts true if a phone was already captured on the OTHER calculator this session — gates the cross-link confirm popup only
  const [thisRowSaved, setThisRowSaved] = useState(false); // specifically: has THIS calculation's journey row been confirmed — controls the Save button's own visible state

  // Journey log (2026-07-19) — fires once, the moment the estimate stage
  // is reached. Unlike the loan flow there's no "cash" exclusion — every
  // path through InsuranceScreen ends up here. Captures the returned row
  // ref so a later Save can flip is_saved on this exact row —
  // journeyLogStatus exists so Save can't be tapped mid-flight and
  // silently no-op (that gap was the actual bug behind is_saved/saved_phone
  // never updating: the confirm-save call was being skipped before the ref
  // ever arrived, with nothing visibly wrong since no request was even made).
  useEffect(() => {
    if (stage === 'result') {
      logJourneyEvent(sessionId, {
        event_type: 'insurance_calculated',
        flow_name: flowName,
        vehicle_id: vehicleId,
        variant_id: variantId,
        partner_key: selectedInsurancePartner,
        partner_type: 'insurance',
        ex_showroom_price_lakh: exShowroom,
        premium_amount: total,
        insurance_preference: insurancePreference,
      }).then((res) => {
        if (res?.ref) {
          setJourneyRowId(res.ref);
          setJourneyLogStatus('ready');
        } else {
          setJourneyLogStatus('failed');
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  function handleContinue() {
    onFinish({ selectedInsurancePartner });
  }

  function handleSaveClick() {
    if (knownPhone) {
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

  const stageCopy = {
    provider: {
      tag: 'Choose an insurer',
      title: 'Compare insurers.',
      small: 'Pick one to see EV-specific covers worth asking for.',
    },
    result: {
      tag: 'First-year estimate',
      title: 'Insurance estimate.',
      small: 'A rough idea of what first-year insurance may cost.',
    },
  }[stage];

  return (
    <div className="finance-screen">
      <button className="finance-abort-btn" onClick={handleContinue} aria-label="Close">✕</button>

      <div className="matched-tag"><span className="m-dot" />{stageCopy.tag}</div>
      <h2 className="t-display">{stageCopy.title}</h2>
      <p className="t-small">{stageCopy.small}</p>

      {stage === 'provider' && (
        <PartnerTiles
          type="insurance"
          layout="grid"
          onSelect={setSelectedInsurancePartner}
          onSelectPartner={() => setStage('result')}
        />
      )}

      {stage === 'result' && (
        <div className="estimate-cards">
          <EstimateCard
            icon="🛡️" title="First-Year Insurance Estimate" badge="Estimated"
            rows={[
              { label: 'Insured Declared Value (IDV)', value: `₹${onRoad.toFixed(1)} lakh` },
              { label: 'Coverage type', value: coverageLabel },
              { label: ncb > 0 ? `NCB discount (${Math.round(ncb * 100)}%)` : 'No NCB applied', value: ncb > 0 ? `-₹${Math.round(idv * (1.8 / 100) * ncb / 1000)}K` : '—' },
              { label: 'Estimated premium (before GST)', value: `₹${(premium / 1000).toFixed(1)}K` },
              { label: 'GST @ 18%', value: `₹${(gst / 1000).toFixed(1)}K` },
              { label: 'Estimated first-year total', value: `₹${(total / 1000).toFixed(1)}K`, highlight: true },
            ]}
            callout={{ ok: true, text: 'Zero Depreciation cover is worth the extra spend for an EV — battery replacements are expensive, and zero dep means no deduction on claims.' }}
          />

          <EstimateCard
            icon="💡" title="What to Know"
            rows={[
              { label: 'EV-specific coverage', value: 'Ask about battery cover' },
              { label: 'Roadside assistance', value: 'Insist on this add-on' },
              { label: 'Get quotes from', value: '2+ insurers' },
            ]}
            callout={{ ok: false, text: "Don't compare on premium alone — check the claim settlement ratio and any EV-specific exclusions before you choose." }}
          />

          <p className="disclaimer">These are broad market estimates only. Actual premiums vary by insurer, add-ons, and model year. Get quotes from at least two insurers before buying.</p>

          <div className="result-actions-row">
            <button className="btn btn-primary" disabled={thisRowSaved || journeyLogStatus === 'pending'} onClick={handleSaveClick}>
              {thisRowSaved ? 'Saved ✓' : 'Save'}
            </button>
            {onCalculateEmi && (
              <button className="btn btn-secondary" onClick={() => { hasSaved ? onCalculateEmi() : setShowConfirmGate(true); }}>Calculate EMI</button>
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
          onContinue={() => { setShowConfirmGate(false); onCalculateEmi(); }}
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
        .matched-tag {
          display:inline-flex; align-items:center; gap:6px;
          background:var(--green-light); color:var(--green);
          font-size:0.6875rem; font-weight:700; letter-spacing:0.07em; text-transform:uppercase;
          padding:5px 10px; border-radius:100px; margin-bottom:14px; width:fit-content;
        }
        .m-dot { width:5px; height:5px; border-radius:50%; background:var(--green); }
        .t-display { font-size:clamp(1.45rem,4vw,2.2rem); font-weight:700; line-height:1.18; letter-spacing:-0.025em; margin:0 0 4px; color:var(--ink); }
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

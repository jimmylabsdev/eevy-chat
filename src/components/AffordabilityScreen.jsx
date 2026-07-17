import React, { useState } from 'react';
import AffordabilitySliders from './widgets/AffordabilitySliders.jsx';
import EstimateCard from './widgets/EstimateCard.jsx';
import PartnerTiles from './widgets/PartnerTiles.jsx';
import ShareButton from './widgets/ShareButton.jsx';

/**
 * variant: 'cash' | 'full' | 'incomeOnly' — same three payment_mode paths
 * as the original assessment (full_cash / loan / not_sure).
 * onRoadLakh/exShowroom: pre-computed pricing for this screen.
 * onFinish(result): called once the person taps Continue on the result stage.
 *
 * Markup/classes below (t-micro/t-display/t-small, .estimate-cards,
 * .disclaimer, .bank-tiles-section) are the same ones index.html uses on
 * #screen-afford-sliders / #screen-reward-finance — same screen, not a
 * re-skinned equivalent.
 */
export default function AffordabilityScreen({ variant, onRoadLakh, exShowroom, onFinish, onWhatsAppInterest }) {
  const [stage, setStage] = useState(variant === 'cash' ? 'result' : 'sliders');
  const [sliderResult, setSliderResult] = useState(null);
  const [selectedLoanPartner, setSelectedLoanPartner] = useState(null);

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

  const isCash = variant === 'cash';

  return (
    <div className="finance-screen">
      <span className="t-micro">{stage === 'sliders' ? 'Loan details' : 'Cost estimate'}</span>
      <h2 className="t-display">{stage === 'sliders' ? "Let's size your loan." : "Here's what it'll cost."}</h2>
      <p className="t-small">
        {stage === 'sliders'
          ? 'All figures are indicative estimates for the lowest variant. Drag the sliders to match your plan.'
          : 'Estimated on-road price and monthly EMI for your shortlisted EV.'}
      </p>

      {stage === 'sliders' && (
        <AffordabilitySliders
          mode={variant === 'full' ? 'full' : 'incomeOnly'}
          onRoadLakh={onRoadLakh}
          onDone={handleSlidersDone}
        />
      )}

      {stage === 'result' && (
        <div className="estimate-cards">
          <EstimateCard
            icon="₹" title="On-Road Price Estimate" badge="Estimated"
            rows={[
              { label: 'Ex-showroom — lowest variant (est.)', value: `₹${exShowroom.toFixed(2)} lakh` },
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

          {!isCash && (
            <div className="bank-tiles-section">
              <p className="bank-tiles-label">COMPARE LENDER RATES</p>
              <PartnerTiles type="loan" onSelect={setSelectedLoanPartner} onWhatsAppInterest={onWhatsAppInterest} />
              <p className="bank-tiles-disclaimer">For current rates and offers, contact banks directly. Rates are indicative.</p>
            </div>
          )}

          <p className="disclaimer">
            All figures are indicative estimates. On-road price varies by city, variant, and applicable subsidies. Verify with your dealer before booking.
          </p>

          <div className="result-btn-row">
            <button className="btn btn-primary" onClick={handleContinue}>Back to eevy</button>
            <ShareButton
              title="My EV cost estimate — eevy"
              text={[
                `On-road price: ₹${onRoadLakh.toFixed(2)} lakh`,
                !isCash && sliderResult ? `Down payment: ₹${sliderResult.downPaymentLakh.toFixed(2)} lakh` : null,
                !isCash && sliderResult ? `EMI: ₹${sliderResult.emi.toLocaleString('en-IN')}/month over ${sliderResult.tenureYears} years` : null,
                isCash ? 'Paying cash — no EMI' : null,
              ].filter(Boolean).join('\n')}
              shareKey="affordability"
            />
          </div>
        </div>
      )}

      <style>{`
        .finance-screen { padding: 4px 0 24px; display:flex; flex-direction:column; gap:4px; max-width:480px; margin:0 auto; }
        .t-micro { font-size:0.75rem; font-weight:600; letter-spacing:0.08em; text-transform:uppercase; color:var(--ink-4); }
        .t-display { font-size:clamp(1.45rem,4vw,2.2rem); font-weight:700; line-height:1.18; letter-spacing:-0.025em; margin:8px 0 4px; color:var(--ink); }
        .t-small { font-size:0.875rem; line-height:1.55; color:var(--ink-3); margin:0 0 20px; }
        .estimate-cards { display:flex; flex-direction:column; gap:12px; }
        .bank-tiles-section { padding:0 0 4px; }
        .bank-tiles-label {
          font-size:0.5625rem; font-weight:700; letter-spacing:0.1em; text-transform:uppercase;
          color:var(--ink-4); margin-bottom:8px;
        }
        .bank-tiles-disclaimer { font-size:0.5rem; color:var(--ink-5); padding:5px 0 0; line-height:1.5; font-style:italic; }
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
        .result-btn-row { display:flex; gap:10px; }
        .result-btn-row .btn-primary { flex:1; width:auto; }
      `}</style>
    </div>
  );
}

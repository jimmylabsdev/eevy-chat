import React, { useState } from 'react';
import EstimateCard from './widgets/EstimateCard.jsx';
import PartnerTiles from './widgets/PartnerTiles.jsx';
import ShareButton from './widgets/ShareButton.jsx';

/**
 * onRoad/idv/premium/gst/total/ncb/coverageLabel: pre-computed breakdown
 * (see computeInsurancePremium in modules/finance.js).
 * onFinish(result): called once the person taps Continue.
 *
 * Markup/classes mirror index.html's #screen-reward-insurance
 * (.estimate-cards, .disclaimer, .bank-tiles-section) — same screen, not a
 * re-skinned equivalent.
 */
export default function InsuranceScreen({ onRoad, idv, premium, gst, total, ncb, coverageLabel, onFinish, onWhatsAppInterest }) {
  const [selectedInsurancePartner, setSelectedInsurancePartner] = useState(null);

  function handleContinue() {
    onFinish({ selectedInsurancePartner });
  }

  return (
    <div className="finance-screen">
      <div className="matched-tag"><span className="m-dot" />First-year estimate</div>
      <h2 className="t-display">Insurance estimate.</h2>
      <p className="t-small">A rough idea of what first-year insurance may cost.</p>

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

        <div className="bank-tiles-section">
          <p className="bank-tiles-label">EV-SPECIFIC COVERS TO ASK FOR</p>
          <PartnerTiles type="insurance" onSelect={setSelectedInsurancePartner} onWhatsAppInterest={onWhatsAppInterest} />
          <p className="bank-tiles-disclaimer">EV-specific add-ons vary by policy and model year. Confirm availability with your insurer.</p>
        </div>

        <div className="result-btn-row">
          <button className="btn btn-primary" onClick={handleContinue}>Back to eevy</button>
          <ShareButton
            title="My insurance estimate — eevy"
            text={[
              `Coverage: ${coverageLabel}`,
              `Estimated first-year premium: ₹${(total / 1000).toFixed(1)}K`,
              `IDV: ₹${onRoad.toFixed(1)} lakh`,
            ].join('\n')}
            shareKey="insurance"
          />
        </div>
      </div>

      <style>{`
        .finance-screen { padding: 4px 0 24px; display:flex; flex-direction:column; gap:4px; max-width:480px; margin:0 auto; }
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

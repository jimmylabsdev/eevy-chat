import React, { useState, useMemo } from 'react';

/** Simple flat-rate EMI approximation for the inline estimate — same formula logic as index.html sliders. */
function estimateEmi(principal, tenureMonths, annualRatePct) {
  const r = annualRatePct / 12 / 100;
  if (r === 0) return principal / tenureMonths;
  const emi = (principal * r * Math.pow(1 + r, tenureMonths)) / (Math.pow(1 + r, tenureMonths) - 1);
  return Math.round(emi);
}

export default function SliderBubble({ onDone, disabled }) {
  const [principal, setPrincipal] = useState(1200000);
  const [tenure, setTenure] = useState(60);

  const emi = useMemo(() => estimateEmi(principal, tenure, 9.5), [principal, tenure]);

  return (
    <div className="slider-bubble">
      <div className="slider-row">
        <div className="slider-label">
          <span>Loan amount</span>
          <strong>₹{(principal / 100000).toFixed(1)}L</strong>
        </div>
        <input
          type="range" min="300000" max="4000000" step="50000"
          value={principal} disabled={disabled}
          onChange={(e) => setPrincipal(Number(e.target.value))}
        />
      </div>
      <div className="slider-row">
        <div className="slider-label">
          <span>Tenure</span>
          <strong>{tenure} months</strong>
        </div>
        <input
          type="range" min="12" max="84" step="6"
          value={tenure} disabled={disabled}
          onChange={(e) => setTenure(Number(e.target.value))}
        />
      </div>
      <div className="emi-result">
        <span>Estimated EMI</span>
        <strong>₹{emi.toLocaleString('en-IN')}/mo</strong>
      </div>
      <button className="slider-done" disabled={disabled} onClick={() => onDone({ principal, tenure, emi })}>
        Looks good
      </button>

      <style>{`
        .slider-bubble { display:flex; flex-direction:column; gap:14px; width:100%; }
        .slider-row { display:flex; flex-direction:column; gap:6px; }
        .slider-label { display:flex; justify-content:space-between; font-size:0.85rem; color: var(--ink-3); }
        .slider-label strong { color: var(--ink); }
        input[type="range"] { width:100%; accent-color: var(--teal); }
        .emi-result {
          display:flex; justify-content:space-between; align-items:baseline;
          background: rgba(13,148,136,0.1); border:1px solid rgba(13,148,136,0.3);
          border-radius: var(--radius-sm); padding: 10px 14px; margin-top:4px;
        }
        .emi-result span { color: var(--ink-3); font-size:0.85rem; }
        .emi-result strong { color: var(--teal); font-size:1.15rem; }
        .slider-done {
          background: var(--brand); border:none; color:#fff; border-radius: var(--radius-sm);
          padding: 10px 16px; cursor:pointer; font-weight:600; font-size:0.9rem;
        }
      `}</style>
    </div>
  );
}

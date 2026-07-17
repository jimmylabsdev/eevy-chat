import React, { useState, useMemo } from 'react';
import { computeEmi, DEFAULT_TENURE_YEARS, DEFAULT_RATE_PCT, INCOME_BANDS, INCOME_BAND_KEYS, DEFAULT_INCOME_IDX } from '../../modules/finance.js';

const DP_HINT = 'Amount you pay upfront from your own pocket';
const TENURE_HINT = 'Longer tenure = lower EMI, but more interest overall';
const RATE_HINT = 'Varies by lender and profile. 8.5–10% is typical for salaried buyers';
const INCOME_HINT = 'Helps us gauge loan eligibility (not stored separately)';

/**
 * Verbatim visual port of index.html's #screen-afford-sliders /
 * #screen-afford-income (.slider-group / .slider-label-row / .slider-hint /
 * .insight-card, same range-input thumb styling) — same markup and CSS as
 * the original, not a re-skinned equivalent.
 *
 * mode: 'full' (payment_mode === 'loan' — down payment + tenure + rate + income)
 *       or 'incomeOnly' (payment_mode === 'not_sure' — just the income band,
 *       same defaults as the old showAffordabilityIncome() screen: down
 *       payment ~20%, tenure 5yr, rate 8.5%).
 * onRoadLakh: pre-computed on-road price this screen estimates against.
 */
export default function AffordabilitySliders({ mode, onRoadLakh, onDone, disabled }) {
  const defaultDp = Math.round(onRoadLakh * 0.2 * 10) / 10;
  const maxDp = Math.min(Math.round(onRoadLakh * 0.5 * 10) / 10, 20);

  const [downPayment, setDownPayment] = useState(defaultDp);
  const [tenureYears, setTenureYears] = useState(DEFAULT_TENURE_YEARS);
  const [ratePct, setRatePct] = useState(DEFAULT_RATE_PCT);
  const [incomeIdx, setIncomeIdx] = useState(DEFAULT_INCOME_IDX);

  const isFull = mode === 'full';
  const effectiveDp = isFull ? downPayment : defaultDp;
  const effectiveTenure = isFull ? tenureYears : DEFAULT_TENURE_YEARS;
  const effectiveRate = isFull ? ratePct : DEFAULT_RATE_PCT;

  const emi = useMemo(
    () => computeEmi({ onRoadLakh, downPaymentLakh: effectiveDp, tenureYears: effectiveTenure, ratePct: effectiveRate }),
    [onRoadLakh, effectiveDp, effectiveTenure, effectiveRate]
  );

  function submit() {
    onDone({
      downPaymentLakh: effectiveDp,
      tenureYears: effectiveTenure,
      ratePct: effectiveRate,
      incomeBand: INCOME_BAND_KEYS[incomeIdx] || '1_2l',
      emi,
    });
  }

  return (
    <div className="affordability-single">
      {isFull ? (
        <div className="insight-card">
          <p>Estimated on-road price: <strong>₹{onRoadLakh.toFixed(1)} lakh</strong> &nbsp;·&nbsp; Rate assumed at ~8.5% p.a.</p>
        </div>
      ) : (
        <div className="insight-card">
          <p>This helps us give you a realistic on-road cost estimate.</p>
        </div>
      )}

      {isFull && (
        <>
          <SliderRow label="Down payment" value={`₹${downPayment.toFixed(1)} lakh`} hint={DP_HINT}>
            <input type="range" min={0.5} max={Math.max(maxDp, 1)} step={0.5} value={downPayment}
              disabled={disabled} onChange={(e) => setDownPayment(Number(e.target.value))} />
          </SliderRow>
          <SliderRow label="Loan tenure" value={`${tenureYears} years`} hint={TENURE_HINT}>
            <input type="range" min={2} max={7} step={1} value={tenureYears}
              disabled={disabled} onChange={(e) => setTenureYears(Number(e.target.value))} />
          </SliderRow>
          <SliderRow label="Interest rate" value={`${ratePct.toFixed(1)}%`} hint={RATE_HINT}>
            <input type="range" min={8} max={13} step={0.5} value={ratePct}
              disabled={disabled} onChange={(e) => setRatePct(Number(e.target.value))} />
          </SliderRow>
        </>
      )}

      <SliderRow label={isFull ? 'Monthly household income' : 'Monthly income'} value={INCOME_BANDS[incomeIdx]} hint={isFull ? INCOME_HINT : null}>
        <input type="range" min={0} max={3} step={1} value={incomeIdx}
          disabled={disabled} onChange={(e) => setIncomeIdx(Number(e.target.value))} />
      </SliderRow>

      {isFull && (
        <div className="insight-card">
          <p>Estimated monthly EMI: <strong style={{ color: 'var(--orange)' }}>{emi > 0 ? `₹${emi.toLocaleString('en-IN')}/month` : '—'}</strong></p>
        </div>
      )}

      <button className="btn btn-primary" disabled={disabled} onClick={submit}>
        {isFull ? 'See Your Cost Breakdown' : 'See My Cost Estimate'}
      </button>

      <style>{`
        .affordability-single { padding:4px 0 8px; display:flex; flex-direction:column; gap:0; }
        .insight-card {
          background:var(--surface); border-left:3px solid var(--orange);
          border-radius:0 var(--radius-sm) var(--radius-sm) 0;
          padding:14px 16px; margin-bottom:20px; box-shadow:var(--shadow-card);
        }
        .insight-card p { font-size:0.8125rem; color:var(--ink-3); line-height:1.55; margin:0; }
        .insight-card strong { color:var(--ink-2); font-weight:600; }
        .slider-group { margin-bottom:20px; }
        .slider-label-row { display:flex; justify-content:space-between; align-items:baseline; margin-bottom:8px; }
        .slider-label { font-size:0.875rem; font-weight:600; color:var(--ink-2); }
        .slider-val { font-size:1rem; font-weight:700; color:var(--orange); }
        .slider-group input[type=range] {
          width:100%; -webkit-appearance:none; appearance:none;
          height:6px; border-radius:3px; background:var(--rule); outline:none;
          transition:background 0.2s;
        }
        .slider-group input[type=range]::-webkit-slider-thumb {
          -webkit-appearance:none; appearance:none;
          width:22px; height:22px; border-radius:50%;
          background:var(--orange); border:3px solid #fff;
          box-shadow:0 2px 8px rgba(240,106,34,0.35); cursor:pointer;
        }
        .slider-group input[type=range]::-moz-range-thumb {
          width:22px; height:22px; border-radius:50%;
          background:var(--orange); border:3px solid #fff;
          box-shadow:0 2px 8px rgba(240,106,34,0.35); cursor:pointer;
        }
        .slider-hint { font-size:0.75rem; color:var(--ink-4); margin-top:5px; }
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
        .btn-primary:disabled { background:var(--ink-5); box-shadow:none; cursor:not-allowed; }
      `}</style>
    </div>
  );
}

function SliderRow({ label, value, hint, children }) {
  return (
    <div className="slider-group">
      <div className="slider-label-row">
        <span className="slider-label">{label}</span>
        <span className="slider-val">{value}</span>
      </div>
      {children}
      {hint && <p className="slider-hint">{hint}</p>}
    </div>
  );
}

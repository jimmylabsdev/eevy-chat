import React, { useState } from 'react';
import ShareButton from './widgets/ShareButton.jsx';

/**
 * Verbatim visual port of index.html's #screen-kit (.kit-card / .kc-header /
 * .kit-row / .ev-row / .cost-table / .ns-list) — turns out index.html's
 * live kit screen is dark-themed with the exact same CSS variable values
 * as this app's theme.css (the light palette only exists in emailKit()'s
 * one-off hex-inlining for the *emailed* snapshot), so these classes need
 * no re-theming — they render correctly against our existing tokens as-is.
 *
 * All figures are pre-computed by ChatThread.jsx (buildBuyingKitData) from
 * this app's own real answers/finance/insurance modules — this component
 * only renders what it's handed.
  */ 
export default function BuyingKitScreen({ data, onContinue }) {
  return (
    <div className="kit-screen">
      <div className="kit-header">
        <span className="t-micro">Your Buying Kit</span>
        <h2 className="t-display">Here's where you stand.</h2>
        <div className="readiness-wrap">
          <div className="readiness-label"><span>Buying readiness</span><span>{data.readiness.score}%</span></div>
          <div className="readiness-track"><div className="readiness-fill" style={{ width: `${data.readiness.score}%` }} /></div>
        </div>
      </div>

      <div className="kit-sections">
        <KitCard icon="🚗" title="Recommended EVs">
          {data.vehicles.map((v) => (
            <div key={v.id} className={`ev-row ${v.selected ? 'selected' : ''}`}>
              <div className="ev-avatar">
                {v.image ? <img src={v.image} alt={v.title} /> : null}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="ev-name">{v.title}</div>
                <div className="ev-meta">{v.priceLabel} · {v.rangeLabel}</div>
              </div>
              {v.selected
                ? <span className="ev-pick selected">Your Pick ✓</span>
                : (v.topPick ? <span className="ev-pick">Top Pick</span> : null)}
            </div>
          ))}
        </KitCard>

        <KitCard icon="₹" title="Cost Summary">
          <KitRow label="Estimated on-road price" value={`₹${data.cost.onRoad.toFixed(1)} lakh`} />
          {data.cost.isCash ? (
            <KitRow label="Payment" value="Full cash" good />
          ) : (
            <>
              <KitRow label="Down payment" value={`₹${data.cost.downPayment.toFixed(1)} lakh`} />
              <KitRow label="Monthly EMI (est.)" value={data.cost.emi > 0 ? `₹${data.cost.emi.toLocaleString('en-IN')}` : '—'} />
            </>
          )}
          {data.cost.selectedLoanPartner && <KitRow label="Preferred lender" value={data.cost.selectedLoanPartner} good />}
          <p className="kit-fineprint">All estimates. Verify with dealer and lender before booking.</p>
        </KitCard>

        <KitCard icon="🛡️" title="Insurance Estimate">
          <KitRow label="Coverage type" value={data.insurance.coverageLabel} />
          <KitRow label="Est. first-year premium" value={`₹${data.insurance.totalK}K`} />
          {data.insurance.selectedInsurancePartner && <KitRow label="Preferred insurer" value={data.insurance.selectedInsurancePartner} good />}
          <p className="kit-fineprint">Estimated. Get quotes from 2+ insurers.</p>
        </KitCard>

        <KitCard icon="📊" title="Running Costs">
          <table className="cost-table">
            <thead><tr><th>Period</th><th>Petrol</th><th>EV</th><th>Saving</th></tr></thead>
            <tbody>
              {[
                ['Mo.', 1], ['Yearly', 12], ['5 years', 60],
              ].map(([label, mult]) => (
                <tr key={label}>
                  <td>{label}</td>
                  <td>₹{(data.running.monthlyFuel * mult).toLocaleString('en-IN')}</td>
                  <td>₹{(data.running.monthlyCharge * mult).toLocaleString('en-IN')}</td>
                  <td className="save">₹{(data.running.monthlySave * mult).toLocaleString('en-IN')}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="kit-fineprint">Estimated at ₹8/km petrol, ₹1.8/km EV charging.</p>
        </KitCard>

        <KitCard icon="⚡" title="Charging Readiness">
          <KitRow label="Primary charging" value={data.charging.label} good={data.charging.ok} />
          <KitRow label="Recommended charger" value={data.charging.charger} />
          <KitRow label="Est. installation" value={data.charging.install} />
        </KitCard>

        <KitCard icon="✅" title="Dealer Checklist">
          {data.checklist.groups.map((g) => (
            <div key={g.title} className="cl-group">
              <p className="cl-group-title">{g.title}</p>
              {g.items.map((item) => <ChecklistItem key={item} text={item} />)}
            </div>
          ))}
        </KitCard>

        <KitCard icon="🎯" title="Your Next Steps">
          <div className="est-callout est-callout-good" style={{ marginBottom: 16 }}>
            <span className="est-callout-icon">🎯</span>
            <p><strong>{data.readiness.score}% buying readiness.</strong> {data.readiness.label}.</p>
          </div>
          <div className="ns-list">
            {data.readiness.nextSteps.map((s, i) => (
              <div key={s} className="ns-item">
                <div className="ns-num">{i + 1}</div>
                <span className="ns-text">{s}</span>
              </div>
            ))}
          </div>
        </KitCard>

        <div className="result-btn-row">
          <button className="btn btn-primary" onClick={onContinue}>Back to eevy</button>
          <ShareButton
            title="My eevy Buying Kit"
            text={[
              (() => { const v = data.vehicles.find((x) => x.selected) || data.vehicles[0]; return v ? `Top match: ${v.title} — ${v.priceLabel}` : null; })(),
              data.cost.isCash ? 'Payment: full cash' : `EMI: ₹${data.cost.emi.toLocaleString('en-IN')}/month`,
              `Insurance: ${data.insurance.coverageLabel}, ~₹${data.insurance.totalK}K/year`,
              `Buying readiness: ${data.readiness.score}% — ${data.readiness.label}`,
            ].filter(Boolean).join('\n')}
            shareKey="buying_kit"
          />
        </div>
      </div>

      <style>{`
        .kit-screen { padding: 4px 0 24px; max-width:480px; margin:0 auto; }
        .kit-header { padding-bottom: 12px; }
        .t-micro { font-size:0.75rem; font-weight:600; letter-spacing:0.08em; text-transform:uppercase; color:var(--ink-4); }
        .t-display { font-size:clamp(1.45rem,4vw,2.2rem); font-weight:700; line-height:1.18; letter-spacing:-0.025em; margin:8px 0 16px; color:var(--ink); }

        .readiness-wrap { margin-bottom:4px; }
        .readiness-label { font-size:0.75rem; font-weight:600; color:var(--ink-3); margin-bottom:6px; display:flex; justify-content:space-between; }
        .readiness-track { height:6px; background:var(--rule); border-radius:3px; overflow:hidden; }
        .readiness-fill { height:100%; background:var(--orange); border-radius:3px; transition:width 1.2s cubic-bezier(0.4,0,0.2,1); }

        .kit-sections { display:flex; flex-direction:column; gap:12px; }

        .kit-row { display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom:1px solid var(--rule-soft); }
        .kit-row:last-child { border-bottom:none; padding-bottom:0; }
        .kit-label { font-size:0.875rem; color:var(--ink-2); }
        .kit-value { font-size:0.875rem; font-weight:700; color:var(--ink); }
        .kit-value.good { color:var(--green); }
        .kit-fineprint { font-size:0.6875rem; color:var(--ink-5); margin-top:10px; }

        .ev-row { display:flex; align-items:center; gap:14px; padding:12px 0; border-bottom:1px solid var(--rule-soft); }
        .ev-row:last-child { border-bottom:none; padding-bottom:0; }
        .ev-row.selected { margin:0 -12px; padding:12px; border-radius:10px; background:var(--green-light); border-bottom-color:transparent; }
        .ev-avatar { width:56px; height:40px; border-radius:var(--radius-sm); background:var(--bg); border:1px solid var(--rule); display:flex; align-items:center; justify-content:center; flex-shrink:0; overflow:hidden; }
        .ev-avatar img { width:100%; height:100%; object-fit:cover; display:block; }
        .ev-name { font-size:0.9375rem; font-weight:600; color:var(--ink); }
        .ev-meta { font-size:0.75rem; color:var(--ink-4); margin-top:2px; }
        .ev-pick { margin-left:auto; font-size:0.625rem; font-weight:800; text-transform:uppercase; letter-spacing:0.07em; color:var(--orange); background:var(--orange-light); padding:3px 8px; border-radius:100px; flex-shrink:0; }
        .ev-pick.selected { color:var(--green); background:var(--green-light); }

        .cost-table { width:100%; border-collapse:collapse; font-size:0.875rem; }
        .cost-table th { font-size:0.6875rem; font-weight:700; text-transform:uppercase; letter-spacing:0.07em; color:var(--ink-4); text-align:left; padding:0 8px 8px 0; border-bottom:1px solid var(--rule); }
        .cost-table td { padding:8px 8px 8px 0; border-bottom:1px solid var(--rule-soft); color:var(--ink-2); vertical-align:top; }
        .cost-table tr:last-child td { border-bottom:none; }
        .cost-table td:last-child { font-weight:600; color:var(--ink); text-align:right; }
        .cost-table td.save { color:var(--green); font-weight:700; }

        .cl-group { margin-bottom:16px; }
        .cl-group:last-child { margin-bottom:0; }
        .cl-group-title { font-size:0.75rem; font-weight:700; color:var(--ink-3); text-transform:uppercase; letter-spacing:0.06em; margin-bottom:8px; }

        .ns-list { display:flex; flex-direction:column; gap:12px; }
        .ns-item { display:flex; gap:12px; align-items:flex-start; }
        .ns-num { width:24px; height:24px; border-radius:50%; background:var(--orange); color:#fff; font-size:0.6875rem; font-weight:800; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
        .ns-text { font-size:0.875rem; color:var(--ink-2); line-height:1.55; }

        .est-callout { padding:12px 14px; border-radius:var(--radius-sm); background:var(--orange-light); display:flex; align-items:flex-start; gap:10px; }
        .est-callout-good { background:var(--green-light); }
        .est-callout p { font-size:0.75rem; color:var(--orange-dark); line-height:1.55; margin:0; }
        .est-callout-good p { color:var(--green); }
        .est-callout-icon { font-size:1rem; flex-shrink:0; }

        .btn-primary {
          width:100%; border:none; border-radius:var(--radius-md); padding:17px;
          background:var(--orange); color:#fff; font-size:1rem; font-weight:700;
          cursor:pointer; box-shadow:var(--shadow-orange);
        }
        .result-btn-row { display:flex; gap:10px; }
        .result-btn-row .btn-primary { flex:1; width:auto; }
      `}</style>
    </div>
  );
}

function KitCard({ icon, title, children }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="kit-card">
      <div className="kc-header" onClick={() => setOpen((o) => !o)}>
        <div className="kc-icon-wrap">{icon}</div>
        <span className="kc-title">{title}</span>
        <svg className={`kc-toggle ${open ? 'open' : ''}`} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15" /></svg>
      </div>
      {open && <div className="kc-body">{children}</div>}
      <style>{`
        .kit-card { background:var(--surface); border-radius:var(--radius-md); overflow:hidden; border:1px solid var(--rule-soft); box-shadow:var(--shadow-card); }
        .kc-header { padding:14px 18px 12px; display:flex; align-items:center; gap:10px; border-bottom:1px solid var(--rule-soft); cursor:pointer; }
        .kc-icon-wrap { width:32px; height:32px; border-radius:8px; background:var(--orange-light); display:flex; align-items:center; justify-content:center; flex-shrink:0; font-size:0.875rem; }
        .kc-title { font-size:0.9375rem; font-weight:700; color:var(--ink); flex:1; }
        .kc-toggle { color:var(--ink-4); transition:transform 0.2s; flex-shrink:0; }
        .kc-toggle.open { transform:rotate(180deg); }
        .kc-body { padding:16px 18px 18px; }
      `}</style>
    </div>
  );
}

function KitRow({ label, value, good }) {
  return (
    <div className="kit-row">
      <span className="kit-label">{label}</span>
      <span className={`kit-value ${good ? 'good' : ''}`}>{value}</span>
    </div>
  );
}

function ChecklistItem({ text }) {
  const [done, setDone] = useState(false);
  return (
    <div className="checklist-item" onClick={() => setDone((d) => !d)}>
      <div className={`check-box ${done ? 'done' : ''}`} />
      <span className={`cl-text ${done ? 'striked' : ''}`}>{text}</span>
      <style>{`
        .checklist-item { display:flex; gap:10px; align-items:flex-start; padding:6px 0; cursor:pointer; }
        .check-box { width:20px; height:20px; border-radius:6px; border:2px solid var(--ink-5); flex-shrink:0; margin-top:1px; display:flex; align-items:center; justify-content:center; transition:var(--tr); }
        .check-box.done { background:var(--green); border-color:var(--green); }
        .check-box.done::after { content:'✓'; color:#fff; font-size:0.625rem; font-weight:800; }
        .cl-text { font-size:0.875rem; color:var(--ink-2); line-height:1.5; }
        .cl-text.striked { text-decoration:line-through; color:var(--ink-4); }
      `}</style>
    </div>
  );
}

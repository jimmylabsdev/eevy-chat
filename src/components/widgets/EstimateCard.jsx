import React from 'react';

/**
 * Verbatim visual port of index.html's .est-card (screen-reward-finance /
 * screen-reward-insurance). Same class names, same CSS, so this renders
 * identically to the original assessment's result cards.
 *
 * icon: emoji/char shown in the header
 * title/badge: header text
 * rows: [{ label, value, highlight?, good? }]
 * callout: { ok: bool, text } — ok=true renders as the green "good news"
 *          variant (.est-callout-good), ok=false as the orange info variant —
 *          same two variants as the original .est-callout / .est-callout-good.
 */
export default function EstimateCard({ icon, title, badge, rows, callout }) {
  return (
    <div className="est-card">
      <div className="est-card-head">
        <span className="est-icon">{icon}</span>
        <span className="est-title">{title}</span>
        {badge && <span className="est-badge">{badge}</span>}
      </div>
      <div className="est-card-body">
        {rows.map((r) => (
          <div key={r.label} className="est-row">
            <span className="est-label">{r.label}</span>
            <span className={`est-value ${r.highlight ? 'highlight' : ''} ${r.good ? 'good' : ''}`}>{r.value}</span>
          </div>
        ))}
        {callout && (
          <div className={`est-callout ${callout.ok ? 'est-callout-good' : ''}`}>
            <span className="est-callout-icon">{callout.ok ? '✅' : 'ℹ️'}</span>
            <p>{callout.text}</p>
          </div>
        )}
      </div>

      <style>{`
        .est-card {
          background:var(--surface); border-radius:var(--radius-md);
          border:1px solid var(--rule-soft); box-shadow:var(--shadow-card); overflow:hidden;
        }
        .est-card-head {
          padding:14px 18px 12px; display:flex; align-items:center; gap:10px;
          border-bottom:1px solid var(--rule-soft);
        }
        .est-icon { font-size:1rem; flex-shrink:0; }
        .est-title { font-size:0.8125rem; font-weight:700; color:var(--ink); }
        .est-badge {
          margin-left:auto; font-size:0.5625rem; font-weight:700; letter-spacing:0.07em;
          text-transform:uppercase; color:var(--ink-4); background:var(--bg);
          padding:3px 7px; border-radius:100px; border:1px solid var(--rule);
        }
        .est-card-body { padding:14px 18px 16px; }
        .est-row { display:flex; justify-content:space-between; align-items:flex-start; gap:12px; padding:7px 0; border-bottom:1px solid var(--rule-soft); }
        .est-row:last-child { border-bottom:none; padding-bottom:0; }
        .est-label { font-size:0.875rem; color:var(--ink-2); flex:1 1 auto; min-width:0; }
        .est-value { font-size:0.9375rem; font-weight:700; color:var(--ink); text-align:right; flex:0 1 auto; min-width:0; max-width:56%; white-space:normal; word-break:break-word; }
        .est-value.highlight { color:var(--orange); }
        .est-value.good { color:var(--green); }
        .est-callout {
          margin-top:12px; padding:12px 14px; border-radius:var(--radius-sm);
          background:var(--orange-light); display:flex; align-items:flex-start; gap:10px;
        }
        .est-callout-good { background:var(--green-light); }
        .est-callout p { font-size:0.75rem; color:var(--orange-dark); line-height:1.55; margin:0; }
        .est-callout-good p { color:var(--green); }
        .est-callout-icon { font-size:1rem; flex-shrink:0; line-height:1; }
      `}</style>
    </div>
  );
}

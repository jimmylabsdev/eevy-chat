import React from 'react';

/**
 * Shared confirm-before-leaving-unsaved popup (2026-07-19) — used only by
 * the cross-link buttons on the two result screens (AffordabilityScreen's
 * "Check Insurance", InsuranceScreen's "Calculate EMI"), NOT the Variants
 * popup's own Calculate EMI/Check Insurance buttons — those are a first
 * entry into a calculator, with no prior computed result to lose, so
 * there's nothing to confirm there.
 *
 * Strict popup, same convention as the rest of the app — no backdrop
 * dismiss, exactly two ways out:
 * onSave(): stays put, hands off to the (currently stub) Save action.
 * onContinue(): proceeds to the cross-link, discarding this result unsaved.
 */
export default function ConfirmContinueGate({ onSave, onContinue }) {
  return (
    <div className="ccg-backdrop">
      <div className="ccg-popup">
        <p className="ccg-title">Continue without saving?</p>
        <div className="ccg-actions">
          <button className="ccg-btn ccg-btn-save" onClick={onSave}>Save</button>
          <button className="ccg-btn ccg-btn-continue" onClick={onContinue}>Continue</button>
        </div>
      </div>

      <style>{`
        .ccg-backdrop {
          position:fixed; inset:0; z-index:30; background:rgba(0,0,0,0.55);
          display:flex; align-items:center; justify-content:center; padding:24px;
        }
        .ccg-popup {
          width:100%; max-width:340px; background:var(--bg);
          border-radius:16px; padding:24px 20px; text-align:center;
        }
        .ccg-title { margin:0 0 18px; font-size:1rem; font-weight:600; color:var(--ink); }
        .ccg-actions { display:flex; gap:10px; }
        .ccg-btn {
          flex:1; border:none; border-radius:var(--radius-sm); padding:13px;
          font-weight:600; font-size:0.9rem; cursor:pointer;
        }
        .ccg-btn-save { background:var(--orange); color:#fff; }
        .ccg-btn-continue { background:transparent; border:1.5px solid var(--rule); color:var(--ink); }
      `}</style>
    </div>
  );
}

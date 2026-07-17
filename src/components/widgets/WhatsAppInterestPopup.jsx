import React, { useState } from 'react';

/**
 * Lightweight, skippable popup shown right after an EV/lender/insurer
 * selection — "would you like to be contacted via WhatsApp about this?"
 * Deliberately does NOT block the selection itself: the caller's normal
 * onContinue/onSelect still fires once this is dismissed, whether the
 * person submitted a number or skipped.
 *
 * contextLabel: e.g. "the Tata Nexon.ev", "HDFC Bank", "ICICI Lombard"
 * onSubmit(phone) / onSkip(): both should be treated as "now proceed".
 */
export default function WhatsAppInterestPopup({ contextLabel, onSubmit, onSkip }) {
  const [value, setValue] = useState('');

  const digits = value.replace(/\D/g, '');
  const canSend = digits.length === 10;

  function submit() {
    if (!canSend) return;
    onSubmit(digits);
  }

  return (
    <div className="wa-popup-overlay" onClick={onSkip}>
      <div className="wa-popup" onClick={(e) => e.stopPropagation()}>
        <p className="wa-popup-title">Want updates on {contextLabel} via WhatsApp?</p>
        <p className="wa-popup-sub">Leave your number and we'll reach out — totally optional.</p>
        <input
          type="tel"
          inputMode="numeric"
          placeholder="10-digit mobile number"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          autoFocus
        />
        <div className="wa-popup-actions">
          <button className="wa-popup-skip" onClick={onSkip}>Not now</button>
          <button className="wa-popup-send" disabled={!canSend} onClick={submit}>Notify me</button>
        </div>
      </div>

      <style>{`
        .wa-popup-overlay {
          position:fixed; inset:0; background:rgba(0,0,0,0.6);
          z-index:1000; display:flex; align-items:flex-end; justify-content:center;
        }
        .wa-popup {
          width:100%; max-width:420px; background:var(--surface); border:1px solid var(--rule);
          border-bottom:none; border-radius:20px 20px 0 0; padding:22px 20px calc(20px + env(safe-area-inset-bottom));
          box-sizing:border-box; box-shadow:var(--shadow-elevated);
        }
        .wa-popup-title { font-size:1rem; font-weight:700; color:var(--ink); margin:0 0 6px; line-height:1.4; }
        .wa-popup-sub { font-size:0.8125rem; color:var(--ink-3); margin:0 0 16px; line-height:1.5; }
        .wa-popup input {
          width:100%; box-sizing:border-box; background:var(--surface-alt); border:1px solid var(--rule);
          border-radius:12px; padding:14px 16px; color:var(--ink); font-family:var(--font);
          font-size:1rem; margin-bottom:14px;
        }
        .wa-popup input:focus { outline:none; border-color:var(--green); }
        .wa-popup-actions { display:flex; gap:10px; }
        .wa-popup-skip {
          flex:1; padding:14px; border-radius:12px; border:1px solid var(--rule);
          background:transparent; color:var(--ink-3); font-size:0.9375rem; font-weight:600; cursor:pointer;
        }
        .wa-popup-send {
          flex:1; padding:14px; border-radius:12px; border:none;
          background:var(--green); color:#fff; font-size:0.9375rem; font-weight:700; cursor:pointer;
        }
        .wa-popup-send:disabled { background:var(--ink-5); cursor:default; }
      `}</style>
    </div>
  );
}

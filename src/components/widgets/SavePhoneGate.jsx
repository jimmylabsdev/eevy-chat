import React, { useState } from 'react';

/**
 * Phone-number capture for the "Save" action (2026-07-19, replaces
 * SaveOtpGate.jsx) — no verification at all anymore. Per Ram's call: OTP
 * added real friction (reCAPTCHA/v2-widget bugs, repeat prompts) for a
 * "remember this for me" action that doesn't need identity proof — that
 * belongs at the future dashboard LOGIN instead, where it actually
 * matters (deciding what data someone gets to see, not just capturing a
 * callback number). Firebase itself stays fully installed for that.
 *
 * Trade being made here, explicitly: saved_phone is no longer guaranteed
 * truthful (a typo or someone else's number just gets saved as typed) —
 * accepted in exchange for removing the friction entirely.
 *
 * onSubmit(phone): called with the typed number as a plain E.164-ish
 * string (+91 assumed, matching the rest of the app) — no async wait,
 * no confirmation step, immediate.
 * onClose(): still cancelable, same as the OTP gate was.
 */
export default function SavePhoneGate({ onSubmit, onClose }) {
  const [phone, setPhone] = useState('');
  const digits = phone.replace(/\D/g, '');
  const canSave = digits.length === 10;

  function handleSave() {
    if (!canSave) return;
    onSubmit(`+91${digits}`);
  }

  return (
    <div className="sog-backdrop">
      <div className="sog-popup">
        <button className="sog-close" onClick={onClose} aria-label="Close">✕</button>

        <p className="sog-title">Enter your mobile number to save this.</p>
        <p className="sog-sub">We'll keep this quote linked to your number.</p>
        <input
          type="tel" inputMode="numeric" placeholder="10-digit mobile number"
          value={phone} onChange={(e) => setPhone(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          autoFocus
        />
        <button className="sog-btn" disabled={!canSave} onClick={handleSave}>Save</button>
      </div>

      <style>{`
        .sog-backdrop {
          position:fixed; inset:0; background:rgba(0,0,0,0.6);
          z-index:40; display:flex; align-items:flex-end; justify-content:center;
        }
        .sog-popup {
          position:relative; width:100%; max-width:420px;
          background:var(--surface); border:1px solid var(--rule); border-bottom:none;
          border-radius:20px 20px 0 0; padding:22px 20px calc(20px + env(safe-area-inset-bottom));
          box-sizing:border-box; box-shadow:var(--shadow-elevated);
        }
        .sog-close {
          position:absolute; top:12px; right:12px;
          width:28px; height:28px; border-radius:50%; border:none;
          background:rgba(0,0,0,0.08); color:var(--ink-3); font-size:0.8rem;
          display:flex; align-items:center; justify-content:center; cursor:pointer;
        }
        .sog-title { font-size:1rem; font-weight:700; color:var(--ink); margin:0 0 6px; line-height:1.4; padding-right:24px; }
        .sog-sub { font-size:0.8125rem; color:var(--ink-3); margin:0 0 16px; line-height:1.5; }
        .sog-popup input {
          width:100%; box-sizing:border-box; background:var(--surface-alt); border:1px solid var(--rule);
          border-radius:12px; padding:14px 16px; color:var(--ink); font-family:var(--font);
          font-size:1rem; margin-bottom:10px;
        }
        .sog-popup input:focus { outline:none; border-color:var(--orange); }
        .sog-btn {
          width:100%; padding:14px; border-radius:12px; border:none;
          background:var(--orange); color:#fff; font-size:0.9375rem; font-weight:700; cursor:pointer;
        }
        .sog-btn:disabled { background:var(--ink-5); cursor:default; }
      `}</style>
    </div>
  );
}

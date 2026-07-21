import React, { useState, useRef } from 'react';
import { RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';
import { auth } from '../../firebase.js';

/**
 * Phone/OTP gate (2026-07-21, renamed from SaveOtpGate.jsx) — two steps:
 * enter a mobile number, then the 6-digit code Firebase texts to it.
 * Assumes Indian (+91) numbers, matching the rest of the app.
 *
 * This used to gate the "Save" action; that verification step was
 * removed per Ram's call (real friction — reCAPTCHA/v2-widget bugs,
 * repeat prompts — for an action that didn't need identity proof). This
 * component's only live use now is the "My Saved Journeys" dashboard's
 * login, where verifying identity actually matters (deciding what data
 * someone gets to see, not just capturing a callback number) — hence the
 * generalized name and configurable copy instead of Save-specific text.
 *
 * onVerified(phone): called once Firebase confirms the code — phone is
 * the full E.164 string (e.g. "+919876543210").
 * onClose(): cancelable — forcing someone through phone verification with
 * no way out felt like the wrong call, even though "strict, X-only" is
 * the convention elsewhere in this app.
 * title/subtitle: optional copy override for the phone-entry step —
 * defaults to generic phrasing if not supplied.
 *
 * requires a #phone-otp-recaptcha container in the DOM for Firebase's
 * invisible reCAPTCHA to attach to — rendered below, not visible to the
 * person.
 */
export default function PhoneOtpGate({ onVerified, onClose, title, subtitle }) {
  const [step, setStep] = useState('phone'); // 'phone' | 'otp'
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const confirmationResultRef = useRef(null);
  const recaptchaRef = useRef(null);

  const digits = phone.replace(/\D/g, '');
  const canSend = digits.length === 10;
  const canVerify = otp.trim().length === 6;

  async function handleSendOtp() {
    if (!canSend || loading) return;
    setError(null);
    setLoading(true);
    try {
      if (!recaptchaRef.current) {
        recaptchaRef.current = new RecaptchaVerifier(auth, 'phone-otp-recaptcha', { size: 'invisible' });
      }
      const fullPhone = `+91${digits}`;
      confirmationResultRef.current = await signInWithPhoneNumber(auth, fullPhone, recaptchaRef.current);
      setStep('otp');
    } catch (e) {
      setError("Couldn't send the code — check the number and try again.");
      console.error('[eevy] sendOtp failed:', e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp() {
    if (!canVerify || loading) return;
    setError(null);
    setLoading(true);
    try {
      await confirmationResultRef.current.confirm(otp.trim());
      onVerified(`+91${digits}`);
    } catch (e) {
      setError('Incorrect code — try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="sog-backdrop">
      <div className="sog-popup">
        <button className="sog-close" onClick={onClose} aria-label="Close">✕</button>

        {step === 'phone' ? (
          <>
            <p className="sog-title">{title || 'Enter your mobile number.'}</p>
            <p className="sog-sub">{subtitle || "We'll text you a 6-digit code to confirm it's you."}</p>
            <input
              type="tel" inputMode="numeric" placeholder="10-digit mobile number"
              value={phone} onChange={(e) => setPhone(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendOtp()}
              autoFocus
            />
            {error && <p className="sog-error">{error}</p>}
            <button className="sog-btn" disabled={!canSend || loading} onClick={handleSendOtp}>
              {loading ? 'Sending…' : 'Send OTP'}
            </button>
          </>
        ) : (
          <>
            <p className="sog-title">Enter the code sent to +91 {digits}</p>
            <input
              type="text" inputMode="numeric" placeholder="6-digit code"
              value={otp} onChange={(e) => setOtp(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleVerifyOtp()}
              autoFocus
            />
            {error && <p className="sog-error">{error}</p>}
            <button className="sog-btn" disabled={!canVerify || loading} onClick={handleVerifyOtp}>
              {loading ? 'Verifying…' : 'Verify'}
            </button>
          </>
        )}

        <div id="phone-otp-recaptcha" />
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
        .sog-error { font-size:0.8125rem; color:#E4572E; margin:0 0 10px; }
        .sog-btn {
          width:100%; padding:14px; border-radius:12px; border:none;
          background:var(--orange); color:#fff; font-size:0.9375rem; font-weight:700; cursor:pointer;
        }
        .sog-btn:disabled { background:var(--ink-5); cursor:default; }
      `}</style>
    </div>
  );
}

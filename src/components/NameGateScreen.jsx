import React, { useState, useEffect } from 'react';
import eevyAvatar from '../assets/eevy-avatar.png';
import { track } from '../modules/analytics.js';

/**
 * Full-bleed welcome/name-gate screen — matches the reference mockup:
 * large centered avatar, a glowing-bordered message bubble (with "Eevy"
 * picked out in the accent blue), a standalone name input below the
 * bubble, and a full-width "Continue" button. No app header here — this
 * screen owns the whole viewport; App.jsx only shows the header once a
 * name is set and the real chat mounts.
 */
export default function NameGateScreen({ onSubmit }) {
  const [value, setValue] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    track('landing_view');
  }, []);

  const canSend = value.trim().length > 0 && !submitting;

  function submit() {
    if (!canSend) return;
    setSubmitting(true);
    onSubmit(value.trim());
  }

  return (
    <div className="name-gate">
      <div className="name-gate-stack">
        <img className="name-gate-avatar" src={eevyAvatar} alt="Eevy" />

        <div className="name-gate-bubble">
          <p>Hi! I'm <span className="accent">Eevy</span> 👋</p>
          <p>I can help you find the right EV and guide you with EMI, charging, insurance, and more.</p>
          <p>Before we start, what should I call you?</p>
        </div>

        <p className="name-gate-social-proof">Trusted by 500+ EV buyers last month</p>

        <input
          type="text"
          inputMode="text"
          placeholder="Your name"
          value={value}
          disabled={submitting}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          autoFocus
        />

        <button className="name-gate-continue" disabled={!canSend} onClick={submit}>
          Continue
        </button>

        <p className="name-gate-consent">
          Your answers help us personalize your results. We never sell your
          personal information, and only use your name/email to send you
          your results.
        </p>
      </div>

      <style>{`
        .name-gate {
          height:100%; display:flex; flex-direction:column; justify-content:center;
          padding: 24px 0 calc(24px + env(safe-area-inset-bottom));
          overflow-y:auto;
        }
        .name-gate-stack { display:flex; flex-direction:column; align-items:stretch; gap:22px; }

        .name-gate-avatar {
          height:220px; width:auto; align-self:center;
          filter: drop-shadow(0 10px 30px rgba(96,165,250,0.25));
        }

        .name-gate-bubble {
          border:1.5px solid rgba(96,165,250,0.55);
          border-radius: 20px; padding:22px 22px;
          background: rgba(96,165,250,0.06);
          box-shadow: 0 0 24px rgba(96,165,250,0.18), inset 0 0 40px rgba(96,165,250,0.04);
        }
        .name-gate-bubble p {
          margin:0 0 16px; color: var(--ink-2); font-size:1.0625rem; line-height:1.5;
        }
        .name-gate-bubble p:last-child { margin-bottom:0; }
        .name-gate-bubble p:first-child { color: var(--ink); font-weight:700; font-size:1.25rem; }
        .accent { color: var(--blue); font-weight:700; }

        .name-gate input {
          width:100%; box-sizing:border-box; background: rgba(255,255,255,0.02);
          border:1.5px solid rgba(96,165,250,0.35); border-radius:14px;
          padding:16px 18px; color: var(--ink); font-family: var(--font);
          font-size:1rem;
        }
        .name-gate-social-proof {
          margin:-6px 0 0; text-align:center; font-size:0.8125rem; font-weight:600;
          color: var(--teal);
        }

        .name-gate input::placeholder { color: var(--ink-4); }
        .name-gate input:focus { outline:none; border-color: var(--blue); }

        .name-gate-continue {
          width:100%; border:none; border-radius:14px; padding:17px;
          background: var(--blue); color:#fff; font-size:1.0625rem; font-weight:700;
          cursor:pointer; box-shadow: 0 6px 24px rgba(96,165,250,0.4);
        }
        .name-gate-continue:disabled { background: var(--ink-5); box-shadow:none; cursor:default; }

        .name-gate-consent {
          font-size:0.6875rem; color: var(--ink-4); text-align:center;
          line-height:1.5; margin:-6px 0 0;
        }
      `}</style>
    </div>
  );
}

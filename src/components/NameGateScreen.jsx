import React, { useState, useEffect, useRef } from 'react';
import eevyHero from '../assets/hero-img.avif';
import { track } from '../modules/analytics.js';

/**
 * Full-bleed welcome/name-gate screen (2026-07-22 rebuild) — the hero
 * image (robot + 3 EVs scene) renders immediately at full size, uncropped,
 * natural aspect ratio. The card/input/button sit in a separate overlay
 * panel, anchored to the bottom, that slides up ~500ms after mount —
 * the hero is deliberately static throughout; only the overlay moves.
 * Any part of the (tall) hero image below the visible viewport is simply
 * clipped by the container's overflow:hidden, not actively cropped —
 * the image itself is never resized/distorted or given a CSS crop
 * rectangle, per Ram's call that an active crop wouldn't look right.
 *
 * No app header here — this screen owns the whole viewport; App.jsx only
 * shows the header once a name is set and the real chat mounts.
 */
export default function NameGateScreen({ onSubmit }) {
  const [value, setValue] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [slideIn, setSlideIn] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    track('landing_view');
    // autoFocus on the input was the actual cause of the whole-page scroll
    // bug (2026-07-22 fix) — a focused-but-still-offscreen element (the
    // overlay starts translateY(100%)) makes the browser try to scroll it
    // into view immediately, before the slide-in transform ever runs.
    // Focusing manually, only once the overlay is already animating into
    // its real position, avoids triggering that scroll at all.
    const t = setTimeout(() => {
      setSlideIn(true);
      inputRef.current?.focus();
    }, 500);
    return () => clearTimeout(t);
  }, []);

  const canSend = value.trim().length > 0 && !submitting;

  function submit() {
    if (!canSend) return;
    setSubmitting(true);
    onSubmit(value.trim());
  }

  return (
    <div className="name-gate">
      <img className="name-gate-hero" src={eevyHero} alt="Eevy" />

      <div className={`name-gate-overlay ${slideIn ? 'name-gate-overlay-in' : ''}`}>
        <div className="name-gate-bubble">
          <p>Hi! I'm <span className="accent">Eevy</span> 👋</p>
          <p>I'll help you find the right EV for your budget and driving needs — from battery size, range, features to charging.</p>
          <p className="name-gate-target-line">🎯 Let's find the <span className="accent">BEST EV</span> for you.</p>
          <p>What should I call you?</p>
        </div>

        <p className="name-gate-social-proof">🛡️ Trusted by <strong>500+</strong> EV buyers last month</p>

        <input
          ref={inputRef}
          type="text"
          inputMode="text"
          placeholder="Your name"
          value={value}
          disabled={submitting}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
        />

        <button className="name-gate-continue" disabled={!canSend} onClick={submit}>
          Find My EV <span aria-hidden="true">→</span>
        </button>

        {/* <p className="name-gate-consent">
          Your answers help us personalize your results. We never sell your
          personal information, and only use your name/email to send you
          your results.
        </p> */}
      </div>

      <style>{`
        .name-gate { height:100%; position:relative; overflow:hidden; background: #000000}
        .name-gate-hero { display:block; width:100%; height:auto; }

        .name-gate-overlay {
          position:absolute; left:0; right:0; bottom:0; max-height:100%;
          display:flex; flex-direction:column; gap:16px; overflow-y:auto;
          padding: 56px 20px calc(20px + env(safe-area-inset-bottom));
          background: linear-gradient(to bottom, transparent, #000000 18%);
          transform: translateY(60px); opacity:0;
          transition: transform 0.9s cubic-bezier(0.16, 1, 0.3, 1), opacity 1.1s ease-out;
        }
        .name-gate-overlay-in { transform: translateY(0); opacity:1; }

        .name-gate-bubble {
          border:1.5px solid rgba(240,106,34,0.55);
          border-radius: 20px; padding:22px 22px;
          background: rgba(240,106,34,0.06);
          box-shadow: 0 0 24px rgba(240,106,34,0.18), inset 0 0 40px rgba(240,106,34,0.04);
        }
        .name-gate-bubble p {
          margin:0 0 16px; color: var(--ink-2); font-size:1.0625rem; line-height:1.5;
        }
        .name-gate-bubble p:last-child { margin-bottom:0; }
        .name-gate-bubble p:first-child { color: var(--ink); font-weight:700; font-size:1.25rem; }
        .name-gate-target-line {
          padding:14px 0 !important; margin:16px 0 !important;
          border-top:1px solid rgba(255,255,255,0.1); border-bottom:1px solid rgba(255,255,255,0.1);
        }
        .accent { color: var(--orange); font-weight:700; }

        .name-gate input {
          width:100%; box-sizing:border-box; background: rgba(255,255,255,0.02);
          border:1.5px solid rgba(240,106,34,0.35); border-radius:14px;
          padding:16px 18px; color: var(--ink); font-family: var(--font);
          font-size:1rem;
        }
        .name-gate-social-proof {
          margin:0; text-align:center; font-size:0.8125rem; font-weight:600;
          color: var(--ink-2);
        }
        .name-gate-social-proof strong { color: var(--orange); }

        .name-gate input::placeholder { color: var(--ink-4); }
        .name-gate input:focus { outline:none; border-color: var(--orange); }

        .name-gate-continue {
          width:100%; border:none; border-radius:14px; padding:17px;
          background: var(--orange); color:#fff; font-size:1.0625rem; font-weight:700;
          cursor:pointer; box-shadow: 0 6px 24px rgba(240,106,34,0.4);
          display:flex; align-items:center; justify-content:center; gap:8px;
        }
        .name-gate-continue:disabled { background: var(--ink-5); box-shadow:none; cursor:default; }

        .name-gate-consent {
          font-size:0.6875rem; color: var(--ink-4); text-align:center;
          line-height:1.5; margin:0;
        }
      `}</style>
    </div>
  );
}

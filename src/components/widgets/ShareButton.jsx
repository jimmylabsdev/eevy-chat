import React, { useState } from 'react';
import { shareResult } from '../../modules/share.js';
import { track } from '../../modules/analytics.js';

/**
 * Reused across every result screen (Top 3 / budget list, Loan-EMI,
 * Insurance, Buying Kit) — always paired with a "Back to eevy" button,
 * never alone.
 */
export default function ShareButton({ title, text, shareKey }) {
  const [status, setStatus] = useState(null); // null | 'copied' | 'failed'

  async function handleClick() {
    const result = await shareResult({ title, text });
    track('result_share', { key: shareKey, result });
    if (result === 'copied') {
      setStatus('copied');
      setTimeout(() => setStatus(null), 2500);
    } else if (result === 'failed') {
      setStatus('failed');
      setTimeout(() => setStatus(null), 2500);
    }
  }

  return (
    <button className="share-btn" onClick={handleClick}>
      {status === 'copied' ? 'Copied — paste it anywhere' : status === 'failed' ? "Couldn't share" : 'Share'}
      <style>{`
        .share-btn {
          flex: 1; padding:17px; border-radius:var(--radius-md); border:1.5px solid var(--rule);
          background:transparent; color:var(--ink); font-size:1rem; font-weight:700; cursor:pointer;
        }
        .share-btn:hover { border-color:var(--ink-4); }
      `}</style>
    </button>
  );
}

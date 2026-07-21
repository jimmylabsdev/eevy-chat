import React from 'react';
import PartnerTiles from './widgets/PartnerTiles.jsx';

/**
 * Pure lender/insurer directory — main-menu chip entry (2026-07-19), no
 * vehicle involved at all. Reuses the same grid-tile PartnerTiles
 * component (and its existing tap-to-see-full-details popup) already
 * built for the Loan/EMI and Insurance flows — no new tile/popup logic
 * here. onClose is the only exit: no calculation, no data captured beyond
 * whichever partner someone taps "Select" on inside a tile's detail popup.
 */
export default function PartnerBrowseScreen({ partnerType, onClose }) {
  const isLoan = partnerType === 'loan';
  return (
    <div className="finance-screen">
      <span className="t-micro">{isLoan ? 'Compare lenders' : 'Compare insurers'}</span>
      <h2 className="t-display">{isLoan ? 'EV loan providers.' : 'EV insurance providers.'}</h2>
      <p className="t-small">
        {isLoan
          ? 'Tap a tile to see full details — rates, tenure, features, and more.'
          : 'Tap a tile to see full coverage details and features.'}
      </p>

      <PartnerTiles type={partnerType} layout="grid" onSelect={() => {}} />

      <button className="btn btn-primary" onClick={onClose}>Back to eevy</button>

      <style>{`
        .finance-screen { padding: 4px 0 24px; display:flex; flex-direction:column; gap:4px; max-width:480px; margin:0 auto; }
        .t-micro { font-size:0.75rem; font-weight:600; letter-spacing:0.08em; text-transform:uppercase; color:var(--ink-4); }
        .t-display { font-size:clamp(1.45rem,4vw,2.2rem); font-weight:700; line-height:1.18; letter-spacing:-0.025em; margin:8px 0 4px; color:var(--ink); }
        .t-small { font-size:0.875rem; line-height:1.55; color:var(--ink-3); margin:0 0 20px; }
        .btn {
          display:flex; align-items:center; justify-content:center; gap:8px;
          border-radius:var(--radius-md); font-weight:700; cursor:pointer;
          transition:var(--tr); border:none; text-decoration:none; user-select:none;
        }
        .btn-primary {
          background:var(--orange); color:#fff; font-size:1rem;
          padding:17px 28px; width:100%; box-shadow:var(--shadow-orange);
          margin-top:20px;
        }
        .btn-primary:hover { background:var(--orange-dark); }
      `}</style>
    </div>
  );
}

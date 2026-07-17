import React, { useState, useEffect, useCallback } from 'react';
import { fetchLoanPartners, fetchInsurancePartners, isWithinWindow, isFeaturedNow } from '../../api/worker.js';
import { track } from '../../modules/analytics.js';
import WhatsAppInterestPopup from './WhatsAppInterestPopup.jsx';

/**
 * Verbatim visual port of index.html's .bank-tile row (reused for both
 * lender and insurer tiles, same as the original's "Insurance tiles reuse
 * .bank-tile structure") — white cards even on the dark chat theme, same
 * as the original.
 *
 * type: 'loan' | 'insurance'
 * onSelect(partnerKey): called when the person selects a partner (bank_name
 * or company_name) — caller is responsible for persisting it.
 */
export default function PartnerTiles({ type, onSelect, onWhatsAppInterest }) {
  const [partners, setPartners] = useState(null); // null = loading, [] = none/hidden
  const [selectedKey, setSelectedKey] = useState(null);
  const [detailIdx, setDetailIdx] = useState(null);
  const [waPopupPartner, setWaPopupPartner] = useState(null); // partner awaiting a WhatsApp choice after explicit Select, or null

  const isLoan = type === 'loan';
  const keyField = isLoan ? 'bank_name' : 'company_name';

  useEffect(() => {
    let cancelled = false;
    (isLoan ? fetchLoanPartners() : fetchInsurancePartners())
      .then((result) => {
        if (cancelled) return;
        const raw = Array.isArray(result) ? result : [];
        // Defensive re-check client-side too, same as renderLoanTiles/renderInsuranceTiles
        // in index.html — RLS/the public view should already scope this server-side.
        const visible = raw.filter((p) => p.is_active !== false && isWithinWindow(p.list_start, p.list_end));
        setPartners(visible);
        visible.forEach((p) => {
          track('partner_tile_view', { type, partner: p[keyField], featured: !!(isLoan ? isFeaturedNow(p) : p.featured) });
        });
        if (visible.length > 0) {
          const def = visible.find((p) => (isLoan ? isFeaturedNow(p) : p.featured)) || visible[0];
          setSelectedKey(def[keyField]);
          onSelect(def[keyField]);
        }
      })
      .catch((e) => {
        console.error(`[eevy] ${type} partners fetch failed:`, e);
        if (!cancelled) setPartners([]);
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  const select = useCallback((p) => {
    setSelectedKey(p[keyField]);
    onSelect(p[keyField]);
  }, [keyField, onSelect]);

  if (partners === null) return <div className="bt-loading">Loading offers…</div>;
  if (partners.length === 0) return null; // no live/dummy content — hide the section entirely

  return (
    <div className="bank-tiles-row">
      {partners.map((p, idx) => {
        const featured = isLoan ? isFeaturedNow(p) : p.featured;
        const isSelected = selectedKey === p[keyField];
        const topFeature = Array.isArray(p.top_2_features) && p.top_2_features.length ? p.top_2_features[0] : null;
        return (
          <button
            key={p[keyField] || idx}
            className={`bank-tile ${isSelected ? 'is-selected' : ''}`}
            onClick={() => {
              track('partner_tile_click', { type, partner: p[keyField], featured: !!featured });
              setDetailIdx(idx);
            }}
          >
            {/* Featured badge intentionally hidden — no sponsors yet. isFeaturedNow()/featured
                logic itself stays (default pre-selection, tracking), just not shown visually. */}
            {p.logo_url && <div className="bt-logo"><img src={p.logo_url} alt={p[keyField] || ''} /></div>}
            {isLoan && p.min_interest_rate != null && (
              <div className="bt-rate">{p.min_interest_rate}<span>% p.a.</span></div>
            )}
            {topFeature && (
              <div className="bt-features"><span className="bt-feature">{topFeature}</span></div>
            )}
          </button>
        );
      })}

      {detailIdx != null && partners[detailIdx] && (
        <PartnerDetailPopup
          partner={partners[detailIdx]}
          isLoan={isLoan}
          keyField={keyField}
          isSelected={selectedKey === partners[detailIdx][keyField]}
          onSelect={() => {
            const p = partners[detailIdx];
            setDetailIdx(null);
            if (onWhatsAppInterest) { setWaPopupPartner(p); return; }
            select(p);
          }}
          onClose={() => setDetailIdx(null)}
        />
      )}

      {waPopupPartner && (
        <WhatsAppInterestPopup
          contextLabel={waPopupPartner[keyField]}
          onSubmit={(phone) => {
            onWhatsAppInterest(phone, waPopupPartner);
            select(waPopupPartner);
            setWaPopupPartner(null);
          }}
          onSkip={() => {
            select(waPopupPartner);
            setWaPopupPartner(null);
          }}
        />
      )}

      <style>{`
        .bt-loading { font-size:0.8rem; color: var(--ink-4); padding:8px 0; }
        .bank-tiles-row {
          display:flex; gap:8px; overflow-x:auto; -webkit-overflow-scrolling:touch;
          scrollbar-width:none; padding:2px 0 4px;
        }
        .bank-tiles-row::-webkit-scrollbar { display:none; }
        .bank-tile {
          all:unset; flex-shrink:0; width:112px; min-height:104px; height:auto;
          background:#fff; border:1px solid rgba(0,0,0,0.08);
          border-radius:10px; padding:10px 8px 9px;
          box-shadow:0 1px 3px rgba(0,0,0,0.07);
          display:flex; flex-direction:column; align-items:center; justify-content:flex-start; text-align:center;
          position:relative; box-sizing:border-box; overflow:hidden; cursor:pointer;
          transition:box-shadow .15s ease, border-color .15s ease, transform .1s ease;
        }
        .bank-tile:hover { box-shadow:0 2px 8px rgba(0,0,0,0.12); transform:translateY(-1px); }
        .bank-tile:active { transform:translateY(0); }
        .bank-tile.is-selected { border-color:var(--orange); box-shadow:0 0 0 2px var(--orange-light); }
        .bank-tile.is-selected::after {
          content:"✓"; position:absolute; bottom:-8px; left:50%; transform:translateX(-50%);
          background:var(--orange); color:#fff; font-size:0.5rem; font-weight:700;
          width:16px; height:16px; border-radius:50%; display:flex; align-items:center; justify-content:center;
          box-shadow:0 1px 3px rgba(0,0,0,0.15);
        }
        .bt-badge {
          display:inline-flex; align-items:center;
          font-size:0.4375rem; font-weight:600; letter-spacing:0.03em; text-transform:uppercase;
          padding:2px 6px; border-radius:20px; white-space:nowrap;
          box-shadow:0 1px 3px rgba(0,0,0,0.10); margin-bottom:6px;
        }
        .bt-badge.best-offer { background:#EFF6FF; color:#1D4ED8; border:1px solid #BFDBFE; }
        .bt-logo {
          width:36px; height:36px; border-radius:6px; overflow:hidden;
          display:flex; align-items:center; justify-content:center;
          margin-bottom:6px; background:transparent; flex-shrink:0;
        }
        .bt-logo img { width:100%; height:100%; object-fit:contain; }
        .bt-rate { font-size:0.8125rem; font-weight:800; color:#1A1A1A; letter-spacing:-0.02em; line-height:1; margin-top:2px; }
        .bt-rate span { font-size:0.5rem; font-weight:600; color:#9A9A9A; }
        .bt-features { display:flex; flex-direction:column; gap:2px; margin-top:6px; width:100%; }
        .bt-feature { font-size:0.6875rem; font-weight:600; color:#3D3D3D; line-height:1.3; text-align:center; }
      `}</style>
    </div>
  );
}

function PartnerDetailPopup({ partner: p, isLoan, keyField, isSelected, onSelect, onClose }) {
  const name = p[keyField];
  const features = (Array.isArray(p.feature_list) && p.feature_list.length)
    ? p.feature_list
    : (Array.isArray(p.top_2_features) ? p.top_2_features : []);

  let description = p.description || '';
  if (!isLoan && !description) {
    const covers = [];
    if (p.comprehensive) covers.push('Comprehensive');
    if (p.zero_dep) covers.push('Zero Depreciation');
    if (p.third_party) covers.push('Third-Party');
    const coverText = covers.length ? `${covers.join(', ')} cover` : 'EV-specific insurance add-ons';
    const premiumText = p.min_premium != null ? ` from ₹${p.min_premium}/year` : '';
    description = `${name} offers ${coverText}${premiumText} for EV owners.`;
  }

  return (
    <div className="partner-popup-overlay is-open" onClick={onClose}>
      <div className="partner-popup" onClick={(e) => e.stopPropagation()}>
        <button className="partner-popup-close" onClick={onClose}>✕</button>
        <div className="partner-popup-header">
          {p.logo_url && <div className="partner-popup-logo"><img src={p.logo_url} alt={name} /></div>}
          <div>
            <div className="partner-popup-name">{name}</div>
            {/* Featured badge intentionally hidden — no sponsors yet, see PartnerTiles tile above. */}
          </div>
        </div>
        {description && <p className="partner-popup-desc">{description}</p>}
        {features.length > 0 && (
          <>
            <p className="partner-popup-features-label">Highlights</p>
            <ul className="partner-popup-features">
              {features.map((f) => <li key={f}>{f}</li>)}
            </ul>
          </>
        )}
        <button className={`partner-popup-select ${isSelected ? 'is-selected-btn' : ''}`} onClick={onSelect}>
          {isSelected ? '✓ Selected' : 'Select'}
        </button>
      </div>

      <style>{`
        .partner-popup-overlay {
          position:fixed; inset:0; background:rgba(0,0,0,0.6);
          z-index:1000; display:flex; align-items:flex-end; justify-content:center;
        }
        .partner-popup {
          width:100%; max-width:420px; background:var(--surface); border:1px solid var(--rule); border-bottom:none;
          border-radius:20px 20px 0 0; padding:20px 20px 16px; box-sizing:border-box; position:relative;
          max-height:80vh; overflow-y:auto; box-shadow:var(--shadow-elevated);
        }
        .partner-popup-close {
          position:absolute; top:14px; right:14px; width:28px; height:28px; border-radius:50%;
          border:none; background:var(--surface-alt); color:var(--ink-3);
          font-size:1rem; line-height:1; cursor:pointer; display:flex; align-items:center; justify-content:center;
        }
        .partner-popup-header { display:flex; align-items:center; gap:12px; margin:4px 32px 14px 0; }
        .partner-popup-logo {
          width:44px; height:44px; border-radius:10px; overflow:hidden; flex-shrink:0;
          background:#fff; border:1px solid var(--rule-soft);
          display:flex; align-items:center; justify-content:center;
        }
        .partner-popup-logo img { width:100%; height:100%; object-fit:contain; }
        .partner-popup-name { font-size:1.0625rem; font-weight:800; color:var(--ink); line-height:1.25; }
        .partner-popup-badge {
          display:inline-block; margin-top:3px; font-size:0.625rem; font-weight:700; letter-spacing:0.03em;
          text-transform:uppercase; padding:2px 7px; border-radius:20px;
          background:#ECFDF5; color:#065F46; border:1px solid #A7F3D0;
        }
        .partner-popup-desc { font-size:0.8125rem; line-height:1.55; color:var(--ink-2); margin:0 0 16px; }
        .partner-popup-features-label {
          font-size:0.625rem; font-weight:700; letter-spacing:0.08em; text-transform:uppercase;
          color:var(--ink-4); margin-bottom:8px;
        }
        .partner-popup-features { list-style:none; margin:0 0 20px; padding:0; display:flex; flex-direction:column; gap:8px; }
        .partner-popup-features li { font-size:0.8125rem; color:var(--ink-2); padding-left:22px; position:relative; line-height:1.4; }
        .partner-popup-features li::before { content:"✓"; position:absolute; left:0; top:0; color:var(--orange-mid); font-weight:700; }
        .partner-popup-select {
          width:100%; padding:14px; border:none; border-radius:12px; cursor:pointer;
          background:var(--orange); color:#fff; font-size:0.9375rem; font-weight:700;
          box-shadow:var(--shadow-orange);
        }
        .partner-popup-select:hover { background:var(--orange-dark); }
        .partner-popup-select.is-selected-btn { background:#0E9F6E; box-shadow:none; }
      `}</style>
    </div>
  );
}

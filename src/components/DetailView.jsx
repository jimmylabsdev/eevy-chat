import React, { useState } from 'react';
import VariantsPopup from './widgets/VariantsPopup.jsx';

/**
 * item: { id, title, subtitle, image, description, specs: [{label, value}], ctaLabel }
 * Only ever used by the Browse flow.
 *
 * onClose: always present — closes back to chat (2026-07-19 fix: this was
 * previously the one Detail screen with no way out other than Select
 * this one/Check Variants; needed regardless of mode below).
 * onSelect: present ONLY for the car-selection-gate detour (untouched,
 * 2026-07-19) — picking a model to hand off to a pending Loan/EMI or
 * Insurance request. Renders the original "Select this one" CTA, which
 * now resolves immediately (WhatsApp-interest gate removed, 2026-07-19).
 * onCalculateEmi/onCheckInsurance: present for the direct main-menu Browse
 * entry (new, 2026-07-19) — renders "Check Variants" instead, opening the
 * same shared VariantsPopup the Budget result screen uses. Exactly one of
 * these two modes is ever active for a given DetailView instance; which
 * one is decided by ChatThread's handleBrowseModelSelect().
 */
export default function DetailView({ item, onClose, onSelect, onCalculateEmi, onCheckInsurance, sessionId }) {
  const [showVariants, setShowVariants] = useState(false);
  if (!item) return null;

  return (
    <div className="detail-view">
      <button className="detail-close-btn" onClick={onClose} aria-label="Close">✕</button>

      {item.image && <img src={item.image} alt={item.title} className="detail-img" />}
      <h2 className="detail-title">{item.title}</h2>
      {item.subtitle && <p className="detail-subtitle">{item.subtitle}</p>}
      {item.description && <p className="detail-description">{item.description}</p>}

      {item.specs && (
        <div className="detail-specs">
          {item.specs.map((s) => (
            <div key={s.label} className="detail-spec-row">
              <span className="detail-spec-label">{s.label}</span>
              <span className="detail-spec-value">{s.value}</span>
            </div>
          ))}
        </div>
      )}

      {onSelect ? (
        <button className="detail-cta" onClick={() => onSelect(item)}>
          {item.ctaLabel || 'Select'}
        </button>
      ) : (
        <button className="detail-cta" onClick={() => setShowVariants(true)}>
          Check Variants
        </button>
      )}

      {showVariants && (
        <VariantsPopup
          vehicleItem={item}
          onBack={() => setShowVariants(false)}
          onCalculateEmi={onCalculateEmi}
          onCheckInsurance={onCheckInsurance}
          sessionId={sessionId}
          flowName="browse"
        />
      )}

      <style>{`
        .detail-view { padding: 44px 0 4px; position:relative; }
        .detail-close-btn {
          position:fixed; top:78px; left:12px; z-index:10;
          width:32px; height:32px; border-radius:50%; border:none;
          background: rgba(0,0,0,0.45); color:#fff; font-size:0.9rem;
          display:flex; align-items:center; justify-content:center; cursor:pointer;
        }
        .detail-img { width:100%; border-radius: var(--radius-md); margin-bottom:14px; }
        .detail-title { margin:0 0 4px; font-size:1.25rem; color: var(--ink); }
        .detail-subtitle { margin:0 0 12px; color: var(--ink-3); font-size:0.9rem; }
        .detail-description { color: var(--ink-2); font-size:0.9rem; line-height:1.5; margin-bottom:16px; }
        .detail-specs {
          background: var(--surface-alt); border-radius: var(--radius-md);
          padding: 4px 16px; margin-bottom:16px;
        }
        .detail-spec-row {
          display:flex; justify-content:space-between; padding:10px 0;
          border-bottom:1px solid var(--rule-soft); font-size:0.875rem;
        }
        .detail-spec-row:last-child { border-bottom:none; }
        .detail-spec-label { color: var(--ink-4); }
        .detail-spec-value { color: var(--ink); font-weight:500; }
        .detail-cta {
          width:100%; background: var(--brand); border:none; color:#fff;
          border-radius: var(--radius-sm); padding: 13px; font-weight:600;
          font-size:0.95rem; cursor:pointer;
        }
      `}</style>
    </div>
  );
}

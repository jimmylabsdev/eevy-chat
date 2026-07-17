import React, { useState } from 'react';
import WhatsAppInterestPopup from './widgets/WhatsAppInterestPopup.jsx';

/**
 * item: { id, title, subtitle, image, description, specs: [{label, value}], ctaLabel }
 * Reused across vehicle detail, insurance plan detail, loan detail.
 */
export default function DetailView({ item, onSelect, onWhatsAppInterest }) {
  const [waPopup, setWaPopup] = useState(false);
  if (!item) return null;

  function handleSelect() {
    if (onWhatsAppInterest) { setWaPopup(true); return; }
    onSelect(item);
  }

  function resolveWhatsAppPopup(phone) {
    setWaPopup(false);
    if (phone) onWhatsAppInterest(phone, item);
    onSelect(item);
  }

  return (
    <div className="detail-view">
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

      {onSelect && (
        <button className="detail-cta" onClick={handleSelect}>
          {item.ctaLabel || 'Select'}
        </button>
      )}

      {waPopup && (
        <WhatsAppInterestPopup
          contextLabel={item.title}
          onSubmit={resolveWhatsAppPopup}
          onSkip={() => resolveWhatsAppPopup(null)}
        />
      )}

      <style>{`
        .detail-view { padding: 4px 0; }
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

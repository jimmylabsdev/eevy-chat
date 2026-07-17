import React from 'react';

/**
 * items: [{ id, title, subtitle, price, image, tags }]
 * Reused across: Top 5 / Top 3 EVs, insurance plans, loan offers.
 */
export default function ListView({ items, onSelect, emptyLabel = 'Nothing to show yet.' }) {
  if (!items || items.length === 0) {
    return <p className="list-empty">{emptyLabel}</p>;
  }

  return (
    <div className="list-view">
      {items.map((item) => (
        <button key={item.id} className="list-card" onClick={() => onSelect(item)}>
          {item.image && <img src={item.image} alt={item.title} className="list-card-img" />}
          <div className="list-card-body">
            <div className="list-card-title">{item.title}</div>
            {item.subtitle && <div className="list-card-subtitle">{item.subtitle}</div>}
            {item.tags && (
              <div className="list-card-tags">
                {item.tags.map((t) => <span key={t} className="list-card-tag">{t}</span>)}
              </div>
            )}
          </div>
          {item.price && <div className="list-card-price">{item.price}</div>}
        </button>
      ))}

      <style>{`
        .list-view { display:flex; flex-direction:column; gap:10px; margin-top:10px; }
        .list-empty { color: var(--ink-4); font-size:0.9rem; }
        .list-card {
          display:flex; align-items:center; gap:12px; text-align:left;
          background: var(--surface); border:1px solid var(--rule-soft);
          border-radius: var(--radius-md); padding: 12px 14px; cursor:pointer;
          box-shadow: var(--shadow-card); transition: border-color 0.15s ease, transform 0.15s ease;
        }
        .list-card:hover { border-color: var(--chip-border-active); transform: translateY(-1px); }
        .list-card-img { width:56px; height:56px; object-fit:cover; border-radius: var(--radius-sm); flex-shrink:0; }
        .list-card-body { flex:1; min-width:0; }
        .list-card-title { font-weight:600; font-size:0.95rem; color: var(--ink); }
        .list-card-subtitle { font-size:0.8125rem; color: var(--ink-3); margin-top:2px; }
        .list-card-tags { display:flex; gap:6px; margin-top:6px; flex-wrap:wrap; }
        .list-card-tag {
          font-size:0.7rem; color: var(--teal); background: rgba(13,148,136,0.12);
          padding:2px 8px; border-radius:999px;
        }
        .list-card-price { font-weight:600; color: var(--orange-dark, var(--orange)); font-size:0.9rem; white-space:nowrap; }
      `}</style>
    </div>
  );
}

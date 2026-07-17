import React, { useState, useEffect } from 'react';
import { buildVehicleSpecs } from '../modules/vehicleSpecs.js';
import WhatsAppInterestPopup from './widgets/WhatsAppInterestPopup.jsx';
import ShareButton from './widgets/ShareButton.jsx';

/**
 * items: [{ id, title, subtitle, price, image, tags, topPick?, _raw? }]
 *
 * Layout is derived from selectionMode, not passed separately — the three
 * always go together in this build:
 *  - 'multi'  -> vertical LIST (budget-match screen, feeds ev-personalize).
 *               Ticking many items reads better as a scannable list than a
 *               carousel. Gate: must select exactly min(maxSelect,
 *               items.length) before Continue enables. If the pool is
 *               already <= maxSelect, everything is pre-selected and
 *               Continue is immediately available — nothing meaningful to
 *               choose.
 *  - 'none'   -> vertical LIST (standalone budget-list screen). No ticking,
 *               no checkboxes — just the pool, browsable. Continue is
 *               always enabled and doesn't carry a selection forward; this
 *               screen is terminal on its own.
 *  - 'single' -> CAROUSEL (Top 3 screen). Full vehicle details render
 *               inline in each card (own vertical scroll if they don't
 *               fit) — no separate detail popup, since the carousel
 *               already owns the whole screen. The item flagged topPick
 *               is pre-selected on mount.
 */
export default function ResultsView({
  title, items, onContinue, emptyLabel,
  selectionMode = 'single', maxSelect = 5,
  onWhatsAppInterest, onFindTop3,
}) {
  const isMulti = selectionMode === 'multi';
  const isNone = selectionMode === 'none';
  const minSelect = isMulti ? Math.min(maxSelect, items?.length || 0) : 1;

  const [selectedIds, setSelectedIds] = useState(() => computeInitialSelection(items, selectionMode, maxSelect));
  const [waPopupItem, setWaPopupItem] = useState(null); // the selected item awaiting a WhatsApp choice, or null

  useEffect(() => {
    setSelectedIds(computeInitialSelection(items, selectionMode, maxSelect));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  function toggleSelect(item) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (!isMulti) return new Set([item.id]);
      if (next.has(item.id)) {
        next.delete(item.id);
      } else {
        if (next.size >= maxSelect) return prev; // cap reached, ignore
        next.add(item.id);
      }
      return next;
    });
  }

  function handleContinue() {
    if (isNone) { onContinue(); return; } // nothing to carry forward — this screen is terminal
    const selectedItems = (items || []).filter((i) => selectedIds.has(i.id));
    if (!isMulti && onWhatsAppInterest && selectedItems[0]) {
      // Single-select (Top 3) — this is the "select this EV" moment. Ask
      // about WhatsApp before actually continuing, not instead of it.
      setWaPopupItem(selectedItems[0]);
      return;
    }
    onContinue(isMulti ? selectedItems : selectedItems[0]);
  }

  function resolveWhatsAppPopup(phone) {
    const item = waPopupItem;
    setWaPopupItem(null);
    if (phone && item) onWhatsAppInterest(phone, item);
    onContinue(item);
  }

  const continueLabel = isMulti
    ? (selectedIds.size >= minSelect ? `Continue with ${selectedIds.size} selected` : `Select ${minSelect - selectedIds.size} more to continue`)
    : 'Back To Eevy';
  const continueDisabled = isMulti && selectedIds.size < minSelect;
  const isTerminal = !isMulti; // 'none' and 'single' are result screens; 'multi' just advances the flow

  const shareText = isTerminal && items?.length
    ? (items || []).map((it, i) => {
        const mark = (selectionMode === 'single' && selectedIds.has(it.id)) ? ' (your pick)' : '';
        return `${i + 1}. ${it.title}${mark}${it.price ? ` — ${it.price}` : ''}`;
      }).join('\n')
    : '';

  const countLabel = !items?.length ? null
    : isMulti
      ? (items.length <= maxSelect ? `${items.length} found — all included` : `${items.length} found · pick exactly ${maxSelect}`)
      : `${items.length} found`;

  return (
    <div className="results-view">
      <div className="results-header">
        <h2>{title}</h2>
        {countLabel && <span className="results-count">{countLabel}</span>}
      </div>

      {(!items || items.length === 0) ? (
        <div className="results-empty">
          <p>{emptyLabel || 'Nothing to show yet.'}</p>
        </div>
      ) : isMulti ? (
        <ListLayout items={items} selectedIds={selectedIds} onToggle={toggleSelect} />
      ) : isNone ? (
        <ListLayout items={items} selectedIds={selectedIds} onToggle={toggleSelect} selectable={false} />
      ) : (
        <CarouselLayout items={items} selectedIds={selectedIds} onToggle={toggleSelect} />
      )}

      <div className="results-footer">
        {isTerminal ? (
          <div className="results-footer-row">
            <button className="results-continue" onClick={handleContinue}>{continueLabel}</button>
            {onFindTop3 ? (
              <button className="results-continue results-secondary" onClick={onFindTop3}>Find Top 3</button>
            ) : (
              <ShareButton title={title} text={shareText} shareKey="results" />
            )}
          </div>
        ) : (
          <button className="results-continue" disabled={continueDisabled} onClick={handleContinue}>
            {continueLabel}
          </button>
        )}
      </div>

      {waPopupItem && (
        <WhatsAppInterestPopup
          contextLabel={waPopupItem.title}
          onSubmit={resolveWhatsAppPopup}
          onSkip={() => resolveWhatsAppPopup(null)}
        />
      )}

      <style>{RESULTS_STYLES}</style>
    </div>
  );
}

function computeInitialSelection(items, selectionMode, maxSelect) {
  if (!items || items.length === 0) return new Set();
  if (selectionMode === 'none') return new Set(); // no selection concept on this screen
  if (selectionMode === 'multi') {
    // Pool already at or under the cap — nothing to meaningfully choose,
    // so pre-select everything and let Continue proceed immediately.
    return items.length <= maxSelect ? new Set(items.map((i) => i.id)) : new Set();
  }
  const top = items.find((i) => i.topPick) || items[0];
  return top ? new Set([top.id]) : new Set();
}

/* ---------------- List layout (multi-select budget match, and the non-selectable budget-list screen) ---------------- */

function ListLayout({ items, selectedIds, onToggle, selectable = true }) {
  return (
    <div className="results-list">
      {items.map((item) => {
        const isSelected = selectable && selectedIds.has(item.id);
        const rowInner = (
          <>
            {selectable && <span className={`checkbox ${isSelected ? 'checkbox-checked' : ''}`}>{isSelected ? '✓' : ''}</span>}
            {item.image && <img src={item.image} alt={item.title} className="results-row-img" />}
            <div className="results-row-body">
              <div className="results-row-title">{item.title}</div>
              {item.subtitle && <div className="results-row-subtitle">{item.subtitle}</div>}
              {item.tags && (
                <div className="results-row-tags">
                  {item.tags.map((t) => <span key={t} className="results-row-tag">{t}</span>)}
                </div>
              )}
            </div>
            {item.price && <div className="results-row-price">{item.price}</div>}
          </>
        );
        return (
          <div key={item.id} className={`results-row ${isSelected ? 'results-row-selected' : ''}`}>
            {selectable ? (
              <button className="results-row-tap" onClick={() => onToggle(item)}>{rowInner}</button>
            ) : (
              <div className="results-row-tap results-row-static">{rowInner}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ---------------- Carousel layout (single-select Top 3) ---------------- */

function CarouselLayout({ items, selectedIds, onToggle }) {
  return (
    <div className="results-carousel">
      {items.map((item) => {
        const isSelected = selectedIds.has(item.id);
        const specs = buildVehicleSpecs(item._raw);
        return (
          <div key={item.id} className={`carousel-card ${isSelected ? 'carousel-card-selected' : ''}`}>
            <div className="carousel-card-scroll">
              {item.image && <img src={item.image} alt={item.title} className="carousel-card-img" />}
              <div className="carousel-card-titlerow">
                <div className="carousel-card-title">{item.title}</div>
                {item.topPick && <span className="top-pick-badge">Top match</span>}
              </div>
              {item.subtitle && <div className="carousel-card-subtitle">{item.subtitle}</div>}
              {item.tags && (
                <div className="carousel-card-tags">
                  {item.tags.map((t) => <span key={t} className="carousel-card-tag">{t}</span>)}
                </div>
              )}
              {item.price && <div className="carousel-card-price">{item.price}</div>}
              {item._raw?.why && <p className="carousel-card-why">{item._raw.why}</p>}
              {specs && specs.length > 0 && (
                <div className="carousel-card-specs">
                  {specs.map((s) => (
                    <div key={s.label} className="carousel-spec-row">
                      <span className="carousel-spec-label">{s.label}</span>
                      <span className="carousel-spec-value">{s.value}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <button className={`carousel-select-btn ${isSelected ? 'carousel-select-btn-active' : ''}`} onClick={() => onToggle(item)}>
              {isSelected ? '✓ Selected' : 'Select this one'}
            </button>
          </div>
        );
      })}
    </div>
  );
}

const RESULTS_STYLES = `
  .results-view {
    height: 100%; display:flex; flex-direction:column;
    padding: 20px 0 0;
  }
  .results-header {
    display:flex; align-items:baseline; justify-content:space-between;
    margin-bottom: 16px; flex-shrink:0;
  }
  .results-header h2 { margin:0; font-size:1.15rem; color: var(--ink); }
  .results-count { font-size:0.825rem; color: var(--ink-4); }
  .results-empty {
    flex:1; display:flex; align-items:center; justify-content:center;
    color: var(--ink-4); text-align:center; padding: 0 24px;
  }

  /* ---- List layout ---- */
  .results-list { flex:1; overflow-y:auto; display:flex; flex-direction:column; gap:10px; padding-bottom:12px; }
  .results-row {
    background: var(--surface); border:1px solid var(--rule-soft);
    border-radius: var(--radius-md); box-shadow: var(--shadow-card);
    transition: border-color 0.15s ease;
  }
  .results-row-selected { border-color: var(--teal); box-shadow: 0 0 0 2px rgba(13,148,136,0.25), var(--shadow-card); }
  .results-row-tap {
    all:unset; display:flex; align-items:center; gap:12px; width:100%; box-sizing:border-box;
    padding: 12px 14px; cursor:pointer;
  }
  .results-row-static { cursor:default; }
  .results-row-img { width:52px; height:52px; object-fit:cover; border-radius: var(--radius-sm); flex-shrink:0; }
  .results-row-body { flex:1; min-width:0; }
  .results-row-title { font-weight:600; font-size:0.95rem; color: var(--ink); }
  .results-row-subtitle { font-size:0.8rem; color: var(--ink-3); margin-top:2px; }
  .results-row-tags { display:flex; gap:6px; margin-top:6px; flex-wrap:wrap; }
  .results-row-tag { font-size:0.68rem; color: var(--teal); background: rgba(13,148,136,0.12); padding:2px 8px; border-radius:999px; }
  .results-row-price { font-weight:600; color: var(--orange); font-size:0.875rem; white-space:nowrap; }
  .checkbox {
    width:22px; height:22px; border-radius:6px; border:2px solid var(--rule); flex-shrink:0;
    display:flex; align-items:center; justify-content:center; font-size:0.8rem; color:#fff;
  }
  .checkbox-checked { background: var(--teal); border-color: var(--teal); }

  /* ---- Carousel layout ---- */
  .results-carousel {
    display:flex; gap:14px; overflow-x:auto; scroll-snap-type: x mandatory;
    padding-bottom: 12px; flex:1; -webkit-overflow-scrolling: touch;
  }
  .carousel-card {
    scroll-snap-align: center; flex: 0 0 84%; max-width:340px;
    display:flex; flex-direction:column;
    background: var(--surface); border:1px solid var(--rule-soft);
    border-radius: var(--radius-lg); box-shadow: var(--shadow-elevated);
    transition: border-color 0.15s ease; overflow:hidden;
  }
  .carousel-card-selected { border-color: var(--teal); box-shadow: 0 0 0 2px rgba(13,148,136,0.3), var(--shadow-elevated); }
  .carousel-card-scroll { flex:1; overflow-y:auto; padding:16px; }
  .carousel-card-img { width:100%; height:150px; object-fit:cover; border-radius: var(--radius-md); margin-bottom:12px; }
  .carousel-card-titlerow { display:flex; align-items:flex-start; justify-content:space-between; gap:8px; }
  .carousel-card-title { font-weight:700; font-size:1.05rem; color: var(--ink); }
  .top-pick-badge {
    font-size:0.68rem; color: var(--orange); background: var(--orange-light);
    padding:3px 9px; border-radius:999px; font-weight:600; white-space:nowrap; flex-shrink:0;
  }
  .carousel-card-subtitle { font-size:0.85rem; color: var(--ink-3); margin-top:4px; }
  .carousel-card-tags { display:flex; gap:6px; margin-top:8px; flex-wrap:wrap; }
  .carousel-card-tag { font-size:0.7rem; color: var(--teal); background: rgba(13,148,136,0.12); padding:3px 9px; border-radius:999px; }
  .carousel-card-price { font-weight:700; color: var(--orange); font-size:1rem; margin-top:10px; }
  .carousel-card-why { font-size:0.825rem; color: var(--ink-2); line-height:1.5; margin:12px 0 0; }
  .carousel-card-specs { margin-top:14px; background: var(--surface-alt); border-radius: var(--radius-md); padding: 2px 14px; }
  .carousel-spec-row { display:flex; justify-content:space-between; padding:9px 0; border-bottom:1px solid var(--rule-soft); font-size:0.82rem; }
  .carousel-spec-row:last-child { border-bottom:none; }
  .carousel-spec-label { color: var(--ink-4); }
  .carousel-spec-value { color: var(--ink); font-weight:500; }
  .carousel-select-btn {
    flex-shrink:0; border:none; border-top:1px solid var(--rule-soft);
    background: var(--surface-alt); color: var(--ink-2); font-weight:600; font-size:0.875rem;
    padding: 13px; cursor:pointer;
  }
  .carousel-select-btn-active { background: var(--teal); color:#fff; }

  /* ---- Footer (shared) ---- */
  .results-footer { flex-shrink:0; padding: 14px 0 20px; border-top:1px solid var(--rule-soft); }
  .results-footer-row { display:flex; gap:10px; }
  .results-continue {
    width:100%; background: var(--brand); border:none; color:#fff;
    border-radius: var(--radius-sm); padding: 14px; font-weight:600;
    font-size:0.95rem; cursor:pointer;
  }
  .results-footer-row .results-continue { flex:1; width:auto; }
  .results-secondary {
    background:transparent !important; border:1.5px solid var(--rule) !important; color:var(--ink) !important;
  }
  .results-continue:disabled { opacity:0.5; cursor:default; }
`;

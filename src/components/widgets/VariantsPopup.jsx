import React, { useState, useEffect } from 'react';
import { fetchVariants, logJourneyEvent } from '../../api/worker.js';
import { track } from '../../modules/analytics.js';

/**
 * Shared "Check Variants" popup — extracted from ResultsView.jsx
 * (2026-07-19) so both the Budget result screen and the Browse flow's
 * DetailView.jsx can use the exact same component instead of duplicating
 * it, per the "alter existing, don't duplicate" convention.
 *
 * vehicleItem: { id, title, ... } — same toListItem()-shaped object used
 * throughout the app; only .id (joins to ev_variants.vehicle_id) and
 * .title are actually read here.
 * onBack(): strict popup — this is the only way out, no backdrop-dismiss.
 * onCalculateEmi(vehicleItem, activeVariant) / onCheckInsurance(...): the
 * caller decides what "returnTo" destination those lead to (e.g. 'results'
 * for the Budget screen, 'detail' for Browse) — this component doesn't
 * need to know or care.
 * sessionId/flowName: for the journey log only (2026-07-19) — flowName is
 * 'budget' or 'browse', hardcoded by whichever screen renders this.
 *
 * Top chip row = one chip per variant (name only), sorted cheapest-first
 * for a stable/sensible default order. Variant data is prefetched/cached
 * for the whole session via fetchVariants(); this popup just filters that
 * cache down to this vehicle's rows on mount.
 */
export default function VariantsPopup({ vehicleItem, onBack, onCalculateEmi, onCheckInsurance, sessionId, flowName }) {
  const [variants, setVariants] = useState(null); // null = loading, [] = loaded-empty, array = loaded
  const [loadError, setLoadError] = useState(null);
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetchVariants()
      .then((res) => {
        if (cancelled) return;
        const all = res?.variants || [];
        const mine = all
          .filter((v) => v.vehicle_id === vehicleItem.id)
          .sort((a, b) => (a.ex_showroom_price_lakh ?? 0) - (b.ex_showroom_price_lakh ?? 0));
        setVariants(mine);
        // Journey log (2026-07-19) — fires once, the moment this popup has
        // a valid variant to show (the default cheapest one — no tap
        // required, per Ram: "we know intent once the tile is selected"
        // doesn't apply here; reaching the popup itself is the signal for
        // this specific event). Skipped entirely if there's nothing to
        // report — an empty result isn't "reaching a variant."
        if (mine.length > 0) {
          logJourneyEvent(sessionId, {
            event_type: 'variant_reached',
            flow_name: flowName,
            vehicle_id: vehicleItem.id,
            variant_id: mine[0].id,
            ex_showroom_price_lakh: mine[0].ex_showroom_price_lakh ?? null,
          });
          track('variant_reached', { flow: flowName, vehicle_id: vehicleItem.id, variant_id: mine[0].id });
        }
      })
      .catch((e) => { if (!cancelled) setLoadError(e.message); });
    return () => { cancelled = true; };
    // Deliberately [vehicleItem.id], NOT [vehicleItem] (2026-07-21 fix) —
    // App.jsx's DetailView path (Browse) reconstructs the item object as a
    // fresh literal on every single App.jsx render ({...detailItem,
    // description:..., specs:...}), while ResultsView's path (Budget)
    // passes a stable reference from its own local popupStack state. With
    // [vehicleItem] as the dependency, every unrelated App.jsx re-render
    // while this popup stayed open (mounted-but-hidden behind the finance
    // screen) looked like "a new vehicle" and re-logged variant_reached —
    // Budget never hit this because its reference never actually changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicleItem.id]);

  const active = variants && variants[activeIdx];

  return (
    <div className="vd-backdrop">
      <div className="vd-popup">
        <button className="vd-back" onClick={onBack} aria-label="Back">←</button>

        {variants && variants.length > 0 && (
          <div className="vp-chiprow">
            {variants.map((v, i) => (
              <button
                key={v.id}
                className={`vp-chip ${i === activeIdx ? 'vp-chip-active' : ''}`}
                onClick={() => setActiveIdx(i)}
              >
                {v.variant}
              </button>
            ))}
          </div>
        )}

        <div className="vd-body">
          {loadError ? (
            <p className="vp-status">Couldn't load variants right now — {loadError}</p>
          ) : variants === null ? (
            <p className="vp-status">Loading variants…</p>
          ) : variants.length === 0 ? (
            <p className="vp-status">No variant details available for this model yet.</p>
          ) : active ? (
            <>
              <h3 className="vd-title">{vehicleItem.title} — {active.variant}</h3>
              {active.ex_showroom_price_lakh != null && (
                <p className="vd-price">₹{Number(active.ex_showroom_price_lakh).toFixed(2)} lakh (ex-showroom)</p>
              )}
              <div className="vd-specs">
                {active.battery_kwh != null && (
                  <div className="vd-spec-row"><span className="vd-spec-label">Battery</span><span className="vd-spec-value">{active.battery_kwh} kWh</span></div>
                )}
                {active.claimed_range_km != null && (
                  <div className="vd-spec-row"><span className="vd-spec-label">Claimed range</span><span className="vd-spec-value">{active.claimed_range_km} km</span></div>
                )}
                {active.availability_status && (
                  <div className="vd-spec-row"><span className="vd-spec-label">Availability</span><span className="vd-spec-value">{active.availability_status}</span></div>
                )}
              </div>
              {active.key_features && (
                <div className="vp-features">
                  {active.key_features.split(';').map((f) => f.trim()).filter(Boolean).map((f) => (
                    <div key={f} className="vp-feature-row">• {f}</div>
                  ))}
                </div>
              )}
            </>
          ) : null}
        </div>

        <div className="vd-footer vp-footer-row">
          <button className="vd-variants-btn results-secondary" onClick={() => onCalculateEmi?.(vehicleItem, active)}>Calculate EMI</button>
          <button className="vd-variants-btn" onClick={() => onCheckInsurance?.(vehicleItem, active)}>Check Insurance</button>
        </div>
      </div>

      <style>{`
        .vd-backdrop {
          position:fixed; inset:0; z-index:20; background:rgba(0,0,0,0.55);
          display:flex; align-items:flex-end; justify-content:center;
        }
        .vd-popup {
          position:relative; width:100%; max-width:560px; max-height:88vh;
          background: var(--bg); border-radius: 20px 20px 0 0;
          display:flex; flex-direction:column; overflow:hidden;
        }
        .vd-back {
          position:absolute; top:12px; left:12px; z-index:1;
          width:32px; height:32px; border-radius:50%; border:none;
          background: rgba(0,0,0,0.45); color:#fff; font-size:1rem;
          display:flex; align-items:center; justify-content:center; cursor:pointer;
        }
        .vd-body { flex:1; overflow-y:auto; padding: 20px; box-sizing:border-box; }
        .vd-title { margin:0 0 4px; font-size:1.15rem; color: var(--ink); }
        .vd-price { margin:0 0 12px; font-weight:700; color: var(--orange); font-size:1rem; }
        .vd-specs { background: var(--surface-alt); border-radius: var(--radius-md); padding: 2px 16px; }
        .vd-spec-row { display:flex; justify-content:space-between; padding:10px 0; border-bottom:1px solid var(--rule-soft); font-size:0.85rem; }
        .vd-spec-row:last-child { border-bottom:none; }
        .vd-spec-label { color: var(--ink-4); }
        .vd-spec-value { color: var(--ink); font-weight:500; }
        .vd-footer { flex-shrink:0; padding: 14px 20px 20px; border-top:1px solid var(--rule-soft); }
        .vd-variants-btn {
          width:100%; background: var(--brand); border:none; color:#fff;
          border-radius: var(--radius-sm); padding: 14px; font-weight:600;
          font-size:0.95rem; cursor:pointer;
        }
        .vp-footer-row { display:flex; gap:10px; }
        .vp-footer-row .vd-variants-btn { width:auto; flex:1; }
        .results-secondary {
          background:transparent !important; border:1.5px solid var(--rule) !important; color:var(--ink) !important;
        }
        .vp-chiprow {
          display:flex; gap:8px; overflow-x:auto; flex-shrink:0;
          padding: 50px 20px 12px; border-bottom:1px solid var(--rule-soft);
        }
        .vp-chip {
          flex-shrink:0; border:1.5px solid var(--rule); background:transparent;
          color: var(--ink-2); padding:8px 16px; border-radius:999px;
          font-size:0.85rem; font-weight:600; cursor:pointer;
        }
        .vp-chip-active { background: var(--teal); border-color: var(--teal); color:#fff; }
        .vp-status { color: var(--ink-4); font-size:0.9rem; padding: 8px 0; }
        .vp-features { margin-top:16px; }
        .vp-feature-row { font-size:0.85rem; color: var(--ink-2); line-height:1.6; }
      `}</style>
    </div>
  );
}

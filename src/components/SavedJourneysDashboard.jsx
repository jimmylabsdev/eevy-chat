import React, { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase.js';
import PhoneOtpGate from './widgets/PhoneOtpGate.jsx';
import EstimateCard from './widgets/EstimateCard.jsx';
import { fetchMyJourneys, hideJourney, fetchVehicles, fetchVariants, fetchLoanPartners, fetchInsurancePartners } from '../api/worker.js';
import eevyAvatar from '../assets/eevy-avatar.png';

/**
 * "My Saved Journeys" dashboard (2026-07-21) — reached via the hamburger
 * menu in the chat header (see App.jsx).
 *
 * Gated by phone/OTP login (PhoneOtpGate) — but checks Firebase's
 * persisted auth session on open first, so a returning visit in the same
 * browser skips straight to the list, no re-login needed. This is
 * deliberately the ONE place in the app where that persisted-session
 * check matters — it's why Firebase/PhoneOtpGate were kept installed
 * after being removed from the Save flow.
 *
 * Access control is intentionally simple per Ram: the client only calls
 * fetchMyJourneys after Firebase confirms the OTP — there's no additional
 * server-side check that the requester actually owns that phone (see the
 * worker's handleMyJourneys comment for the same note).
 *
 * Each saved row is either a Finance Profile (emi_calculated) or
 * Insurance Profile (insurance_calculated) — never both combined, since
 * that's how the underlying journey rows are stored (one row per Save).
 * Vehicle/variant/partner details aren't stored on the row itself — this
 * cross-references them client-side against the same cached fetchers
 * already used elsewhere (fetchVehicles/fetchVariants/fetchLoanPartners/
 * fetchInsurancePartners), same pattern VariantsPopup.jsx uses.
 *
 * Delete is soft — hideJourney() flips hidden_by_user, never removes the
 * row (Ram's own journey analytics still sees it).
 *
 * No share/print/download anywhere on this screen, per the spec.
 */
export default function SavedJourneysDashboard({ onClose }) {
  const [checkingAuth, setCheckingAuth] = useState(true); // true until Firebase's onAuthStateChanged fires at least once
  const [phone, setPhone] = useState(null);
  const [showLoginGate, setShowLoginGate] = useState(false);
  const [journeys, setJourneys] = useState(null); // null = loading, [] = loaded-empty, array = loaded

  const [vehiclesById, setVehiclesById] = useState(null);
  const [variantsById, setVariantsById] = useState(null);
  const [loanPartnersByKey, setLoanPartnersByKey] = useState(null);
  const [insurancePartnersByKey, setInsurancePartnersByKey] = useState(null);

  const [selectedJourney, setSelectedJourney] = useState(null); // the journey object for the detail popup, or null
  const [confirmDeleteRef, setConfirmDeleteRef] = useState(null); // client_ref pending delete confirmation, or null

  // Firebase restores its persisted session asynchronously — this is the
  // correct way to know when that's actually settled, rather than reading
  // auth.currentUser synchronously (which can be momentarily stale/null
  // even when a persisted session exists).
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user?.phoneNumber) setPhone(user.phoneNumber);
      setCheckingAuth(false);
    });
    return unsubscribe;
  }, []);

  // Reference data — cheap, cached (fetchVehicles/fetchVariants/
  // fetchLoanPartners/fetchInsurancePartners all cache for the session
  // already), loaded regardless of login state since it's needed the
  // moment journeys load.
  useEffect(() => {
    fetchVehicles().then((res) => {
      const map = {};
      for (const v of res?.vehicles || []) map[v.id] = v;
      setVehiclesById(map);
    }).catch(() => setVehiclesById({}));
    fetchVariants().then((res) => {
      const map = {};
      for (const v of res?.variants || []) map[v.id] = v;
      setVariantsById(map);
    }).catch(() => setVariantsById({}));
    fetchLoanPartners().then((list) => {
      const map = {};
      for (const p of list || []) map[p.bank_name] = p;
      setLoanPartnersByKey(map);
    }).catch(() => setLoanPartnersByKey({}));
    fetchInsurancePartners().then((list) => {
      const map = {};
      for (const p of list || []) map[p.company_name] = p;
      setInsurancePartnersByKey(map);
    }).catch(() => setInsurancePartnersByKey({}));
  }, []);

  // Once we know the phone (from a persisted session or a fresh login),
  // fetch their saved journeys.
  useEffect(() => {
    if (!phone) return;
    setJourneys(null);
    fetchMyJourneys(phone).then((res) => {
      setJourneys(res?.journeys || []);
    }).catch((e) => {
      console.warn('[eevy] fetchMyJourneys failed:', e.message);
      setJourneys([]);
    });
  }, [phone]);

  function handleLoginVerified(verifiedPhone) {
    setShowLoginGate(false);
    setPhone(verifiedPhone);
  }

  function handleDeleteConfirmed() {
    const ref = confirmDeleteRef;
    setConfirmDeleteRef(null);
    setJourneys((prev) => (prev || []).filter((j) => j.client_ref !== ref)); // optimistic — no reason to make them wait
    hideJourney(ref).catch((e) => {
      console.warn('[eevy] hideJourney failed:', e.message);
    });
  }

  const referenceDataReady = vehiclesById && variantsById && loanPartnersByKey && insurancePartnersByKey;

  return (
    <div className="sjd-screen">
      {checkingAuth ? (
        <p className="sjd-status">Loading…</p>
      ) : !phone ? (
        <div className="sjd-login-wrap">
          <p className="sjd-login-title">My Saved Journeys</p>
          <p className="sjd-login-sub">Log in with your mobile number to see what you've saved.</p>
          <button className="sjd-login-btn" onClick={() => setShowLoginGate(true)}>Log in</button>
        </div>
      ) : !referenceDataReady || journeys === null ? (
        <p className="sjd-status">Loading your saved journeys…</p>
      ) : journeys.length === 0 ? (
        <p className="sjd-status">Nothing saved yet — quotes you save from the Loan/EMI or Insurance screens will show up here.</p>
      ) : (
        <div className="sjd-list">
          {journeys.map((j) => (
            <SavedJourneyTile
              key={j.client_ref}
              journey={j}
              vehicle={vehiclesById[j.vehicle_id]}
              variant={variantsById[j.variant_id]}
              onOpen={() => setSelectedJourney(j)}
              onDelete={() => setConfirmDeleteRef(j.client_ref)}
            />
          ))}
        </div>
      )}

      <button className="sjd-float-btn" onClick={onClose} aria-label="Back to chat">
        <img src={eevyAvatar} alt="" />
      </button>

      {showLoginGate && (
        <PhoneOtpGate
          title="Log in to see your saved journeys."
          onVerified={handleLoginVerified}
          onClose={() => setShowLoginGate(false)}
        />
      )}

      {selectedJourney && referenceDataReady && (
        <SavedJourneyDetailPopup
          journey={selectedJourney}
          vehicle={vehiclesById[selectedJourney.vehicle_id]}
          variant={variantsById[selectedJourney.variant_id]}
          partner={
            selectedJourney.event_type === 'emi_calculated'
              ? loanPartnersByKey[selectedJourney.partner_key]
              : insurancePartnersByKey[selectedJourney.partner_key]
          }
          onClose={() => setSelectedJourney(null)}
        />
      )}

      {confirmDeleteRef && (
        <ConfirmDeleteGate
          onConfirm={handleDeleteConfirmed}
          onCancel={() => setConfirmDeleteRef(null)}
        />
      )}

      <style>{`
        .sjd-screen { padding: 20px 0 100px; min-height:100%; position:relative; box-sizing:border-box; }
        .sjd-status { color:var(--ink-4); font-size:0.9rem; text-align:center; padding:60px 20px; }
        .sjd-login-wrap { text-align:center; padding:60px 20px; }
        .sjd-login-title { font-size:1.3rem; font-weight:700; color:var(--ink); margin:0 0 8px; }
        .sjd-login-sub { font-size:0.875rem; color:var(--ink-3); margin:0 0 20px; }
        .sjd-login-btn {
          background:var(--orange); color:#fff; border:none; border-radius:var(--radius-sm);
          padding:13px 28px; font-weight:700; font-size:0.95rem; cursor:pointer;
        }
        .sjd-list { display:flex; flex-direction:column; gap:10px; }
        .sjd-float-btn {
          position:fixed; bottom:24px; right:24px; z-index:15;
          width:52px; height:52px; border-radius:50%; border:none; padding:0;
          background:var(--surface); box-shadow:var(--shadow-elevated); cursor:pointer;
          display:flex; align-items:center; justify-content:center; overflow:hidden;
        }
        .sjd-float-btn img { width:100%; height:100%; object-fit:cover; }
      `}</style>
    </div>
  );
}

/* ---------------- Tile ---------------- */

function SavedJourneyTile({ journey, vehicle, variant, onOpen, onDelete }) {
  const isEmi = journey.event_type === 'emi_calculated';
  const title = vehicle ? `${vehicle.brand} ${vehicle.model}` : 'EV';
  const variantLabel = variant?.variant || null;
  const price = journey.ex_showroom_price_lakh != null
    ? `₹${Number(journey.ex_showroom_price_lakh).toFixed(2)} lakh`
    : null;

  return (
    <div className="sjt-tile">
      <button className="sjt-tile-main" onClick={onOpen}>
        {vehicle?.image_url && <img src={vehicle.image_url} alt={title} className="sjt-img" />}
        <div className="sjt-info">
          <span className={`sjt-badge ${isEmi ? 'sjt-badge-finance' : 'sjt-badge-insurance'}`}>
            {isEmi ? 'Finance Profile' : 'Insurance Profile'}
          </span>
          <div className="sjt-title">{title}{variantLabel ? ` — ${variantLabel}` : ''}</div>
          {price && <div className="sjt-price">{price}</div>}
        </div>
      </button>
      <button className="sjt-delete" onClick={(e) => { e.stopPropagation(); onDelete(); }} aria-label="Delete">
        🗑
      </button>

      <style>{`
        .sjt-tile {
          display:flex; align-items:center; gap:8px; background:var(--surface);
          border:1px solid var(--rule); border-radius:14px; padding:10px;
        }
        .sjt-tile-main {
          all:unset; box-sizing:border-box; flex:1; display:flex; align-items:center; gap:12px;
          cursor:pointer; min-width:0;
        }
        .sjt-img { width:56px; height:56px; border-radius:10px; object-fit:cover; flex-shrink:0; background:var(--surface-alt); }
        .sjt-info { min-width:0; flex:1; }
        .sjt-badge {
          display:inline-block; font-size:0.625rem; font-weight:700; letter-spacing:0.04em;
          text-transform:uppercase; padding:2px 8px; border-radius:100px; margin-bottom:4px;
        }
        .sjt-badge-finance { background:var(--orange-light); color:var(--orange-dark); }
        .sjt-badge-insurance { background:var(--green-light); color:var(--green); }
        .sjt-title { font-size:0.9rem; font-weight:600; color:var(--ink); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .sjt-price { font-size:0.8125rem; color:var(--ink-3); margin-top:2px; }
        .sjt-delete {
          flex-shrink:0; width:36px; height:36px; border-radius:50%; border:none;
          background:transparent; color:var(--ink-4); font-size:1rem; cursor:pointer;
        }
      `}</style>
    </div>
  );
}

/* ---------------- Detail popup ---------------- */

function SavedJourneyDetailPopup({ journey, vehicle, variant, partner, onClose }) {
  const isEmi = journey.event_type === 'emi_calculated';
  const title = vehicle ? `${vehicle.brand} ${vehicle.model}` : 'EV';

  // Mirrors computeInsurancePremium()'s coverageLabel mapping in
  // modules/finance.js exactly, for the two named preferences — the
  // fallback (not_sure, or missing) now explicitly reads "Comprehensive +
  // Zero Dep" here per Ram's call (2026-07-21), rather than showing the
  // raw "not_sure" value.
  const coverageLabel = journey.insurance_preference === 'zero_dep' ? 'Zero Depreciation'
    : journey.insurance_preference === 'basic' ? 'Comprehensive'
      : 'Comprehensive + Zero Dep';

  return (
    <div className="vd-backdrop">
      <div className="vd-popup">
        <button className="vd-back" onClick={onClose} aria-label="Close">✕</button>
        <div className="vd-body">
          {vehicle?.image_url && <img src={vehicle.image_url} alt={title} className="vd-img" />}
          <h3 className="vd-title">{title}{variant?.variant ? ` — ${variant.variant}` : ''}</h3>
          {journey.ex_showroom_price_lakh != null && (
            <p className="vd-price">₹{Number(journey.ex_showroom_price_lakh).toFixed(2)} lakh (ex-showroom)</p>
          )}

          {variant && (variant.battery_kwh != null || variant.claimed_range_km != null) && (
            <div className="vd-specs">
              {variant.battery_kwh != null && (
                <div className="vd-spec-row"><span className="vd-spec-label">Battery</span><span className="vd-spec-value">{variant.battery_kwh} kWh</span></div>
              )}
              {variant.claimed_range_km != null && (
                <div className="vd-spec-row"><span className="vd-spec-label">Claimed range</span><span className="vd-spec-value">{variant.claimed_range_km} km</span></div>
              )}
            </div>
          )}

          <div className="vd-estimate-wrap">
            {isEmi ? (
              <EstimateCard
                icon="📅" title="Monthly EMI Estimate" badge="Saved"
                rows={[
                  partner ? { label: 'Lender', value: partner.bank_name } : null,
                  journey.down_payment_lakh != null ? { label: 'Down payment', value: `₹${Number(journey.down_payment_lakh).toFixed(2)} lakh` } : null,
                  journey.tenure_years != null ? { label: 'Tenure', value: `${journey.tenure_years} years` } : null,
                  journey.rate_pct != null ? { label: 'Interest rate', value: `${Number(journey.rate_pct).toFixed(1)}% p.a.` } : null,
                  journey.emi_amount != null ? { label: 'Estimated EMI', value: `₹${Number(journey.emi_amount).toLocaleString('en-IN')}/month`, highlight: true } : null,
                ].filter(Boolean)}
              />
            ) : (
              <EstimateCard
                icon="🛡️" title="Insurance Estimate" badge="Saved"
                rows={[
                  partner ? { label: 'Insurer', value: partner.company_name } : null,
                  { label: 'Coverage', value: coverageLabel },
                  journey.premium_amount != null ? { label: 'Estimated first-year premium', value: `₹${(Number(journey.premium_amount) / 1000).toFixed(1)}K`, highlight: true } : null,
                ].filter(Boolean)}
              />
            )}
          </div>

          <p className="vd-disclaimer">
            These figures are indicative estimates only. Contact the bank or insurance provider directly for actual current rates.
          </p>
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
          .vd-body { flex:1; overflow-y:auto; padding: 50px 20px 20px; box-sizing:border-box; }
          .vd-img { width:100%; height:180px; object-fit:cover; border-radius: var(--radius-md); margin-bottom:14px; }
          .vd-title { margin:0 0 4px; font-size:1.15rem; color: var(--ink); }
          .vd-price { margin:0 0 12px; font-weight:700; color: var(--orange); font-size:1rem; }
          .vd-specs { background: var(--surface-alt); border-radius: var(--radius-md); padding: 2px 16px; margin-bottom:16px; }
          .vd-spec-row { display:flex; justify-content:space-between; padding:10px 0; border-bottom:1px solid var(--rule-soft); font-size:0.85rem; }
          .vd-spec-row:last-child { border-bottom:none; }
          .vd-spec-label { color: var(--ink-4); }
          .vd-spec-value { color: var(--ink); font-weight:500; }
          .vd-estimate-wrap { margin-top:4px; }
          .vd-disclaimer { padding:14px 0 0; font-size:0.6875rem; color:var(--ink-5); text-align:center; line-height:1.55; }
        `}</style>
      </div>
    </div>
  );
}

/* ---------------- Delete confirmation ---------------- */

function ConfirmDeleteGate({ onConfirm, onCancel }) {
  return (
    <div className="cdg-backdrop">
      <div className="cdg-popup">
        <p className="cdg-title">Delete this?</p>
        <div className="cdg-actions">
          <button className="cdg-btn cdg-btn-delete" onClick={onConfirm}>Delete</button>
          <button className="cdg-btn cdg-btn-cancel" onClick={onCancel}>Cancel</button>
        </div>
      </div>

      <style>{`
        .cdg-backdrop {
          position:fixed; inset:0; z-index:30; background:rgba(0,0,0,0.55);
          display:flex; align-items:center; justify-content:center; padding:24px;
        }
        .cdg-popup {
          width:100%; max-width:320px; background:var(--bg);
          border-radius:16px; padding:22px 20px; text-align:center;
        }
        .cdg-title { margin:0 0 16px; font-size:1rem; font-weight:600; color:var(--ink); }
        .cdg-actions { display:flex; gap:10px; }
        .cdg-btn { flex:1; border:none; border-radius:var(--radius-sm); padding:12px; font-weight:600; font-size:0.9rem; cursor:pointer; }
        .cdg-btn-delete { background:#E4572E; color:#fff; }
        .cdg-btn-cancel { background:transparent; border:1.5px solid var(--rule); color:var(--ink); }
      `}</style>
    </div>
  );
}

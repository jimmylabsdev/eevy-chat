import React, { useState } from 'react';

export default function ChipGroup({ options, onSelect, disabled }) {
  const [selectedValue, setSelectedValue] = useState(null);
  const [freetextValue, setFreetextValue] = useState('');
  const [showFreetext, setShowFreetext] = useState(false);

  function handleClick(opt) {
    if (disabled) return;
    setSelectedValue(opt.v);
    if (opt.freetext) {
      setShowFreetext(true);
      return;
    }
    onSelect(opt.v, opt.l);
  }

  function submitFreetext() {
    if (disabled || !freetextValue.trim()) return;
    const opt = options.find((o) => o.v === selectedValue);
    const extraFields = opt?.freetextField ? { [opt.freetextField]: freetextValue.trim() } : null;
    onSelect(selectedValue, freetextValue.trim(), extraFields);
  }

  return (
    <div className="chip-group">
      {options.map((opt) => (
        <button
          key={opt.v}
          className={`chip ${selectedValue === opt.v ? 'chip-selected' : ''}`}
          disabled={disabled}
          onClick={() => handleClick(opt)}
        >
          {opt.l}
        </button>
      ))}
      {showFreetext && (
        <div className="chip-freetext">
          <input
            autoFocus
            placeholder="Type your city…"
            value={freetextValue}
            disabled={disabled}
            onChange={(e) => setFreetextValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submitFreetext()}
          />
          <button className="chip-freetext-submit" disabled={disabled} onClick={submitFreetext}>→</button>
        </div>
      )}

      <style>{`
        .chip-group { display:flex; flex-wrap:wrap; gap:8px; margin-top:10px; }
        .chip {
          background: var(--chip-bg);
          border: 1px solid var(--chip-border);
          color: var(--ink-2);
          padding: 9px 16px;
          border-radius: 999px;
          font-size: 0.9rem;
          text-align: left;
          cursor: pointer;
          transition: border-color 0.15s ease, color 0.15s ease, background 0.15s ease;
        }
        .chip:hover:not(:disabled) { border-color: var(--chip-border-active); color: var(--chip-text-active); }
        .chip:disabled { opacity: 0.5; cursor: default; }
        .chip-selected {
          border-color: var(--chip-border-active);
          color: var(--chip-text-active);
          background: rgba(13,148,136,0.12);
        }
        .chip-freetext { display:flex; gap:8px; margin-top:4px; width:100%; min-width:0; }
        .chip-freetext input {
          flex:1; min-width:0; background: var(--surface-alt); border:1px solid var(--rule);
          border-radius: var(--radius-sm); padding: 9px 14px; color: var(--ink);
          font-family: var(--font); font-size: 0.9rem;
        }
        .chip-freetext-submit {
          flex-shrink:0;
          background: var(--brand); border:none; color:#fff; border-radius: var(--radius-sm);
          padding: 0 16px; cursor:pointer; font-size:1rem;
        }
      `}</style>
    </div>
  );
}

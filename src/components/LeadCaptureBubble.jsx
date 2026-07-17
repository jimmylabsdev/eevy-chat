import React, { useState } from 'react';

const FIELD_CONFIG = {
  name: { placeholder: 'Your name', type: 'text' },
  email: { placeholder: 'you@example.com', type: 'email' },
  whatsapp: { placeholder: '10-digit WhatsApp number', type: 'tel' },
};

export default function LeadCaptureBubble({ field, prompt, onSubmit, onSkip, disabled }) {
  const [value, setValue] = useState('');
  const cfg = FIELD_CONFIG[field] || FIELD_CONFIG.name;

  function submit() {
    if (disabled || !value.trim()) return;
    onSubmit(value.trim());
  }

  return (
    <div className="lead-capture">
      <p className="lead-prompt">{prompt}</p>
      <div className="lead-row">
        <input
          type={cfg.type}
          placeholder={cfg.placeholder}
          value={value}
          disabled={disabled}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          autoFocus
        />
        <button disabled={disabled} onClick={submit}>Send</button>
      </div>
      {onSkip && <button className="lead-skip" disabled={disabled} onClick={onSkip}>Not now</button>}
      <p className="lead-consent">Only used to send you your results — never sold, never shared without your consent.</p>

      <style>{`
        .lead-capture { margin-top: 6px; }
        .lead-prompt { margin: 0 0 10px; color: var(--ink-2); font-size: 0.9rem; }
        .lead-row { display:flex; gap:8px; min-width:0; }
        .lead-row input {
          flex:1; min-width:0; background: var(--surface-alt); border:1px solid var(--rule);
          border-radius: var(--radius-sm); padding: 10px 14px; color: var(--ink);
          font-family: var(--font); font-size: 0.9rem;
        }
        .lead-row button {
          flex-shrink:0;
          background: var(--brand); border:none; color:#fff; border-radius: var(--radius-sm);
          padding: 0 18px; cursor:pointer; font-weight:600; font-size:0.9rem;
        }
        .lead-skip {
          background:none; border:none; color: var(--ink-4); font-size:0.8125rem;
          margin-top:8px; cursor:pointer; padding:0; text-decoration:underline;
        }
        .lead-consent {
          font-size:0.6875rem; color: var(--ink-5); margin:8px 0 0; line-height:1.5;
        }
      `}</style>
    </div>
  );
}

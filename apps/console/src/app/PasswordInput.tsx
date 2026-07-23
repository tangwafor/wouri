'use client';
import { useState } from 'react';

// A password field with a show/hide eye. Client component so the toggle is
// interactive; drops into the server-rendered auth forms in place of a plain
// input. No em-dashes.
export function PasswordInput({
  id, name, autoComplete, required, minLength, placeholder,
}: {
  id: string; name: string; autoComplete?: string;
  required?: boolean; minLength?: number; placeholder?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ position: 'relative' }}>
      <input
        id={id} name={name} type={show ? 'text' : 'password'}
        required={required} minLength={minLength} autoComplete={autoComplete}
        placeholder={placeholder} style={{ paddingRight: 44 }}
      />
      <button
        type="button" onClick={() => setShow((s) => !s)}
        aria-label={show ? 'Hide password' : 'Show password'} title={show ? 'Hide' : 'Show'}
        style={{
          position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)',
          margin: 0, padding: 6, background: 'transparent', border: 0, cursor: 'pointer',
          color: 'var(--ink-3)', lineHeight: 0,
        }}
      >
        {show ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
            <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
            <line x1="1" y1="1" x2="23" y2="23" />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        )}
      </button>
    </div>
  );
}

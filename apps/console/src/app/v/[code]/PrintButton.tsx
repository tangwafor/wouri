'use client';
// A small print control for the verification document. No em-dashes.
export function PrintButton({ label }: { label: string }) {
  return (
    <button type="button" className="ghost" style={{ marginTop: 0, padding: '5px 12px', fontSize: '.85rem' }} onClick={() => window.print()}>
      {label}
    </button>
  );
}

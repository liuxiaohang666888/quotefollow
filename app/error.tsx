'use client';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ maxWidth: 420, width: '100%', textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 8 }}>⚠️</div>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 8px' }}>Something went wrong</h1>
        <p style={{ fontSize: 14, color: 'var(--fg-dim)', lineHeight: 1.6, margin: '0 0 20px' }}>
          This page hit an unexpected error. Your data is safe — please try again.
          {error?.digest ? <span style={{ display: 'block', fontSize: 12, marginTop: 8, opacity: 0.6 }}>Error digest: {error.digest}</span> : null}
        </p>
        <button
          className="btn"
          onClick={() => reset()}
          style={{ padding: '10px 24px', fontSize: 14 }}
        >
          Try again
        </button>
      </div>
    </div>
  );
}

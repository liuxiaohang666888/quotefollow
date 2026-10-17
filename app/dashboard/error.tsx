'use client';

export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div style={{ padding: '48px 24px', textAlign: 'center' }}>
      <div style={{ fontSize: 36, marginBottom: 8 }}>⚠️</div>
      <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 8px' }}>Dashboard hit an error</h2>
      <p style={{ fontSize: 14, color: 'var(--fg-dim)', lineHeight: 1.6, margin: '0 0 20px' }}>
        Something went wrong while loading this page. Your quotes are safe — please try again.
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
  );
}

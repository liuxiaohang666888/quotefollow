'use client';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body>
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: '#0a0a0f', color: '#fff' }}>
          <div style={{ maxWidth: 420, width: '100%', textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>⚠️</div>
            <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 8px' }}>Something went wrong</h1>
            <p style={{ fontSize: 14, lineHeight: 1.6, opacity: 0.8, margin: '0 0 20px' }}>
              This page hit an unexpected error. Your data is safe — please try again.
            </p>
            <button
              onClick={() => reset()}
              style={{ padding: '10px 24px', fontSize: 14, borderRadius: 8, border: 'none', background: '#6366f1', color: '#fff', cursor: 'pointer' }}
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}

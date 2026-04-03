'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="pt-BR">
      <body style={{ backgroundColor: '#080810', color: '#eeeef8', fontFamily: 'sans-serif' }}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            gap: '16px',
            padding: '24px',
            textAlign: 'center',
          }}
        >
          <h1 style={{ fontSize: '24px', fontWeight: 'bold' }}>Algo deu errado</h1>
          <p style={{ color: '#65657a', fontSize: '14px', maxWidth: '400px' }}>
            Ocorreu um erro inesperado. Nossa equipe ja foi notificada.
          </p>
          <button
            onClick={reset}
            style={{
              backgroundColor: '#7c6aff',
              color: 'white',
              border: 'none',
              padding: '10px 24px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500',
            }}
          >
            Tentar novamente
          </button>
        </div>
      </body>
    </html>
  );
}

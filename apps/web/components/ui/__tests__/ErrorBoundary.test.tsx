// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import * as Sentry from '@sentry/nextjs';
import { ErrorBoundary } from '../ErrorBoundary';
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.clearAllMocks(); });
it('reporta exceção com componentStack e exibe recuperação', () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  const error = new Error('PII pessoa@example.com token=segredo');
  function Quebra(): never { throw error; }
  render(<ErrorBoundary><Quebra /></ErrorBoundary>);
  expect(vi.mocked(Sentry.captureException).mock.calls[0]?.[0]).not.toBe(error);
  expect(String((vi.mocked(Sentry.captureException).mock.calls[0]?.[0] as Error).stack)).not.toMatch(/pessoa@|segredo/);
  expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeTruthy();
  expect(Sentry.captureException).toHaveBeenCalledWith(expect.objectContaining({ message: 'Falha no servidor' }), {
    contexts: { react: { componentStack: expect.stringContaining('Quebra') } },
  });
});

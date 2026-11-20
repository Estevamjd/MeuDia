import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import * as Sentry from '@sentry/nextjs';
vi.mock('@sentry/nextjs', () => ({ init: vi.fn() }));
beforeEach(() => { vi.resetModules(); vi.clearAllMocks(); vi.stubEnv('NODE_ENV', 'production'); });
afterEach(() => vi.unstubAllEnvs());
it.each(['nodejs', 'edge'])('carrega a configuração %s com DSN', async (runtime) => {
  vi.stubEnv('NEXT_RUNTIME', runtime);
  vi.stubEnv('NEXT_PUBLIC_SENTRY_DSN', 'https://public@example.invalid/1');
  const { register } = await import('../../instrumentation');
  await register();
  expect(Sentry.init).toHaveBeenCalledTimes(1);
  expect(Sentry.init).toHaveBeenCalledWith(expect.objectContaining({ dsn: 'https://public@example.invalid/1', enabled: true }));
});
it('sem DSN não inicializa cliente nem lança erro', async () => {
  vi.stubEnv('NEXT_RUNTIME', 'nodejs');
  vi.stubEnv('NEXT_PUBLIC_SENTRY_DSN', '');
  const { register } = await import('../../instrumentation');
  await expect(register()).resolves.toBeUndefined();
  expect(Sentry.init).not.toHaveBeenCalled();
});

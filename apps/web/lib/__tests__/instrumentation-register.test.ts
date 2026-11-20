import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const loaded = vi.hoisted(() => ({ server: vi.fn(), edge: vi.fn() }));
vi.mock('../../sentry.server.config', () => { loaded.server(); return {}; });
vi.mock('../../sentry.edge.config', () => { loaded.edge(); return {}; });
beforeEach(() => { vi.resetModules(); vi.clearAllMocks(); });
afterEach(() => vi.unstubAllEnvs());
it.each(['nodejs', 'edge'])('sem DSN não importa configs em %s', async (runtime) => {
  vi.stubEnv('NEXT_PUBLIC_SENTRY_DSN', '');
  vi.stubEnv('NEXT_RUNTIME', runtime);
  await (await import('../../instrumentation')).register();
  expect(loaded.server).not.toHaveBeenCalled();
  expect(loaded.edge).not.toHaveBeenCalled();
});
it.each(['nodejs', 'edge'])('com DSN importa apenas config de %s', async (runtime) => {
  vi.stubEnv('NEXT_PUBLIC_SENTRY_DSN', 'https://public@example.invalid/1');
  vi.stubEnv('NEXT_RUNTIME', runtime);
  await (await import('../../instrumentation')).register();
  expect(loaded.server).toHaveBeenCalledTimes(runtime === 'nodejs' ? 1 : 0);
  expect(loaded.edge).toHaveBeenCalledTimes(runtime === 'edge' ? 1 : 0);
});
it('Next habilita instrumentação sem DSN de build', async () => {
  vi.stubEnv('NEXT_PUBLIC_SENTRY_DSN', '');
  // eslint-disable-next-line @typescript-eslint/no-var-requires -- next.config.js é CommonJS
  const config = require('../../next.config.js') as { experimental: { instrumentationHook: boolean } };
  expect(config.experimental.instrumentationHook).toBe(true);
});

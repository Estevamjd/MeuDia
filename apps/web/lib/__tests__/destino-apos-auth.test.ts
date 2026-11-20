import { afterEach, expect, it, vi } from 'vitest';
import { destinoAposAuth } from '../destino-apos-auth';

afterEach(() => vi.unstubAllEnvs());

// A Início antiga saiu com os módulos legados: os dois modos entram em /financas.
it.each([['financas', '/financas'], ['padrao', '/financas'], ['', '/financas']])(
  'resolve home em runtime: %s → %s', async (mode, home) => {
    vi.stubEnv('APP_MODE', mode);
    expect(await destinoAposAuth()).toBe(home);
  },
);


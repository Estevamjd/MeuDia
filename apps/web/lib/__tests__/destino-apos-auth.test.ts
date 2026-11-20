import { afterEach, expect, it, vi } from 'vitest';
import { destinoAposAuth } from '../destino-apos-auth';

afterEach(() => vi.unstubAllEnvs());

it.each([['financas', '/financas'], ['padrao', '/inicio'], ['', '/inicio']])(
  'resolve home em runtime: %s → %s', async (mode, home) => {
    vi.stubEnv('APP_MODE', mode);
    expect(await destinoAposAuth()).toBe(home);
  },
);

it('não congela o modo ao importar o módulo', async () => {
  vi.stubEnv('APP_MODE', 'padrao');
  expect(await destinoAposAuth()).toBe('/inicio');
  vi.stubEnv('APP_MODE', 'financas');
  expect(await destinoAposAuth()).toBe('/financas');
});

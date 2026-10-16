import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildManifest } from '../manifest';
import { GET as getWebmanifest } from '../../app/manifest.webmanifest/route';
import { GET as getManifestJson } from '../../app/manifest.json/route';

afterEach(() => vi.unstubAllEnvs());

const OCULTOS_NO_FINANCAS = ['/inicio', '/agenda', '/habitos', '/treinos', '/dieta', '/compras', '/medicamentos', '/notas', '/veiculo'];

describe('buildManifest', () => {
  it('modo padrão: igual ao antigo public/manifest.json', () => {
    const m = buildManifest('padrao');
    expect(m.start_url).toBe('/inicio');
    expect(m.shortcuts.map((s) => s.url)).toEqual(['/treinos', '/habitos', '/notas', '/financas', '/agenda']);
    expect(m.categories).toEqual(['health', 'fitness', 'productivity', 'finance']);
    expect(m.icons).toHaveLength(4);
  });

  it('modo finanças: só atalhos de finanças e start_url /financas', () => {
    const m = buildManifest('financas');
    expect(m.start_url).toBe('/financas');
    expect(m.shortcuts.map((s) => s.url)).toEqual(['/financas']);
    expect(m.categories).toEqual(['finance']);
  });
});

describe.each([
  ['/manifest.webmanifest', getWebmanifest],
  ['/manifest.json', getManifestJson],
])('rota %s', (_rota, GET) => {
  it('APP_MODE=financas: sem atalhos de módulos ocultos', async () => {
    vi.stubEnv('APP_MODE', 'financas');
    const res = GET();
    expect(res.headers.get('content-type')).toContain('application/manifest+json');
    const m = await res.json();
    expect(m.start_url).toBe('/financas');
    for (const atalho of m.shortcuts) expect(OCULTOS_NO_FINANCAS).not.toContain(atalho.url);
    expect(m.shortcuts.map((s: { url: string }) => s.url)).not.toContain('/treinos');
  });

  it('sem APP_MODE: manifest padrão (inclui /treinos)', async () => {
    vi.stubEnv('APP_MODE', '');
    const m = await GET().json();
    expect(m.start_url).toBe('/inicio');
    expect(m.shortcuts.map((s: { url: string }) => s.url)).toContain('/treinos');
  });
});

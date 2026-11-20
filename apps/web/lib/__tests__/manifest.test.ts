import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildManifest } from '../manifest';
import { ROTAS_LEGADAS } from '../app-mode';
import { GET as getWebmanifest } from '../../app/manifest.webmanifest/route';
import { GET as getManifestJson } from '../../app/manifest.json/route';

afterEach(() => vi.unstubAllEnvs());

// Módulos legados removidos (20/11/2026): nenhum atalho aponta para eles, em nenhum modo.
const OCULTOS_NO_FINANCAS: readonly string[] = ROTAS_LEGADAS;

describe('buildManifest', () => {
  it('modo padrão: start_url /financas e só atalhos de módulos que existem', () => {
    const m = buildManifest('padrao');
    expect(m.start_url).toBe('/financas');
    expect(m.shortcuts.map((s) => s.url)).toEqual(['/treinos', '/financas']);
    expect(m.categories).toEqual(['finance', 'health', 'fitness']);
    expect(m.icons).toHaveLength(4);
  });

  it('modo finanças: atalhos de Treinos e Finanças e start_url /financas', () => {
    const m = buildManifest('financas');
    expect(m.start_url).toBe('/financas');
    expect(m.shortcuts.map((s) => s.url)).toEqual(['/treinos', '/financas']);
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
    expect(m.shortcuts.map((s: { url: string }) => s.url)).toContain('/treinos');
  });

  it('sem APP_MODE: manifest padrão (start_url /financas, inclui /treinos)', async () => {
    vi.stubEnv('APP_MODE', '');
    const m = await GET().json();
    expect(m.start_url).toBe('/financas');
    for (const atalho of m.shortcuts) expect(OCULTOS_NO_FINANCAS).not.toContain(atalho.url);
    expect(m.shortcuts.map((s: { url: string }) => s.url)).toContain('/treinos');
  });
});

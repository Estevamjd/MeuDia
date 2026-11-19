// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CHAVE_TEMA, COR_BARRA, SCRIPT_TEMA, lerPreferencia, pintarModo, resolverModo } from '../tema';

function rodarScript() {
  // eslint-disable-next-line no-new-func
  new Function(SCRIPT_TEMA)();
}
function sistema(escuro: boolean) {
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('dark') ? escuro : !escuro, addEventListener() {}, removeEventListener() {} }));
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-mode');
  document.head.innerHTML = '<meta name="theme-color" content="#000000">';
  sistema(true);
});
afterEach(() => vi.unstubAllGlobals());

describe('resolverModo / lerPreferencia', () => {
  it('claro e escuro são fixos; sistema segue o celular', () => {
    expect(resolverModo('claro', true)).toBe('light');
    expect(resolverModo('escuro', false)).toBe('dark');
    expect(resolverModo('sistema', true)).toBe('dark');
    expect(resolverModo('sistema', false)).toBe('light');
  });
  it('só aceita os três valores', () => {
    expect(lerPreferencia('claro')).toBe('claro');
    expect(lerPreferencia('light')).toBeNull();
    expect(lerPreferencia(null)).toBeNull();
    expect(lerPreferencia(1)).toBeNull();
  });
});

describe('SCRIPT_TEMA (roda no <head>, antes do React)', () => {
  it('sem escolha fica no escuro de sempre', () => {
    rodarScript();
    expect(document.documentElement.dataset.mode).toBe('dark');
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe(COR_BARRA.dark);
  });
  it('escolha "claro" pinta claro antes da hidratação', () => {
    localStorage.setItem(CHAVE_TEMA, 'claro');
    rodarScript();
    expect(document.documentElement.dataset.mode).toBe('light');
    expect(document.documentElement.style.colorScheme).toBe('light');
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe(COR_BARRA.light);
  });
  it('"sistema" segue o celular; valor estranho volta ao padrão', () => {
    localStorage.setItem(CHAVE_TEMA, 'sistema');
    sistema(false);
    rodarScript();
    expect(document.documentElement.dataset.mode).toBe('light');
    localStorage.setItem(CHAVE_TEMA, 'roxo');
    rodarScript();
    expect(document.documentElement.dataset.mode).toBe('dark');
  });
  it('é a mesma regra do resolverModo', () => {
    for (const p of ['claro', 'escuro', 'sistema'] as const) {
      for (const escuro of [true, false]) {
        localStorage.setItem(CHAVE_TEMA, p);
        sistema(escuro);
        rodarScript();
        expect(document.documentElement.dataset.mode).toBe(resolverModo(p, escuro));
      }
    }
  });
});

it('pintarModo troca data-mode, color-scheme e a cor da barra', () => {
  document.documentElement.dataset.mode = 'dark';
  pintarModo('light');
  expect(document.documentElement.dataset.mode).toBe('light');
  pintarModo('dark');
  expect(document.documentElement.style.colorScheme).toBe('dark');
  expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe(COR_BARRA.dark);
});

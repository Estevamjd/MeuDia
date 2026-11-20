import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Tema claro = mesma linguagem do escuro (Astro G claro do Mestres CRM), não troca chapada de cores.
 * Estes testes travam as decisões que fazem isso funcionar.
 */
const raiz = path.resolve(__dirname, '../..');
const css = readFileSync(path.join(raiz, 'app/globals.css'), 'utf8');
const blocoClaro = css.slice(css.indexOf("html[data-mode='light'] {"), css.indexOf('html[data-trocando-tema]'));

describe('tema claro (globals.css)', () => {
  it('não troca o material do bloco principal: --lap-m-* só existe no escuro', () => {
    expect(blocoClaro).not.toMatch(/--lap-m-/);
  });
  it('dentro do .lap-heroi devolve os tokens escuros (texto claro, ciano, números rosa/ciano)', () => {
    const heroi = blocoClaro.slice(blocoClaro.indexOf("html[data-mode='light'] .lap-heroi"));
    // Número ciano com croma um pouco menor no claro (Wave 1B / P0.2): mesma luz, sem "estourar" sobre o branco.
    // O accent do bloco é o tom "vivo" da cor do app (ciano = 0 229 255 no :root; ver cores-app.test.ts).
    expect(css).toContain('--c-accent-vivo: 0 229 255;');
    expect(css).toContain('--lap-h-positivo-claro: oklch(0.9 0.105 203);');
    for (const token of ['--c-text: 245 246 248', '--c-accent: var(--c-accent-vivo)', '--lap-h-negativo: #f8b4b4', '--lap-h-positivo: var(--lap-h-positivo-claro)']) {
      expect(heroi).toContain(token);
    }
  });
  it('cartões brancos com aresta de luz e sombra suave (não chapados)', () => {
    expect(blocoClaro).toMatch(/--lap-sombra-cartao: inset 0 1px 0 var\(--lap-luz-aresta\)/);
    expect(blocoClaro).toMatch(/\.bg-card\.border[\s\S]*box-shadow: var\(--lap-sombra-cartao\)/);
  });
  it('accent e números legíveis no branco (azul-petróleo e vermelho escuro)', () => {
    expect(blocoClaro).toContain('--c-accent: 14 116 144');
    expect(blocoClaro).toContain('--lap-h-negativo: #c43232');
  });
});

function arquivosTsx(dir: string): string[] {
  return readdirSync(dir).flatMap((nome) => {
    const p = path.join(dir, nome);
    if (nome === 'node_modules' || nome === '__tests__' || nome.startsWith('.')) return [];
    if (statSync(p).isDirectory()) return arquivosTsx(p);
    return p.endsWith('.tsx') ? [p] : [];
  });
}

describe('telas sem cores fixas do escuro', () => {
  const arquivos = [...arquivosTsx(path.join(raiz, 'app')), ...arquivosTsx(path.join(raiz, 'components'))];
  it('bordas, divisórias e fundos translúcidos usam o token de texto (text/α), não branco fixo', () => {
    const achados = arquivos
      .filter((f) => !f.endsWith('OfflineIndicator.tsx')) // avisos coloridos sólidos: branco é proposital
      .flatMap((f) => (readFileSync(f, 'utf8').match(/\b(border|divide|ring|bg)-white\/[\w.[\]]+/g) ?? []).map((m) => `${path.relative(raiz, f)}: ${m}`));
    expect(achados).toEqual([]);
  });
  it('sem o ciano/rosa do escuro fixo em classes (usa tokens que mudam no claro)', () => {
    const achados = arquivos.flatMap((f) =>
      (readFileSync(f, 'utf8').match(/rgba\(0,229,255|#f8b4b4|#fca5a5|accent-\[#/g) ?? []).map((m) => `${path.relative(raiz, f)}: ${m}`));
    expect(achados).toEqual([]);
  });
});

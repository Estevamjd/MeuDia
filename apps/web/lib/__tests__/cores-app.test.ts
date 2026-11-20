// @vitest-environment jsdom
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { CHAVE_COR, CORES_APP, FUNDOS_TEMA, PALETA_CORES, cssCoresApp, lerCor, pintarCor, rgb } from '../cores-app';
import { SCRIPT_TEMA } from '../tema';

const css = readFileSync(path.resolve(__dirname, '../../app/globals.css'), 'utf8');

/** Razão de contraste WCAG 2.x entre duas cores #rrggbb. */
function luminancia(hex: string): number {
  const canais = rgb(hex).split(' ').map((v) => {
    const c = Number(v) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return [0.2126, 0.7152, 0.0722].reduce((soma, peso, i) => soma + peso * (canais[i] ?? 0), 0);
}
function contraste(a: string, b: string): number {
  const la = luminancia(a);
  const lb = luminancia(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

describe('contraste de cada cor × tema (WCAG AA, ≥ 4,5:1)', () => {
  for (const cor of CORES_APP) {
    for (const tema of ['escuro', 'claro'] as const) {
      const t = PALETA_CORES[cor][tema];
      const fundo = FUNDOS_TEMA[tema];
      it(`${cor} no ${tema}`, () => {
        const casos: [string, number][] = [
          ['texto do botão sobre o accent', contraste(t.fg, t.accent)],
          ['texto do botão sobre o hover (accent3)', contraste(t.fg, t.accent3)],
          ['accent como texto na página', contraste(t.accent, fundo.pagina)],
          ['accent como texto no cartão', contraste(t.accent, fundo.card)],
          ['accent2 (hover de link) na página', contraste(t.accent2, fundo.pagina)],
          ['accent2 no cartão', contraste(t.accent2, fundo.card)],
        ];
        for (const [nome, razao] of casos) expect(razao, `${cor}/${tema}: ${nome}`).toBeGreaterThanOrEqual(4.5);
      });
    }
  }
  it('no escuro o texto do botão é sempre o escuro de sempre (o .lap-heroi do claro fixa --c-accent-fg: 6 16 28)', () => {
    for (const cor of CORES_APP) expect(PALETA_CORES[cor].escuro.fg).toBe('#06101c');
  });
});

/** Mistura `frente` com alfa sobre `fundo` (o que a tela pinta para bg-x/NN ou opacity-NN). */
function sobre(frente: string, alfa: number, fundo: string): string {
  const [f, b] = [frente, fundo].map((h) => rgb(h).split(' ').map(Number));
  return `#${f!.map((c, i) => Math.round(c * alfa + (b![i] ?? 0) * (1 - alfa)).toString(16).padStart(2, '0')).join('')}`;
}

function arquivosTsx(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === '__tests__' ? [] : arquivosTsx(p);
    return e.name.endsWith('.tsx') ? [p] : [];
  });
}

describe('hover renderizado dos botões com texto accent-fg (≥ 4,5:1 em toda cor × tema)', () => {
  const raiz = path.resolve(__dirname, '../..');
  const botoes = ['app', 'components'].flatMap((d) =>
    arquivosTsx(path.join(raiz, d)).flatMap((arq) =>
      readFileSync(arq, 'utf8')
        .split('\n')
        .map((linha, i) => ({ onde: `${path.relative(raiz, arq)}:${i + 1}`, linha }))
        .filter(({ linha }) => /\btext-accent-fg\b/.test(linha) && /\bbg-accent\b/.test(linha)),
    ),
  );

  it('acha os botões primários (Button, InstallPrompt, AgentChat)', () => {
    const onde = botoes.map((b) => b.onde).join(' ');
    for (const arq of ['components/ui/Button.tsx', 'components/ui/InstallPrompt.tsx', 'components/agent/AgentChat.tsx']) expect(onde).toContain(arq);
  });

  for (const { onde, linha } of botoes) {
    it(onde, () => {
      const bg = /\bhover:bg-(accent3|accent2|accent)(?:\/(\d+|\[[\d.]+\]))?(?![\w-])/.exec(linha);
      const opacidade = /\bhover:opacity-(\d+)\b/.exec(linha);
      for (const cor of CORES_APP) {
        for (const tema of ['escuro', 'claro'] as const) {
          const t = PALETA_CORES[cor][tema];
          for (const fundo of Object.values(FUNDOS_TEMA[tema])) {
            const tom = t[(bg?.[1] ?? 'accent') as 'accent' | 'accent2' | 'accent3'];
            const bruto = bg?.[2];
            const alfaBg = bruto === undefined ? 1 : bruto.startsWith('[') ? Number(bruto.slice(1, -1)) : Number(bruto) / 100;
            let fundoBotao = sobre(tom, alfaBg, fundo);
            let texto = t.fg;
            const alfa = opacidade ? Number(opacidade[1]) / 100 : 1;
            fundoBotao = sobre(fundoBotao, alfa, fundo);
            texto = sobre(texto, alfa, fundo);
            const razao = contraste(texto, fundoBotao);
            expect(razao, `${onde} ${cor}/${tema} sobre ${fundo}: ${razao.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
          }
        }
      }
    });
  }
});

describe('globals.css usa a mesma tabela', () => {
  it('os blocos html[data-accent] são exatamente os gerados por cssCoresApp()', () => {
    expect(css).toContain(cssCoresApp());
  });
  it('ciano (padrão) é o :root e o claro de sempre', () => {
    const raiz = css.slice(css.indexOf(':root {'), css.indexOf('}', css.indexOf(':root {')));
    const claro = css.slice(css.indexOf("html[data-mode='light'] {"), css.indexOf('}', css.indexOf("html[data-mode='light'] {")));
    const { escuro: e, claro: c } = PALETA_CORES.ciano;
    for (const [bloco, t] of [[raiz, e], [claro, c]] as const) {
      expect(bloco).toContain(`--c-accent: ${rgb(t.accent)};`);
      expect(bloco).toContain(`--c-accent-fg: ${rgb(t.fg)};`);
      expect(bloco).toContain(`--c-accent2: ${rgb(t.accent2)};`);
      expect(bloco).toContain(`--c-accent3: ${rgb(t.accent3)};`);
      expect(bloco).toContain(`--c-brilho: ${rgb(t.brilho)};`);
      expect(bloco).toMatch(new RegExp(`--accent:\\s+${t.accent};`));
      expect(bloco).toMatch(new RegExp(`--accent-fg:\\s+${t.fg};`));
    }
    expect(raiz).toContain(`--c-accent-vivo: ${rgb(e.accent)};`);
    expect(css).not.toContain("data-accent='ciano'");
  });
  it('sem o ciano fixo em rgba(): brilhos seguem a cor do app', () => {
    expect(css).not.toMatch(/rgba\(0, ?229, ?255/);
  });
});

describe('aplicar a cor', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-accent');
  });
  it('lerCor só aceita a lista branca', () => {
    expect(lerCor('laranja')).toBe('laranja');
    expect(lerCor('azul')).toBeNull();
    expect(lerCor("laranja'] *{")).toBeNull();
    expect(lerCor(3)).toBeNull();
  });
  it('SCRIPT_TEMA põe data-accent antes do React; ciano e valor estranho ficam sem atributo', () => {
    localStorage.setItem(CHAVE_COR, 'roxo');
    // eslint-disable-next-line no-new-func
    new Function(SCRIPT_TEMA)();
    expect(document.documentElement.getAttribute('data-accent')).toBe('roxo');
    for (const v of ['ciano', 'azul', '"><script>']) {
      document.documentElement.removeAttribute('data-accent');
      localStorage.setItem(CHAVE_COR, v);
      // eslint-disable-next-line no-new-func
      new Function(SCRIPT_TEMA)();
      expect(document.documentElement.hasAttribute('data-accent')).toBe(false);
    }
  });
  it('pintarCor troca o atributo (ciano remove) e não grava nada', () => {
    pintarCor('verde');
    expect(document.documentElement.getAttribute('data-accent')).toBe('verde');
    pintarCor('ciano');
    expect(document.documentElement.hasAttribute('data-accent')).toBe(false);
    expect(localStorage.getItem(CHAVE_COR)).toBeNull();
  });
});

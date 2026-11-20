// @vitest-environment jsdom
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { CHAVE_COR, CORES_APP, FUNDOS_TEMA, PALETA_CORES, cssCoresApp, lerCor, pintarCor, rgb, variaveisMaterial, type CorApp, type Oklch } from '../cores-app';
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

/** OKLCH → sRGB (#rrggbb), com corte por canal como o navegador faz numa tela sRGB. */
function deOklch([l, c, h]: Oklch): string {
  const a = c * Math.cos((h * Math.PI) / 180);
  const b = c * Math.sin((h * Math.PI) / 180);
  const L = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const M = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const S = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const lin = [
    4.0767416621 * L - 3.3077115913 * M + 0.2309699292 * S,
    -1.2684380046 * L + 2.6097574011 * M - 0.3413193965 * S,
    -0.0041960863 * L - 0.7034186147 * M + 1.707614701 * S,
  ];
  const gama = (v: number) => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);
  return `#${lin.map((v) => Math.round(Math.min(1, Math.max(0, gama(v))) * 255).toString(16).padStart(2, '0')).join('')}`;
}
/** Mistura em OKLCH pelo caminho curto da matiz (o color-mix(in oklch) do CSS). */
function misturar(a: Oklch, b: Oklch, t: number): Oklch {
  let dh = b[2] - a[2];
  if (dh > 180) dh -= 360;
  if (dh < -180) dh += 360;
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + dh * t];
}

/**
 * "Tom claro" do herói = APROXIMAÇÃO do ponto mais claro do gradiente onde há texto: o fundo com ~45% da luz do canto e
 * 12% do foco de brilho, misturados em OKLCH. Não é o pixel real (o navegador empilha 6 gradientes, anéis e grão);
 * serve para comparar as cores entre si com a mesma régua.
 */
function tomClaro(m: (typeof PALETA_CORES)[CorApp]['heroi']): string {
  return deOklch(misturar(misturar(m.fundo, m.luz, 0.45), m.brilho, 0.12));
}
/** --lap-h-texto-3 (rótulos pequenos, 9,5–12px) composto com o alfa sobre `bg`. */
function texto3Sobre(m: (typeof PALETA_CORES)[CorApp]['heroi'], bg: string): number {
  return contraste(sobre(deOklch([0.9, 0.04, m.matizTexto]), m.alfaTexto3 ?? 0.62, bg), bg);
}

describe('herói (.lap-heroi) de cada cor: texto ≥ 4,5:1 nos dois temas', () => {
  for (const cor of CORES_APP) {
    it(cor, () => {
      const m = PALETA_CORES[cor].heroi;
      const claro = tomClaro(m);
      const fundo = deOklch(m.fundo);
      const texto2 = deOklch([0.95, 0.03, m.matizTexto]);
      for (const [onde, bg] of [['fundo', fundo], ['tom claro', claro]] as const) {
        const casos: [string, number][] = [
          ['texto branco', contraste('#ffffff', bg)],
          ['--lap-h-texto-2 (alfa 0,84)', contraste(sobre(texto2, 0.84, bg), bg)],
          ['--lap-h-positivo (escuro)', contraste(deOklch(m.positivo), bg)],
          ['--lap-h-positivo-claro (claro)', contraste(deOklch(m.positivoClaro), bg)],
        ];
        for (const [nome, razao] of casos) expect(razao, `${cor}: ${nome} sobre ${onde} (${razao.toFixed(2)}:1)`).toBeGreaterThanOrEqual(4.5);
      }
      // --lap-h-positivo também colore números nos cartões escuros ao lado do herói.
      expect(contraste(deOklch(m.positivo), FUNDOS_TEMA.escuro.card)).toBeGreaterThanOrEqual(4.5);
      expect(contraste(m.pilula.texto, m.pilula.fundo)).toBeGreaterThanOrEqual(7);
    });
  }
});

/*
 * --lap-h-texto-3 (rótulos pequenos do herói: "SOBRA DO MÊS", "previsão", notas). Sobre o fundo passa de 4,5:1 em
 * todas as cores. Sobre o "tom claro" (aproximação, ver tomClaro) nem o ciano de 42aea22 passa: ~3,0:1. Como o ciano
 * não muda nesta onda, o limite ali é o próprio ciano: nenhuma cor pode ler pior que ele. Verde e amarelo ficavam
 * abaixo (2,97 e 2,98) e usam alfa 0,64.
 */
describe('--lap-h-texto-3 (com alfa) de cada cor', () => {
  const cianoClaro = texto3Sobre(PALETA_CORES.ciano.heroi, tomClaro(PALETA_CORES.ciano.heroi));
  it('ciano sobre o tom claro fica abaixo de 4,5:1 (por isso o limite é ele)', () => {
    expect(cianoClaro).toBeGreaterThan(2.9);
    expect(cianoClaro).toBeLessThan(4.5);
    expect(PALETA_CORES.ciano.heroi.alfaTexto3 ?? 0.62).toBe(0.62);
  });
  for (const cor of CORES_APP) {
    it(cor, () => {
      const m = PALETA_CORES[cor].heroi;
      const sobreFundo = texto3Sobre(m, deOklch(m.fundo));
      const sobreClaro = texto3Sobre(m, tomClaro(m));
      expect(sobreFundo, `${cor}: texto-3 sobre o fundo (${sobreFundo.toFixed(2)}:1)`).toBeGreaterThanOrEqual(4.5);
      expect(sobreClaro, `${cor}: texto-3 sobre o tom claro (${sobreClaro.toFixed(2)}:1) ≥ ciano (${cianoClaro.toFixed(2)}:1)`).toBeGreaterThanOrEqual(cianoClaro);
    });
  }
});

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
    // Material do herói e brilhos da página: as mesmas linhas que cada cor gera, com os valores de sempre.
    for (const linha of variaveisMaterial('ciano')) expect(raiz).toContain(linha);
    expect(claro).toContain(`--lap-h-positivo: ${c.accent};`);
    expect(css).not.toContain("data-accent='ciano'");
  });
  it('sem o ciano fixo em rgba(): brilhos seguem a cor do app', () => {
    expect(css).not.toMatch(/rgba\(0, ?229, ?255/);
    expect(css).not.toMatch(/rgba\(0, ?255, ?163|rgba\(106, ?255, ?218, ?0\.(06|14)\)/);
  });
  it('material do herói e sombras tingidas só por variável (nada de ciano fixo nas regras)', () => {
    // As peles Conta/Meta fixam o ciano de propósito (não seguem a cor); conferidas em ciano-42aea22.test.ts.
    const regras = css
      .slice(css.indexOf('}', css.indexOf(':root {')))
      .replace(/^(?:html\[data-mode='light'\] )?\.lap-heroi:is\(\.cartao-pele-conta, \.cartao-pele-meta\) \{[^}]*\}/gm, '');
    for (const fixo of ['#0b2233', '#062a33', '#1f5f6b', '#ccf7ff', 'oklch(0.6 0.13 210', 'oklch(0.15 0.04 240', 'oklch(0.9 0.105 203']) {
      expect(regras, fixo).not.toContain(fixo);
    }
    expect(regras).not.toMatch(/oklch\(0\.(25|3) 0\.0\d 23[05]/);
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

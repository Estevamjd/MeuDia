import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/*
 * Proteção do ciano (Wave 3D): o visual de sempre não pode mudar. A referência é INDEPENDENTE do código atual:
 * fixtures/globals-42aea22-ciano.css tem as regras copiadas literalmente de 42aea22. O teste monta uma cascata mínima
 * (html → herói/peles → filhos), resolve os var() dos dois arquivos e compara valor a valor:
 *  - ciano (sem data-accent), escuro e claro: :root, html claro, herói, fundo (céu, brilho do topo) e filhos do herói;
 *  - peles Conta/Meta em QUALQUER cor e tema: idênticas a 42aea22 (não seguem a cor do app).
 */

const atual = readFileSync(path.resolve(__dirname, '../../app/globals.css'), 'utf8');
const antigo = readFileSync(path.resolve(__dirname, 'fixtures/globals-42aea22-ciano.css'), 'utf8');

const CORES = ['ciano', 'laranja', 'verde', 'amarelo', 'roxo', 'rosa'] as const;
const TEMAS = ['escuro', 'claro'] as const;
type Tema = (typeof TEMAS)[number];
type Decls = Map<string, string>;

/** Regras "folha" (sem chaves dentro), na ordem do arquivo: seletor exato → declarações. */
function regras(css: string): { sel: string; decls: [string, string][] }[] {
  const semComentario = css.replace(/\/\*[\s\S]*?\*\//g, '');
  return [...semComentario.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({
    sel: m[1]!.split(';').pop()!.trim().replace(/\s+/g, ' '),
    decls: m[2]!
      .split(';')
      .map((d) => d.trim())
      .filter(Boolean)
      .map((d) => {
        const i = d.indexOf(':');
        return [d.slice(0, i).trim(), d.slice(i + 1).trim().replace(/\s+/g, ' ')] as [string, string];
      }),
  }));
}

/** Junta as declarações dos seletores pedidos, na ordem dada (= ordem de especificidade/fonte). */
function juntar(css: string, seletores: string[]): Decls {
  const todas = regras(css);
  const saida: Decls = new Map();
  for (const sel of seletores) for (const r of todas) if (r.sel === sel) for (const [p, v] of r.decls) saida.set(p, v);
  return saida;
}

/** Resolve var(--x[, reserva]) usando as próprias declarações e, na falta, as herdadas (já resolvidas). */
function resolverValor(valor: string, proprias: Decls, herdadas: Decls, pilha: string[] = []): string {
  return valor.replace(/var\((--[\w-]+)\s*(?:,\s*([^()]*))?\)/g, (_, nome: string, reserva?: string) => {
    if (pilha.includes(nome)) throw new Error(`ciclo em ${nome}`);
    const bruto = proprias.get(nome);
    if (bruto !== undefined) return resolverValor(bruto, proprias, herdadas, [...pilha, nome]);
    const herdado = herdadas.get(nome);
    if (herdado !== undefined) return herdado;
    if (reserva !== undefined) return reserva.trim();
    throw new Error(`${nome} indefinida`);
  });
}

function computar(proprias: Decls, herdadas: Decls): Decls {
  const saida: Decls = new Map(herdadas);
  for (const [p, v] of proprias) saida.set(p, resolverValor(v, proprias, herdadas));
  return saida;
}

/** Mesmo valor escrito de outro jeito: rgba(r, g, b, a) = rgb(r g b / a), espaços. */
function normalizar(v: string): string {
  return v
    .replace(/rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)/g, 'rgb($1 $2 $3 / $4)')
    .replace(/\s+/g, ' ')
    .trim();
}

function seletoresHtml(cor: string, tema: Tema): string[] {
  const s = [':root'];
  if (tema === 'claro') s.push("html[data-mode='light']");
  if (cor !== 'ciano') s.push(`html[data-accent='${cor}']`);
  if (cor !== 'ciano' && tema === 'claro') s.push(`html[data-mode='light'][data-accent='${cor}']`);
  return s;
}

const PELES_IS = '.lap-heroi:is(.cartao-pele-conta, .cartao-pele-meta)';
/** Seletores que casam com o elemento, em ordem crescente de especificidade (e de fonte no empate). */
function seletoresElemento(el: 'heroi' | 'heroi-cc' | 'pele-conta' | 'pele-meta', tema: Tema): string[] {
  const claro = tema === 'claro';
  const L = "html[data-mode='light']";
  if (el === 'heroi') return ['.lap-heroi', ...(claro ? [`${L} .lap-heroi`] : [])];
  const cc = ['.lap-heroi', '.lap-heroi.cartao-cc'];
  if (el === 'heroi-cc') return [...cc, ...(claro ? [`${L} .lap-heroi`, `${L} .lap-heroi.cartao-cc`] : [])];
  const pele = el === 'pele-conta' ? '.lap-heroi.cartao-pele-conta' : '.lap-heroi.cartao-pele-meta';
  return [...cc, pele, PELES_IS, ...(claro ? [`${L} .lap-heroi`, `${L} .lap-heroi.cartao-cc`, `${L} ${PELES_IS}`] : [])];
}

const FILHOS = [
  '.lap-heroi .lap-texto-2',
  '.lap-heroi .lap-texto-3',
  '.lap-heroi .lap-positivo',
  '.lap-vidro',
  '.lap-cartao',
  '.lap-heroi .pilula-situacao',
];
const PAGINA = {
  escuro: ['.astrog-ceu', '.bg-glow-orbs::before', '.glow-accent2', '.ai-bar.purple', '.tag.t'],
  claro: ['.astrog-ceu', "html[data-mode='light'] .astrog-ceu", '.bg-glow-orbs::before', "html[data-mode='light'] .bg-glow-orbs::before", '.glow-accent2', '.ai-bar.purple', '.tag.t'],
};

function cenario(css: string, cor: string, tema: Tema) {
  const html = computar(juntar(css, seletoresHtml(cor, tema)), new Map());
  const elemento = (el: Parameters<typeof seletoresElemento>[0]) => computar(juntar(css, seletoresElemento(el, tema)), html);
  const filhosDe = (pai: Decls) => new Map(FILHOS.map((sel) => [sel, computar(juntar(css, [sel]), pai)] as const));
  const pagina = new Map(PAGINA[tema].map((sel) => [sel, computar(juntar(css, [sel]), html)] as const));
  return { html, elemento, filhosDe, pagina };
}

/** Toda propriedade que existia em 42aea22 tem o mesmo valor (resolvido) agora. */
function mesmo(rotulo: string, velho: Decls, novo: Decls, ignorar: (p: string) => boolean = () => false) {
  const diferencas: string[] = [];
  for (const [p, v] of velho) {
    if (ignorar(p)) continue;
    const n = novo.get(p);
    if (n === undefined || normalizar(n) !== normalizar(v)) diferencas.push(`${p}\n    42aea22: ${v}\n    atual:   ${n}`);
  }
  // Nada de propriedade de verdade (não-variável) nova nos elementos conferidos.
  for (const p of novo.keys()) if (!p.startsWith('--') && !velho.has(p) && !ignorar(p)) diferencas.push(`${p} nova: ${novo.get(p)}`);
  expect(diferencas, `${rotulo}:\n  ${diferencas.join('\n  ')}`).toEqual([]);
}

describe('fixture de 42aea22 (sanidade da referência)', () => {
  it('tem os literais ciano de sempre e nenhum token da Wave 3D', () => {
    expect(antigo).toContain('background-color: #0b2233;');
    expect(antigo).toContain('--lap-h-positivo: oklch(0.9 0.105 203);');
    expect(antigo).toContain('background: #062a33;');
    expect(antigo).not.toMatch(/--lap-m-base|--lap-m-halo|--lap-vidro-fundo|--lap-pilula-|--lap-matiz-sombra|--c-accent2-vivo|--c-par-vivo|--lap-h-positivo-claro/);
  });
});

describe('ciano (sem data-accent) resolve igual a 42aea22', () => {
  for (const tema of TEMAS) {
    it(`:root / html no ${tema}`, () => {
      const v = cenario(antigo, 'ciano', tema);
      const n = cenario(atual, 'ciano', tema);
      mesmo(`html ${tema}`, v.html, n.html);
    });
    for (const el of ['heroi', 'heroi-cc', 'pele-conta', 'pele-meta'] as const) {
      it(`${el} e filhos no ${tema}`, () => {
        const v = cenario(antigo, 'ciano', tema);
        const n = cenario(atual, 'ciano', tema);
        const ev = v.elemento(el);
        const en = n.elemento(el);
        mesmo(`${el} ${tema}`, ev, en);
        const fv = v.filhosDe(ev);
        const fn = n.filhosDe(en);
        for (const [sel, d] of fv) mesmo(`${el} ${tema} › ${sel}`, d, fn.get(sel)!);
      });
    }
    it(`fundo da página (céu, brilho do topo, glow, faixa da IA, tag) no ${tema}`, () => {
      const v = cenario(antigo, 'ciano', tema);
      const n = cenario(atual, 'ciano', tema);
      for (const [sel, d] of v.pagina) mesmo(`${sel} ${tema}`, d, n.pagina.get(sel)!);
    });
  }
});

describe('peles Conta e Meta: idênticas a 42aea22 em qualquer cor e tema', () => {
  for (const cor of CORES) {
    for (const tema of TEMAS) {
      for (const el of ['pele-conta', 'pele-meta'] as const) {
        it(`${el} · ${cor} · ${tema}`, () => {
          const v = cenario(antigo, cor, tema);
          const n = cenario(atual, cor, tema);
          const ev = v.elemento(el);
          const en = n.elemento(el);
          // --astrog-ceu é herdado mas só pinta o fundo da página (.astrog-ceu no body), nunca dentro do cartão.
          const soPagina = (p: string) => p === '--astrog-ceu';
          mesmo(`${el} ${cor} ${tema}`, ev, en, soPagina);
          const fv = v.filhosDe(ev);
          const fn = n.filhosDe(en);
          for (const [sel, d] of fv) mesmo(`${el} ${cor} ${tema} › ${sel}`, d, fn.get(sel)!, soPagina);
        });
      }
    }
  }
  it('o herói sem pele segue a cor (o teste acima não está cego)', () => {
    const v = cenario(antigo, 'laranja', 'escuro').elemento('heroi');
    const n = cenario(atual, 'laranja', 'escuro').elemento('heroi');
    expect(normalizar(n.get('background-color')!)).not.toBe(normalizar(v.get('background-color')!));
    const lv = cenario(antigo, 'laranja', 'claro').elemento('heroi');
    const ln = cenario(atual, 'laranja', 'claro').elemento('heroi');
    expect(ln.get('--lap-h-positivo')).not.toBe(lv.get('--lap-h-positivo'));
  });
});

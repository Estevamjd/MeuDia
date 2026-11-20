/**
 * Cor do app (Configurações › Aparência › Cor do app): troca o destaque (accent) e o material do app. A preferência fica no aparelho
 * (localStorage, lida antes da 1ª pintura pelo SCRIPT_TEMA no <head>) e na conta (user_metadata.cor_app), igual ao tema.
 *
 * Além do destaque, a cor pinta o material do bloco principal (.lap-heroi: fundo, vizinho, luz, brilho, textos, halo,
 * vidro, pílula) e os brilhos/sombras tingidos do fundo da página (`heroi` de cada cor).
 *
 * Esta tabela é a fonte única: `cssCoresApp()` gera os blocos `html[data-accent=…]` que estão em app/globals.css
 * (o teste cores-app.test.ts confere que o CSS é idêntico) e o mesmo teste calcula o contraste de cada combinação.
 * Ciano é o visual de sempre (sem atributo no <html>); as cores semânticas (verde/vermelho/amarelo/laranja de
 * receitas, gastos e alertas) e as das notas não mudam.
 */
export type CorApp = 'ciano' | 'laranja' | 'verde' | 'amarelo' | 'roxo' | 'rosa';

export const CHAVE_COR = 'meudia-cor';
export const COR_PADRAO: CorApp = 'ciano';
export const CORES_APP: readonly CorApp[] = ['ciano', 'laranja', 'verde', 'amarelo', 'roxo', 'rosa'];

/** Tons de uma cor num tema. `accent2` = par do gradiente (vizinho harmônico); `brilho` = sombras e halos. */
export interface TonsCor {
  accent: string;
  /** Texto sobre o botão accent (≥ 4,5:1). */
  fg: string;
  accent2: string;
  /** Hover/realce do botão (mais claro no escuro, mais fundo no claro). */
  accent3: string;
  brilho: string;
}

/** Cor em OKLCH: [luminosidade, croma, matiz]. */
export type Oklch = readonly [number, number, number];

/**
 * Material do bloco principal (.lap-heroi, igual nos dois temas) e o que tinge o fundo da página nesta cor.
 * Mesmo "ritmo" do ciano: brilho claro e vivo puxando para o accent2, luz e meio descendo, fundo profundo e um vizinho
 * escuro deslocado ~30° (o azul-noite do ciano). Nos tons quentes o escuro desliza para o vermelho/vinho em vez de
 * virar marrom.
 */
export interface MaterialHeroi {
  fundo: Oklch;
  vizinho: Oklch;
  meio: Oklch;
  luz: Oklch;
  brilho: Oklch;
  /** Matiz dos textos secundários do herói (0,95/0,03 e 0,9/0,04, com alfa). */
  matizTexto: number;
  /**
   * Alfa do --lap-h-texto-3 (rótulos pequenos). Padrão 0,62 (o do ciano). O ciano já fica em ~3,0:1 sobre o tom mais
   * claro do herói; nenhuma cor pode ficar abaixo dele (cores-app.test.ts), por isso verde e amarelo sobem um pouco.
   */
  alfaTexto3?: number;
  /** Números positivos no herói (e nos cartões ao lado) no escuro. */
  positivo: Oklch;
  /** Os mesmos números no herói do tema claro (um pouco menos de croma para não estourar sobre o branco). */
  positivoClaro: Oklch;
  /** background-color de reserva do herói (antes dos gradientes). */
  base: string;
  /** Halo largo embaixo do herói no escuro (alfa 0,45). */
  halo: Oklch;
  /** Células de vidro dentro do herói (alfa 0,66). */
  vidro: Oklch;
  /** Matiz das sombras e arestas tingidas do claro (a 2ª é +5°). */
  matizSombra: number;
  /** Pílula de situação "No controle" (≥ 7:1). */
  pilula: { fundo: string; borda: string; texto: string };
  /** Par claro do accent2 (a menta do ciano): faixa da IA, tag e linha da média do peso. */
  par: string;
}

export interface DefinicaoCor {
  rotulo: string;
  escuro: TonsCor;
  claro: TonsCor;
  heroi: MaterialHeroi;
}

const ESCURO_FG = '#06101c';

export const PALETA_CORES: Record<CorApp, DefinicaoCor> = {
  ciano: {
    rotulo: 'Ciano',
    escuro: { accent: '#00e5ff', fg: ESCURO_FG, accent2: '#00ffa3', accent3: '#5cefff', brilho: '#00e5ff' },
    claro: { accent: '#0e7490', fg: '#ffffff', accent2: '#047857', accent3: '#155e75', brilho: '#0891b2' },
    // O material de sempre (azul-noite com luz ciano): os mesmos valores do :root.
    heroi: {
      fundo: [0.2, 0.05, 232], vizinho: [0.13, 0.03, 262], meio: [0.42, 0.1, 222], luz: [0.62, 0.13, 210], brilho: [0.9, 0.15, 200],
      matizTexto: 205, positivo: [0.9, 0.15, 200], positivoClaro: [0.9, 0.105, 203], base: '#0b2233',
      halo: [0.6, 0.13, 210], vidro: [0.15, 0.04, 240], matizSombra: 230,
      pilula: { fundo: '#062a33', borda: '#1f5f6b', texto: '#ccf7ff' }, par: '#6affda',
    },
  },
  laranja: {
    rotulo: 'Laranja',
    escuro: { accent: '#fb923c', fg: ESCURO_FG, accent2: '#fbbf24', accent3: '#fdba74', brilho: '#fb923c' },
    claro: { accent: '#c2410c', fg: '#ffffff', accent2: '#b45309', accent3: '#9a3412', brilho: '#ea580c' },
    // Brasa: luz dourada, fundo cobre-vinho (escuro puxado para o vermelho, sem virar marrom), vizinho vinho.
    heroi: {
      fundo: [0.21, 0.06, 33], vizinho: [0.14, 0.04, 8], meio: [0.44, 0.13, 40], luz: [0.66, 0.16, 52], brilho: [0.88, 0.14, 68],
      matizTexto: 60, positivo: [0.88, 0.14, 68], positivoClaro: [0.88, 0.11, 66], base: '#321812',
      halo: [0.62, 0.16, 48], vidro: [0.15, 0.04, 25], matizSombra: 40,
      pilula: { fundo: '#371e15', borda: '#754939', texto: '#ffe5d8' }, par: '#ffcf76',
    },
  },
  verde: {
    rotulo: 'Verde',
    escuro: { accent: '#4ade80', fg: ESCURO_FG, accent2: '#2dd4bf', accent3: '#86efac', brilho: '#4ade80' },
    claro: { accent: '#15803d', fg: '#ffffff', accent2: '#0f766e', accent3: '#166534', brilho: '#16a34a' },
    // Floresta: luz verde-menta, fundo verde profundo, vizinho petróleo.
    heroi: {
      fundo: [0.2, 0.05, 165], vizinho: [0.13, 0.03, 195], meio: [0.42, 0.11, 158], luz: [0.64, 0.15, 152], brilho: [0.9, 0.17, 150],
      matizTexto: 155, alfaTexto3: 0.64, positivo: [0.9, 0.17, 150], positivoClaro: [0.9, 0.13, 152], base: '#06261b',
      halo: [0.6, 0.14, 152], vidro: [0.15, 0.04, 175], matizSombra: 165,
      pilula: { fundo: '#112c1d', borda: '#336147', texto: '#d6f8e2' }, par: '#9afbb0',
    },
  },
  amarelo: {
    rotulo: 'Amarelo',
    escuro: { accent: '#facc15', fg: ESCURO_FG, accent2: '#fb923c', accent3: '#fde047', brilho: '#facc15' },
    // Amarelo com texto branco não chega a 4,5:1: no claro vira um mostarda escuro (5,7:1 no branco).
    claro: { accent: '#8f5b05', fg: '#ffffff', accent2: '#c2410c', accent3: '#713f12', brilho: '#ca8a04' },
    // Ouro: luz dourada sobre um fundo quase preto e quente (pouco croma, para o escuro não virar oliva/marrom).
    heroi: {
      fundo: [0.2, 0.035, 52], vizinho: [0.13, 0.03, 30], meio: [0.44, 0.1, 62], luz: [0.67, 0.14, 80], brilho: [0.92, 0.16, 98],
      matizTexto: 90, alfaTexto3: 0.64, positivo: [0.92, 0.16, 98], positivoClaro: [0.92, 0.12, 96], base: '#2f1a0d',
      halo: [0.66, 0.14, 80], vidro: [0.15, 0.03, 52], matizSombra: 55,
      pilula: { fundo: '#34200e', borda: '#704d2d', texto: '#ffe8d0' }, par: '#f9e26e',
    },
  },
  roxo: {
    rotulo: 'Roxo',
    escuro: { accent: '#a78bfa', fg: ESCURO_FG, accent2: '#e879f9', accent3: '#c4b5fd', brilho: '#a78bfa' },
    claro: { accent: '#6d28d9', fg: '#ffffff', accent2: '#a21caf', accent3: '#5b21b6', brilho: '#7c3aed' },
    // Ametista: luz lavanda, fundo violeta profundo, vizinho ameixa (longe do índigo do cartão "Conta").
    heroi: {
      fundo: [0.2, 0.07, 302], vizinho: [0.13, 0.04, 330], meio: [0.4, 0.14, 300], luz: [0.6, 0.17, 296], brilho: [0.86, 0.12, 292],
      matizTexto: 298, positivo: [0.86, 0.12, 292], positivoClaro: [0.86, 0.1, 292], base: '#241b31',
      halo: [0.58, 0.17, 296], vidro: [0.15, 0.05, 305], matizSombra: 302,
      pilula: { fundo: '#282037', borda: '#5b4d75', texto: '#f2e8ff' }, par: '#e3d0ff',
    },
  },
  rosa: {
    rotulo: 'Rosa',
    escuro: { accent: '#f472b6', fg: ESCURO_FG, accent2: '#c084fc', accent3: '#f9a8d4', brilho: '#f472b6' },
    claro: { accent: '#be185d', fg: '#ffffff', accent2: '#7e22ce', accent3: '#9d174d', brilho: '#db2777' },
    // Framboesa: luz rosa, fundo vinho-rosado, vizinho roxo (o accent2).
    heroi: {
      fundo: [0.2, 0.06, 346], vizinho: [0.13, 0.04, 315], meio: [0.42, 0.13, 350], luz: [0.63, 0.17, 354], brilho: [0.88, 0.12, 355],
      matizTexto: 350, positivo: [0.88, 0.12, 355], positivoClaro: [0.88, 0.1, 355], base: '#2f1724',
      halo: [0.6, 0.17, 354], vidro: [0.15, 0.04, 340], matizSombra: 346,
      pilula: { fundo: '#351c28', borda: '#71465b', texto: '#ffe2f2' }, par: '#ffbae6',
    },
  },
};

/** Fundo da página e do cartão de cada tema (mesmos de globals.css), para o teste de contraste. */
export const FUNDOS_TEMA = {
  escuro: { pagina: '#050a16', card: '#0b1220' },
  claro: { pagina: '#f6f8fb', card: '#ffffff' },
} as const;

export function lerCor(valor: unknown): CorApp | null {
  return typeof valor === 'string' && (CORES_APP as readonly string[]).includes(valor) ? (valor as CorApp) : null;
}

/** Põe a cor no <html> (ciano = sem atributo). Some com as transições na troca, como o tema. Não grava nada. */
export function pintarCor(cor: CorApp, doc: Document = document): void {
  const raiz = doc.documentElement;
  const atual = lerCor(raiz.getAttribute('data-accent')) ?? COR_PADRAO;
  if (atual === cor) return;
  raiz.setAttribute('data-trocando-tema', '');
  if (cor === COR_PADRAO) raiz.removeAttribute('data-accent');
  else raiz.setAttribute('data-accent', cor);
  void raiz.offsetHeight;
  const soltar = () => raiz.removeAttribute('data-trocando-tema');
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => requestAnimationFrame(soltar));
  else soltar();
}

/** Trecho ES5 do SCRIPT_TEMA: lê a cor do aparelho (lista branca) e põe data-accent antes da 1ª pintura. */
export const SCRIPT_COR = `try{var k=null;try{k=localStorage.getItem('${CHAVE_COR}')}catch(e){}
if(${CORES_APP.filter((c) => c !== COR_PADRAO)
  .map((c) => `k==='${c}'`)
  .join('||')})document.documentElement.setAttribute('data-accent',k);}catch(e){}`;

export function rgb(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

function rgba(hex: string, alfa: number): string {
  return `rgba(${rgb(hex).split(' ').join(', ')}, ${alfa})`;
}

function variaveis(t: TonsCor, softs: [number, number]): string[] {
  return [
    `--c-accent: ${rgb(t.accent)};`,
    `--c-accent-fg: ${rgb(t.fg)};`,
    `--c-accent2: ${rgb(t.accent2)};`,
    `--c-accent3: ${rgb(t.accent3)};`,
    `--c-brilho: ${rgb(t.brilho)};`,
    `--accent: ${t.accent};`,
    `--accent-fg: ${t.fg};`,
    `--accent-soft: ${rgba(t.brilho, softs[0])};`,
    `--accent-soft-2: ${rgba(t.brilho, softs[1])};`,
    `--accent2: ${t.accent2};`,
    `--accent3: ${t.accent3};`,
  ];
}

/** `oklch(L C H)` ou `oklch(L C H / alfa)`, no formato escrito à mão em globals.css. */
export function oklch([l, c, h]: Oklch, alfa?: number): string {
  return `oklch(${l} ${c} ${h}${alfa === undefined ? '' : ` / ${alfa}`})`;
}

/**
 * Variáveis do material do herói e dos brilhos da página que valem nos dois temas (vão no bloco escuro, que é o
 * próprio <html>). O ciano tem as mesmas linhas no :root de globals.css (o teste confere uma a uma).
 */
export function variaveisMaterial(cor: CorApp): string[] {
  const { escuro, heroi: m } = PALETA_CORES[cor];
  return [
    `--c-accent2-vivo: ${rgb(escuro.accent2)};`,
    `--c-par-vivo: ${rgb(m.par)};`,
    `--lap-m-fundo: ${oklch(m.fundo)};`,
    `--lap-m-vizinho: ${oklch(m.vizinho)};`,
    `--lap-m-meio: ${oklch(m.meio)};`,
    `--lap-m-luz: ${oklch(m.luz)};`,
    `--lap-m-brilho: ${oklch(m.brilho)};`,
    `--lap-m-base: ${m.base};`,
    `--lap-m-halo: ${oklch(m.halo, 0.45)};`,
    `--lap-h-texto-2: ${oklch([0.95, 0.03, m.matizTexto], 0.84)};`,
    `--lap-h-texto-3: ${oklch([0.9, 0.04, m.matizTexto], m.alfaTexto3 ?? 0.62)};`,
    `--lap-h-positivo: ${oklch(m.positivo)};`,
    `--lap-h-positivo-claro: ${oklch(m.positivoClaro)};`,
    `--lap-vidro-fundo: ${oklch(m.vidro, 0.66)};`,
    `--lap-pilula-fundo: ${m.pilula.fundo};`,
    `--lap-pilula-borda: ${m.pilula.borda};`,
    `--lap-pilula-texto: ${m.pilula.texto};`,
    `--lap-matiz-sombra: ${m.matizSombra};`,
    `--lap-matiz-sombra-2: ${(m.matizSombra + 5) % 360};`,
  ];
}

/**
 * Blocos CSS de cada cor (exceto ciano, que é o :root / html[data-mode='light'] de sempre).
 * `--c-accent-vivo` = o tom do escuro, usado nos brilhos fixos e dentro do bloco principal (.lap-heroi) nos dois temas.
 * No claro, `--lap-h-positivo` (números positivos fora do herói) vira o accent do claro; dentro do herói vale
 * `--lap-h-positivo-claro`.
 */
export function cssCoresApp(): string {
  const blocos: string[] = [];
  for (const cor of CORES_APP) {
    if (cor === COR_PADRAO) continue;
    const { escuro, claro } = PALETA_CORES[cor];
    blocos.push(
      [
        `html[data-accent='${cor}'] {`,
        `--c-accent-vivo: ${rgb(escuro.accent)};`,
        ...variaveis(escuro, [0.12, 0.2]),
        ...variaveisMaterial(cor),
      ]
        .join('\n  ')
        .concat('\n}'),
      [`html[data-mode='light'][data-accent='${cor}'] {`, ...variaveis(claro, [0.1, 0.18]), `--lap-h-positivo: ${claro.accent};`]
        .join('\n  ')
        .concat('\n}'),
    );
  }
  return blocos.join('\n');
}

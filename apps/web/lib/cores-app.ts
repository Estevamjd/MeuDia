/**
 * Cor do app (Configurações › Aparência › Cor do app): troca só o destaque (accent). A preferência fica no aparelho
 * (localStorage, lida antes da 1ª pintura pelo SCRIPT_TEMA no <head>) e na conta (user_metadata.cor_app), igual ao tema.
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

export interface DefinicaoCor {
  rotulo: string;
  escuro: TonsCor;
  claro: TonsCor;
}

const ESCURO_FG = '#06101c';

export const PALETA_CORES: Record<CorApp, DefinicaoCor> = {
  ciano: {
    rotulo: 'Ciano',
    escuro: { accent: '#00e5ff', fg: ESCURO_FG, accent2: '#00ffa3', accent3: '#5cefff', brilho: '#00e5ff' },
    claro: { accent: '#0e7490', fg: '#ffffff', accent2: '#047857', accent3: '#155e75', brilho: '#0891b2' },
  },
  laranja: {
    rotulo: 'Laranja',
    escuro: { accent: '#fb923c', fg: ESCURO_FG, accent2: '#fbbf24', accent3: '#fdba74', brilho: '#fb923c' },
    claro: { accent: '#c2410c', fg: '#ffffff', accent2: '#b45309', accent3: '#9a3412', brilho: '#ea580c' },
  },
  verde: {
    rotulo: 'Verde',
    escuro: { accent: '#4ade80', fg: ESCURO_FG, accent2: '#2dd4bf', accent3: '#86efac', brilho: '#4ade80' },
    claro: { accent: '#15803d', fg: '#ffffff', accent2: '#0f766e', accent3: '#166534', brilho: '#16a34a' },
  },
  amarelo: {
    rotulo: 'Amarelo',
    escuro: { accent: '#facc15', fg: ESCURO_FG, accent2: '#fb923c', accent3: '#fde047', brilho: '#facc15' },
    // Amarelo com texto branco não chega a 4,5:1: no claro vira um mostarda escuro (5,7:1 no branco).
    claro: { accent: '#8f5b05', fg: '#ffffff', accent2: '#c2410c', accent3: '#713f12', brilho: '#ca8a04' },
  },
  roxo: {
    rotulo: 'Roxo',
    escuro: { accent: '#a78bfa', fg: ESCURO_FG, accent2: '#e879f9', accent3: '#c4b5fd', brilho: '#a78bfa' },
    claro: { accent: '#6d28d9', fg: '#ffffff', accent2: '#a21caf', accent3: '#5b21b6', brilho: '#7c3aed' },
  },
  rosa: {
    rotulo: 'Rosa',
    escuro: { accent: '#f472b6', fg: ESCURO_FG, accent2: '#c084fc', accent3: '#f9a8d4', brilho: '#f472b6' },
    claro: { accent: '#be185d', fg: '#ffffff', accent2: '#7e22ce', accent3: '#9d174d', brilho: '#db2777' },
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

/**
 * Blocos CSS de cada cor (exceto ciano, que é o :root / html[data-mode='light'] de sempre).
 * `--c-accent-vivo` = o tom do escuro, usado nos brilhos fixos e dentro do bloco principal (.lap-heroi) nos dois temas.
 */
export function cssCoresApp(): string {
  const blocos: string[] = [];
  for (const cor of CORES_APP) {
    if (cor === COR_PADRAO) continue;
    const { escuro, claro } = PALETA_CORES[cor];
    blocos.push(
      [`html[data-accent='${cor}'] {`, `--c-accent-vivo: ${rgb(escuro.accent)};`, ...variaveis(escuro, [0.12, 0.2])]
        .join('\n  ')
        .concat('\n}'),
      [`html[data-mode='light'][data-accent='${cor}'] {`, ...variaveis(claro, [0.1, 0.18])].join('\n  ').concat('\n}'),
    );
  }
  return blocos.join('\n');
}

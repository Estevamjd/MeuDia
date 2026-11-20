/**
 * Pose de cada cartão do maço (Início v5) a partir de `d = índice do cartão − posição atual` (em páginas).
 * Os próximos ficam atrás, à direita; os já passados, atrás, à esquerda (como o efeito "cards" do Swiper:
 * deslocamento e giro pequenos por cartão). O cartão que está sendo passado (−1 < d < 0) sai em arco para a
 * esquerda, girando, e na metade do caminho vai para trás do maço, como quem passa cartões na carteira.
 *
 * O arco é medido em % da largura do próprio cartão (não do palco): assim a pose vira @keyframes da animação ligada à
 * rolagem (que rodam no compositor, sem JS por quadro). Onde ela não existe, o maço vira o carrossel de reserva.
 */
export interface PoseCartao {
  /** Deslocamento horizontal em % da largura do cartão. */
  xPct: number;
  /** Deslocamento horizontal extra em px. */
  xPx: number;
  rot: number;
  escala: number;
  z: number;
  visivel: boolean;
}

export const DESLOCAMENTO = 13;
export const GIRO = 2.4;
export const ENCOLHE = 0.055;
const GIRO_NA_MAO = 9;
/** Quanto o cartão passado anda para a esquerda no meio do arco, em larguras do cartão. */
const ARCO = 0.68;

export function poseDoCartao(d: number, larguraPalco: number, reduzirMovimento = false): PoseCartao {
  if (reduzirMovimento) {
    // Sem giro nem arco: um carrossel simples que acompanha o dedo (referência; o componente usa o de reserva).
    return { xPct: 0, xPx: d * larguraPalco, rot: 0, escala: 1, z: 20 - Math.round(Math.min(Math.abs(d), 2) * 2), visivel: Math.abs(d) < 1.5 };
  }
  if (d < 0 && d > -1) {
    const a = -d;
    const arco = Math.sin(Math.PI * a);
    return {
      xPct: -arco * ARCO * 100,
      xPx: -a * DESLOCAMENTO,
      rot: -(arco * GIRO_NA_MAO + a * GIRO),
      escala: 1 - ENCOLHE * a,
      z: a < 0.5 ? 30 : 18,
      visivel: true,
    };
  }
  const a = Math.min(Math.abs(d), 2);
  const lado = d > 0 ? 1 : d < 0 ? -1 : 0;
  return { xPct: 0, xPx: lado * a * DESLOCAMENTO, rot: lado * a * GIRO, escala: 1 - ENCOLHE * a, z: 20 - Math.round(a * 2), visivel: Math.abs(d) <= 2.5 };
}

const n = (v: number, casas: number) => (Object.is(v, -0) ? 0 : v).toFixed(casas);

/** Sempre a mesma lista de funções (translateX · rotate · scale), para interpolar sem matriz. */
export function transformDaPose(p: PoseCartao): string {
  return `translateX(calc(${n(p.xPct, 2)}% + ${n(p.xPx, 2)}px)) rotate(${n(p.rot, 2)}deg) scale(${n(p.escala, 4)})`;
}

/** Amostras por página: o arco (seno) fica liso com interpolação linear entre elas. */
const AMOSTRAS_POR_PAGINA = 16;

/** Mesma condição do @supports do maço (aqui, no globals.css e no `macoNaRolagem`). */
export const SUPORTE_ROLAGEM = '(animation-timeline: --maco) and (timeline-scope: --maco)';

/**
 * Palco no caminho "rolagem": marcado pelo JS (`data-maco="rolagem"`) ou ainda sem marca (SSR/primeira pintura, aí
 * quem decide é o @supports em volta). Com `data-maco="reserva"` nada do caminho scroll-driven vale, mesmo que o
 * navegador suporte (é o que o benchmark força ao trocar `CSS.supports`).
 */
export const PALCO_ROLAGEM = '.maco-palco:is([data-maco="rolagem"],:not([data-maco]))';

/**
 * CSS da animação ligada à rolagem (scroll-driven animations; Chrome 116+, Safari/iOS 26+): o trilho publica a
 * timeline `--maco` e cada cartão anima transform (compositor) e z-index/visibilidade (degraus) com ela. Sem suporte,
 * com "reduzir movimento" ou no palco em "reserva", nada disso vale: fica o carrossel com scroll-snap nativo.
 */
export function cssDoMaco(total: number): string {
  if (total < 2) return '';
  const regras: string[] = [];
  const quadros: string[] = [];
  const ultimo = total - 1;
  for (let i = 0; i < total; i++) {
    const t: string[] = [];
    const z: string[] = [];
    const passos = ultimo * AMOSTRAS_POR_PAGINA;
    // Pontos de amostra + as viradas de z (meio do arco) e de visibilidade, para os degraus caírem no lugar certo.
    const posicoes = new Set<number>();
    for (let k = 0; k <= passos; k++) posicoes.add(k / AMOSTRAS_POR_PAGINA);
    for (let k = 0; k <= ultimo; k++) for (const extra of [k + 1e-4, k + 0.5]) if (extra <= ultimo) posicoes.add(extra);
    let zAnterior = '';
    for (const pos of [...posicoes].sort((a, b) => a - b)) {
      const pose = poseDoCartao(i - pos, 0);
      const off = `${n((pos / ultimo) * 100, 4)}%`;
      t.push(`${off}{transform:${transformDaPose(pose)}}`);
      const zv = `z-index:${pose.z};visibility:${pose.visivel ? 'visible' : 'hidden'}`;
      if (zv !== zAnterior) {
        z.push(`${off}{${zv};animation-timing-function:step-end}`);
        zAnterior = zv;
      }
    }
    if (!z.some((q) => q.startsWith('100.0000%'))) z.push(`100%{${zAnterior};animation-timing-function:step-end}`);
    quadros.push(`@keyframes maco-${total}-${i}-t{${t.join('')}}@keyframes maco-${total}-${i}-z{${z.join('')}}`);
    regras.push(
      `${PALCO_ROLAGEM}[data-total="${total}"] .maco-cartao[data-i="${i}"]{animation-name:maco-${total}-${i}-t,maco-${total}-${i}-z;animation-duration:1ms,1ms;animation-timing-function:linear,linear;animation-fill-mode:both,both;animation-timeline:--maco,--maco}`,
    );
  }
  return `@supports ${SUPORTE_ROLAGEM}{@media (prefers-reduced-motion: no-preference){${PALCO_ROLAGEM}{timeline-scope:--maco}${PALCO_ROLAGEM} .maco-trilho{scroll-timeline:--maco x}${regras.join('')}${quadros.join('')}}}`;
}

/** Mesmo critério do CSS acima (lido em `CSS.supports`, que dá para trocar em teste/benchmark; o @supports não). */
export function macoNaRolagem(): boolean {
  if (typeof window === 'undefined' || typeof CSS === 'undefined' || !CSS.supports) return false;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return false;
  return CSS.supports('animation-timeline: --maco') && CSS.supports('timeline-scope: --maco');
}

/**
 * Caminho do maço, gravado no palco como `data-maco`:
 * - "rolagem": o navegador anima o maço pela rolagem, no compositor (Chrome 116+, iOS 26+);
 * - "reserva": carrossel com scroll-snap nativo, sem JS por quadro (iOS < 26, Firefox, "reduzir movimento").
 */
export type ModoMaco = 'rolagem' | 'reserva';

export function modoDoMaco(): ModoMaco {
  return macoNaRolagem() ? 'rolagem' : 'reserva';
}

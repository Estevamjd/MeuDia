/**
 * Pose de cada cartão do maço (Início v5) a partir de `d = índice do cartão − posição atual` (em páginas).
 * Os próximos ficam atrás, à direita; os já passados, atrás, à esquerda (como o efeito "cards" do Swiper:
 * deslocamento e giro pequenos por cartão). O cartão que está sendo passado (−1 < d < 0) sai em arco para a
 * esquerda, girando, e na metade do caminho vai para trás do maço, como quem passa cartões na carteira.
 */
export interface PoseCartao {
  /** Deslocamento horizontal em px, relativo ao centro do palco. */
  x: number;
  rot: number;
  escala: number;
  z: number;
  visivel: boolean;
}

export const DESLOCAMENTO = 13;
export const GIRO = 2.4;
export const ENCOLHE = 0.055;
const GIRO_NA_MAO = 9;
const ARCO = 0.62;

export function poseDoCartao(d: number, larguraPalco: number, reduzirMovimento = false): PoseCartao {
  if (reduzirMovimento) {
    // Sem giro nem arco: um carrossel simples que acompanha o dedo.
    return { x: d * larguraPalco, rot: 0, escala: 1, z: 20 - Math.round(Math.min(Math.abs(d), 2) * 2), visivel: Math.abs(d) < 1.5 };
  }
  if (d < 0 && d > -1) {
    const a = -d;
    const arco = Math.sin(Math.PI * a);
    return {
      x: -(arco * ARCO * larguraPalco) - a * DESLOCAMENTO,
      rot: -(arco * GIRO_NA_MAO + a * GIRO),
      escala: 1 - ENCOLHE * a,
      z: a < 0.5 ? 30 : 18,
      visivel: true,
    };
  }
  const a = Math.min(Math.abs(d), 2);
  const lado = d > 0 ? 1 : d < 0 ? -1 : 0;
  return { x: lado * a * DESLOCAMENTO, rot: lado * a * GIRO, escala: 1 - ENCOLHE * a, z: 20 - Math.round(a * 2), visivel: Math.abs(d) <= 2.5 };
}

export function transformDaPose(p: PoseCartao): string {
  return `translateX(${p.x.toFixed(2)}px) rotate(${p.rot.toFixed(2)}deg) scale(${p.escala.toFixed(4)})`;
}

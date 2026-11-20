import { describe, expect, it } from 'vitest';
import { cssDoMaco, poseDoCartao, transformDaPose } from '../poseDoMaco';

describe('poseDoCartao (maço da Início v5)', () => {
  const W = 390;
  it('em repouso: frente no centro; próximos atrás à direita; passados atrás à esquerda; até 2 visíveis de cada lado', () => {
    expect(poseDoCartao(0, W)).toEqual({ xPct: 0, xPx: 0, rot: 0, escala: 1, z: 20, visivel: true });
    expect(poseDoCartao(1, W)).toMatchObject({ xPct: 0, xPx: 13, rot: 2.4, z: 18 });
    expect(poseDoCartao(-1, W)).toMatchObject({ xPx: -13, rot: -2.4, z: 18 });
    expect(poseDoCartao(2, W).escala).toBeCloseTo(0.89);
    expect(poseDoCartao(3, W).visivel).toBe(false);
  });

  it('passando o cartão: sai em arco para a esquerda girando (em % do cartão), por cima até a metade e depois vai para trás', () => {
    const meio = poseDoCartao(-0.5, W);
    expect(meio.xPct).toBeLessThan(-60);
    expect(meio.rot).toBeLessThan(-9);
    expect(poseDoCartao(-0.3, W).z).toBe(30);
    expect(poseDoCartao(-0.7, W).z).toBeLessThan(poseDoCartao(0.3, W).z);
    // contínuo nas pontas (sem salto ao soltar)
    expect(poseDoCartao(-0.9999, W).xPct).toBeCloseTo(0, 0);
    expect(poseDoCartao(-0.9999, W).xPx).toBeCloseTo(poseDoCartao(-1, W).xPx, 0);
    expect(poseDoCartao(-0.0001, W).xPct).toBeCloseTo(0, 0);
  });

  it('reduzir movimento: sem giro nem escala, só desliza junto com o dedo', () => {
    expect(poseDoCartao(0.5, W, true)).toMatchObject({ xPx: 195, rot: 0, escala: 1 });
    expect(poseDoCartao(-1, W, true)).toMatchObject({ xPx: -390, rot: 0 });
  });

  it('transform sempre com a mesma lista de funções (interpola sem matriz)', () => {
    expect(transformDaPose(poseDoCartao(1, W))).toBe('translateX(calc(0.00% + 13.00px)) rotate(2.40deg) scale(0.9450)');
    expect(transformDaPose(poseDoCartao(0, W))).toBe('translateX(calc(0.00% + 0.00px)) rotate(0.00deg) scale(1.0000)');
  });
});

describe('cssDoMaco (animação ligada à rolagem, no compositor)', () => {
  it('só vale com suporte e sem "reduzir movimento"; o trilho publica --maco e cada cartão anima com ela', () => {
    const css = cssDoMaco(3);
    expect(css.startsWith('@supports (animation-timeline: --maco) and (timeline-scope: --maco){@media (prefers-reduced-motion: no-preference){')).toBe(true);
    expect(css).toContain('.maco-trilho{scroll-timeline:--maco x}');
    expect(css).toContain('.maco-palco{timeline-scope:--maco}');
    for (const i of [0, 1, 2]) expect(css).toContain(`.maco-palco[data-total="3"] .maco-cartao[data-i="${i}"]{animation-name:maco-3-${i}-t,maco-3-${i}-z;`);
    expect(cssDoMaco(1)).toBe('');
  });

  it('keyframes batem com a pose: no início o 1º na frente e o 2º atrás; no fim o último na frente', () => {
    const css = cssDoMaco(2);
    const quadros = (nome: string) => css.match(new RegExp(`@keyframes ${nome}\\{(.*?)\\}(?=@keyframes|\\}\\}$)`))![1]!;
    expect(quadros('maco-2-0-t').startsWith(`0.0000%{transform:${transformDaPose(poseDoCartao(0, 0))}}`)).toBe(true);
    expect(quadros('maco-2-1-t')).toContain(`100.0000%{transform:${transformDaPose(poseDoCartao(0, 0))}}`);
    // z-index em degraus: o cartão passado fica por cima até o meio do arco e depois vai para trás.
    expect(quadros('maco-2-0-z')).toContain('0.0000%{z-index:20;visibility:visible;animation-timing-function:step-end}0.0100%{z-index:30;');
    expect(quadros('maco-2-0-z')).toContain('50.0000%{z-index:18;');
    expect(quadros('maco-2-0-z')).toContain('z-index:18');
  });
});

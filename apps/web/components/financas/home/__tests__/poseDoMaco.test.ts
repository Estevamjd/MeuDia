import { describe, expect, it } from 'vitest';
import { poseDoCartao, transformDaPose } from '../poseDoMaco';

describe('poseDoCartao (maço da Início v5)', () => {
  const W = 390;
  it('em repouso: frente no centro; próximos atrás à direita; passados atrás à esquerda; até 2 visíveis de cada lado', () => {
    expect(poseDoCartao(0, W)).toEqual({ x: 0, rot: 0, escala: 1, z: 20, visivel: true });
    expect(poseDoCartao(1, W)).toMatchObject({ x: 13, rot: 2.4, z: 18 });
    expect(poseDoCartao(-1, W)).toMatchObject({ x: -13, rot: -2.4, z: 18 });
    expect(poseDoCartao(2, W).escala).toBeCloseTo(0.89);
    expect(poseDoCartao(3, W).visivel).toBe(false);
  });

  it('passando o cartão: sai em arco para a esquerda girando, por cima até a metade e depois vai para trás', () => {
    const meio = poseDoCartao(-0.5, W);
    expect(meio.x).toBeLessThan(-200);
    expect(meio.rot).toBeLessThan(-9);
    expect(poseDoCartao(-0.3, W).z).toBe(30);
    expect(poseDoCartao(-0.7, W).z).toBeLessThan(poseDoCartao(0.3, W).z);
    // contínuo nas pontas (sem salto ao soltar)
    expect(poseDoCartao(-0.9999, W).x).toBeCloseTo(poseDoCartao(-1, W).x, 0);
    expect(poseDoCartao(-0.0001, W).x).toBeCloseTo(0, 0);
  });

  it('reduzir movimento: sem giro nem escala, só desliza junto com o dedo', () => {
    expect(poseDoCartao(0.5, W, true)).toMatchObject({ x: 195, rot: 0, escala: 1 });
    expect(poseDoCartao(-1, W, true)).toMatchObject({ x: -390, rot: 0 });
  });

  it('transform em px/deg', () => {
    expect(transformDaPose(poseDoCartao(1, W))).toBe('translateX(13.00px) rotate(2.40deg) scale(0.9450)');
  });
});

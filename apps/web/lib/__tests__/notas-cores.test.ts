import { describe, expect, it } from 'vitest';
import config from '../../tailwind.config';
import { CORES_NOTA, corDaNota } from '../notas-cores';

const cores = (config.theme?.extend?.colors ?? {}) as Record<string, string>;
const hexDoToken = (classe: string) => {
  const token = classe.replace(/^bg-/, '').replace(/\/.*$/, '');
  return cores[token];
};

describe('cores das notas', () => {
  it('mantém os valores salvos no banco (notas antigas continuam com a cor)', () => {
    expect(CORES_NOTA.map((c) => c.value)).toEqual(['default', 'purple', 'green', 'orange', 'red', 'yellow']);
  });

  it('cada cor tem um tom próprio: Amarelo ≠ Laranja, Roxo não é o ciano do app', () => {
    const coloridas = CORES_NOTA.filter((c) => c.value !== 'default');
    const hex = coloridas.map((c) => hexDoToken(c.swatch));
    hex.forEach((h) => expect(h).toMatch(/^#[0-9a-f]{6}$/i));
    expect(new Set(hex).size).toBe(coloridas.length);
    expect(hexDoToken(corDaNota('yellow').swatch)).not.toBe(hexDoToken(corDaNota('orange').swatch));
    expect(hexDoToken(corDaNota('purple').swatch)).not.toBe('#00e5ff');
  });

  it('a bolinha do seletor mostra a cor cheia; o cartão usa o mesmo tom', () => {
    for (const c of CORES_NOTA.filter((x) => x.value !== 'default')) {
      expect(c.swatch).not.toContain('/');
      expect(c.bg.startsWith(c.swatch + '/')).toBe(true);
      expect(c.border).toContain(c.swatch.replace(/^bg-/, ''));
    }
  });

  it('cor desconhecida ou vazia cai no Padrão', () => {
    expect(corDaNota('azul').value).toBe('default');
    expect(corDaNota(null).value).toBe('default');
  });
});

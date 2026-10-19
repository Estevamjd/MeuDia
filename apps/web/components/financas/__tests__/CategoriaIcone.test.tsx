// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import * as lucide from 'lucide-react';
import { CATEGORIAS } from '@meudia/shared';
import { CategoriaIcone, ICONES_CATEGORIA } from '../CategoriaIcone';

afterEach(cleanup);

const pascal = (id: string) => id.split('-').map((p) => p[0]!.toUpperCase() + p.slice(1)).join('');

describe('CategoriaIcone', () => {
  it('todo ícone do mapa existe no lucide-react instalado e é o componente usado', () => {
    for (const c of CATEGORIAS) {
      const doLucide = (lucide as unknown as Record<string, unknown>)[pascal(c.icone)];
      expect(doLucide, `${c.nome}: ${c.icone} não existe no lucide-react`).toBeDefined();
      expect(ICONES_CATEGORIA[c.icone], `${c.nome}: ${c.icone} sem componente`).toBe(doLucide);
    }
  });

  it.each([
    ['Comida', 'utensils'],
    ['Unha', 'paintbrush'],
    ['Sobrancelha', 'eye'],
    ['Restaurante', 'utensils-crossed'],
    ['Inventada', 'tag'],
  ])('%s expõe data-icone=%s e desenha o svg do lucide', (categoria, icone) => {
    const { container } = render(<CategoriaIcone categoria={categoria} />);
    const caixa = container.querySelector('[data-icone]')!;
    expect(caixa.getAttribute('data-icone')).toBe(icone);
    expect(caixa.querySelector('svg')?.getAttribute('class')).toContain(`lucide-${icone}`);
  });
});

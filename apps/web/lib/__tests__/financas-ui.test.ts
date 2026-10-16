import { expect, it } from 'vitest';
import type { Competencia } from '@meudia/shared';
import { partesCompetencia } from '../financas-ui';

it('separa ano e mês válidos', () => {
  expect(partesCompetencia('2026-10')).toEqual({ ano: 2026, mes: 10 });
});
it.each(['2026', '2026-00', '2026-13', 'abc-10', '2026-1.5', '-1-10'])('rejeita ano/mês inválidos: %s', valor => {
  expect(() => partesCompetencia(valor as Competencia)).toThrow('Competência inválida');
});

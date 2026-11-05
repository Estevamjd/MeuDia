import { describe, expect, it } from 'vitest';
import type { SerieRealizada } from '../../types';
import { formatarSerieAnterior, resumoUltimaVez, seriesAnteriores } from '../treino';

const serie = (sessao: string, exercicio: string, n: number, carga: number | null, reps: number | null, concluido = true): SerieRealizada => ({
  id: `${sessao}-${exercicio}-${n}`,
  sessao_id: sessao,
  exercicio_id: exercicio,
  numero_serie: n,
  carga_usada: carga,
  reps_feitas: reps,
  concluido,
});

describe('seriesAnteriores', () => {
  // s3 é a mais recente; supino foi feito em s3 e s1; remada só em s2.
  const sessoes = [{ id: 's3' }, { id: 's2' }, { id: 's1' }];
  const series = [
    serie('s1', 'supino', 1, 55, 10),
    serie('s3', 'supino', 2, 60, 9),
    serie('s3', 'supino', 1, 60, 10),
    serie('s3', 'supino', 3, 57.5, 8),
    serie('s2', 'remada', 1, 50, 10),
    serie('s3', 'remada', 1, 52, 4, false), // não feita: não conta
  ];

  it('pega a sessão mais recente em que cada exercício foi feito, em ordem de série', () => {
    const r = seriesAnteriores(sessoes, series);
    expect(r.get('supino')?.map((s) => [s.numero_serie, s.carga_usada, s.reps_feitas])).toEqual([
      [1, 60, 10],
      [2, 60, 9],
      [3, 57.5, 8],
    ]);
    expect(r.get('remada')?.map((s) => s.sessao_id)).toEqual(['s2']);
  });

  it('exercício novo não aparece (a tela mostra "—")', () => {
    expect(seriesAnteriores(sessoes, series).has('agachamento')).toBe(false);
  });

  it('séries de sessão fora da lista (a sessão em andamento) não contam', () => {
    const r = seriesAnteriores([{ id: 's1' }], [...series, serie('atual', 'supino', 1, 80, 1)]);
    expect(r.get('supino')?.map((s) => s.carga_usada)).toEqual([55]);
  });
});

describe('formatarSerieAnterior', () => {
  it('carga × reps, decimal com vírgula, e os casos incompletos', () => {
    expect(formatarSerieAnterior({ carga_usada: 60, reps_feitas: 10 })).toBe('60 × 10');
    expect(formatarSerieAnterior({ carga_usada: 57.5, reps_feitas: 8 })).toBe('57,5 × 8');
    expect(formatarSerieAnterior({ carga_usada: 20, reps_feitas: null })).toBe('20 kg');
    expect(formatarSerieAnterior({ carga_usada: null, reps_feitas: 12 })).toBe('12 reps');
    expect(formatarSerieAnterior(undefined)).toBe('—');
  });
});

describe('resumoUltimaVez', () => {
  it('mesma carga: "últ. 50 × 10, 10, 9"', () => {
    expect(resumoUltimaVez([serie('s', 'r', 1, 50, 10), serie('s', 'r', 2, 50, 10), serie('s', 'r', 3, 50, 9)])).toBe('últ. 50 × 10, 10, 9');
  });
  it('cargas diferentes: lista cada série', () => {
    expect(resumoUltimaVez([serie('s', 'r', 1, 50, 10), serie('s', 'r', 2, 55, 8)])).toBe('últ. 50 × 10, 55 × 8');
  });
  it('sem histórico: null', () => {
    expect(resumoUltimaVez([])).toBeNull();
    expect(resumoUltimaVez(undefined)).toBeNull();
  });
});

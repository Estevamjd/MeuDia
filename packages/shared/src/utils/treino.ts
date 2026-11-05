import type { SerieRealizada } from '../types';

/**
 * Coluna ANTERIOR da tabela de séries: o que a pessoa fez no exercício na última sessão em que ele apareceu.
 * `sessoesRecentes` vem da mais recente para a mais antiga e não inclui a sessão em andamento.
 * Só contam séries marcadas como feitas. Exercício que nunca foi feito não aparece no resultado ("—" na tela).
 */
export function seriesAnteriores(
  sessoesRecentes: readonly { id: string }[],
  series: readonly SerieRealizada[],
): Map<string, SerieRealizada[]> {
  const ordem = new Map(sessoesRecentes.map((s, i) => [s.id, i]));
  const melhor = new Map<string, number>();
  for (const s of series) {
    const i = ordem.get(s.sessao_id);
    if (i === undefined || !s.concluido) continue;
    const atual = melhor.get(s.exercicio_id);
    if (atual === undefined || i < atual) melhor.set(s.exercicio_id, i);
  }
  const resultado = new Map<string, SerieRealizada[]>();
  for (const s of series) {
    if (!s.concluido || ordem.get(s.sessao_id) !== melhor.get(s.exercicio_id)) continue;
    const lista = resultado.get(s.exercicio_id) ?? [];
    lista.push(s);
    resultado.set(s.exercicio_id, lista);
  }
  for (const lista of resultado.values()) lista.sort((a, b) => a.numero_serie - b.numero_serie);
  return resultado;
}

const kg = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 2 });

/** "60 × 10", "57,5 × 8", "60 kg" (sem reps), "10 reps" (sem carga) ou "—". */
export function formatarSerieAnterior(serie: Pick<SerieRealizada, 'carga_usada' | 'reps_feitas'> | null | undefined): string {
  if (!serie) return '—';
  const { carga_usada: carga, reps_feitas: reps } = serie;
  if (carga !== null && reps !== null) return `${kg(carga)} × ${reps}`;
  if (carga !== null) return `${kg(carga)} kg`;
  if (reps !== null) return `${reps} reps`;
  return '—';
}

/** Resumo do exercício fechado: "últ. 50 × 10, 10, 9" quando a carga foi a mesma; senão "últ. 50 × 10, 55 × 8". */
export function resumoUltimaVez(series: readonly SerieRealizada[] | undefined): string | null {
  if (!series || series.length === 0) return null;
  const cargas = new Set(series.map((s) => s.carga_usada));
  const [primeira] = series;
  if (cargas.size === 1 && primeira && primeira.carga_usada !== null && series.every((s) => s.reps_feitas !== null)) {
    return `últ. ${kg(primeira.carga_usada)} × ${series.map((s) => s.reps_feitas).join(', ')}`;
  }
  return `últ. ${series.map(formatarSerieAnterior).join(', ')}`;
}

import type { Exercicio, ExercicioInsert } from '@meudia/shared';
import { AppError, faixaDaLinha, formatarFaixaRepeticoes, lerFaixaRepeticoes, logger } from '@meudia/shared';
import { schemaDesatualizado } from './erros-db';
import { getSupabase } from './supabase';

// C3 (PLANO-F1): banco real (000_baseline, GAP-10) tem `descanso_segundos` e `repeticoes INTEGER`; não há `tempo_descanso`.
// Pedir `tempo_descanso` dava 400 do PostgREST. O app segue vendo `tempo_descanso` e `repeticoes` em texto via `paraExercicio`.
// A faixa (8–12, sem repetição) mora em `repeticoes_min`/`repeticoes_max` (008). Sem a 008 aplicada, cai nas colunas antigas.
const COLUNAS_BASE: string = 'id, treino_id, nome, series, repeticoes, carga, descanso_segundos, observacao, ordem';
const COLUNAS_008: string = `${COLUNAS_BASE}, repeticoes_min, repeticoes_max`;

export interface ExercicioRow {
  id: string;
  treino_id: string;
  nome: string;
  series: number | null;
  repeticoes: number | null;
  repeticoes_min?: number | null;
  repeticoes_max?: number | null;
  carga: number | string | null;
  descanso_segundos: number | null;
  observacao: string | null;
  ordem: number | null;
}

export function paraExercicio(row: ExercicioRow): Exercicio {
  const faixa = faixaDaLinha(row);
  return {
    id: row.id,
    treino_id: row.treino_id,
    nome: row.nome,
    series: row.series ?? 3,
    repeticoes: formatarFaixaRepeticoes(faixa),
    repeticoes_min: faixa.min,
    repeticoes_max: faixa.max,
    carga: row.carga === null || row.carga === undefined ? null : Number(row.carga),
    tempo_descanso: row.descanso_segundos ?? 60,
    observacao: row.observacao ?? null,
    ordem: row.ordem ?? 0,
  };
}

/** App → banco. `repeticoes` (texto) vira min/max e, para quem ainda lê a coluna antiga, o mínimo da faixa. */
export function paraRowExercicio(data: Partial<ExercicioInsert>, com008: boolean): Record<string, unknown> {
  const { tempo_descanso, repeticoes, ...resto } = data;
  const row: Record<string, unknown> = { ...resto };
  if (tempo_descanso !== undefined) row.descanso_segundos = tempo_descanso;
  if (repeticoes !== undefined) {
    const faixa = lerFaixaRepeticoes(repeticoes);
    if (!faixa) throw new AppError('Repetições inválidas', 'VALIDATION_ERROR', 400, 'Use um número (10) ou uma faixa (8-12).');
    row.repeticoes = faixa.min;
    if (com008) {
      row.repeticoes_min = faixa.min;
      row.repeticoes_max = faixa.max;
    }
  }
  return row;
}

// Depois do primeiro erro de schema, a sessão segue só com as colunas antigas (sem repetir o 400 a cada chamada).
let tem008 = true;
/** Só para testes. */
export function __reiniciarDeteccao008(): void {
  tem008 = true;
}

type Resultado = { data: unknown; error: { message: string; code?: string } | null };

async function comFallback<T>(consulta: (com008: boolean) => PromiseLike<Resultado>): Promise<T> {
  if (tem008) {
    const r = await consulta(true);
    if (!r.error) return r.data as T;
    if (!schemaDesatualizado(r.error)) throw new AppError(r.error.message, 'DB_ERROR');
    tem008 = false;
    logger.warn('exercicios sem as colunas da 008: usando repeticoes/descanso_segundos', { code: r.error.code });
  }
  const r = await consulta(false);
  if (r.error) throw new AppError(r.error.message, 'DB_ERROR');
  return r.data as T;
}

export async function findByTreinoId(treinoId: string): Promise<Exercicio[]> {
  const rows = await comFallback<ExercicioRow[]>((com008) =>
    getSupabase()
      .from('exercicios')
      .select(com008 ? COLUNAS_008 : COLUNAS_BASE)
      .eq('treino_id', treinoId)
      .order('ordem', { ascending: true }),
  );
  return rows.map(paraExercicio);
}

export async function create(data: ExercicioInsert): Promise<Exercicio> {
  const row = await comFallback<ExercicioRow>((com008) =>
    getSupabase()
      .from('exercicios')
      .insert(paraRowExercicio(data, com008))
      .select(com008 ? COLUNAS_008 : COLUNAS_BASE)
      .single(),
  );
  return paraExercicio(row);
}

export async function update(exercicioId: string, data: Partial<ExercicioInsert>): Promise<Exercicio> {
  const row = await comFallback<ExercicioRow>((com008) =>
    getSupabase()
      .from('exercicios')
      .update(paraRowExercicio(data, com008))
      .eq('id', exercicioId)
      .select(com008 ? COLUNAS_008 : COLUNAS_BASE)
      .single(),
  );
  return paraExercicio(row);
}

export async function remove(exercicioId: string): Promise<void> {
  const { error } = await getSupabase()
    .from('exercicios')
    .delete()
    .eq('id', exercicioId);

  if (error) throw new AppError(error.message, 'DB_ERROR');
}

export async function updateOrdem(exercicios: { id: string; ordem: number }[]): Promise<void> {
  const supabase = getSupabase();

  for (const exercicio of exercicios) {
    const { error } = await supabase
      .from('exercicios')
      .update({ ordem: exercicio.ordem })
      .eq('id', exercicio.id);

    if (error) throw new AppError(error.message, 'DB_ERROR');
  }
}

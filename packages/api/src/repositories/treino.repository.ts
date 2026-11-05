import type { Treino, TreinoInsert } from '@meudia/shared';
import { AppError } from '@meudia/shared';
import { paraExercicio, type ExercicioRow } from './exercicio.repository';
import { getSupabase } from './supabase';

// Banco real (000_baseline): `treinos` tem `descricao`, não `observacao`; pedir `observacao` dava 400.
// `exercicios(*)` traz `descanso_segundos`/`repeticoes` (C3): cada exercício passa por `paraExercicio`.
const COLUNAS_TREINO = 'id, user_id, nome, dia_semana, tipo, descricao, ordem, created_at';

interface TreinoRow {
  id: string;
  user_id: string;
  nome: string;
  dia_semana: Treino['dia_semana'];
  tipo: Treino['tipo'];
  descricao: string | null;
  ordem: number | null;
  created_at: string;
  exercicios?: ExercicioRow[];
}

export function paraTreino({ descricao, exercicios, ordem, ...resto }: TreinoRow): Treino {
  const treino: Treino = { ...resto, observacao: descricao ?? null, ordem: ordem ?? 0 };
  if (exercicios) {
    treino.exercicios = exercicios.map(paraExercicio).sort((a, b) => a.ordem - b.ordem);
  }
  return treino;
}

function paraRowTreino(data: Partial<TreinoInsert>): Record<string, unknown> {
  const { observacao, ...resto } = data;
  return observacao === undefined ? resto : { ...resto, descricao: observacao };
}

export async function findByUserId(userId: string): Promise<Treino[]> {
  const { data, error } = await getSupabase()
    .from('treinos')
    .select(`${COLUNAS_TREINO}, exercicios(*)`)
    .eq('user_id', userId)
    .order('ordem', { ascending: true });

  if (error) throw new AppError(error.message, 'DB_ERROR');
  return (data as TreinoRow[]).map(paraTreino);
}

export async function findById(treinoId: string, userId: string): Promise<Treino> {
  const { data, error } = await getSupabase()
    .from('treinos')
    .select(`${COLUNAS_TREINO}, exercicios(*)`)
    .eq('id', treinoId)
    .eq('user_id', userId)
    .single();

  if (error) throw new AppError(error.message, 'DB_ERROR');
  return paraTreino(data as TreinoRow);
}

export async function create(userId: string, data: TreinoInsert): Promise<Treino> {
  const { data: created, error } = await getSupabase()
    .from('treinos')
    .insert({ ...paraRowTreino(data), user_id: userId })
    .select(COLUNAS_TREINO)
    .single();

  if (error) throw new AppError(error.message, 'DB_ERROR');
  return paraTreino(created as TreinoRow);
}

export async function update(treinoId: string, data: Partial<TreinoInsert>, userId: string): Promise<Treino> {
  const { data: updated, error } = await getSupabase()
    .from('treinos')
    .update(paraRowTreino(data))
    .eq('id', treinoId)
    .eq('user_id', userId)
    .select(COLUNAS_TREINO)
    .single();

  if (error) throw new AppError(error.message, 'DB_ERROR');
  return paraTreino(updated as TreinoRow);
}

export async function remove(treinoId: string, userId: string): Promise<void> {
  const { error } = await getSupabase()
    .from('treinos')
    .delete()
    .eq('id', treinoId)
    .eq('user_id', userId);

  if (error) throw new AppError(error.message, 'DB_ERROR');
}

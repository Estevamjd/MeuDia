import type { Exercicio, ExercicioInsert } from '@meudia/shared';
import { AppError } from '@meudia/shared';
import { getSupabase } from './supabase';

export async function findByTreinoId(treinoId: string): Promise<Exercicio[]> {
  const { data, error } = await getSupabase()
    .from('exercicios')
    .select('id, treino_id, nome, series, repeticoes, carga, tempo_descanso, observacao, ordem')
    .eq('treino_id', treinoId)
    .order('ordem', { ascending: true });

  if (error) throw new AppError(error.message, 'DB_ERROR');
  return data as Exercicio[];
}

export async function create(data: ExercicioInsert): Promise<Exercicio> {
  const { data: created, error } = await getSupabase()
    .from('exercicios')
    .insert(data)
    .select('id, treino_id, nome, series, repeticoes, carga, tempo_descanso, observacao, ordem')
    .single();

  if (error) throw new AppError(error.message, 'DB_ERROR');
  return created as Exercicio;
}

export async function update(exercicioId: string, data: Partial<ExercicioInsert>): Promise<Exercicio> {
  const { data: updated, error } = await getSupabase()
    .from('exercicios')
    .update(data)
    .eq('id', exercicioId)
    .select('id, treino_id, nome, series, repeticoes, carga, tempo_descanso, observacao, ordem')
    .single();

  if (error) throw new AppError(error.message, 'DB_ERROR');
  return updated as Exercicio;
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

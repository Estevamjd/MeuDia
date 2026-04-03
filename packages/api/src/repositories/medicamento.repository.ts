import type { Medicamento, MedicamentoInsert, RegistroMedicamento, RegistroMedicamentoInsert } from '@meudia/shared';
import { AppError } from '@meudia/shared';
import { getSupabase } from './supabase';

const MEDICAMENTO_COLUMNS = 'id, user_id, nome, dosagem, frequencia, horarios, estoque_atual, estoque_minimo, ativo, created_at';
const REGISTRO_COLUMNS = 'id, medicamento_id, user_id, data_hora, tomado';

export async function findByUserId(userId: string): Promise<Medicamento[]> {
  const { data, error } = await getSupabase()
    .from('medicamentos')
    .select(MEDICAMENTO_COLUMNS)
    .eq('user_id', userId)
    .eq('ativo', true)
    .order('nome', { ascending: true });

  if (error) throw new AppError(error.message, 'DB_ERROR');
  return data as Medicamento[];
}

export async function findById(medicamentoId: string): Promise<Medicamento> {
  const { data, error } = await getSupabase()
    .from('medicamentos')
    .select(MEDICAMENTO_COLUMNS)
    .eq('id', medicamentoId)
    .single();

  if (error) throw new AppError(error.message, 'DB_ERROR');
  return data as Medicamento;
}

export async function create(userId: string, data: MedicamentoInsert): Promise<Medicamento> {
  const { data: created, error } = await getSupabase()
    .from('medicamentos')
    .insert({ ...data, user_id: userId })
    .select(MEDICAMENTO_COLUMNS)
    .single();

  if (error) throw new AppError(error.message, 'DB_ERROR');
  return created as Medicamento;
}

export async function update(medicamentoId: string, data: Partial<MedicamentoInsert>): Promise<Medicamento> {
  const { data: updated, error } = await getSupabase()
    .from('medicamentos')
    .update(data)
    .eq('id', medicamentoId)
    .select(MEDICAMENTO_COLUMNS)
    .single();

  if (error) throw new AppError(error.message, 'DB_ERROR');
  return updated as Medicamento;
}

export async function remove(medicamentoId: string): Promise<void> {
  const { error } = await getSupabase()
    .from('medicamentos')
    .update({ ativo: false })
    .eq('id', medicamentoId);

  if (error) throw new AppError(error.message, 'DB_ERROR');
}

export async function findRegistrosByDate(
  userId: string,
  startDate: string,
  endDate: string,
): Promise<RegistroMedicamento[]> {
  const { data, error } = await getSupabase()
    .from('registro_medicamentos')
    .select(REGISTRO_COLUMNS)
    .eq('user_id', userId)
    .gte('data_hora', startDate)
    .lte('data_hora', endDate)
    .order('data_hora', { ascending: true });

  if (error) throw new AppError(error.message, 'DB_ERROR');
  return data as RegistroMedicamento[];
}

export async function createRegistro(
  userId: string,
  registro: RegistroMedicamentoInsert,
): Promise<RegistroMedicamento> {
  const { data, error } = await getSupabase()
    .from('registro_medicamentos')
    .insert({ ...registro, user_id: userId, tomado: true })
    .select(REGISTRO_COLUMNS)
    .single();

  if (error) throw new AppError(error.message, 'DB_ERROR');
  return data as RegistroMedicamento;
}

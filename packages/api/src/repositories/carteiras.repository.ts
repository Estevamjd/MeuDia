import type { Carteira, CarteiraInsert, TipoCarteira, Transacao } from '@meudia/shared';
import { AppError } from '@meudia/shared';
import { erroDb } from './erros-db';
import { getSupabase } from './supabase';

const COLUMNS = 'id, user_id, nome, tipo, saldo_inicial, saldo_inicial_em, incluir_no_total, arquivada, ordem, created_at, updated_at';

export interface CarteiraUpdate {
  nome?: string;
  tipo?: TipoCarteira;
  incluir_no_total?: boolean;
  arquivada?: boolean;
  ordem?: number;
}

function erro(error: { message: string; code?: string }): never {
  if (error.code === 'PGRST116') throw new AppError('Carteira não encontrada', 'NOT_FOUND', 404);
  erroDb(error);
}

/** Todas (inclusive arquivadas: o histórico continua); a âncora `saldo_inicial_em` vem do DEFAULT now() do banco. */
export async function findAll(userId: string): Promise<Carteira[]> {
  const { data, error } = await getSupabase().from('carteiras').select(COLUMNS).eq('user_id', userId)
    .order('ordem', { ascending: true }).order('created_at', { ascending: true });
  if (error) erro(error);
  return data as unknown as Carteira[];
}

export async function findById(id: string, userId: string): Promise<Carteira> {
  const { data, error } = await getSupabase().from('carteiras').select(COLUMNS).eq('id', id).eq('user_id', userId).single();
  if (error) erro(error);
  return data as unknown as Carteira;
}

export async function create(userId: string, input: CarteiraInsert): Promise<Carteira> {
  const { data, error } = await getSupabase().from('carteiras').insert({ ...input, user_id: userId }).select(COLUMNS).single();
  if (error) erro(error);
  return data as unknown as Carteira;
}

/** Sem `saldo_inicial`/âncora: mudar o saldo é sempre um ajuste auditável (R9). */
export async function update(id: string, input: CarteiraUpdate, userId: string): Promise<Carteira> {
  const { data, error } = await getSupabase().from('carteiras').update(input).eq('id', id).eq('user_id', userId).select(COLUMNS).single();
  if (error) erro(error);
  return data as unknown as Carteira;
}

export async function rpcCorrigirSaldo(carteiraId: string, valorReal: number, chave: string): Promise<Transacao | null> {
  const { data, error } = await getSupabase().rpc('corrigir_saldo', {
    p_carteira_id: carteiraId, p_valor_real: valorReal, p_chave: chave,
  });
  if (error) erro(error);
  return (Array.isArray(data) ? data[0] ?? null : data) as Transacao | null;
}

/** UUID estável do rascunho: repetir após resposta perdida não cria outro banco. */
export async function createIdempotente(userId: string, id: string, input: CarteiraInsert): Promise<Carteira> {
  const { error } = await getSupabase().from('carteiras').upsert({ ...input, id, user_id: userId }, { onConflict: 'id', ignoreDuplicates: true });
  if (error) erro(error);
  // Repetição após falha pode trazer nome/saldo/ordem editados; mantém a âncora original.
  const { data, error: erroAtualizacao } = await getSupabase().from('carteiras').update(input).eq('id', id).eq('user_id', userId).select(COLUMNS).single();
  if (erroAtualizacao) erro(erroAtualizacao);
  return data as unknown as Carteira;
}

import type { ListaCompras, ListaComprasInsert, ItemCompra, ItemCompraInsert } from '@meudia/shared';
import { AppError } from '@meudia/shared';
import { getSupabase } from './supabase';

/* ── Listas ── */

export async function findListasByUserId(userId: string): Promise<(ListaCompras & { itens_count: number })[]> {
  const { data, error } = await getSupabase()
    .from('listas_compras')
    .select('id, user_id, nome, created_at, itens_compras(id)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw new AppError(error.message, 'DB_ERROR');

  return (data as any[]).map((l) => ({
    id: l.id,
    user_id: l.user_id,
    nome: l.nome,
    created_at: l.created_at,
    itens_count: Array.isArray(l.itens_compras) ? l.itens_compras.length : 0,
  }));
}

export async function findListaById(listaId: string): Promise<ListaCompras> {
  const { data, error } = await getSupabase()
    .from('listas_compras')
    .select('id, user_id, nome, created_at, itens_compras(id, lista_id, nome, quantidade, unidade, categoria, comprado, preco_estimado)')
    .eq('id', listaId)
    .single();

  if (error) throw new AppError(error.message, 'DB_ERROR');

  const lista = data as any;
  return {
    id: lista.id,
    user_id: lista.user_id,
    nome: lista.nome,
    created_at: lista.created_at,
    itens: Array.isArray(lista.itens_compras) ? lista.itens_compras : [],
  } as ListaCompras;
}

export async function createLista(userId: string, data: ListaComprasInsert): Promise<ListaCompras> {
  const { data: created, error } = await getSupabase()
    .from('listas_compras')
    .insert({ ...data, user_id: userId })
    .select('id, user_id, nome, created_at')
    .single();

  if (error) throw new AppError(error.message, 'DB_ERROR');
  return created as ListaCompras;
}

export async function updateLista(listaId: string, data: Partial<ListaComprasInsert>): Promise<ListaCompras> {
  const { data: updated, error } = await getSupabase()
    .from('listas_compras')
    .update(data)
    .eq('id', listaId)
    .select('id, user_id, nome, created_at')
    .single();

  if (error) throw new AppError(error.message, 'DB_ERROR');
  return updated as ListaCompras;
}

export async function removeLista(listaId: string): Promise<void> {
  const { error } = await getSupabase()
    .from('listas_compras')
    .delete()
    .eq('id', listaId);

  if (error) throw new AppError(error.message, 'DB_ERROR');
}

/* ── Itens ── */

export async function findItensByListaId(listaId: string): Promise<ItemCompra[]> {
  const { data, error } = await getSupabase()
    .from('itens_compras')
    .select('id, lista_id, nome, quantidade, unidade, categoria, comprado, preco_estimado')
    .eq('lista_id', listaId)
    .order('comprado', { ascending: true })
    .order('categoria', { ascending: true })
    .order('nome', { ascending: true });

  if (error) throw new AppError(error.message, 'DB_ERROR');
  return data as ItemCompra[];
}

export async function createItem(data: ItemCompraInsert): Promise<ItemCompra> {
  const { data: created, error } = await getSupabase()
    .from('itens_compras')
    .insert(data)
    .select('id, lista_id, nome, quantidade, unidade, categoria, comprado, preco_estimado')
    .single();

  if (error) throw new AppError(error.message, 'DB_ERROR');
  return created as ItemCompra;
}

export async function updateItem(itemId: string, data: Partial<ItemCompraInsert>): Promise<ItemCompra> {
  const { data: updated, error } = await getSupabase()
    .from('itens_compras')
    .update(data)
    .eq('id', itemId)
    .select('id, lista_id, nome, quantidade, unidade, categoria, comprado, preco_estimado')
    .single();

  if (error) throw new AppError(error.message, 'DB_ERROR');
  return updated as ItemCompra;
}

export async function removeItem(itemId: string): Promise<void> {
  const { error } = await getSupabase()
    .from('itens_compras')
    .delete()
    .eq('id', itemId);

  if (error) throw new AppError(error.message, 'DB_ERROR');
}

export async function toggleComprado(itemId: string, comprado: boolean): Promise<ItemCompra> {
  const { data: updated, error } = await getSupabase()
    .from('itens_compras')
    .update({ comprado })
    .eq('id', itemId)
    .select('id, lista_id, nome, quantidade, unidade, categoria, comprado, preco_estimado')
    .single();

  if (error) throw new AppError(error.message, 'DB_ERROR');
  return updated as ItemCompra;
}

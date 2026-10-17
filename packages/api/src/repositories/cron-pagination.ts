import { AppError } from '@meudia/shared';

type ErroDb = { message: string; code?: string };
type PageQuery = { range(from: number, to: number): PromiseLike<{ data: Record<string, unknown>[] | null; error: ErroDb | null }> };

/** Abaixo do `max-rows` padrão do PostgREST no Supabase (1.000): cada página volta inteira. */
export const TAMANHO_PAGINA = 500;

/**
 * Lê todas as páginas até esgotar. A ordem precisa ser total e estável (ex.: data + id) e é definida pelo caller;
 * nunca depende do limite padrão do PostgREST.
 */
export async function paginas(
  query: () => PageQuery,
  onError: (error: ErroDb) => never = () => {
    throw new AppError('Falha ao carregar lote do cron', 'DB_ERROR', 500);
  },
  tamanho = TAMANHO_PAGINA,
): Promise<Record<string, unknown>[]> {
  const rows: Record<string, unknown>[] = [];
  for (let inicio = 0; ; inicio += tamanho) {
    const { data, error } = await query().range(inicio, inicio + tamanho - 1);
    if (error) onError(error);
    rows.push(...(data ?? []));
    if (!data || data.length < tamanho) return rows;
  }
}

type Linha = Record<string, unknown> & { data: string; id: string };
type ChaveQuery = {
  or(filtro: string): ChaveQuery;
  order(coluna: string, opcoes: { ascending: boolean }): ChaveQuery;
  limit(n: number): PromiseLike<{ data: Record<string, unknown>[] | null; error: ErroDb | null }>;
};

/**
 * Paginação por chave (data, id) > última linha lida, em ordem (data, id). Estável com inserções retroativas entre
 * páginas (offset duplicaria ou pularia linhas) e só para na página vazia: um `max-rows` do projeto menor que
 * `tamanho` encurta as páginas, mas não trunca o resultado. `query` traz só os filtros; a ordem é definida aqui.
 */
export async function paginasPorChave(
  query: () => ChaveQuery,
  onError: (error: ErroDb) => never,
  tamanho = TAMANHO_PAGINA,
): Promise<Linha[]> {
  const rows: Linha[] = [];
  for (let ultima: Linha | undefined; ;) {
    let q = query();
    if (ultima) q = q.or(`data.gt.${ultima.data},and(data.eq.${ultima.data},id.gt.${ultima.id})`);
    const { data, error } = await q.order('data', { ascending: true }).order('id', { ascending: true }).limit(tamanho);
    if (error) onError(error);
    if (!data?.length) return rows;
    rows.push(...(data as Linha[]));
    ultima = rows[rows.length - 1];
  }
}

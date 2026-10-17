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

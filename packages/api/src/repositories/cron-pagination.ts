import { AppError } from '@meudia/shared';

type PageQuery = { range(from: number, to: number): PromiseLike<{ data: Record<string, unknown>[] | null; error: { message: string } | null }> };
/** Ordem estável por id definida pelo caller; nunca depende do limite padrão do PostgREST. */
export async function paginas(query: () => PageQuery): Promise<Record<string, unknown>[]> {
  const rows: Record<string, unknown>[] = [];
  const tamanho = 500;
  for (let inicio = 0; ; inicio += tamanho) {
    const { data, error } = await query().range(inicio, inicio + tamanho - 1);
    if (error) throw new AppError('Falha ao carregar lote do cron', 'DB_ERROR', 500);
    rows.push(...(data ?? []));
    if (!data || data.length < tamanho) return rows;
  }
}

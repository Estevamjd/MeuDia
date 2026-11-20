import { competenciaDe, type Competencia } from '@meudia/shared';
import { isCompetencia } from './financas-ui';

export type AbaGastos = 'despesas' | 'analise';

export interface FiltrosGastos {
  aba: AbaGastos;
  mes: Competencia;
  categoria: string | null;
  /** Texto da busca (`q=`), como digitado; vazio = sem busca. Vale só para o mês escolhido. */
  busca: string;
  /** "Só WhatsApp" (`origem=whatsapp`). */
  soWhatsapp: boolean;
}

/**
 * `/financas/gastos?aba=analise&mes=2026-10&categoria=Mercado&q=uber&origem=whatsapp` → filtros (padrão: Últimas
 * despesas do mês corrente, sem busca).
 */
export function filtrosGastos(params: Pick<URLSearchParams, 'get'>, hojeISO: string): FiltrosGastos {
  const mes = params.get('mes');
  return {
    aba: params.get('aba') === 'analise' ? 'analise' : 'despesas',
    mes: isCompetencia(mes) ? mes : competenciaDe(hojeISO),
    categoria: params.get('categoria') || null,
    busca: params.get('q') ?? '',
    soWhatsapp: params.get('origem') === 'whatsapp',
  };
}

/** URL com os filtros alterados; o que é padrão fica fora da query. */
export function hrefGastos(atual: FiltrosGastos, mudanca: Partial<FiltrosGastos>, hojeISO: string): string {
  const f = { ...atual, ...mudanca };
  const q = new URLSearchParams();
  if (f.aba !== 'despesas') q.set('aba', f.aba);
  if (f.mes !== competenciaDe(hojeISO)) q.set('mes', f.mes);
  if (f.categoria) q.set('categoria', f.categoria);
  // Busca só de espaços não vai para a URL (é "sem filtro"); o resto vai como digitado.
  if (f.busca.trim()) q.set('q', f.busca);
  if (f.soWhatsapp) q.set('origem', 'whatsapp');
  const s = q.toString();
  return s ? `/financas/gastos?${s}` : '/financas/gastos';
}

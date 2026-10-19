import { competenciaDe, type Competencia } from '@meudia/shared';
import { isCompetencia } from './financas-ui';

export type AbaGastos = 'despesas' | 'analise';

export interface FiltrosGastos {
  aba: AbaGastos;
  mes: Competencia;
  categoria: string | null;
}

/** `/financas/gastos?aba=analise&mes=2026-10&categoria=Mercado` → filtros (padrão: Últimas despesas do mês corrente). */
export function filtrosGastos(params: Pick<URLSearchParams, 'get'>, hojeISO: string): FiltrosGastos {
  const mes = params.get('mes');
  return {
    aba: params.get('aba') === 'analise' ? 'analise' : 'despesas',
    mes: isCompetencia(mes) ? mes : competenciaDe(hojeISO),
    categoria: params.get('categoria') || null,
  };
}

/** URL com os filtros alterados; o que é padrão fica fora da query. */
export function hrefGastos(atual: FiltrosGastos, mudanca: Partial<FiltrosGastos>, hojeISO: string): string {
  const f = { ...atual, ...mudanca };
  const q = new URLSearchParams();
  if (f.aba !== 'despesas') q.set('aba', f.aba);
  if (f.mes !== competenciaDe(hojeISO)) q.set('mes', f.mes);
  if (f.categoria) q.set('categoria', f.categoria);
  const s = q.toString();
  return s ? `/financas/gastos?${s}` : '/financas/gastos';
}

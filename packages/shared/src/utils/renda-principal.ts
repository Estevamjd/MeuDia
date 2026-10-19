import type { Renda } from '../types/financas';
import { CATEGORIA_SALARIO, categoriaInfo } from '../constants/categorias';

/**
 * Renda principal (dia do salário em Config): entre as ativas, a de categoria Salário (pela descrição, que é o
 * que `rendas` tem; aliases do mapa, sem acento/caixa); sem nenhuma, a ativa mais antiga. Empate: a mais antiga.
 */
export function rendaPrincipal<R extends Pick<Renda, 'ativo' | 'descricao' | 'created_at'>>(rendas: readonly R[]): R | null {
  const ativas = rendas
    .filter((r) => r.ativo)
    .sort((a, b) => (a.created_at ?? '\uffff').localeCompare(b.created_at ?? '\uffff'));
  return ativas.find((r) => categoriaInfo(r.descricao).nome === CATEGORIA_SALARIO) ?? ativas[0] ?? null;
}

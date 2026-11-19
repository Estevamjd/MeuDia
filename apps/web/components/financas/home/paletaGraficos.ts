/**
 * Paleta categórica dos gráficos (tema escuro), validada com o validador da skill de dataviz:
 * slots fixos em ordem, nunca ciclados; o 6º slot ("Outros") é cinza neutro.
 * As cores dos ícones de categoria (mapa em @meudia/shared) são para ícones, não para fatias.
 */
export const CATEGORICAS = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181'] as const;
export const COR_OUTROS = '#6b6b80';
export const COR_SALDO = '#3987e5';
export const COR_GASTO = '#d95926';
// Separador entre fatias = cor do cartão do tema atual (variável CSS vale em atributo de SVG).
export const SUPERFICIE = 'var(--card)';
export const GRADE = 'rgba(120,135,160,0.16)';
export const TINTA_MUTED = '#9b9bb0';

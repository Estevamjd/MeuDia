import { filtrarPorModo, type AppMode } from './app-mode';

/** Config única da navegação (Sidebar, BottomNav, Drawer), sempre filtrada pelo APP_MODE. */
export interface NavItem {
  href: string;
  label: string;
  emoji: string;
  colorClass?: 'green' | 'orange';
  /** Ativo só na rota exata (ex.: `/financas` não acende em `/financas/contas`). */
  exato?: boolean;
}

export interface NavSection {
  label: string;
  items: NavItem[];
}

// Modo Finanças (IA de navegação 19/11/2026, docs/ia-navegacao.md): a barra de baixo tem as 4 áreas do dia
// (Início · Treino · Dieta · Painel); o menu ☰ tem só o que NÃO está na barra, em grupos. Sem "Mais".
const RESUMO_DO_MES: NavItem = { href: '/financas', label: 'Resumo do mês', emoji: '💸', exato: true };
const RELATORIO: NavItem = { href: '/financas/relatorio', label: 'Painel do mês', emoji: '📊' };
const TREINO: NavItem = { href: '/treinos', label: 'Treino', emoji: '🏋️', exato: true };
const DIETA: NavItem = { href: '/refeicoes', label: 'Dieta', emoji: '🥗' };

const ITENS_FINANCAS_MENU: NavItem[] = [
  { href: '/financas/gastos', label: 'Gastos', emoji: '🧾' },
  { href: '/financas/contas', label: 'Contas', emoji: '📅' },
  { href: '/assinaturas', label: 'Assinaturas', emoji: '💳' },
  { href: '/financas/orcamento', label: 'Orçamento', emoji: '📊' },
  { href: '/financas/metas', label: 'Metas', emoji: '🎯' },
  { href: '/financas/carteiras', label: 'Bancos e carteira', emoji: '🏦' },
];

const ITENS_SAUDE_MENU: NavItem[] = [
  { href: '/treinos/plano', label: 'Plano de treino', emoji: '🗓️' },
  { href: '/saude', label: 'Calorias e peso', emoji: '⚖️' },
];

const CONFIGURACOES: NavItem = { href: '/configuracoes', label: 'Configurações', emoji: '⚙️' };

/** Desktop (sem barra de baixo): tudo, em seções. */
const SECOES_FINANCAS: NavSection[] = [
  { label: 'Finanças', items: [RESUMO_DO_MES, RELATORIO, ...ITENS_FINANCAS_MENU] },
  { label: 'Saúde', items: [TREINO, DIETA, ...ITENS_SAUDE_MENU] },
];

/** Menu ☰ no celular: o que não está na barra de baixo (sem repetir destino). */
const SECOES_DRAWER_FINANCAS: NavSection[] = [
  { label: 'Finanças', items: ITENS_FINANCAS_MENU },
  { label: 'Saúde', items: ITENS_SAUDE_MENU },
  { label: 'Conta', items: [CONFIGURACOES] },
];

/** Os dois modos têm a mesma navegação desde a faxina dos módulos legados (20/11/2026). */
export function secoesSidebar(mode: AppMode): NavSection[] {
  return SECOES_FINANCAS
    .map((secao) => ({ ...secao, items: filtrarPorModo(secao.items, mode) }))
    .filter((secao) => secao.items.length > 0);
}

/** Menu ☰ mobile, em seções. */
export function secoesDrawer(mode: AppMode): NavSection[] {
  return SECOES_DRAWER_FINANCAS
    .map((secao) => ({ ...secao, items: filtrarPorModo(secao.items, mode) }))
    .filter((secao) => secao.items.length > 0);
}

/** Lista plana do menu ☰ (mesma ordem das seções). */
export function itensDrawer(mode: AppMode): NavItem[] {
  return secoesDrawer(mode).flatMap((secao) => secao.items);
}

// --- BottomNav ---

/** Abre o modal "Nova conta" que já existe em /financas/contas. */
export const HREF_NOVA_CONTA = '/financas/contas?nova=1';

/** Nome do ícone lucide (kebab-case) de cada aba; o componente mapeia para o ícone. */
export type IconeAba = 'house' | 'dumbbell' | 'salad' | 'layout-dashboard';

export type ItemBottomFinancas = NavItem & { icone: IconeAba };

// 19/11/2026: o "Mais" saiu (o ☰ já abre o menu, era repetido). Assinaturas foi para o ☰ e um atalho na Início.
const BOTTOM_FINANCAS: ItemBottomFinancas[] = [
  { href: '/financas', label: 'Início', emoji: '🏠', icone: 'house', exato: true },
  { href: '/treinos', label: 'Treino', emoji: '🏋️', icone: 'dumbbell', exato: true },
  { href: '/refeicoes', label: 'Dieta', emoji: '🥗', icone: 'salad' },
  { href: '/financas/relatorio', label: 'Painel', emoji: '📊', icone: 'layout-dashboard' },
];

export function itensBottomFinancas(mode: AppMode = 'financas'): ItemBottomFinancas[] {
  return filtrarPorModo(BOTTOM_FINANCAS, mode);
}

/** Ativo pela rota; query string (`?mes=…`, `?aba=…`) é ignorada dos dois lados. */
export function isNavAtivo(pathname: string, item: Pick<NavItem, 'href' | 'exato'>): boolean {
  const rota = pathname.split('?')[0] ?? pathname;
  const href = item.href.split('?')[0] ?? item.href;
  return rota === href || (!item.exato && rota.startsWith(href + '/'));
}

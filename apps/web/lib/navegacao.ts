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

const SECOES_PADRAO: NavSection[] = [
  {
    label: 'Geral',
    items: [
      { href: '/inicio', label: 'Início', emoji: '🏠' },
      { href: '/notas', label: 'Notas', emoji: '📝' },
      { href: '/agenda', label: 'Agenda', emoji: '📅' },
      { href: '/financas', label: 'Finanças', emoji: '💸' },
      { href: '/compras', label: 'Compras', emoji: '🛒' },
      { href: '/habitos', label: 'Hábitos', emoji: '🔁' },
      { href: '/veiculo', label: 'Veículo', emoji: '🚗' },
      { href: '/assinaturas', label: 'Assinaturas', emoji: '💳' },
    ],
  },
  {
    label: 'Saúde',
    items: [
      { href: '/treinos', label: 'Treinos', emoji: '🏋️', colorClass: 'orange' },
      { href: '/dieta', label: 'Dieta', emoji: '🍽️', colorClass: 'green' },
      { href: '/medicamentos', label: 'Medicamentos', emoji: '💊' },
    ],
  },
];

// Modo Finanças: só finanças (as subrotas ganham item próprio).
const ITENS_FINANCAS: NavItem[] = [
  { href: '/financas', label: 'Resumo do mês', emoji: '💸', exato: true },
  { href: '/financas/carteiras', label: 'Bancos e carteira', emoji: '🏦' },
  { href: '/financas/contas', label: 'Contas', emoji: '🧾' },
  { href: '/financas/orcamento', label: 'Orçamento', emoji: '📊' },
  { href: '/assinaturas', label: 'Assinaturas', emoji: '💳' },
];

const SECOES_FINANCAS: NavSection[] = [{ label: 'Finanças', items: ITENS_FINANCAS }];

export function secoesSidebar(mode: AppMode): NavSection[] {
  const secoes = mode === 'financas' ? SECOES_FINANCAS : SECOES_PADRAO;
  return secoes
    .map((secao) => ({ ...secao, items: filtrarPorModo(secao.items, mode) }))
    .filter((secao) => secao.items.length > 0);
}

/** Drawer mobile (modo Finanças): seções de finanças + Configurações (que hoje também é a área da conta). */
export function itensDrawer(mode: AppMode): NavItem[] {
  return filtrarPorModo(
    [...ITENS_FINANCAS, { href: '/configuracoes', label: 'Configurações', emoji: '⚙️' }],
    mode,
  );
}

// --- BottomNav ---

export const BOTTOM_TABS_PADRAO: readonly NavItem[] = [
  { href: '/inicio', label: 'Início', emoji: '🏠' },
  { href: '/agenda', label: 'Agenda', emoji: '📅' },
  { href: '/habitos', label: 'Hábitos', emoji: '✅' },
  { href: '/financas', label: 'Finanças', emoji: '💰' },
  { href: '/mais', label: 'Mais', emoji: '⋯' },
];

export const MENU_MAIS_PADRAO: readonly NavItem[] = [
  { href: '/treinos', label: 'Treinos', emoji: '🏋️' },
  { href: '/dieta', label: 'Dieta', emoji: '🍽️' },
  { href: '/medicamentos', label: 'Medicamentos', emoji: '💊' },
  { href: '/notas', label: 'Notas', emoji: '📝' },
  { href: '/compras', label: 'Compras', emoji: '🛒' },
  { href: '/veiculo', label: 'Veículo', emoji: '🚗' },
  { href: '/assinaturas', label: 'Assinaturas', emoji: '💳' },
  { href: '/configuracoes', label: 'Config', emoji: '⚙️' },
];

/** Abre o modal "Nova conta" que já existe em /financas/contas. */
export const HREF_NOVA_CONTA = '/financas/contas?nova=1';

export type ItemBottomFinancas =
  | ({ tipo: 'link' } & NavItem)
  // "+" abre a folha Gastei · Entrou dinheiro · Transferir (sem rota própria).
  | { tipo: 'acoes'; label: string; emoji: string; href?: never }
  | { tipo: 'chat'; label: string; emoji: string; href?: never };

const BOTTOM_FINANCAS: ItemBottomFinancas[] = [
  { tipo: 'link', href: '/financas', label: 'Início', emoji: '🏠', exato: true },
  { tipo: 'link', href: '/financas/contas', label: 'Contas', emoji: '🧾' },
  { tipo: 'acoes', label: 'Lançar', emoji: '+' },
  { tipo: 'link', href: '/financas/orcamento', label: 'Orçamento', emoji: '📊' },
  // Chat abre o AgentPanel do layout (sem rota própria).
  { tipo: 'chat', label: 'Chat', emoji: '💬' },
];

export function itensBottomFinancas(mode: AppMode = 'financas'): ItemBottomFinancas[] {
  return filtrarPorModo(BOTTOM_FINANCAS, mode);
}

export function isNavAtivo(pathname: string, item: Pick<NavItem, 'href' | 'exato'>): boolean {
  const href = item.href.split('?')[0] ?? item.href;
  return pathname === href || (!item.exato && pathname.startsWith(href + '/'));
}

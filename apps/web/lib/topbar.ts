import { filtrarPorModo, type AppMode } from './app-mode';

export interface TopbarTab {
  label: string;
  href: string;
  color: 'accent' | 'orange' | 'green';
}

export const TOPBAR_TABS: readonly TopbarTab[] = [
  { label: '🏠 Início', href: '/inicio', color: 'accent' },
  { label: '🏋️ Treinos', href: '/treinos', color: 'orange' },
  { label: '📝 Notas', href: '/notas', color: 'green' },
];

/** Abas do desktop visíveis no modo (FE-01): em Finanças nenhuma; a navegação fica na Sidebar. */
export function tabsTopbar(mode: AppMode): TopbarTab[] {
  return filtrarPorModo(TOPBAR_TABS, mode);
}

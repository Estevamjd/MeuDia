import { create } from 'zustand';

/** Estado do menu lateral (NavDrawer) do modo Finanças: o ☰ do topo e a aba "Mais" abrem o mesmo menu. */
interface MenuLateral {
  aberto: boolean;
  abrir: () => void;
  fechar: () => void;
}

export const useMenuLateral = create<MenuLateral>((set) => ({
  aberto: false,
  abrir: () => set({ aberto: true }),
  fechar: () => set({ aberto: false }),
}));

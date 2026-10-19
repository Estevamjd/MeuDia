import { clsx } from 'clsx';
import {
  BookOpen, Bus, Droplets, Dumbbell, Eye, Fuel, Gift, GraduationCap, HandCoins, House, Lightbulb, Paintbrush, PartyPopper,
  PawPrint, Pill, Plane, Receipt, Repeat, Scale, School, Scissors, Shirt, ShoppingCart, Smartphone, Sofa,
  Sparkles, Tag, Tv, Utensils, UtensilsCrossed, Wallet, Wifi, type LucideIcon,
} from 'lucide-react';
import { categoriaInfo, type IconeCategoria } from '@meudia/shared';

/** id do mapa (shared) → componente do lucide-react. Exportado para o teste que confere o lucide instalado. */
export const ICONES_CATEGORIA: Record<IconeCategoria, LucideIcon> = {
  'shopping-cart': ShoppingCart, utensils: Utensils, 'utensils-crossed': UtensilsCrossed, bus: Bus, fuel: Fuel,
  house: House, lightbulb: Lightbulb, droplets: Droplets, wifi: Wifi, smartphone: Smartphone, tv: Tv,
  dumbbell: Dumbbell, pill: Pill, 'book-open': BookOpen, 'graduation-cap': GraduationCap, paintbrush: Paintbrush,
  eye: Eye, sparkles: Sparkles, scissors: Scissors, shirt: Shirt, 'paw-print': PawPrint, gift: Gift,
  'party-popper': PartyPopper, plane: Plane, sofa: Sofa, school: School, repeat: Repeat, receipt: Receipt,
  wallet: Wallet, 'hand-coins': HandCoins, scale: Scale, tag: Tag,
};

const TAMANHOS = { sm: { caixa: 'h-8 w-8', icone: 16 }, md: { caixa: 'h-10 w-10', icone: 20 }, lg: { caixa: 'h-12 w-12', icone: 24 } } as const;

interface CategoriaIconeProps {
  /** Nome da categoria; desconhecida/legada usa o ícone de "Outros". */
  categoria: string | null | undefined;
  tamanho?: keyof typeof TAMANHOS;
  className?: string;
}

/** Ícone da categoria num quadrado com fundo suave da mesma cor (padrão dos cards do dashboard). Decorativo. */
export function CategoriaIcone({ categoria, tamanho = 'md', className }: CategoriaIconeProps) {
  const info = categoriaInfo(categoria);
  const Icone = ICONES_CATEGORIA[info.icone] ?? Tag;
  const t = TAMANHOS[tamanho];
  return (
    <span
      aria-hidden="true"
      data-categoria-icone={info.nome}
      data-icone={info.icone}
      className={clsx('inline-flex shrink-0 items-center justify-center rounded-xl', t.caixa, className)}
      style={{ backgroundColor: `${info.cor}24`, color: info.cor }}
    >
      <Icone size={t.icone} strokeWidth={2} />
    </span>
  );
}

import { clsx } from 'clsx';
import {
  Bike, Car, Gamepad2, Gift, GraduationCap, Heart, House, Laptop, PawPrint, Plane, Shirt, Smartphone, Sofa, Target, Tv,
  type LucideIcon,
} from 'lucide-react';
import type { IconeMeta as ChaveIconeMeta } from '@meudia/shared';

export const ICONES_LUCIDE_META: Record<ChaveIconeMeta, LucideIcon> = {
  gamepad: Gamepad2, smartphone: Smartphone, laptop: Laptop, tv: Tv, car: Car, bike: Bike, plane: Plane, house: House,
  sofa: Sofa, shirt: Shirt, gift: Gift, 'graduation-cap': GraduationCap, 'paw-print': PawPrint, heart: Heart, target: Target,
};

/** Nome de cada ícone no seletor (nome acessível do radio). */
export const ROTULO_ICONE_META: Record<ChaveIconeMeta, string> = {
  gamepad: 'Videogame', smartphone: 'Celular', laptop: 'Notebook', tv: 'TV', car: 'Carro', bike: 'Bike', plane: 'Viagem',
  house: 'Casa', sofa: 'Móveis', shirt: 'Roupas', gift: 'Presente', 'graduation-cap': 'Estudos', 'paw-print': 'Pet',
  heart: 'Saúde', target: 'Outro',
};

/** Ícone da meta num quadrado suave; chave desconhecida ou `null` usa o alvo. Decorativo. */
export function IconeMeta({ icone, className }: { icone: string | null; className?: string }) {
  const Icone = ICONES_LUCIDE_META[icone as ChaveIconeMeta] ?? Target;
  return (
    <span aria-hidden="true" className={clsx('inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent', className)}>
      <Icone size={20} />
    </span>
  );
}

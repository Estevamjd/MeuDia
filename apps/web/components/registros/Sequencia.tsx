import { Flame } from 'lucide-react';

/** "3 semanas seguidas": aparece só a partir de 2 (1 semana não é sequência), sem pressão quando zera. */
export function Sequencia({ semanas, oQue }: { semanas: number; oQue: string }) {
  if (semanas < 2) return null;
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-yellow/30 bg-yellow/[0.12] px-2.5 py-1 text-[11px] font-medium text-yellow">
      <Flame size={12} aria-hidden="true" />
      {semanas} semanas seguidas {oQue}
    </span>
  );
}

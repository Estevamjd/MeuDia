import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Competencia } from '@meudia/shared';
import { rotuloCompetencia } from '../../lib/financas-ui';

/** "‹ Outubro 2026 ›" com alvos de 44px. */
export function SeletorMes({ competencia, onMudar, discreto = false }: { competencia: Competencia; onMudar: (delta: number) => void; discreto?: boolean }) {
  const botao = 'flex h-11 w-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-card2 hover:text-text';
  return (
    <div className={discreto ? '-my-2.5 -ml-3 flex items-center' : '-my-1.5 flex items-center'}>
      <button type="button" onClick={() => onMudar(-1)} className={botao} aria-label="Mês anterior">
        <ChevronLeft size={18} />
      </button>
      <span className={discreto ? 'whitespace-nowrap text-[13px] text-muted' : 'whitespace-nowrap text-[15px] font-medium text-text'} aria-live="polite">
        {rotuloCompetencia(competencia)}
      </span>
      <button type="button" onClick={() => onMudar(1)} className={botao} aria-label="Próximo mês">
        <ChevronRight size={18} />
      </button>
    </div>
  );
}

import { Trash2 } from 'lucide-react';
import type { OrigemRegistro } from '@meudia/shared';
import { OrigemSelo } from '../financas/OrigemSelo';

interface LinhaRegistroProps {
  titulo: string;
  meta: string;
  origem: OrigemRegistro;
  onExcluir: () => void;
  rotuloExcluir: string;
}

/** Linha de histórico (Treino e Dieta): título, "dd/mm · 40 min" + selo Manual/WhatsApp e o excluir. */
export function LinhaRegistro({ titulo, meta, origem, onExcluir, rotuloExcluir }: LinhaRegistroProps) {
  return (
    <li data-testid="registro" className="flex items-center gap-3 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] text-text">{titulo}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
          <span className="whitespace-nowrap">{meta}</span>
          <OrigemSelo t={{ origem }} />
        </p>
      </div>
      <button
        type="button"
        onClick={onExcluir}
        aria-label={rotuloExcluir}
        className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-red/10 hover:text-red focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
      >
        <Trash2 size={16} aria-hidden="true" />
      </button>
    </li>
  );
}

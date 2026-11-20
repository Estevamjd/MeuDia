import Link from 'next/link';
import { ChevronRight, ClipboardList, Trash2 } from 'lucide-react';
import type { OrigemRegistro } from '@meudia/shared';
import { OrigemSelo } from '../financas/OrigemSelo';

interface LinhaRegistroProps {
  titulo: string;
  meta: string;
  /** 'plano' = sessão concluída no Plano de treino: sem excluir aqui, a linha leva ao plano. */
  origem: OrigemRegistro | 'plano';
  onExcluir?: () => void;
  rotuloExcluir?: string;
}

/** Linha de histórico (Treino e Dieta): título, "dd/mm · 40 min" + selo Manual/WhatsApp/Plano e o excluir. */
export function LinhaRegistro({ titulo, meta, origem, onExcluir, rotuloExcluir }: LinhaRegistroProps) {
  return (
    <li data-testid="registro" data-origem={origem} className="flex items-center gap-3 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] text-text">{titulo}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
          <span className="whitespace-nowrap">{meta}</span>
          {origem === 'plano' ? (
            <span className="selo-origem selo-origem-manual" data-origem="plano">
              <ClipboardList size={10} aria-hidden="true" />
              Plano
            </span>
          ) : (
            <OrigemSelo t={{ origem }} />
          )}
        </p>
      </div>
      {origem === 'plano' ? (
        <Link
          href="/treinos/plano"
          aria-label={`Ver ${titulo} no plano de treino`}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-card2 hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
        >
          <ChevronRight size={16} aria-hidden="true" />
        </Link>
      ) : (
        onExcluir && (
          <button
            type="button"
            onClick={onExcluir}
            aria-label={rotuloExcluir}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-red/10 hover:text-red focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
          >
            <Trash2 size={16} aria-hidden="true" />
          </button>
        )
      )}
    </li>
  );
}

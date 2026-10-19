import Link from 'next/link';
import { ChevronRight, Plus } from 'lucide-react';
import type { Transacao } from '@meudia/shared';
import { Button } from '../../ui';
import { LinhaLancamento } from '../LinhaLancamento';

export interface UltimosGastosProps {
  /** 3 despesas mais recentes do mês. */
  gastos: Transacao[];
  onGastei: () => void;
}

/** Início: 3 últimos gastos (só leitura) + "Ver todos os gastos" (aba Gastos) + "Gastei". */
export function UltimosGastos({ gastos, onGastei }: UltimosGastosProps) {
  return (
    <section aria-labelledby="ultimos-gastos" className="space-y-2 rounded-xl border border-border bg-card px-4 py-3">
      <h2 id="ultimos-gastos" className="text-[13px] font-medium text-muted">
        Últimos gastos
      </h2>
      {gastos.length === 0 ? (
        <p className="text-[15px] text-muted">Nenhum gasto neste mês ainda.</p>
      ) : (
        <ul>
          {gastos.map((t) => (
            <LinhaLancamento key={t.id} t={t} />
          ))}
        </ul>
      )}
      <div className="flex items-center justify-between gap-3">
        <Link href="/financas/gastos" className="-ml-1 flex min-h-[44px] items-center gap-1 px-1 text-sm font-medium text-accent">
          Ver todos os gastos <ChevronRight size={16} aria-hidden="true" />
        </Link>
        <Button onClick={onGastei} className="min-h-[44px]">
          <Plus size={16} aria-hidden="true" />
          Gastei
        </Button>
      </div>
    </section>
  );
}

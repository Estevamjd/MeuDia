import Link from 'next/link';
import { clsx } from 'clsx';
import type { Competencia, SituacaoOcorrencia } from '@meudia/shared';
import { Button } from '../../ui';
import { formatBRL, textoVencimento } from '../../../lib/financas-ui';
import { CategoriaIcone } from '../CategoriaIcone';

export interface ContaProxima {
  contaId: string;
  competencia: Competencia;
  descricao: string;
  valor: number;
  vencimento: string;
  situacao: SituacaoOcorrencia;
  categoria?: string;
}

export interface ProximasContasProps {
  /** Até 3 contas não pagas, vencidas primeiro e depois por vencimento. */
  contas: ContaProxima[];
  /** Total de contas do mês (pagas + pendentes), para "Ver todas as contas (N)". */
  totalMes: number;
  hojeISO: string;
  /** `contaId` com "Paguei" em andamento. */
  contaOcupada?: string;
  pagamentoBloqueado?: boolean;
  onPagar: (conta: ContaProxima) => void;
}

/** "Contas a vencer": lista curta com "Paguei" em 1 toque. */
export function ProximasContas({ contas, totalMes, hojeISO, contaOcupada, pagamentoBloqueado, onPagar }: ProximasContasProps) {
  return (
    <section id="proximas-contas" aria-labelledby="proximas-contas-titulo" className="scroll-mt-20 space-y-3">
      <h2 id="proximas-contas-titulo" className="text-[15px] font-semibold text-text">
        Contas a vencer
      </h2>

      {contas.length === 0 ? (
        <p className="rounded-card border border-border bg-card p-4 text-[15px] text-muted">
          Todas as contas do mês estão pagas.
        </p>
      ) : (
        <ul className="space-y-2">
          {contas.map((c) => (
            <li key={c.contaId} className="flex items-center gap-3 rounded-card border border-border bg-card p-3">
              <CategoriaIcone categoria={c.categoria ?? 'Contas'} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-medium text-text" title={c.descricao}>
                  {c.descricao}
                </p>
                <p className={clsx('text-[13px]', c.situacao === 'vencida' ? 'text-red' : 'text-muted')}>
                  {textoVencimento(c.vencimento, hojeISO)}
                </p>
              </div>
              <span className="shrink-0 whitespace-nowrap text-[15px] font-semibold tabular-nums text-text">
                {formatBRL(c.valor)}
              </span>
              <Button
                className="shrink-0"
                onClick={() => onPagar(c)}
                disabled={pagamentoBloqueado}
                isLoading={contaOcupada === c.contaId}
                aria-label={`Paguei ${c.descricao}`}
              >
                Paguei
              </Button>
            </li>
          ))}
        </ul>
      )}

      <Link href="/financas/contas" className="inline-block text-sm font-medium text-accent hover:underline">
        Ver todas as contas ({totalMes})
      </Link>
    </section>
  );
}

import Link from 'next/link';
import { clsx } from 'clsx';
import { ChevronRight } from 'lucide-react';
import type { Competencia, SituacaoOcorrencia } from '@meudia/shared';
import { Button } from '../../ui';
import { formatBRL, textoVencimento } from '../../../lib/financas-ui';
import { CategoriaIcone } from '../CategoriaIcone';
import { InfoDica } from '../../ui/InfoDica';
import { EXPLICACOES } from './explicacoes';
import { LinhaRendaAReceber, type RendaAReceberItem } from './CardRendaAReceber';

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
  /** Até 2 contas não pagas, vencidas primeiro e depois por vencimento. */
  contas: ContaProxima[];
  /** Total de contas do mês (pagas + pendentes), para "Ver todas as contas (N)". */
  totalMes: number;
  hojeISO: string;
  /** `contaId` com "Paguei" em andamento. */
  contaOcupada?: string;
  pagamentoBloqueado?: boolean;
  onPagar: (conta: ContaProxima) => void;
  /** Renda do mês ainda sem "Recebi": vira a linha "A receber" dentro do card. */
  rendasAReceber?: RendaAReceberItem[];
  onRecebi?: (renda: RendaAReceberItem) => void;
}

/** "Contas a vencer": até 2 contas com "Paguei" em 1 toque; vencida/hoje em destaque (sem banner separado). */
export function ProximasContas({ contas, totalMes, hojeISO, contaOcupada, pagamentoBloqueado, onPagar, rendasAReceber = [], onRecebi }: ProximasContasProps) {
  return (
    <section id="proximas-contas" aria-labelledby="proximas-contas-titulo" className="lap-cartao scroll-mt-20 space-y-2 px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 id="proximas-contas-titulo" className="text-[13px] font-medium text-muted">
            Contas a vencer
          </h2>
          <InfoDica {...EXPLICACOES.contasAVencer} />
        </div>
        <Link
          href="/financas/contas"
          aria-label={`Ver todas as contas (${totalMes})`}
          className="-my-3 -mr-1 flex min-h-[44px] items-center gap-0.5 px-1 text-sm font-medium text-accent"
        >
          Ver todas <ChevronRight size={16} aria-hidden="true" />
        </Link>
      </div>

      {contas.length === 0 && totalMes === 0 ? (
        // Nenhuma conta cadastrada não é "tudo pago" (o card aparece só pela linha "A receber").
        <div className="flex min-h-[44px] items-center justify-between gap-3" data-testid="contas-vazio">
          <p className="text-[15px] text-muted">Nenhuma conta fixa cadastrada</p>
          <Link
            href="/financas/contas?nova=1"
            className="-my-2 -mr-1 inline-flex min-h-[44px] shrink-0 items-center px-1 text-sm font-medium text-accent"
          >
            Adicionar
          </Link>
        </div>
      ) : contas.length === 0 ? (
        <p className="text-[15px] text-muted" data-testid="contas-todas-pagas">
          {totalMes === 1 ? 'A conta do mês está paga.' : `Todas as ${totalMes} contas do mês estão pagas.`}
        </p>
      ) : (
        <ul className="space-y-1">
          {contas.map((c) => {
            const urgente = c.situacao === 'vencida' || c.vencimento === hojeISO;
            return (
              <li key={c.contaId} data-conta={c.contaId} className="flex min-h-[44px] items-center gap-3">
                <CategoriaIcone categoria={c.categoria ?? 'Contas'} tamanho="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-medium leading-tight text-text" title={c.descricao}>
                    {c.descricao}
                  </p>
                  <p className={clsx('truncate text-[12px] leading-tight', c.situacao === 'vencida' ? 'font-medium text-red' : urgente ? 'font-medium text-orange' : 'text-muted')}>
                    {textoVencimento(c.vencimento, hojeISO)} · <span className="tabular-nums">{formatBRL(c.valor)}</span>
                  </p>
                </div>
                <Button
                  className="min-h-[44px] shrink-0"
                  onClick={() => onPagar(c)}
                  disabled={pagamentoBloqueado}
                  isLoading={contaOcupada === c.contaId}
                  aria-label={`Paguei ${c.descricao}`}
                >
                  Paguei
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      {onRecebi && rendasAReceber.length > 0 && (
        <ul className="space-y-1 border-t border-border pt-2">
          {rendasAReceber.map((r, i) => (
            // Um ⓘ só, na primeira linha "A receber" (não repete por renda).
            <LinhaRendaAReceber key={r.rendaId} renda={r} hojeISO={hojeISO} onRecebi={onRecebi} dica={i === 0} />
          ))}
        </ul>
      )}
    </section>
  );
}

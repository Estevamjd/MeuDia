'use client';

import Link from 'next/link';
import { Receipt, ChevronRight } from 'lucide-react';
import type { Competencia } from '@meudia/shared';
import { useContasMes } from '../../hooks';
import { Badge, Button, EmptyState, SkeletonList } from '../ui';
import { formatBRL, formatDiaMes, ordenarOcorrencias, SITUACAO_UI } from '../../lib/financas-ui';
import { usePagamentoAcoes } from './usePagamentoAcoes';

/** Seção "Contas do mês" com chips de situação, "Paguei" e "Desfazer". */
export function ContasDoMes({ competencia }: { competencia: Competencia }) {
  const { data, isLoading, isError, refetch, isFetching } = useContasMes(competencia);
  const { pagarConta, desfazerPagamento, contaOcupada } = usePagamentoAcoes();

  return (
    <section aria-labelledby="contas-do-mes" className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 id="contas-do-mes" className="font-syne text-lg font-semibold text-text">
          Contas do mês
        </h2>
        <Link href="/financas/contas" className="text-sm text-accent hover:underline">
          Gerenciar contas
        </Link>
      </div>

      {isLoading ? (
        <SkeletonList count={3} />
      ) : isError ? (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-card border border-red/40 bg-card p-3 text-sm">
          <span>Não foi possível carregar as contas deste mês.</span>
          <Button variant="ghost" onClick={() => void refetch()} isLoading={isFetching}>
            Tentar de novo
          </Button>
        </div>
      ) : !data || data.length === 0 ? (
        <EmptyState
          icon={<Receipt size={40} />}
          title="Nenhuma conta neste mês"
          description="Cadastre contas com vencimento para receber lembretes e marcar como pagas."
        />
      ) : (
        <ul className="space-y-2">
          {ordenarOcorrencias(data).map((oc) => {
            const ui = SITUACAO_UI[oc.situacao];
            const alvo = { contaId: oc.conta.id, competencia, descricao: oc.conta.descricao };
            const ocupada = contaOcupada === oc.conta.id;
            return (
              <li
                key={oc.conta.id}
                className="flex flex-wrap items-center gap-3 rounded-card border border-border bg-card p-4"
              >
                <Link
                  href={`/financas/contas/${oc.conta.id}?competencia=${competencia}`}
                  className="flex min-w-0 flex-1 items-center gap-3 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                >
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 truncate text-sm font-medium text-text">
                      {oc.conta.descricao}
                      <Badge color={ui.color}>{ui.label}</Badge>
                    </p>
                    <p className="text-xs text-muted">
                      {oc.pagamento ? `Paga em ${formatDiaMes(oc.pagamento.pago_em)}` : `Vence ${formatDiaMes(oc.vencimento)}`}
                      {' · '}
                      {oc.conta.categoria}
                    </p>
                  </div>
                  <span className="whitespace-nowrap text-sm font-bold text-text">{formatBRL(Number(oc.conta.valor))}</span>
                  <ChevronRight size={16} className="text-muted" aria-hidden="true" />
                </Link>
                {oc.situacao === 'paga' ? (
                  <Button
                    variant="ghost"
                    onClick={() => desfazerPagamento(alvo)}
                    isLoading={ocupada}
                    aria-label={`Desfazer pagamento de ${oc.conta.descricao}`}
                  >
                    Desfazer
                  </Button>
                ) : (
                  <Button
                    onClick={() => pagarConta(alvo)}
                    isLoading={ocupada}
                    aria-label={`Paguei ${oc.conta.descricao}`}
                  >
                    Paguei
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

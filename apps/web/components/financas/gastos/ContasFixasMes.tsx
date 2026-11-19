import Link from 'next/link';
import { clsx } from 'clsx';
import type { ContaFixaDoMes } from '@meudia/shared';
import { Button } from '../../ui';
import { formatBRL, formatDiaMes, nomeMes } from '../../../lib/financas-ui';
import type { ContasFixasDoMes } from './contasFixasDoMes';

/** Gastos › Últimas despesas: as contas fixas do mês (pagas ou a pagar), separadas dos gastos do dia a dia. */
export function ContasFixasMes({ mes, contas, onDesfazer, ocupada }: {
  mes: string;
  contas: ContasFixasDoMes;
  /** "Desfazer" do "Paguei": a conta volta a ficar a pagar e o lançamento dela some. */
  onDesfazer?: (conta: ContaFixaDoMes) => void;
  /** Conta com mutação em andamento. */
  ocupada?: string;
}) {
  if (contas.itens.length === 0) return null;
  return (
    <section aria-labelledby="contas-fixas-mes" className="rounded-xl border border-border bg-card px-4 py-3" data-testid="contas-fixas-mes">
      <div className="flex items-center justify-between gap-2">
        <h2 id="contas-fixas-mes" className="text-[15px] font-medium text-text">Contas fixas de {nomeMes(mes)}</h2>
        <span data-testid="total-contas-fixas" className="font-semibold tabular-nums text-red">{formatBRL(contas.total)}</span>
      </div>
      <p className="text-[12px] text-muted">
        {contas.pagas} paga{contas.pagas === 1 ? '' : 's'} · {contas.aPagar} a pagar. Pagas ou não, já descontam da sobra do mês.
      </p>
      <ul className="mt-1 divide-y divide-border">
        {contas.itens.map((c) => (
          <li key={c.id} className="flex items-center justify-between gap-2 py-2 text-[15px]" data-conta-fixa={c.paga ? 'paga' : 'a-pagar'}>
            <span className="min-w-0">
              <span className="block truncate text-text">{c.descricao}</span>
              <span className="text-[12px] text-muted">{c.paga && c.pagoEm ? `pago em ${formatDiaMes(c.pagoEm)}` : `a pagar · vence ${formatDiaMes(c.vencimento)}`}</span>
            </span>
            <span className="flex shrink-0 items-center gap-2">
              <span className="tabular-nums text-text">{formatBRL(c.valor)}</span>
              <span className={clsx('rounded-full border px-1.5 text-[11px] leading-[18px]', c.paga ? 'border-accent/40 text-accent' : 'border-yellow/40 text-yellow')}>
                {c.paga ? 'pago' : 'a pagar'}
              </span>
              {c.paga && onDesfazer && (
                <Button variant="ghost" className="min-h-[44px] px-2 text-[13px]" isLoading={ocupada === c.id} onClick={() => onDesfazer(c)} aria-label={`Desfazer pagamento de ${c.descricao}`}>
                  Desfazer
                </Button>
              )}
            </span>
          </li>
        ))}
      </ul>
      <Link href="/financas/contas" className="flex min-h-[44px] items-center text-[13px] font-medium text-accent">
        Ver e pagar contas
      </Link>
    </section>
  );
}

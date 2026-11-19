import Link from 'next/link';
import { ChevronRight, PiggyBank } from 'lucide-react';
import { formatBRLSinal } from '../../../lib/financas-ui';
import { VALOR_OCULTO } from '../../../lib/carteiras-ui';
import { BANCOS_PATH } from './CardSaldoHoje';

export interface LinhaCofrinhoProps {
  saldo: number;
  escondido?: boolean;
}

/** Linha pequena sob o resumo do mês: o Cofrinho (dinheiro guardado) e o atalho para Bancos. */
export function LinhaCofrinho({ saldo, escondido = false }: LinhaCofrinhoProps) {
  const valor = escondido ? VALOR_OCULTO : formatBRLSinal(saldo);
  return (
    <Link
      href={BANCOS_PATH}
      data-testid="linha-cofrinho"
      aria-label={`Cofrinho: ${escondido ? 'valor oculto' : valor}. Abrir Bancos para guardar, tirar ou corrigir`}
      className="lap-cartao flex min-h-[44px] items-center gap-2 px-4 py-2.5 text-[15px] text-text"
    >
      <PiggyBank size={18} aria-hidden="true" className="shrink-0 text-accent" />
      <span className="flex-1">
        Cofrinho: <span data-testid="linha-cofrinho-valor" className="font-semibold tabular-nums">{valor}</span>
      </span>
      <ChevronRight size={18} aria-hidden="true" className="shrink-0 text-muted" />
    </Link>
  );
}

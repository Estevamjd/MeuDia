import Link from 'next/link';
import { clsx } from 'clsx';
import { Eye, EyeOff, Wallet } from 'lucide-react';
import { formatBRLSinal } from '../../../lib/financas-ui';
import { VALOR_OCULTO } from '../../../lib/carteiras-ui';
import { CardDashboard, VALOR_GRANDE } from './CardDashboard';

export interface ChipCarteira {
  id: string;
  nome: string;
  saldo: number;
  noTotal: boolean;
}

export interface CardSaldoHojeProps {
  total: number;
  carteiras: ChipCarteira[];
  /** `null` quando nenhuma carteira existia antes do mês (R12). */
  comecouMes: number | null;
  /** "outubro" */
  nomeMes: string;
  escondido: boolean;
  onAlternarOlho: () => void;
}

/** "Você tem hoje": total das carteiras no total, chips por banco e "Começou o mês com". */
export function CardSaldoHoje({ total, carteiras, comecouMes, nomeMes, escondido, onAlternarOlho }: CardSaldoHojeProps) {
  const valor = (v: number) => (escondido ? VALOR_OCULTO : formatBRLSinal(v));
  if (carteiras.length === 0) {
    return (
      <CardDashboard id="saldo-hoje" titulo="Você tem hoje" icone={<Wallet size={20} />}>
        <p className="text-[15px] text-text">Diga onde fica seu dinheiro para ver quanto você tem hoje.</p>
        <Link
          href="/financas/carteiras?nova=1"
          className="inline-flex min-h-[44px] w-full items-center justify-center rounded-lg bg-gradient-to-r from-accent to-accent2 text-base font-medium text-white"
        >
          Adicionar banco ou carteira
        </Link>
      </CardDashboard>
    );
  }
  return (
    <CardDashboard
      id="saldo-hoje"
      titulo="Você tem hoje"
      icone={<Wallet size={20} />}
      acao={
        <button
          type="button"
          onClick={onAlternarOlho}
          aria-pressed={escondido}
          aria-label={escondido ? 'Mostrar valores' : 'Esconder valores'}
          className="flex h-11 w-11 items-center justify-center rounded-lg text-muted transition-colors hover:bg-card2 hover:text-text"
        >
          {escondido ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      }
    >
      <p
        data-testid="saldo-hoje-valor"
        className={clsx('whitespace-nowrap font-semibold leading-tight tabular-nums', total < 0 && !escondido ? 'text-red' : 'text-text')}
        style={VALOR_GRANDE}
      >
        {valor(total)}
      </p>
      {total < 0 && !escondido && <p className="text-[13px] text-red">Saldo negativo: entrou menos do que saiu desde o cadastro.</p>}
      <ul className="flex flex-wrap gap-2" aria-label="Saldo por banco">
        {carteiras.map((c) => (
          <li
            key={c.id}
            className={clsx('max-w-full rounded-full border border-border bg-card2 px-3 py-1.5 text-[13px]', !c.noTotal && 'opacity-70')}
          >
            <span className="text-muted">{c.nome}</span>{' '}
            <span className={clsx('font-medium tabular-nums', c.saldo < 0 && !escondido ? 'text-red' : 'text-text')}>{valor(c.saldo)}</span>
            {!c.noTotal && <span className="text-muted"> · fora do total</span>}
          </li>
        ))}
      </ul>
      {comecouMes !== null && (
        <p className="text-[13px] text-muted">
          Começou {nomeMes} com <span className="tabular-nums text-text">{valor(comecouMes)}</span>
        </p>
      )}
    </CardDashboard>
  );
}

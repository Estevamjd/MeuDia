import Link from 'next/link';
import { clsx } from 'clsx';
import { ChevronRight, Eye, EyeOff, Scale, Wallet } from 'lucide-react';
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
  compacto?: boolean;
}

export const BANCOS_PATH = '/financas/carteiras';

/** Link do "Corrigir": com um banco abre o "Corrigir saldo" dele; com vários, a lista de Bancos pedindo para escolher. */
export function hrefCorrigirSaldo(carteiras: Pick<ChipCarteira, 'id'>[]): string {
  return carteiras.length === 1
    ? `${BANCOS_PATH}?corrigir=${encodeURIComponent(carteiras[0]!.id)}`
    : `${BANCOS_PATH}?corrigir=escolher`;
}

/**
 * "Cofrinho" (quanto tem hoje): total das carteiras no total, chips por banco e "Começou o mês com".
 * Tocar no conteúdo abre Bancos; o "Corrigir" no cabeçalho abre o "Corrigir saldo". O olho fica fora do link.
 */
export function CardSaldoHoje({ total, carteiras, comecouMes, nomeMes, escondido, onAlternarOlho, compacto = false, semOlho = false }: CardSaldoHojeProps & { semOlho?: boolean }) {
  const valor = (v: number) => (escondido ? VALOR_OCULTO : formatBRLSinal(v));
  if (carteiras.length === 0) {
    return (
      <CardDashboard id="saldo-hoje" titulo="Cofrinho" icone={<Wallet size={20} />} compacto={compacto}>
        <p className="text-[15px] text-text">Diga onde fica seu dinheiro para ver quanto você tem hoje.</p>
        <Link
          href="/financas/carteiras?nova=1"
          className="inline-flex min-h-[44px] w-full items-center justify-center rounded-lg bg-accent text-base font-medium text-accent-fg"
        >
          Adicionar banco ou carteira
        </Link>
      </CardDashboard>
    );
  }
  const umBanco = carteiras.length === 1 ? carteiras[0]! : null;
  return (
    <CardDashboard
      id="saldo-hoje"
      titulo="Cofrinho"
      icone={<Wallet size={20} />}
      compacto={compacto}
      acao={
        <>
          <Link
            href={hrefCorrigirSaldo(carteiras)}
            aria-label={umBanco ? `Corrigir saldo de ${umBanco.nome}` : 'Corrigir saldo de um banco'}
            className="inline-flex h-11 min-w-[44px] items-center justify-center gap-1 rounded-lg px-2 text-[13px] font-medium text-accent transition-colors hover:bg-card2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
          >
            <Scale size={14} aria-hidden="true" /> Corrigir
          </Link>
          {!semOlho && (
            <button
              type="button"
              onClick={onAlternarOlho}
              aria-pressed={escondido}
              aria-label={escondido ? 'Mostrar valores' : 'Esconder valores'}
              className="flex h-11 w-11 items-center justify-center rounded-lg text-muted transition-colors hover:bg-card2 hover:text-text"
            >
              {escondido ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          )}
        </>
      }
    >
      <Link
        href={BANCOS_PATH}
        data-testid="saldo-hoje-link"
        className={clsx(
          '-mx-2 block min-h-[44px] rounded-lg px-2 py-1 transition-colors hover:bg-card2/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent',
          compacto ? 'space-y-2' : 'space-y-3',
        )}
      >
        <span className="sr-only">Abrir bancos e carteira. </span>
        <span className="flex items-center justify-between gap-2">
          <span
            data-testid="saldo-hoje-valor"
            className={clsx('whitespace-nowrap font-semibold leading-tight tabular-nums', total < 0 && !escondido ? 'text-red' : 'text-text')}
            style={VALOR_GRANDE}
          >
            {valor(total)}
          </span>
          <ChevronRight size={18} aria-hidden="true" className="shrink-0 text-muted" />
        </span>
        {total < 0 && !escondido && <span className="block text-[13px] text-red">Saldo negativo: entrou menos do que saiu desde o cadastro.</span>}
        <span className="flex flex-wrap gap-2" role="list" aria-label="Saldo por banco">
          {carteiras.map((c) => (
            <span
              key={c.id}
              role="listitem"
              className={clsx('max-w-full rounded-full border border-border bg-card2 px-3 text-[13px]', compacto ? 'py-1' : 'py-1.5', !c.noTotal && 'opacity-70')}
            >
              <span className="text-muted">{c.nome}</span>{' '}
              <span className={clsx('font-medium tabular-nums', c.saldo < 0 && !escondido ? 'text-red' : 'text-text')}>{valor(c.saldo)}</span>
              {!c.noTotal && <span className="text-muted"> · fora do total</span>}
            </span>
          ))}
        </span>
        {comecouMes !== null && (
          <span className="block text-[13px] text-muted">
            Começou {nomeMes} com <span className="tabular-nums text-text">{valor(comecouMes)}</span>
          </span>
        )}
      </Link>
    </CardDashboard>
  );
}

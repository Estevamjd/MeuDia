'use client';

import { useId, useState, type ReactNode } from 'react';
import { clsx } from 'clsx';
import { CalendarClock, CalendarDays } from 'lucide-react';
import type { EmSeteDias, SobraDoMes } from '@meudia/shared';
import { formatBRL, formatBRLSinal, formatDiaMes } from '../../../lib/financas-ui';
import { VALOR_OCULTO } from '../../../lib/carteiras-ui';
import { CardDashboard, VALOR_GRANDE } from './CardDashboard';

interface CardBaseProps {
  id: string;
  titulo: string;
  icone: ReactNode;
  valor: number;
  escondido: boolean;
  /** Conta curta visível sem abrir nada (ex.: "Guardado R$ 235,00 + sobra R$ 2.090,00"). */
  conta: string;
  rodape: string;
  porque: ReactNode;
}

/** Valor grande + conta curta + "por quê?" que abre a conta em português. */
function CardBase({ id, titulo, icone, valor, escondido, conta, rodape, porque }: CardBaseProps) {
  const [aberto, setAberto] = useState(false);
  const painelId = useId();
  const negativo = valor < 0;
  return (
    <CardDashboard id={id} titulo={titulo} icone={icone} corIcone={negativo ? 'bg-red/[0.14] text-red' : 'bg-green/[0.14] text-green'}>
      <p
        data-testid={`${id}-valor`}
        className={clsx('whitespace-nowrap font-semibold leading-tight tabular-nums', negativo && !escondido ? 'text-red' : 'text-text')}
        style={VALOR_GRANDE}
      >
        {escondido ? VALOR_OCULTO : formatBRLSinal(valor)}
      </p>
      <p data-testid={`${id}-conta`} className="text-[13px] tabular-nums text-muted">
        {conta}
      </p>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[13px] text-muted">{rodape}</p>
        <button
          type="button"
          onClick={() => setAberto((a) => !a)}
          aria-expanded={aberto}
          aria-controls={painelId}
          aria-label={`por quê? ${titulo}`}
          className="min-h-[44px] px-2 text-sm font-medium text-accent hover:underline"
        >
          por quê?
        </button>
      </div>
      {negativo && !escondido && <p className="text-[13px] text-red">Faltam {formatBRL(-valor)} para fechar o mês.</p>}
      {aberto && (
        <div id={painelId} className="space-y-1 rounded-lg bg-card2 p-3 text-[13px]">
          {porque}
        </div>
      )}
    </CardDashboard>
  );
}

function Linha({ rotulo, valor, escondido, sinal, total }: { rotulo: string; valor: number; escondido: boolean; sinal?: '+' | '−'; total?: boolean }) {
  const texto = escondido ? VALOR_OCULTO : sinal ? `${sinal}${formatBRL(Math.abs(valor))}` : formatBRLSinal(valor);
  return (
    <li className={clsx('flex justify-between gap-3', total && 'border-t border-border pt-1 font-medium')}>
      <span className={clsx('min-w-0 break-words', total ? 'text-text' : 'text-muted')}>{rotulo}</span>
      <span className={clsx('whitespace-nowrap tabular-nums', total ? 'text-text' : sinal === '−' ? 'text-red' : sinal === '+' ? 'text-green' : 'text-text')}>
        {texto}
      </span>
    </li>
  );
}

const oculto = (escondido: boolean, n: number) => (escondido ? VALOR_OCULTO : formatBRL(Math.abs(n)));

export interface CardSobraMesProps {
  sobra: SobraDoMes;
  escondido: boolean;
}

/** "No fim do mês sobra" = renda do mês − despesas do mês (lançadas + contas ainda não pagas). Sem saldo guardado. */
export function CardSobraMes({ sobra, escondido }: CardSobraMesProps) {
  const v = (n: number) => oculto(escondido, n);
  const resultado = sobra.valor < 0 ? `faltam ${v(sobra.valor)}` : `sobra ${v(sobra.valor)}`;
  return (
    <CardBase
      id="previsao-fim-mes"
      titulo="No fim do mês sobra"
      icone={<CalendarClock size={20} />}
      valor={sobra.valor}
      escondido={escondido}
      conta={`Renda ${v(sobra.renda.total)} − despesas ${v(sobra.despesas)} = ${resultado}`}
      rodape="renda do mês − despesas do mês"
      porque={
        <>
          <ul className="space-y-1">
            {sobra.renda.lancada > 0 && <Linha rotulo="+ Receitas lançadas no mês" valor={sobra.renda.lancada} sinal="+" escondido={escondido} />}
            {sobra.rendasAReceber.map((r) => (
              <Linha key={r.id} rotulo={`+ ${r.descricao} (sem "Recebi", dia ${formatDiaMes(r.data)})`} valor={r.valor} sinal="+" escondido={escondido} />
            ))}
            <Linha rotulo="= Renda do mês" valor={sobra.renda.total} escondido={escondido} total />
            {sobra.despesasLancadas > 0 && <Linha rotulo="− Despesas lançadas no mês" valor={sobra.despesasLancadas} sinal="−" escondido={escondido} />}
            {sobra.contasAPagar.map((c) => (
              <Linha key={c.id} rotulo={`− ${c.descricao} (vence ${formatDiaMes(c.vencimento)})`} valor={c.valor} sinal="−" escondido={escondido} />
            ))}
            <Linha rotulo="= Despesas do mês" valor={sobra.despesas} escondido={escondido} total />
            <Linha rotulo="= No fim do mês sobra" valor={sobra.valor} escondido={escondido} total />
          </ul>
          <p className="pt-1 text-muted">
            O dinheiro guardado nos bancos não entra. Conta paga com &quot;Paguei&quot; já está nas despesas lançadas; renda com
            &quot;Recebi&quot;, nas receitas. Limites do orçamento não entram.
          </p>
        </>
      }
    />
  );
}

export interface CardSeteDiasProps {
  seteDias: EmSeteDias;
  escondido: boolean;
}

/** "Em 7 dias você terá" = guardado hoje nos bancos + "No fim do mês sobra". */
export function CardSeteDias({ seteDias, escondido }: CardSeteDiasProps) {
  const v = (n: number) => oculto(escondido, n);
  const parcela = seteDias.sobra < 0 ? `− falta ${v(seteDias.sobra)}` : `+ sobra ${v(seteDias.sobra)}`;
  return (
    <CardBase
      id="previsao-7dias"
      titulo="Em 7 dias você terá"
      icone={<CalendarDays size={20} />}
      valor={seteDias.valor}
      escondido={escondido}
      conta={`Guardado ${seteDias.guardado < 0 ? '−' : ''}${v(seteDias.guardado)} ${parcela}`}
      rodape={`até ${formatDiaMes(seteDias.alvoISO)}`}
      porque={
        <ul className="space-y-1">
          <Linha rotulo="Guardado hoje nos bancos" valor={seteDias.guardado} escondido={escondido} />
          <Linha rotulo={seteDias.sobra < 0 ? '− Falta no fim do mês' : '+ Sobra do fim do mês'} valor={seteDias.sobra} sinal={seteDias.sobra < 0 ? '−' : '+'} escondido={escondido} />
          <Linha rotulo={`= Em ${formatDiaMes(seteDias.alvoISO)}`} valor={seteDias.valor} escondido={escondido} total />
        </ul>
      }
    />
  );
}

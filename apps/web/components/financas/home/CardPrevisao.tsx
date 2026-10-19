'use client';

import { useId, useState } from 'react';
import { clsx } from 'clsx';
import type { SobraDoMes } from '@meudia/shared';
import { formatBRL, formatBRLSinal, formatDiaMes } from '../../../lib/financas-ui';
import { VALOR_OCULTO } from '../../../lib/carteiras-ui';
import { VALOR_GRANDE } from './CardDashboard';

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

/**
 * "No fim do mês sobra" = renda do mês − despesas do mês (lançadas + contas ainda não pagas). Sem saldo guardado.
 * Compacto (Início sem rolar): valor, barra do quanto da renda do mês já está comprometido e a conta numa linha.
 */
export function CardSobraMes({ sobra, escondido }: CardSobraMesProps) {
  const [aberto, setAberto] = useState(false);
  const painelId = useId();
  const v = (n: number) => oculto(escondido, n);
  const negativo = sobra.valor < 0;
  const resultado = negativo ? `faltam ${v(sobra.valor)}` : `sobra ${v(sobra.valor)}`;
  // % usado = despesas do mês ÷ renda do mês; a barra para em 100, o texto mostra o real.
  const pct = sobra.renda.total > 0 ? Math.round((sobra.despesas / sobra.renda.total) * 100) : null;
  const pctBarra = pct === null ? (sobra.despesas > 0 ? 100 : 0) : Math.min(Math.max(pct, 0), 100);
  const corBarra = pctBarra < 70 ? 'bg-green' : pctBarra < 90 ? 'bg-orange' : 'bg-red';
  return (
    <section aria-labelledby="previsao-fim-mes" className="min-w-0 space-y-2 rounded-xl border border-border bg-card px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <h2 id="previsao-fim-mes" className="text-[13px] font-medium text-muted">
          No fim do mês sobra
        </h2>
        <button
          type="button"
          onClick={() => setAberto((a) => !a)}
          aria-expanded={aberto}
          aria-controls={painelId}
          aria-label="por quê? No fim do mês sobra"
          className="-my-3 -mr-1 min-h-[44px] px-1 text-sm font-medium text-accent hover:underline"
        >
          por quê?
        </button>
      </div>
      <p
        data-testid="previsao-fim-mes-valor"
        className={clsx('whitespace-nowrap font-semibold leading-tight tabular-nums', negativo && !escondido ? 'text-red' : 'text-green')}
        style={VALOR_GRANDE}
      >
        {escondido ? VALOR_OCULTO : formatBRLSinal(sobra.valor)}
      </p>
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-card2"
        role="progressbar"
        aria-label="Renda do mês usada"
        aria-valuenow={pctBarra}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuetext={pct === null ? 'sem renda no mês' : `usou ${pct}% da renda do mês`}
      >
        <div className={clsx('h-full rounded-full', corBarra)} style={{ width: `${pctBarra}%` }} />
      </div>
      <p className="text-[12px] leading-snug text-muted">
        <span data-testid="previsao-fim-mes-conta" className="tabular-nums">
          Renda {v(sobra.renda.total)} − despesas {v(sobra.despesas)} = {resultado}
        </span>
        {pct !== null && !escondido && <span className="tabular-nums"> · usou {pct}%</span>}
      </p>
      {aberto && (
        <div id={painelId} className="space-y-1 rounded-lg bg-card2 p-3 text-[13px]">
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
        </div>
      )}
    </section>
  );
}

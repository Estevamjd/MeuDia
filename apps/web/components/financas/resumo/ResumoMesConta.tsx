'use client';

import { useId, useState } from 'react';
import { clsx } from 'clsx';
import { ChevronDown } from 'lucide-react';
import type { SobraDoMes } from '@meudia/shared';
import { formatBRL, formatBRLSinal, formatDiaMes, nomeMes } from '../../../lib/financas-ui';
import { VALOR_OCULTO } from '../../../lib/carteiras-ui';
import { NumeroAnimado } from '../../ui/NumeroAnimado';
import { situacaoDo, type SituacaoMes } from './montarResumoMes';

const SITUACAO: Record<SituacaoMes, { texto: string; classe: string }> = {
  'no-controle': { texto: 'No controle', classe: 'border-[color-mix(in_oklch,var(--lap-h-positivo)_28%,transparent)] bg-[color-mix(in_oklch,var(--lap-h-positivo)_16%,transparent)] text-[var(--lap-h-positivo)]' },
  atencao: { texto: 'Atenção', classe: 'border-yellow/30 bg-yellow/[0.12] text-yellow' },
  passou: { texto: 'Passou da renda', classe: 'border-red/30 bg-red/[0.14] text-[#fca5a5]' },
};

export interface ResumoMesContaProps {
  sobra: SobraDoMes;
  escondido?: boolean;
}

/** % da renda já comprometida (contas fixas + gastos do mês); `null` sem renda. */
export function pctComprometida(sobra: Pick<SobraDoMes, 'renda' | 'despesas'>): number | null {
  return sobra.renda.total > 0 ? Math.round((sobra.despesas / sobra.renda.total) * 100) : null;
}

/**
 * Início, variante B "conta explícita" (aprovada): Você recebe − Contas fixas − Gastos do mês = Deve sobrar.
 * Contas fixas contam todas (pagas ou não); o "Paguei" não entra de novo em Gastos do mês.
 */
export function ResumoMesConta({ sobra, escondido = false }: ResumoMesContaProps) {
  const [contasAbertas, setContasAbertas] = useState(false);
  const listaId = useId();
  const v = (n: number) => (escondido ? VALOR_OCULTO : formatBRL(n));
  const pct = pctComprometida(sobra);
  const situacao = SITUACAO[situacaoDo(pct, sobra.valor) ?? 'no-controle'];
  const pctBarra = pct === null ? 0 : Math.min(Math.max(pct, 0), 100);
  const pagas = sobra.contasFixas.filter((c) => c.paga).length;
  const aPagar = sobra.contasFixas.length - pagas;
  const mes = nomeMes(sobra.competencia);
  return (
    <section aria-labelledby="resumo-mes" className="lap-heroi px-5 pb-[18px] pt-5" data-testid="resumo-mes-conta">
      <div className="flex min-h-6 items-center justify-between gap-2">
        <h2 id="resumo-mes" className="lap-rotulo lap-texto-3 font-normal tracking-[0.08em]">
          Resumo de {mes}
        </h2>
        {pct !== null && (
          <span className={clsx('inline-flex h-[22px] shrink-0 items-center whitespace-nowrap rounded-full border px-2 text-[11px] font-medium', situacao.classe)}>
            {situacao.texto}
          </span>
        )}
      </div>

      <dl className="mt-3 space-y-0.5 text-[15px]">
        <div className="flex min-h-[36px] items-center justify-between gap-2">
          <dt className="lap-texto-2 flex items-center gap-2">
            Você recebe
            {sobra.previsao && (
              <span data-testid="renda-previsao" className="lap-texto-3 rounded-full border border-white/15 px-1.5 text-[11px] leading-[18px]">
                previsão
              </span>
            )}
          </dt>
          <dd data-testid="resumo-renda" className="whitespace-nowrap font-medium tabular-nums">{v(sobra.renda.total)}</dd>
        </div>

        <div>
          <dt>
            <button
              type="button"
              onClick={() => setContasAbertas((a) => !a)}
              aria-expanded={contasAbertas}
              aria-controls={contasAbertas ? listaId : undefined}
              className="lap-texto-2 -mx-1 flex min-h-[44px] w-[calc(100%+0.5rem)] items-center justify-between gap-2 rounded-lg px-1 text-left"
            >
              <span className="flex items-center gap-1">
                Contas fixas
                <ChevronDown size={16} aria-hidden="true" className={clsx('transition-transform', contasAbertas && 'rotate-180')} />
                <span className="sr-only">{contasAbertas ? '(esconder lista)' : '(ver lista)'}</span>
              </span>
              <span data-testid="resumo-contas-fixas" className="whitespace-nowrap font-medium tabular-nums text-[#f8b4b4]">
                {escondido ? VALOR_OCULTO : `− ${formatBRL(sobra.totalContasFixas)}`}
              </span>
            </button>
          </dt>
          <dd className="lap-texto-3 -mt-1.5 text-[12px]">
            {sobra.contasFixas.length === 0
              ? 'Nenhuma conta fixa cadastrada'
              : `${pagas} paga${pagas === 1 ? '' : 's'} · ${aPagar} a pagar · pagas ou não, já contam aqui`}
          </dd>
          {contasAbertas && (
            <dd>
              <ul id={listaId} aria-label={`Contas fixas de ${mes}`} className="lap-vidro mt-2 divide-y divide-white/10 px-3">
                {sobra.contasFixas.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-2 py-2 text-[13px]">
                    <span className="min-w-0">
                      <span className="block truncate">{c.descricao}</span>
                      <span className="lap-texto-3 text-[11px]">
                        {c.paga && c.pagoEm ? `pago em ${formatDiaMes(c.pagoEm)}` : `vence ${formatDiaMes(c.vencimento)}`}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <span className="tabular-nums">{v(c.valor)}</span>
                      <span
                        className={clsx(
                          'rounded-full border px-1.5 text-[11px] leading-[18px]',
                          c.paga ? 'border-[color-mix(in_oklch,var(--lap-h-positivo)_35%,transparent)] text-[var(--lap-h-positivo)]' : 'border-yellow/40 text-yellow',
                        )}
                      >
                        {c.paga ? 'pago' : 'a pagar'}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </dd>
          )}
        </div>

        <div className="flex min-h-[36px] items-center justify-between gap-2">
          <dt className="lap-texto-2">
            Gastos do mês <span className="lap-texto-3 text-[12px]">(fora as contas)</span>
          </dt>
          <dd data-testid="resumo-gastos" className="whitespace-nowrap font-medium tabular-nums text-[#f8b4b4]">
            {escondido ? VALOR_OCULTO : `− ${formatBRL(sobra.gastosExtras)}`}
          </dd>
        </div>
      </dl>

      <div className="mt-2 flex items-end justify-between gap-2 border-t border-white/10 pt-3">
        <p className="lap-rotulo lap-texto-3 pb-1.5 tracking-[0.08em]">Deve sobrar</p>
        <p
          data-testid="previsao-fim-mes-valor"
          className={clsx(
            'whitespace-nowrap text-[clamp(1.75rem,8vw,2.25rem)] font-light leading-[1.1] tracking-[-0.035em] tabular-nums',
            sobra.valor < 0 && !escondido ? 'text-[#fca5a5]' : 'text-[var(--lap-h-positivo)]',
          )}
        >
          {escondido ? VALOR_OCULTO : <NumeroAnimado valor={sobra.valor} formatar={formatBRLSinal} />}
        </p>
      </div>

      <div
        className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10"
        role="progressbar"
        aria-label="Renda do mês comprometida"
        aria-valuenow={pctBarra}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuetext={pct === null ? 'sem renda no mês' : `${pct}% da renda comprometida`}
      >
        <span className="lap-barra-luz block h-full rounded-full" style={{ width: `${pctBarra}%` }} />
      </div>
      <p className="lap-texto-2 mt-2 text-[13px]" data-testid="resumo-comprometida">
        {pct === null
          ? 'Cadastre sua renda para ver quanto sobra.'
          : `${pct}% da renda já está comprometida · ${v(sobra.despesas)} de ${v(sobra.renda.total)}`}
      </p>
      <p className="lap-texto-2 mt-2 text-[13px]">
        {sobra.previsao
          ? 'A renda ainda é previsão: toque em Recebi quando o salário cair. Gastos baixam a sobra, nunca o Cofrinho.'
          : 'Gastos baixam a sobra, nunca o Cofrinho. No fim do mês, você escolhe se guarda o que sobrou.'}
      </p>
    </section>
  );
}

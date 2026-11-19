'use client';

import { useId, useState } from 'react';
import { clsx } from 'clsx';
import type { SobraDoMes } from '@meudia/shared';
import { ExplicacaoSobra } from '../home/CardPrevisao';
import { formatBRL, formatBRLSinal, formatDiaMes } from '../../../lib/financas-ui';
import { VALOR_OCULTO } from '../../../lib/carteiras-ui';
import type { ResumoMes, SituacaoMes } from './montarResumoMes';

const SITUACAO: Record<SituacaoMes, { texto: string; classe: string }> = {
  'no-controle': { texto: 'No controle', classe: 'border-[color-mix(in_oklch,var(--lap-h-positivo)_28%,transparent)] bg-[color-mix(in_oklch,var(--lap-h-positivo)_16%,transparent)] text-[var(--lap-h-positivo)]' },
  atencao: { texto: 'Atenção', classe: 'border-yellow/30 bg-yellow/[0.12] text-yellow' },
  passou: { texto: 'Passou da renda', classe: 'border-red/30 bg-red/[0.14] text-[#fca5a5]' },
};

export interface HeroiSobraProps {
  resumo: ResumoMes;
  escondido?: boolean;
  /** Relatório: sem barra nem Entrou/Saiu dentro do bloco (vão em cartões separados). */
  compacto?: boolean;
  /** Conta do "No fim do mês sobra" para o "por quê?" (só no mês corrente com banco). */
  sobra?: SobraDoMes | null;
}

/** Bloco principal "Sobra do mês" (material ciano do CRM): valor grande, prevista, barra da renda usada e Entrou/Saiu. */
export function HeroiSobra({ resumo, escondido = false, compacto = false, sobra = null }: HeroiSobraProps) {
  const [aberto, setAberto] = useState(false);
  const painelId = useId();
  const v = (n: number) => (escondido ? VALOR_OCULTO : formatBRL(n));
  const situacao = resumo.situacao ? SITUACAO[resumo.situacao] : null;
  const pctBarra = resumo.pctUsado === null ? 0 : Math.min(Math.max(resumo.pctUsado, 0), 100);
  return (
    <section aria-labelledby="heroi-sobra" className="lap-heroi px-5 pb-[18px] pt-5">
      <div className="flex min-h-6 items-center justify-between gap-2">
        <h2 id="heroi-sobra" className="lap-rotulo lap-texto-3 font-normal tracking-[0.08em]">
          Sobra do mês
        </h2>
        {situacao && (
          <span className={clsx('inline-flex h-[22px] shrink-0 items-center whitespace-nowrap rounded-full border px-2 text-[11px] font-medium', situacao.classe)}>
            {situacao.texto}
          </span>
        )}
      </div>
      <p
        data-testid="sobra-ate-agora-valor"
        className={clsx(
          'mt-2.5 whitespace-nowrap text-[clamp(2rem,9vw,2.5rem)] font-light leading-[1.1] tracking-[-0.035em] tabular-nums',
          resumo.sobra < 0 && !escondido && 'text-[#fca5a5]',
        )}
      >
        {escondido ? VALOR_OCULTO : formatBRLSinal(resumo.sobra)}
      </p>
      {resumo.prevista !== null && (
        <div className="lap-texto-2 mt-2 flex items-start justify-between gap-2 text-[13px] leading-[18px]">
          <p className="min-w-0">
            No fim do mês:{' '}
            <span data-testid="previsao-fim-mes-valor" className="whitespace-nowrap tabular-nums">
              {escondido ? VALOR_OCULTO : formatBRLSinal(resumo.prevista)}
            </span>
            {resumo.proximaConta && (
              <>
                {' · '}
                {resumo.proximaConta.descricao.toLowerCase()} no dia {formatDiaMes(resumo.proximaConta.vencimento).slice(0, 2)}
              </>
            )}
          </p>
          {sobra && (
            <button
              type="button"
              onClick={() => setAberto((a) => !a)}
              aria-expanded={aberto}
              aria-controls={aberto ? painelId : undefined}
              aria-label="por quê? No fim do mês sobra"
              className="-my-3 -mr-1 min-h-[44px] shrink-0 px-1 text-[13px] font-medium text-[var(--lap-h-positivo)] hover:underline"
            >
              por quê?
            </button>
          )}
        </div>
      )}
      {sobra && aberto && <ExplicacaoSobra id={painelId} sobra={sobra} escondido={escondido} />}
      {!compacto && (
        <>
          <div
            className="mt-3.5 h-1.5 overflow-hidden rounded-full bg-white/10"
            role="progressbar"
            aria-label="Renda do mês usada"
            aria-valuenow={pctBarra}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuetext={resumo.pctUsado === null ? 'sem renda no mês' : `usou ${resumo.pctUsado}% da renda do mês`}
          >
            <span className="lap-barra-luz block h-full rounded-full" style={{ width: `${pctBarra}%` }} />
          </div>
          <p className="lap-texto-2 mt-2 text-[13px]">
            {resumo.pctUsado === null
              ? 'Cadastre sua renda para ver quanto já usou.'
              : `Você já usou ${resumo.pctUsado}% da renda · ${v(resumo.saiu)} de ${v(resumo.renda)}`}
          </p>
          <EntrouSaiu resumo={resumo} escondido={escondido} className="mt-3.5" vidro />
        </>
      )}
      {compacto && resumo.pctUsado !== null && <p className="lap-texto-2 mt-2 text-[13px]">Você usou {resumo.pctUsado}% da renda</p>}
    </section>
  );
}

export function EntrouSaiu({ resumo, escondido = false, className, vidro = false }: { resumo: ResumoMes; escondido?: boolean; className?: string; vidro?: boolean }) {
  const celula = vidro ? 'lap-vidro px-3 py-2.5' : 'lap-cartao px-4 py-3.5';
  const rotulo = vidro ? 'lap-texto-3' : 'text-muted';
  return (
    <div className={clsx('grid grid-cols-2 gap-2', className)}>
      <div className={celula}>
        <p className={clsx('lap-rotulo', rotulo)}>Entrou</p>
        <p data-testid="entrou-valor" className="mt-1 whitespace-nowrap text-base font-medium tracking-[-0.02em] text-[var(--lap-h-positivo)] tabular-nums">
          {escondido ? VALOR_OCULTO : formatBRL(resumo.entrou)}
        </p>
        {resumo.aReceber > 0 && (
          <p className={clsx('mt-0.5 whitespace-nowrap text-[11px] tabular-nums', vidro ? 'lap-texto-3' : 'text-muted')}>
            + {escondido ? VALOR_OCULTO : formatBRL(resumo.aReceber)} a receber
          </p>
        )}
      </div>
      <div className={celula}>
        <p className={clsx('lap-rotulo', rotulo)}>Saiu</p>
        <p data-testid="saiu-valor" className="mt-1 whitespace-nowrap text-base font-medium tracking-[-0.02em] text-[#f8b4b4] tabular-nums">
          {escondido ? VALOR_OCULTO : formatBRL(resumo.saiu)}
        </p>
      </div>
    </div>
  );
}

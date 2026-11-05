'use client';

import { progressoCalorias } from '@meudia/shared';
import { Rotulo } from '../caderno';

const fmt = (n: number) => Math.round(n).toLocaleString('pt-BR');

/**
 * Calorias do dia (design-system §4, telas 01 e 09): número grande, "/ meta", % à direita e barra de 3px.
 * Até 100%: --accent3. Acima: barra cheia, --green até a marca de 100% e --green-dark no excedente,
 * "meta cumprida" e "X kcal acima da meta do dia." Nunca vermelho, sem alerta.
 */
export function BarraCalorias({ consumido, meta, itensSemValor = 0 }: { consumido: number; meta: number | null; itensSemValor?: number }) {
  const p = meta ? progressoCalorias(consumido, meta) : null;
  return (
    <div>
      <Rotulo>Calorias</Rotulo>
      <div className="mt-2 flex items-end justify-between gap-3">
        <p className="min-w-0 whitespace-nowrap">
          <span className="font-syne text-[44px] font-bold leading-none tracking-[-1px] text-text tabular-nums">{fmt(consumido)}</span>
          {meta ? (
            <span className="ml-1 text-[15px] text-muted-text tabular-nums">/ {fmt(meta)}</span>
          ) : (
            <span className="ml-1 text-[15px] text-muted-text">kcal</span>
          )}
        </p>
        {p && (
          <div className="shrink-0 text-right">
            <p className={`font-syne text-[20px] font-bold leading-none tabular-nums ${p.cumprida ? 'text-green' : 'text-accent3'}`}>{p.pct}%</p>
            {p.cumprida && <p className="mt-1 text-[13px] text-green">meta cumprida</p>}
          </div>
        )}
      </div>
      <div
        className="mt-3 flex h-[3px] w-full overflow-hidden bg-white/10"
        role="progressbar"
        aria-label="Calorias do dia"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={p ? Math.min(p.pct, 100) : 0}
        aria-valuetext={p ? `${p.pct}% da meta` : 'sem meta'}
      >
        {p && (
          <>
            <span data-barra="ate-meta" className={p.cumprida ? 'bg-green' : 'bg-accent3'} style={{ width: `${p.barraAteMeta * 100}%` }} />
            {p.barraExcedente > 0 && <span data-barra="excedente" className="bg-green-dark" style={{ width: `${p.barraExcedente * 100}%` }} />}
          </>
        )}
      </div>
      {p && p.acimaKcal > 0 && <p className="mt-2 text-[13px] text-muted-text">{fmt(p.acimaKcal)} kcal acima da meta do dia.</p>}
      {!meta && <p className="mt-2 text-[13px] text-muted-text">Sem meta de calorias. Calcule no cadastro de saúde.</p>}
      {itensSemValor > 0 && (
        <p className="mt-2 text-[13px] text-muted-text">
          {itensSemValor === 1 ? '1 item sem valor não entra no total.' : `${itensSemValor} itens sem valor não entram no total.`}
        </p>
      )}
    </div>
  );
}

/**
 * Proteína: preenchimento #9a9ab0 e a faixa da meta marcada em --green a 60% (escala até o topo da faixa).
 * Meta de um número só: marca curta no fim da barra.
 */
export function BarraProteina({ consumido, min, max }: { consumido: number; min: number | null; max: number | null }) {
  const temMeta = min !== null && max !== null && max > 0;
  const topo = temMeta ? (max === min ? max * 1.05 : max) : 0;
  const pctPreenchido = temMeta ? Math.min(1, consumido / topo) : 0;
  const naFaixa = temMeta && consumido >= min! && consumido <= max!;
  const inicioFaixa = temMeta ? (max === min ? min! / topo - 0.01 : min! / topo) : 0;
  const larguraFaixa = temMeta ? (max === min ? 0.02 : (max! - min!) / topo) : 0;
  return (
    <div>
      <Rotulo>Proteína</Rotulo>
      <div className="mt-2 flex items-end justify-between gap-3">
        <p className="min-w-0">
          <span className="font-syne text-[32px] font-bold leading-none text-text tabular-nums">{fmt(consumido)}</span>
          <span className="ml-1 text-[15px] text-muted-text tabular-nums">
            g{temMeta ? (min === max ? ` · meta ${min}` : ` · faixa ${min}–${max}`) : ''}
          </span>
        </p>
        {naFaixa && <p className="shrink-0 text-[13px] text-green">{min === max ? 'na meta' : 'na faixa'}</p>}
      </div>
      <div className="relative mt-3 h-[3px] w-full bg-white/10" aria-hidden="true">
        <span className="absolute inset-y-0 left-0 bg-[#9a9ab0]" style={{ width: `${pctPreenchido * 100}%` }} />
        {temMeta && (
          <span className="absolute inset-y-0 bg-green/60" style={{ left: `${inicioFaixa * 100}%`, width: `${larguraFaixa * 100}%` }} />
        )}
      </div>
    </div>
  );
}

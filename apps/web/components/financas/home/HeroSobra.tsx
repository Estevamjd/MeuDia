import { clsx } from 'clsx';
import type { Selo } from '@meudia/shared';
import { Badge } from '../../ui';
import { formatBRL, formatBRLSinal, SELO_UI } from '../../../lib/financas-ui';

export interface HeroSobraProps {
  sobraReal: number;
  sobraPrevista: number;
  selo: Selo | null;
  gastoReal: number;
  /** Renda que já entrou (ou a prevista, se nada entrou ainda). */
  rendaBase: number;
}

/** Card-herói "Sobra do mês": o número que importa, sobra prevista, selo e uso da renda. */
export function HeroSobra({ sobraReal, sobraPrevista, selo, gastoReal, rendaBase }: HeroSobraProps) {
  const usado = rendaBase > 0 ? gastoReal / rendaBase : null;
  const pctUsado = usado === null ? null : Math.round(usado * 100);
  const pctBarra = pctUsado === null ? 0 : Math.min(Math.max(pctUsado, 0), 100);
  const corBarra = usado === null || usado < 0.7 ? 'bg-green' : usado < 0.9 ? 'bg-orange' : 'bg-red';

  return (
    <section aria-labelledby="hero-sobra" className="space-y-3 rounded-card border border-border bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 id="hero-sobra" className="text-[13px] font-medium text-muted">
          Sobra do mês
        </h2>
        {selo && <Badge color={SELO_UI[selo].color} className="whitespace-nowrap">{selo}</Badge>}
      </div>

      <p
        className={clsx(
          'whitespace-nowrap font-semibold leading-tight tabular-nums',
          sobraReal < 0 ? 'text-red' : 'text-green',
        )}
        style={{ fontSize: 'clamp(1.5rem, 8vw, 2rem)' }}
      >
        {formatBRLSinal(sobraReal)}
      </p>

      <p className="text-[13px] text-muted">
        Prevista: <span className="whitespace-nowrap tabular-nums">{formatBRLSinal(sobraPrevista)}</span>
      </p>

      {pctUsado !== null && (
        <div className="space-y-1.5">
          <div
            className="h-1.5 w-full overflow-hidden rounded-full bg-card2"
            role="progressbar"
            aria-label="Renda usada no mês"
            aria-valuenow={pctBarra}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuetext={`${pctUsado}% da renda usada`}
          >
            <div className={clsx('h-full rounded-full', corBarra)} style={{ width: `${pctBarra}%` }} />
          </div>
          <p className="text-[13px] text-muted">
            Você já usou <span className="tabular-nums">{pctUsado}%</span> da renda
            <span className="sr-only"> ({formatBRL(gastoReal)} de {formatBRL(rendaBase)})</span>
          </p>
        </div>
      )}
    </section>
  );
}

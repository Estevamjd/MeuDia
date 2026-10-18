import { clsx } from 'clsx';
import { PiggyBank, Trash2 } from 'lucide-react';
import type { Meta, SugestaoMeta } from '@meudia/shared';
import { rotuloMesAno } from '@meudia/shared';
import { Button } from '../../ui';
import { formatBRL } from '../../../lib/financas-ui';
import { IconeMeta } from './IconeMeta';

export interface MetaCardProps {
  meta: Meta;
  /** `null` enquanto a sobra do mês carrega. */
  sugestao: SugestaoMeta | null;
  onGuardei: (meta: Meta) => void;
  onExcluir: (meta: Meta) => void;
}

/** Meta: ícone, nome, barra guardado/alvo, prazo e a sugestão pela sobra do mês. */
export function MetaCard({ meta, sugestao, onGuardei, onExcluir }: MetaCardProps) {
  const alvo = Number(meta.valor_alvo);
  const guardado = Number(meta.valor_guardado);
  // Em centavos inteiros: (570 / 1000) * 100 dá 56,999… em ponto flutuante.
  const alvoCentavos = Math.round(alvo * 100);
  const guardadoCentavos = Math.round(guardado * 100);
  const pct = alvoCentavos > 0 ? Math.min(100, Math.floor((guardadoCentavos * 100) / alvoCentavos)) : 100;
  const concluida = guardadoCentavos >= alvoCentavos;
  const faltaCentavos = alvoCentavos - guardadoCentavos;
  const alerta = sugestao && ['nao_cabe', 'sem_sobra', 'prazo_curto', 'prazo_passou'].includes(sugestao.tipo);
  return (
    <li className="space-y-3 rounded-card border border-border bg-card p-4" aria-label={meta.nome}>
      <div className="flex items-center gap-3">
        <IconeMeta icone={meta.icone} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold text-text">{meta.nome}</p>
          <p className="text-[13px] tabular-nums text-muted">
            Guardado {formatBRL(guardado)} de {formatBRL(alvo)} · {pct}%
          </p>
          {meta.data_limite && <p className="text-[13px] text-muted">· até {rotuloMesAno(meta.data_limite.slice(0, 7))}</p>}
        </div>
        <Button variant="icon" className="min-h-[44px] min-w-[44px]" onClick={() => onExcluir(meta)} aria-label={`Excluir meta ${meta.nome}`}>
          <Trash2 size={16} />
        </Button>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-card2">
        <div
          role="progressbar"
          aria-label={`Progresso de ${meta.nome}`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
          className={clsx('h-full rounded-full transition-all', pct >= 100 ? 'bg-green' : 'bg-accent')}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className={clsx('text-[13px]', concluida ? 'text-green' : 'text-muted')}>
        {concluida ? 'Meta alcançada 🎉' : `Faltam ${formatBRL(faltaCentavos / 100)}`}
      </p>
      {!concluida && sugestao && (
        <div data-testid={`sugestao-${meta.id}`} className={clsx('space-y-1 rounded-lg p-3 text-[13px]', alerta ? 'bg-orange/10' : 'bg-card2')}>
          <p className={clsx('font-medium', sugestao.tipo === 'alcancada' ? 'text-green' : 'text-text')}>{sugestao.texto}</p>
          {sugestao.detalhes.map((d) => (
            <p key={d} className="text-muted">{d}</p>
          ))}
        </div>
      )}
      <Button variant="ghost" className="min-h-[44px] w-full" onClick={() => onGuardei(meta)} aria-label={`Guardei em ${meta.nome}`}>
        <PiggyBank size={16} aria-hidden="true" /> Guardei
      </Button>
    </li>
  );
}

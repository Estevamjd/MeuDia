import { clsx } from 'clsx';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import type { Transacao } from '@meudia/shared';
import { Button, SkeletonList } from '../../ui';
import { formatBRL, formatDiaMes } from '../../../lib/financas-ui';
import { CategoriaIcone } from '../CategoriaIcone';

/** Quantos lançamentos a home mostra antes de "Ver todos". */
export const LANCAMENTOS_VISIVEIS = 5;

export interface UltimosLancamentosProps {
  /** Lançamentos do mês, mais recentes primeiro. */
  transacoes: Transacao[];
  carregando?: boolean;
  expandido: boolean;
  onAlternarExpandido: () => void;
  onNovo: () => void;
  onEditar: (t: Transacao) => void;
  onExcluir: (t: Transacao) => void;
}

/** "Últimos lançamentos": 5 mais recentes + "Ver todos", com editar/excluir. */
export function UltimosLancamentos({
  transacoes,
  carregando = false,
  expandido,
  onAlternarExpandido,
  onNovo,
  onEditar,
  onExcluir,
}: UltimosLancamentosProps) {
  const visiveis = expandido ? transacoes : transacoes.slice(0, LANCAMENTOS_VISIVEIS);

  return (
    <section aria-labelledby="ultimos-lancamentos" className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 id="ultimos-lancamentos" className="text-[15px] font-semibold text-text">
          Últimos lançamentos
        </h2>
        <Button variant="ghost" onClick={onNovo} className="whitespace-nowrap">
          <Plus size={16} aria-hidden="true" />
          Novo lançamento
        </Button>
      </div>

      {carregando ? (
        <SkeletonList count={3} />
      ) : transacoes.length === 0 ? (
        <p className="rounded-card border border-border bg-card p-4 text-[15px] text-muted">
          Nenhum lançamento neste mês.
        </p>
      ) : (
        <>
          <ul className="space-y-2">
            {visiveis.map((t) => (
              <li key={t.id} className="flex items-center gap-3 rounded-card border border-border bg-card p-3">
                <CategoriaIcone categoria={t.categoria} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-medium text-text" title={t.descricao}>
                    {t.descricao}
                  </p>
                  <p className="truncate text-[13px] text-muted">
                    {t.categoria} · {formatDiaMes(t.data)}
                    {t.banco ? ` · ${t.banco}` : ''}
                  </p>
                </div>
                <span
                  className={clsx(
                    'shrink-0 whitespace-nowrap text-[15px] font-semibold tabular-nums',
                    t.tipo === 'receita' ? 'text-green' : 'text-red',
                  )}
                >
                  {t.tipo === 'receita' ? '+' : '−'}
                  {formatBRL(Number(t.valor))}
                </span>
                <div className="flex shrink-0 items-center">
                  <button
                    type="button"
                    onClick={() => onEditar(t)}
                    className="rounded-lg p-2 text-muted transition-colors hover:bg-card2 hover:text-text"
                    aria-label={`Editar lançamento ${t.descricao}`}
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onExcluir(t)}
                    className="rounded-lg p-2 text-muted transition-colors hover:bg-red/[0.14] hover:text-red"
                    aria-label={`Excluir lançamento ${t.descricao}`}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
          {transacoes.length > LANCAMENTOS_VISIVEIS && (
            <button type="button" onClick={onAlternarExpandido} className="text-sm font-medium text-accent hover:underline">
              {expandido ? 'Mostrar menos' : `Ver todos (${transacoes.length})`}
            </button>
          )}
        </>
      )}
    </section>
  );
}

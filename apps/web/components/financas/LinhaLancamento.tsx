import { clsx } from 'clsx';
import { Pencil, Trash2 } from 'lucide-react';
import type { Transacao } from '@meudia/shared';
import { formatBRL, formatDiaMes } from '../../lib/financas-ui';
import { CategoriaIcone } from './CategoriaIcone';

export type VinculoLancamento = 'recebimento' | 'pagamento';

export interface AcoesLancamento {
  bloqueadas?: boolean;
  onEditar: (t: Transacao) => void;
  onExcluir: (t: Transacao) => void;
}

export interface LinhaLancamentoProps {
  t: Transacao;
  vinculo?: VinculoLancamento;
  /** Lista de Gastos: categoria antes da data. A Início mostra só data e banco. */
  comCategoria?: boolean;
  /** Sem ações = linha só de leitura (Início). Vinculado a Recebi/Paguei não edita; o excluir vira desfazer. */
  acoes?: AcoesLancamento;
}

/** Item de lançamento: ícone da categoria, descrição, data · banco ("Sem banco") e valor. */
export function LinhaLancamento({ t, vinculo, comCategoria = false, acoes }: LinhaLancamentoProps) {
  const banco = t.banco ?? (t.carteira_id ? null : 'Sem banco');
  const detalhe = [comCategoria ? t.categoria : null, formatDiaMes(t.data), banco].filter(Boolean).join(' · ');
  return (
    <li className={clsx('flex gap-3', acoes ? 'min-h-[44px] items-start py-1' : 'min-h-[40px] items-center')}>
      <CategoriaIcone categoria={t.categoria} tamanho="sm" className={acoes ? 'mt-1.5' : undefined} />
      {/* Valor ao lado da descrição e a linha "categoria · data · banco" quebrando em vez de cortar: o banco sempre aparece. */}
      <div className={clsx('min-w-0 flex-1', acoes && 'pt-1')}>
        <div className="flex items-baseline justify-between gap-2">
          <p className="line-clamp-2 min-w-0 break-words text-[15px] font-medium leading-tight text-text" title={t.descricao}>
            {t.descricao}
          </p>
          <span className={clsx('shrink-0 whitespace-nowrap text-[15px] font-semibold tabular-nums', t.tipo === 'receita' ? 'text-green' : 'text-red')}>
            {t.tipo === 'receita' ? '+' : '−'}
            {formatBRL(Number(t.valor))}
          </span>
        </div>
        <p data-meta className="break-words text-[12px] leading-snug text-muted">
          {detalhe}
          {vinculo && (
            <span className="ml-1.5 whitespace-nowrap rounded-full bg-card2 px-2 py-0.5 text-[11px]">{vinculo === 'pagamento' ? 'Paguei' : 'Recebi'}</span>
          )}
        </p>
      </div>
      {acoes && (
        <div className="-mr-2 flex shrink-0 items-center">
          {!vinculo && (
            <button
              type="button"
              disabled={acoes.bloqueadas}
              onClick={() => acoes.onEditar(t)}
              className="flex h-11 w-11 items-center justify-center rounded-lg text-muted transition-colors hover:bg-card2 hover:text-text"
              aria-label={`Editar lançamento ${t.descricao}`}
            >
              <Pencil size={14} />
            </button>
          )}
          <button
            type="button"
            disabled={acoes.bloqueadas}
            onClick={() => acoes.onExcluir(t)}
            className="flex h-11 w-11 items-center justify-center rounded-lg text-muted transition-colors hover:bg-red/[0.14] hover:text-red"
            aria-label={`Excluir lançamento ${t.descricao}`}
          >
            <Trash2 size={14} />
          </button>
        </div>
      )}
    </li>
  );
}

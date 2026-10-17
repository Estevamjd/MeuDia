'use client';

import { radioTeclado } from './radioTeclado';
import { clsx } from 'clsx';
import { CATEGORIAS_GASTO, categoriaInfo } from '@meudia/shared';
import { CategoriaIcone } from './CategoriaIcone';

interface SeletorCategoriaProps {
  value: string;
  onChange: (categoria: string) => void;
  /** Rótulo do grupo (nome acessível do radiogroup). */
  label?: string;
  id?: string;
}

/**
 * Grade de categorias com ícone (radiogroup). Categoria legada fora do mapa continua
 * selecionável: aparece como primeiro item, com o ícone de "Outros".
 */
export function SeletorCategoria({ value, onChange, label = 'Categoria', id = 'seletor-categoria' }: SeletorCategoriaProps) {
  const conhecidas = CATEGORIAS_GASTO.map((c) => c.nome);
  const legada = value && !conhecidas.includes(value) && categoriaInfo(value).nome === 'Outros' ? [value] : [];
  const valorAtual = value && !legada.length ? categoriaInfo(value).nome : value;
  const opcoes = [...legada, ...conhecidas];

  return (
    <div className="flex flex-col gap-1.5">
      <span id={`${id}-label`} className="text-sm font-medium text-muted">
        {label}
      </span>
      <div
        role="radiogroup"
        aria-labelledby={`${id}-label`}
        className="grid max-h-64 grid-cols-4 gap-2 overflow-y-auto overscroll-contain rounded-lg p-0.5"
      >
        {opcoes.map((nome) => {
          const ativo = valorAtual === nome;
          return (
            <button
              key={nome}
              type="button"
              role="radio"
              aria-checked={ativo}
              tabIndex={nome === (opcoes.includes(valorAtual) ? valorAtual : opcoes[0]) ? 0 : -1}
              onKeyDown={(e) => radioTeclado(e, (i) => onChange(opcoes[i]!))}
              onClick={() => onChange(nome)}
              className={clsx(
                'flex min-h-[64px] min-w-0 flex-col items-center justify-center gap-1 rounded-xl border px-1 py-2 text-[11px] leading-tight transition-colors',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent',
                ativo ? 'border-accent bg-accent/15 text-text' : 'border-border bg-card2 text-muted hover:border-accent/40',
              )}
            >
              <CategoriaIcone categoria={nome} tamanho="sm" />
              <span className="w-full truncate text-center">{nome}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

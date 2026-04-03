'use client';

import { useState } from 'react';
import { clsx } from 'clsx';
import { CheckSquare, Plus, Minus, Pencil, Trash2 } from 'lucide-react';
import type { Habito, RegistroHabito } from '@meudia/shared';

import { Card, Badge, Button } from '../ui';

interface HabitoCardProps {
  habito: Habito;
  registro: RegistroHabito | undefined;
  onToggle: (habitoId: string, concluido: boolean, valor: number) => void;
  onEdit: (habito: Habito) => void;
  onDelete: (habito: Habito) => void;
}

export function HabitoCard({
  habito,
  registro,
  onToggle,
  onEdit,
  onDelete,
}: HabitoCardProps) {
  const concluido = registro?.concluido ?? false;
  const valorAtual = registro?.valor ?? 0;
  const temMeta = habito.meta > 1;
  const [animating, setAnimating] = useState(false);

  function handleToggle() {
    if (temMeta) {
      // For meta > 1, toggle completes fully or resets
      const novoValor = concluido ? 0 : habito.meta;
      const novoConcluido = !concluido;
      triggerAnimation();
      onToggle(habito.id, novoConcluido, novoValor);
    } else {
      triggerAnimation();
      onToggle(habito.id, !concluido, concluido ? 0 : 1);
    }
  }

  function handleIncrement() {
    const novoValor = Math.min(valorAtual + 1, habito.meta);
    const novoConcluido = novoValor >= habito.meta;
    if (novoConcluido) triggerAnimation();
    onToggle(habito.id, novoConcluido, novoValor);
  }

  function handleDecrement() {
    const novoValor = Math.max(valorAtual - 1, 0);
    const novoConcluido = novoValor >= habito.meta;
    onToggle(habito.id, novoConcluido, novoValor);
  }

  function triggerAnimation() {
    setAnimating(true);
    setTimeout(() => setAnimating(false), 300);
  }

  const frequenciaLabel = habito.frequencia === 'diario' ? 'Diário' : 'Semanal';
  const metaLabel = temMeta
    ? `${habito.meta}x/dia`
    : frequenciaLabel;

  return (
    <Card
      variant={concluido ? 'green' : 'default'}
      className={clsx(
        'group relative transition-all duration-200',
        animating && 'scale-[1.02]',
      )}
    >
      <div className="flex items-center gap-4">
        {/* Left: icon + name */}
        <div className="flex flex-1 items-center gap-3 overflow-hidden">
          <span
            className={clsx(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg transition-colors',
              concluido ? 'bg-green/20' : 'bg-card2',
            )}
          >
            {habito.icone || '✅'}
          </span>
          <div className="min-w-0 flex-1">
            <p
              className={clsx(
                'truncate font-dm text-sm font-medium transition-all',
                concluido ? 'text-muted line-through' : 'text-text',
              )}
            >
              {habito.nome}
            </p>
            <Badge
              color={concluido ? 'green' : 'purple'}
              className="mt-1"
            >
              {metaLabel}
            </Badge>
          </div>
        </div>

        {/* Right: valor counter or toggle */}
        <div className="flex items-center gap-2">
          {temMeta ? (
            <div className="flex items-center gap-1.5">
              <Button
                variant="icon"
                onClick={handleDecrement}
                disabled={valorAtual <= 0}
                aria-label="Diminuir valor"
                className="h-8 w-8"
              >
                <Minus size={14} />
              </Button>
              <span
                className={clsx(
                  'min-w-[2.5rem] text-center font-syne text-sm font-bold',
                  concluido ? 'text-green' : 'text-text',
                )}
              >
                {valorAtual}/{habito.meta}
              </span>
              <Button
                variant="icon"
                onClick={handleIncrement}
                disabled={valorAtual >= habito.meta}
                aria-label="Aumentar valor"
                className="h-8 w-8"
              >
                <Plus size={14} />
              </Button>
            </div>
          ) : (
            <button
              onClick={handleToggle}
              className={clsx(
                'flex h-8 w-8 items-center justify-center rounded-lg border transition-all duration-200',
                concluido
                  ? 'border-green bg-green/20 text-green'
                  : 'border-border bg-card2 text-muted hover:border-accent hover:text-accent',
              )}
              aria-label={concluido ? 'Desmarcar hábito' : 'Marcar hábito como concluído'}
            >
              {concluido && <CheckSquare size={16} />}
            </button>
          )}
        </div>

        {/* Edit/delete icons (hover) */}
        <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
          <Button
            variant="icon"
            onClick={() => onEdit(habito)}
            aria-label="Editar hábito"
            className="h-7 w-7"
          >
            <Pencil size={14} />
          </Button>
          <Button
            variant="icon"
            onClick={() => onDelete(habito)}
            aria-label="Excluir hábito"
            className="h-7 w-7 text-red hover:text-red"
          >
            <Trash2 size={14} />
          </Button>
        </div>
      </div>
    </Card>
  );
}

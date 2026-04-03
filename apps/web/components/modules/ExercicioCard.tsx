'use client';

import { useState, useCallback, useMemo } from 'react';
import { clsx } from 'clsx';
import { ChevronDown, ChevronUp, Pencil, Trash2, Check } from 'lucide-react';
import type { Exercicio, SerieRealizada } from '@meudia/shared';
import { analisarCarga } from '@meudia/ai';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Input } from '../ui/Input';
import { ProgressBar } from '../ui/ProgressBar';
import { CargaSugestao } from '../agent/CargaSugestao';
import { useHistoricoExercicio } from '../../hooks';

interface ExercicioCardProps {
  exercicio: Exercicio;
  sessaoId: string | null;
  series: SerieRealizada[];
  onEdit: () => void;
  onDelete: () => void;
  onSerieComplete: (data: {
    exercicio_id: string;
    numero_serie: number;
    carga_usada: number | null;
    reps_feitas: number | null;
    concluido: boolean;
    id?: string;
  }) => void;
}

interface SerieLocal {
  numero: number;
  carga: number | null;
  reps: number | null;
  concluido: boolean;
  id?: string;
}

export function ExercicioCard({
  exercicio,
  sessaoId,
  series,
  onEdit,
  onDelete,
  onSerieComplete,
}: ExercicioCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [sugestaoIgnorada, setSugestaoIgnorada] = useState(false);
  const [cargaOverride, setCargaOverride] = useState<number | null>(null);

  // Análise inteligente de carga baseada no histórico
  const { data: historico } = useHistoricoExercicio(sessaoId ? exercicio.id : undefined);
  const sugestaoCarga = useMemo(() => {
    if (!historico || historico.length < 2 || sugestaoIgnorada) return null;
    // repeticoes pode ser "8-12" ou "10" — extraímos o primeiro número como meta
    const repsMeta = parseInt(exercicio.repeticoes, 10) || 10;
    const historicoFormatado = historico.map((s) => ({
      carga_usada: s.carga_usada,
      reps_feitas: s.reps_feitas,
      repeticoes_meta: repsMeta,
      concluido: s.concluido,
    }));
    const resultado = analisarCarga(historicoFormatado, exercicio.carga ?? 0);
    if (resultado.sugestao === 'MANTER') return null;
    return resultado;
  }, [historico, exercicio.carga, exercicio.repeticoes, sugestaoIgnorada]);

  const cargaEfetiva = cargaOverride ?? exercicio.carga;

  const buildSeriesLocal = useCallback((): SerieLocal[] => {
    return Array.from({ length: exercicio.series }, (_, i) => {
      const serieNum = i + 1;
      const existing = series.find(
        (s) => s.exercicio_id === exercicio.id && s.numero_serie === serieNum,
      );
      return {
        numero: serieNum,
        carga: existing?.carga_usada ?? cargaEfetiva,
        reps: existing?.reps_feitas ?? null,
        concluido: existing?.concluido ?? false,
        id: existing?.id,
      };
    });
  }, [exercicio, series, cargaEfetiva]);

  const seriesLocal = buildSeriesLocal();
  const seriesConcluidas = seriesLocal.filter((s) => s.concluido).length;

  const handleToggleSerie = (
    serie: SerieLocal,
    carga: number | null,
    reps: number | null,
  ) => {
    const novoConcluido = !serie.concluido;
    onSerieComplete({
      exercicio_id: exercicio.id,
      numero_serie: serie.numero,
      carga_usada: carga,
      reps_feitas: reps,
      concluido: novoConcluido,
      id: serie.id,
    });
  };

  return (
    <Card className="group overflow-hidden p-0">
      {/* Header */}
      <button
        className="flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-card2/50"
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-text truncate">{exercicio.nome}</span>
            <Badge color="orange">
              {exercicio.series}x{exercicio.repeticoes}
            </Badge>
            {(cargaEfetiva != null && cargaEfetiva > 0) && (
              <Badge color={cargaOverride ? 'purple' : 'teal'}>
                {cargaEfetiva}kg{cargaOverride ? ' ✨' : ''}
              </Badge>
            )}
          </div>
          {sessaoId && (
            <ProgressBar
              value={seriesConcluidas}
              max={exercicio.series}
              color={seriesConcluidas === exercicio.series ? 'green' : 'orange'}
              className="mt-2"
            />
          )}
        </div>

        {/* Action icons - visible on hover */}
        <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            className="rounded-lg p-1.5 text-muted transition-colors hover:bg-card2 hover:text-text"
            aria-label="Editar exercicio"
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="rounded-lg p-1.5 text-muted transition-colors hover:bg-red/10 hover:text-red"
            aria-label="Excluir exercicio"
          >
            <Trash2 size={14} />
          </button>
        </div>

        <span className="text-muted">
          {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </span>
      </button>

      {/* Expanded body */}
      {expanded && (
        <div className="animate-fadeSlide border-t border-border px-5 py-4">
          {/* Sugestão inteligente de carga */}
          {sessaoId && sugestaoCarga && (
            <CargaSugestao
              sugestao={sugestaoCarga}
              onAceitar={(novaCarga) => setCargaOverride(novaCarga)}
              onIgnorar={() => setSugestaoIgnorada(true)}
              className="mb-3"
            />
          )}

          {!sessaoId ? (
            <p className="text-sm text-muted">
              Inicie um treino para registrar suas series.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {seriesLocal.map((serie) => (
                <SerieCard
                  key={serie.numero}
                  serie={serie}
                  defaultCarga={exercicio.carga}
                  onToggle={handleToggleSerie}
                />
              ))}
            </div>
          )}

          {exercicio.observacao && (
            <p className="mt-3 text-xs text-muted italic">{exercicio.observacao}</p>
          )}
        </div>
      )}
    </Card>
  );
}

// --- Serie Card ---

interface SerieCardProps {
  serie: SerieLocal;
  defaultCarga: number | null;
  onToggle: (serie: SerieLocal, carga: number | null, reps: number | null) => void;
}

function SerieCard({ serie, defaultCarga, onToggle }: SerieCardProps) {
  const [carga, setCarga] = useState<string>(
    serie.carga?.toString() ?? defaultCarga?.toString() ?? '',
  );
  const [reps, setReps] = useState<string>(serie.reps?.toString() ?? '');

  const handleToggle = () => {
    onToggle(
      serie,
      carga ? parseFloat(carga) : null,
      reps ? parseInt(reps, 10) : null,
    );
  };

  return (
    <div
      className={clsx(
        'flex items-center gap-3 rounded-lg border p-3 transition-all duration-200',
        serie.concluido
          ? 'border-green/40 bg-green/[0.06]'
          : 'border-border bg-card2/50',
      )}
    >
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-card2 text-xs font-bold text-muted">
        {serie.numero}
      </span>

      <div className="flex flex-1 items-center gap-2">
        <Input
          type="number"
          step="0.5"
          min="0"
          placeholder="kg"
          value={carga}
          onChange={(e) => setCarga(e.target.value)}
          className="!py-1.5 !px-2 text-center !text-xs w-16"
          disabled={serie.concluido}
          aria-label={`Carga serie ${serie.numero}`}
        />
        <Input
          type="number"
          min="0"
          placeholder="reps"
          value={reps}
          onChange={(e) => setReps(e.target.value)}
          className="!py-1.5 !px-2 text-center !text-xs w-16"
          disabled={serie.concluido}
          aria-label={`Reps serie ${serie.numero}`}
        />
      </div>

      <button
        onClick={handleToggle}
        className={clsx(
          'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition-all duration-200',
          serie.concluido
            ? 'border-green bg-green text-white'
            : 'border-border text-muted hover:border-green hover:text-green',
        )}
        aria-label={serie.concluido ? 'Desmarcar serie' : 'Marcar serie como concluida'}
      >
        <Check size={14} />
      </button>
    </div>
  );
}

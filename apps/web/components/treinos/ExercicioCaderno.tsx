'use client';

import { useState, type ReactNode } from 'react';
import { clsx } from 'clsx';
import type { Exercicio, SerieRealizada } from '@meudia/shared';
import { formatarPrescricao, formatarSerieAnterior, resumoUltimaVez } from '@meudia/shared';

export interface MarcarSerie {
  exercicio_id: string;
  numero_serie: number;
  carga_usada: number | null;
  reps_feitas: number | null;
  concluido: boolean;
  id?: string;
}

interface ExercicioCadernoProps {
  exercicio: Exercicio;
  posicao: number;
  total: number;
  /** Séries da última vez (coluna ANTERIOR). Vazio/undefined = exercício novo, "—". */
  anteriores: SerieRealizada[] | undefined;
  /** Séries já gravadas na sessão em andamento. */
  feitas: SerieRealizada[];
  aberto: boolean;
  onAlternar: () => void;
  onMarcar: (serie: MarcarSerie) => void;
  onEditar: () => void;
  onExcluir: () => void;
}

const doisDigitos = (n: number) => String(n).padStart(2, '0');
const lerNumero = (texto: string): number | null => {
  const t = texto.trim().replace(',', '.');
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : null;
};
const paraTexto = (n: number | null | undefined) =>
  n === null || n === undefined ? '' : n.toLocaleString('pt-BR', { maximumFractionDigits: 2, useGrouping: false });

/** Seção de um exercício: número, nome, prescrição e a tabela SÉRIE · ANTERIOR · KG · REPS · ✓. */
export function ExercicioCaderno({
  exercicio,
  posicao,
  total,
  anteriores,
  feitas,
  aberto,
  onAlternar,
  onMarcar,
  onEditar,
  onExcluir,
}: ExercicioCadernoProps) {
  const [extras, setExtras] = useState(0);
  // Só o que a pessoa digitou ou copiou; o resto vem da série gravada ou da carga planejada.
  const [digitado, setDigitado] = useState<Record<number, { kg?: string; reps?: string }>>({});

  const faixa = { min: exercicio.repeticoes_min, max: exercicio.repeticoes_max };
  const maiorFeita = feitas.reduce((m, s) => Math.max(m, s.numero_serie), 0);
  const linhas = Math.max(exercicio.series, maiorFeita) + extras;
  const resumo = resumoUltimaVez(anteriores);
  const idTabela = `series-${exercicio.id}`;

  const valores = (n: number) => {
    const feita = feitas.find((s) => s.numero_serie === n);
    const d = digitado[n] ?? {};
    return {
      feita,
      kg: d.kg ?? (feita ? paraTexto(feita.carga_usada) : paraTexto(exercicio.carga)),
      reps: d.reps ?? (feita ? paraTexto(feita.reps_feitas) : ''),
    };
  };

  const digitar = (n: number, campo: 'kg' | 'reps', valor: string) =>
    setDigitado((atual) => ({ ...atual, [n]: { ...atual[n], [campo]: valor } }));

  return (
    <section className="border-b border-white/[0.07] px-5 py-[18px]" aria-labelledby={`nome-${exercicio.id}`}>
      <div className="flex items-start justify-between gap-3">
        <button
          type="button"
          onClick={onAlternar}
          aria-expanded={aberto}
          aria-controls={idTabela}
          className="min-h-11 min-w-0 flex-1 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent3"
        >
          <span className="block text-[10.5px] uppercase tracking-[1.6px] text-muted-text tabular-nums">
            {doisDigitos(posicao)} / {doisDigitos(total)}
          </span>
          <span id={`nome-${exercicio.id}`} className="mt-1 block font-syne text-[22px] font-bold leading-tight text-text">
            {exercicio.nome}
          </span>
        </button>
        <div className="flex shrink-0 flex-col items-end gap-1 pt-6">
          <span className="rounded-sm border border-accent3/50 px-2 py-0.5 text-[12px] tracking-[1px] text-accent3 tabular-nums">
            {formatarPrescricao(exercicio.series, faixa)}
          </span>
          {!aberto && resumo && <span className="text-[13px] text-muted-text tabular-nums">{resumo}</span>}
        </div>
      </div>

      {aberto && (
        <div id={idTabela} className="mt-3">
          <table className="w-full table-fixed border-collapse text-[15px] tabular-nums">
            <caption className="sr-only">Séries de {exercicio.nome}</caption>
            <colgroup>
              <col className="w-[52px]" />
              <col />
              <col className="w-[72px]" />
              <col className="w-[60px]" />
              <col className="w-[44px]" />
            </colgroup>
            <thead>
              <tr className="border-b border-white/[0.14] text-left text-[10px] uppercase tracking-[1.4px] text-muted-text">
                <th scope="col" className="pb-2 font-normal">Série</th>
                <th scope="col" className="pb-2 font-normal">Anterior</th>
                <th scope="col" className="pb-2 font-normal">Kg</th>
                <th scope="col" className="pb-2 font-normal">Reps</th>
                <th scope="col" className="pb-2 text-center font-normal">
                  <span aria-hidden="true">✓</span>
                  <span className="sr-only">Feita</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: linhas }, (_, i) => i + 1).map((n) => {
                const { feita, kg, reps } = valores(n);
                const anterior = anteriores?.find((s) => s.numero_serie === n);
                const textoAnterior = formatarSerieAnterior(anterior);
                const concluida = !!feita?.concluido;
                return (
                  <tr key={n} className="border-b border-white/[0.07]">
                    <th scope="row" className="py-1 text-left font-syne font-bold text-text">{n}</th>
                    <td className="py-1">
                      {anterior ? (
                        <button
                          type="button"
                          onClick={() =>
                            setDigitado((atual) => ({
                              ...atual,
                              [n]: { kg: paraTexto(anterior.carga_usada), reps: paraTexto(anterior.reps_feitas) },
                            }))
                          }
                          aria-label={`Copiar série anterior ${n}: ${textoAnterior}`}
                          className="min-h-11 text-left text-muted-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent3"
                        >
                          {textoAnterior}
                        </button>
                      ) : (
                        <span className="text-muted-text" aria-label="Sem registro anterior">—</span>
                      )}
                    </td>
                    <td className="py-1 pr-2">
                      <input
                        type="text"
                        inputMode="decimal"
                        aria-label={`Kg da série ${n}`}
                        value={kg}
                        placeholder="—"
                        onChange={(e) => digitar(n, 'kg', e.target.value)}
                        className="h-11 w-full border-b border-white/25 bg-transparent font-bold text-text placeholder:text-muted-text focus:border-accent3 focus:outline-none"
                      />
                    </td>
                    <td className="py-1 pr-2">
                      <input
                        type="text"
                        inputMode="numeric"
                        aria-label={`Repetições da série ${n}`}
                        value={reps}
                        placeholder="—"
                        onChange={(e) => digitar(n, 'reps', e.target.value)}
                        className="h-11 w-full border-b border-white/25 bg-transparent font-bold text-text placeholder:text-muted-text focus:border-accent3 focus:outline-none"
                      />
                    </td>
                    <td className="py-1 text-center">
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={concluida}
                        aria-label={`Série ${n} feita`}
                        onClick={() =>
                          onMarcar({
                            exercicio_id: exercicio.id,
                            numero_serie: n,
                            carga_usada: lerNumero(kg),
                            reps_feitas: lerNumero(reps),
                            concluido: !concluida,
                            id: feita?.id,
                          })
                        }
                        className="inline-flex h-11 w-11 items-center justify-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent3"
                      >
                        <span
                          aria-hidden="true"
                          className={clsx(
                            'flex h-5 w-5 items-center justify-center rounded-[3px] text-[13px] font-bold',
                            concluida ? 'bg-accent3 text-[#04201a]' : 'border-[1.5px] border-muted',
                          )}
                        >
                          {concluida ? '✓' : ''}
                        </span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="mt-1 flex flex-wrap items-center gap-x-5">
            <LinkAcao onClick={() => setExtras((e) => e + 1)}>+ série</LinkAcao>
            <LinkAcao onClick={onEditar}>editar</LinkAcao>
            <LinkAcao onClick={onExcluir}>excluir</LinkAcao>
          </div>
          {exercicio.observacao && <p className="mt-1 text-[13px] text-muted-text">{exercicio.observacao}</p>}
        </div>
      )}
    </section>
  );
}

export function LinkAcao({ onClick, children, disabled }: { onClick: () => void; children: ReactNode; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="min-h-11 text-[14px] font-bold text-accent3 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent3"
    >
      {children}
    </button>
  );
}

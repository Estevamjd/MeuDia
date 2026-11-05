'use client';

import { clsx } from 'clsx';

export interface DiaSeletor {
  /** 0 = domingo … 6 = sábado (igual a `treinos.dia_semana`). */
  diaSemana: number;
  letra: string;
  nome: string;
  /** Dia de recuperação: aparece riscado. */
  descanso: boolean;
  treino: string | null;
}

interface SeletorDiasProps {
  dias: DiaSeletor[];
  selecionado: number;
  hoje: number;
  onSelecionar: (diaSemana: number) => void;
}

/** S T Q Q S S D (segunda primeiro). Dia ativo cheio na cor do módulo; recuperação riscada. */
export function SeletorDias({ dias, selecionado, hoje, onSelecionar }: SeletorDiasProps) {
  return (
    <div role="group" aria-label="Dia da semana" className="grid grid-cols-7 gap-1">
      {dias.map((dia) => {
        const ativo = dia.diaSemana === selecionado;
        const rotulo = [dia.nome, dia.diaSemana === hoje ? 'hoje' : null, dia.descanso ? 'recuperação' : dia.treino]
          .filter(Boolean)
          .join(', ');
        return (
          <button
            key={dia.diaSemana}
            type="button"
            aria-pressed={ativo}
            aria-label={rotulo}
            onClick={() => onSelecionar(dia.diaSemana)}
            className={clsx(
              'relative flex h-11 items-center justify-center rounded font-syne text-[15px] font-bold',
              'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent3',
              ativo ? 'bg-accent3 text-[#04201a]' : dia.descanso ? 'text-muted-text line-through' : 'text-text',
            )}
          >
            {dia.letra}
            {!ativo && dia.diaSemana === hoje && (
              <span aria-hidden="true" className="absolute bottom-1 h-1 w-1 rounded-full bg-accent3" />
            )}
          </button>
        );
      })}
    </div>
  );
}

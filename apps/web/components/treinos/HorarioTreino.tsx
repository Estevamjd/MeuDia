'use client';

import { useState } from 'react';

interface HorarioTreinoProps {
  /** "HH:MM" ou null (sem hora no plano). */
  horario: string | null | undefined;
  salvando: boolean;
  onSalvar: (horario: string | null) => void;
}

/** Hora planejada do treino do dia. O lembrete do WhatsApp usa essa hora (sai 1h antes). Salva ao sair do campo. */
export function HorarioTreino({ horario, salvando, onSalvar }: HorarioTreinoProps) {
  const atual = horario ?? '';
  const [valor, setValor] = useState(atual);
  const [base, setBase] = useState(atual);
  if (base !== atual) {
    setBase(atual);
    setValor(atual);
  }

  const salvar = () => {
    if (valor === atual) return;
    onSalvar(valor === '' ? null : valor);
  };

  return (
    <section className="border-b border-white/[0.07] px-5 py-[18px]">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <label htmlFor="horario-treino" className="text-[14.5px] font-medium text-text">
            Horário do treino
          </label>
          <p className="mt-0.5 text-[13px] text-muted-text">
            {atual ? 'O lembrete no WhatsApp chega 1h antes.' : 'Sem hora definida. Defina para o lembrete chegar 1h antes.'}
          </p>
        </div>
        <input
          id="horario-treino"
          type="time"
          step={60}
          value={valor}
          disabled={salvando}
          onChange={(e) => setValor(e.target.value)}
          onBlur={salvar}
          onKeyDown={(e) => {
            if (e.key === 'Enter') salvar();
          }}
          className="h-11 shrink-0 rounded-md border border-white/[0.12] bg-transparent px-3 font-syne text-[15px] text-text tabular-nums disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent3"
        />
      </div>
    </section>
  );
}

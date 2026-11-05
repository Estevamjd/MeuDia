'use client';

import { clsx } from 'clsx';

interface LembreteTreinoProps {
  /** false por padrão; null = a coluna ainda não existe no banco (migration 008 não aplicada). */
  ligado: boolean | null | undefined;
  salvando: boolean;
  onAlterar: (ligado: boolean) => void;
}

/** Interruptor do lembrete de treino. Desligado por padrão (BRIEF §5: lembrete só quando a pessoa ativa). */
export function LembreteTreino({ ligado, salvando, onAlterar }: LembreteTreinoProps) {
  const indisponivel = ligado === null;
  const marcado = ligado === true;
  return (
    <section className="border-b border-white/[0.07] px-5 py-[18px]" aria-labelledby="lembrete-treino-titulo">
      <p className="text-[10.5px] uppercase tracking-[1.6px] text-muted-text">Lembrete</p>
      <div className="mt-2 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p id="lembrete-treino-titulo" className="text-[14.5px] font-medium text-text">Lembrete de treino</p>
          <p className="mt-0.5 text-[13px] text-muted-text">
            {indisponivel
              ? 'Disponível depois da próxima atualização do app.'
              : 'Guarda sua escolha. O envio da notificação chega numa próxima versão.'}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={marcado}
          aria-labelledby="lembrete-treino-titulo"
          disabled={indisponivel || salvando || ligado === undefined}
          onClick={() => onAlterar(!marcado)}
          className="inline-flex h-11 w-14 shrink-0 items-center justify-center disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent3"
        >
          <span
            aria-hidden="true"
            className={clsx(
              'relative block h-6 w-11 rounded-full border',
              marcado ? 'border-accent3 bg-accent3' : 'border-muted bg-transparent',
            )}
          >
            <span
              className={clsx(
                'absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full',
                marcado ? 'right-[3px] bg-[#04201a]' : 'left-[3px] bg-muted-text',
              )}
            />
          </span>
        </button>
      </div>
    </section>
  );
}

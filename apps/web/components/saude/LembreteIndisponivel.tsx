'use client';

import { Rotulo } from '../caderno';

/**
 * Interruptor de lembrete que ainda não tem onde gravar (refeição/suplemento: `notif_refeicao`/`notif_suplemento`
 * vêm na 008, que não está aplicada, e o envio não existe). Fica desligado e desabilitado, com o motivo escrito.
 */
export function LembreteIndisponivel({ id, titulo }: { id: string; titulo: string }) {
  return (
    <section className="border-b border-white/[0.07] px-5 py-[18px]" aria-labelledby={id}>
      <Rotulo>Lembrete</Rotulo>
      <div className="mt-2 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p id={id} className="text-[14.5px] font-medium text-text">{titulo}</p>
          <p className="mt-0.5 text-[13px] text-muted-text">Desligado. Disponível depois da próxima atualização do app.</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={false}
          aria-labelledby={id}
          disabled
          className="inline-flex h-11 w-14 shrink-0 items-center justify-center disabled:opacity-50"
        >
          <span aria-hidden="true" className="relative block h-6 w-11 rounded-full border border-muted">
            <span className="absolute left-[3px] top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-muted-text" />
          </span>
        </button>
      </div>
    </section>
  );
}

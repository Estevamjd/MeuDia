'use client';

import { useState } from 'react';
import { Bell, X } from 'lucide-react';
import type { EstadoPush } from '../../../lib/push';
import { Button } from '../../ui';

export const AVISO_LEMBRETES_DISPENSADO_KEY = 'meudia:aviso-lembretes-dispensado';

/** Sem push neste aparelho/ambiente (ou ainda verificando) não há o que oferecer. */
const SEM_AVISO: readonly EstadoPush[] = ['ativo', 'carregando', 'nao-suportado', 'nao-configurado'];

export function mostrarAvisoLembretes(temContas: boolean, estado: EstadoPush, dispensado: boolean): boolean {
  return temContas && !dispensado && !SEM_AVISO.includes(estado);
}

export interface AvisoLembretesProps {
  estado: EstadoPush;
  ativando?: boolean;
  onAtivar: () => void;
  onDispensar: () => void;
}

/** Aviso dispensável na home: "Ative os lembretes" + "Como ativar" expansível. */
export function AvisoLembretes({ estado, ativando = false, onAtivar, onDispensar }: AvisoLembretesProps) {
  const [comoAtivarAberto, setComoAtivarAberto] = useState(false);
  // Fora do app instalado (ou com permissão negada) o pedido de permissão não funciona: mostra o passo a passo.
  const podeAtivar = estado === 'inativo';

  return (
    <section aria-labelledby="aviso-lembretes" className="space-y-3 rounded-card border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <Bell size={18} className="mt-0.5 shrink-0 text-accent" aria-hidden="true" />
        <div className="min-w-0 flex-1 space-y-1">
          <h2 id="aviso-lembretes" className="text-[15px] font-semibold text-text">
            Ative os lembretes
          </h2>
          <p className="text-sm text-muted">Receba um aviso no iPhone antes de cada conta vencer.</p>
        </div>
        <button
          type="button"
          onClick={onDispensar}
          aria-label="Dispensar"
          className="-mr-1 -mt-1 shrink-0 rounded-lg p-1 text-muted transition-colors hover:bg-card2 hover:text-text"
        >
          <X size={18} />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 pl-[30px]">
        <Button onClick={podeAtivar ? onAtivar : () => setComoAtivarAberto(true)} isLoading={ativando}>
          Ativar
        </Button>
        <Button
          variant="ghost"
          aria-expanded={comoAtivarAberto}
          aria-controls="aviso-lembretes-como"
          onClick={() => setComoAtivarAberto((v) => !v)}
        >
          Como ativar
        </Button>
      </div>

      {comoAtivarAberto && (
        <div id="aviso-lembretes-como" className="space-y-1 pl-[30px] text-sm text-muted">
          <p>
            No iPhone, abra o MeuDia no Safari, toque em Compartilhar e depois em Adicionar à Tela de Início. Abra o
            app pela Tela de Início e toque em Ativar.
          </p>
          {estado === 'negado' && (
            <p>As notificações estão bloqueadas. Libere em Ajustes → Notificações → MeuDia.</p>
          )}
        </div>
      )}
    </section>
  );
}

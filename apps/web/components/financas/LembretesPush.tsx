'use client';

import { Bell, BellOff, Share, PlusSquare } from 'lucide-react';
import { Button, useToast } from '../ui';
import { usePushLembretes } from '../../hooks';

/** Botão "Ativar lembretes" + estados (ativo/negado/não suportado) e "Como instalar no iPhone". */
export function LembretesPush() {
  const toast = useToast();
  const { estado, ocupado, ativar, desativar } = usePushLembretes();

  const onAtivar = () =>
    ativar().catch(() => toast.error('Não foi possível ativar os lembretes. Tente de novo.'));
  const onDesativar = () =>
    desativar()
      .then(() => toast.info('Lembretes desativados neste aparelho.'))
      .catch(() => toast.error('Não foi possível desativar os lembretes.'));

  return (
    <section aria-labelledby="lembretes-push" className="space-y-3 rounded-card border border-border bg-card p-4">
      <h2 id="lembretes-push" className="flex items-center gap-2 font-syne text-lg font-semibold text-text">
        <Bell size={18} aria-hidden="true" /> Lembretes de vencimento
      </h2>
      <p className="text-sm text-muted">
        Avisos às 9h: 2 dias antes, 1 dia antes e no dia do vencimento. Marcou como paga, os lembretes daquele mês param.
      </p>

      <div aria-live="polite">
        {estado === 'carregando' && <p className="text-sm text-muted">Verificando…</p>}

        {estado === 'requer-instalacao' && <ComoInstalarIphone />}

        {estado === 'nao-suportado' && (
          <p className="text-sm text-muted">Este navegador não suporta notificações push.</p>
        )}

        {estado === 'nao-configurado' && (
          <p className="text-sm text-muted">Os lembretes ainda não estão disponíveis. Tente mais tarde.</p>
        )}

        {estado === 'negado' && (
          <p className="text-sm text-text">
            As notificações estão bloqueadas. Para liberar no iPhone: Ajustes → Notificações → MeuDia → Permitir
            Notificações. No navegador do computador, use o ícone de cadeado ao lado do endereço.
          </p>
        )}

        {estado === 'inativo' && (
          <Button onClick={() => void onAtivar()} isLoading={ocupado}>
            <Bell size={16} aria-hidden="true" /> Ativar lembretes
          </Button>
        )}

        {estado === 'ativo' && (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-green">Lembretes ativados neste aparelho.</p>
            <Button variant="ghost" onClick={() => void onDesativar()} isLoading={ocupado}>
              <BellOff size={16} aria-hidden="true" /> Desativar
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}

/** Push no iOS só funciona com o PWA instalado (16.4+). */
export function ComoInstalarIphone() {
  return (
    <div className="space-y-2 text-sm text-text">
      <p className="font-medium">Como instalar no iPhone</p>
      <ol className="list-decimal space-y-1 pl-5 text-muted">
        <li>
          Abra o MeuDia no Safari e toque em Compartilhar <Share size={14} className="inline" aria-label="(ícone Compartilhar)" />.
        </li>
        <li>
          Escolha “Adicionar à Tela de Início” <PlusSquare size={14} className="inline" aria-label="(ícone Adicionar)" />.
        </li>
        <li>Abra o MeuDia pelo ícone na tela inicial e volte aqui para ativar os lembretes.</li>
      </ol>
      <p className="text-xs text-muted">Requer iOS 16.4 ou superior.</p>
    </div>
  );
}

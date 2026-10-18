'use client';

import { useMemo, useState } from 'react';
import { Plus, Target } from 'lucide-react';
import type { Meta } from '@meudia/shared';
import { hojeSP, sugestaoMeta } from '@meudia/shared';
import { useAtualizarMeta, useCriarMeta, useExcluirMeta, useGuardarNaMeta, useMetas, useSobraDoMesCorrente } from '../../../../hooks';
import { Button, EmptyState, Modal, SkeletonList, useToast } from '../../../../components/ui';
import { ConfirmarExclusao } from '../../../../components/financas/ConfirmarExclusao';
import { MetaCard } from '../../../../components/financas/metas/MetaCard';
import { FormMeta } from '../../../../components/financas/metas/FormMeta';
import { FormGuardei } from '../../../../components/financas/metas/FormGuardei';
import { formatBRLSinal } from '../../../../lib/financas-ui';

const AVISO = 'Sugestão, não é recomendação financeira.';

export default function MetasPage() {
  const toast = useToast();
  const hojeISO = useMemo(() => hojeSP(), []);
  const metas = useMetas();
  const { sobra, erro: erroSobra } = useSobraDoMesCorrente(hojeISO);
  const criar = useCriarMeta();
  const atualizar = useAtualizarMeta();
  const guardar = useGuardarNaMeta();
  const excluir = useExcluirMeta();

  const [criando, setCriando] = useState(false);
  const [guardando, setGuardando] = useState<Meta | null>(null);
  const [excluindo, setExcluindo] = useState<Meta | null>(null);

  const sugestao = (m: Meta) =>
    sobra
      ? sugestaoMeta({ hojeISO, sobraMensal: sobra.valor, valorAlvo: Number(m.valor_alvo), valorGuardado: Number(m.valor_guardado), dataLimite: m.data_limite })
      : null;

  const confirmarExcluir = () => {
    if (!excluindo) return;
    excluir.mutate(excluindo.id, {
      onSuccess: () => {
        toast.success(`Meta "${excluindo.nome}" excluída`);
        setExcluindo(null);
      },
      onError: () => toast.error('Não foi possível excluir. Tente de novo.'),
    });
  };

  const aoGuardar = { onSuccess: () => { toast.success('Guardado!'); setGuardando(null); }, onError: () => toast.error('Não foi possível salvar. Tente de novo.') };

  return (
    <div className="animate-fadeSlide space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-syne text-3xl font-bold text-text">Metas</h1>
        <Button onClick={() => { criar.reset(); setCriando(true); }} className="min-h-[44px] whitespace-nowrap">
          <Plus size={16} aria-hidden="true" /> Nova meta
        </Button>
      </div>

      <div className="space-y-1 rounded-card border border-border bg-card p-4 text-[13px]">
        {sobra ? (
          <p className="text-text">
            No fim do mês sobra <span data-testid="metas-sobra" className="font-semibold tabular-nums">{formatBRLSinal(sobra.valor)}</span>. As sugestões
            dividem o que falta por essa sobra.
          </p>
        ) : erroSobra ? (
          <p className="text-muted">Não foi possível calcular a sobra do mês; as sugestões aparecem quando ela carregar.</p>
        ) : (
          <p className="text-muted">Calculando a sobra do mês…</p>
        )}
        <p className="text-muted">{AVISO} Sem investimento nem rendimento: só o que você separa.</p>
      </div>

      {metas.isLoading ? (
        <SkeletonList count={2} />
      ) : metas.isError ? (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-card border border-red/40 bg-card p-3 text-sm">
          <span>Não foi possível carregar suas metas.</span>
          <Button variant="ghost" onClick={() => void metas.refetch()}>Tentar de novo</Button>
        </div>
      ) : !metas.data?.length ? (
        <EmptyState
          icon={<Target size={48} />}
          title="Quer comprar algo?"
          description="Crie uma meta com o valor e, se quiser, até quando. O MeuDia sugere quanto guardar por mês."
          actionLabel="Criar meta"
          onAction={() => setCriando(true)}
        />
      ) : (
        <ul className="space-y-3" aria-label="Suas metas">
          {metas.data.map((m) => (
            <MetaCard key={m.id} meta={m} sugestao={sugestao(m)} onGuardei={setGuardando} onExcluir={setExcluindo} />
          ))}
        </ul>
      )}

      <Modal isOpen={criando} onClose={() => setCriando(false)} title="Nova meta">
        {criando && (
          <FormMeta
            salvando={criar.isPending}
            onSalvar={(data) =>
              criar.mutate(data, {
                onSuccess: () => { toast.success(`Meta "${data.nome}" criada`); setCriando(false); },
                onError: () => toast.error('Não foi possível salvar. Tente de novo.'),
              })
            }
          />
        )}
      </Modal>
      <Modal isOpen={!!guardando} onClose={() => setGuardando(null)} title="Guardei">
        {guardando && (
          <FormGuardei
            meta={guardando}
            salvando={guardar.isPending || atualizar.isPending}
            onGuardar={(valor) => guardar.mutate({ id: guardando.id, valor }, aoGuardar)}
            onCorrigir={(total) => atualizar.mutate({ id: guardando.id, data: { valor_guardado: total } }, aoGuardar)}
          />
        )}
      </Modal>
      <ConfirmarExclusao
        isOpen={!!excluindo}
        onClose={() => setExcluindo(null)}
        onConfirm={confirmarExcluir}
        titulo="Excluir meta"
        detalhe={excluindo ? `A meta "${excluindo.nome}" e o valor guardado registrado nela somem. Nenhum banco muda.` : undefined}
        isLoading={excluir.isPending}
      />
    </div>
  );
}

'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { CreditCard, Plus, Calendar, DollarSign, Pencil, Trash2 } from 'lucide-react';
import { clsx } from 'clsx';
import type { Assinatura, AssinaturaInsert, SituacaoOcorrencia } from '@meudia/shared';
import { competenciaDe, hojeSP } from '@meudia/shared';

import {
  useAssinaturas,
  useCriarAssinatura,
  useAtualizarAssinatura,
  useExcluirAssinatura,
  useTotalMensal,
  useContasMes,
} from '../../../hooks';
import { isVencendoEstaSemana, situacaoPorAssinatura } from '../../../lib/assinaturas';
import { CabecalhoPagina } from '../../../components/financas/resumo/CabecalhoPagina';

import {
  Badge,
  Button,
  Input,
  Modal,
  EmptyState,
  SkeletonCard,
  SkeletonList,
  ConfirmDialog,
  useToast,
} from '../../../components/ui';

const EMOJIS = ['💳', '🎵', '🎬', '📱', '🏋️', '☁️', '🎮', '📚', '🛡️'];

const PRESET_COLORS = [
  '#7c6aff',
  '#6366f1',
  '#8b5cf6',
  '#ec4899',
  '#f43f5e',
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#14b8a6',
  '#06b6d4',
  '#3b82f6',
];

function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

const SITUACAO_BADGE: Record<SituacaoOcorrencia, { label: string; color: 'green' | 'yellow' | 'red' }> = {
  paga: { label: 'Paga', color: 'green' },
  pendente: { label: 'Pendente', color: 'yellow' },
  vencida: { label: 'Vencida', color: 'red' },
};

// --- Add/Edit Modal ---
interface AssinaturaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: AssinaturaInsert) => void;
  defaultValues?: Partial<AssinaturaInsert>;
  isLoading: boolean;
  title: string;
}

function AssinaturaModal({
  isOpen,
  onClose,
  onSubmit,
  defaultValues,
  isLoading,
  title,
}: AssinaturaModalProps) {
  const [nome, setNome] = useState(defaultValues?.nome ?? '');
  const [valor, setValor] = useState(defaultValues?.valor?.toString() ?? '');
  const [diaVencimento, setDiaVencimento] = useState(defaultValues?.dia_vencimento?.toString() ?? '');
  const [icone, setIcone] = useState(defaultValues?.icone ?? '💳');
  const [cor, setCor] = useState(defaultValues?.cor ?? '#7c6aff');

  // Reset form when modal opens with new default values
  const resetForm = useCallback(() => {
    setNome(defaultValues?.nome ?? '');
    setValor(defaultValues?.valor?.toString() ?? '');
    setDiaVencimento(defaultValues?.dia_vencimento?.toString() ?? '');
    setIcone(defaultValues?.icone ?? '💳');
    setCor(defaultValues?.cor ?? '#7c6aff');
  }, [defaultValues]);

  // Reset when opened with new values
  useEffect(() => {
    resetForm();
  }, [resetForm]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedValor = parseFloat(valor);
    const parsedDia = parseInt(diaVencimento, 10);
    if (!nome || isNaN(parsedValor) || parsedValor <= 0 || isNaN(parsedDia) || parsedDia < 1 || parsedDia > 31) return;
    onSubmit({ nome, valor: parsedValor, dia_vencimento: parsedDia, icone, cor });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Nome"
          placeholder="Ex: Netflix, Spotify..."
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          required
        />

        <Input
          label="Valor (R$)"
          type="number"
          step="0.01"
          min="0.01"
          placeholder="0,00"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          icon={<DollarSign size={16} />}
          required
        />

        <Input
          label="Dia do vencimento"
          type="number"
          min="1"
          max="31"
          placeholder="1-31"
          value={diaVencimento}
          onChange={(e) => setDiaVencimento(e.target.value)}
          icon={<Calendar size={16} />}
          required
        />

        {/* Emoji selector */}
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-muted">Icone</span>
          <div className="flex flex-wrap gap-2">
            {EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => setIcone(emoji)}
                className={clsx(
                  'flex h-10 w-10 items-center justify-center rounded-lg border text-lg transition-all',
                  icone === emoji
                    ? 'border-accent bg-accent/20 scale-110'
                    : 'border-border bg-card2 hover:border-accent/50',
                )}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>

        {/* Color picker */}
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-muted">Cor</span>
          <div className="flex flex-wrap gap-2">
            {PRESET_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => setCor(color)}
                className={clsx(
                  'h-8 w-8 rounded-full border-2 transition-all',
                  cor === color ? 'border-white scale-110' : 'border-transparent hover:scale-105',
                )}
                style={{ backgroundColor: color }}
                aria-label={`Cor ${color}`}
              />
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="ghost" type="button" onClick={onClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button type="submit" isLoading={isLoading}>
            Salvar
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// Data de hoje em SP como estado: acompanha a virada do dia com a aba aberta ou ao voltar a ela.
function useHojeSP(): string {
  const [hoje, setHoje] = useState(hojeSP);
  useEffect(() => {
    const atualizar = () => setHoje(hojeSP());
    const id = window.setInterval(atualizar, 60_000);
    window.addEventListener('focus', atualizar);
    document.addEventListener('visibilitychange', atualizar);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('focus', atualizar);
      document.removeEventListener('visibilitychange', atualizar);
    };
  }, []);
  return hoje;
}

// --- Main Page ---
export default function AssinaturasPage() {
  const toast = useToast();
  // Data hooks
  const { data: assinaturas, isLoading: loadingAssinaturas } = useAssinaturas();
  const { data: totalMensal, isLoading: loadingTotal } = useTotalMensal();
  const hoje = useHojeSP();
  // Badge do mês vem da conta espelhada (contas_pagar.assinatura_id); sem espelho, sem badge.
  const {
    data: contasMes,
    isLoading: loadingContas,
    isError: erroContas,
    isFetching: fetchingContas,
    refetch: refetchContas,
  } = useContasMes(competenciaDe(hoje));
  const situacoes = useMemo(() => situacaoPorAssinatura(contasMes ?? []), [contasMes]);

  // Mutations
  const criarAssinatura = useCriarAssinatura();
  const atualizarAssinatura = useAtualizarAssinatura();
  const excluirAssinatura = useExcluirAssinatura();

  // Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingAssinatura, setEditingAssinatura] = useState<Assinatura | null>(null);
  const [deletingAssinatura, setDeletingAssinatura] = useState<Assinatura | null>(null);

  const isLoading = loadingAssinaturas || loadingTotal;

  // Separate subscriptions due this week
  const { vencendoSemana, outras } = useMemo(() => {
    if (!assinaturas) return { vencendoSemana: [], outras: [] };
    const vencendo: Assinatura[] = [];
    const rest: Assinatura[] = [];
    for (const a of assinaturas) {
      if (isVencendoEstaSemana(a.dia_vencimento, hoje)) {
        vencendo.push(a);
      } else {
        rest.push(a);
      }
    }
    return { vencendoSemana: vencendo, outras: rest };
  }, [assinaturas, hoje]);

  // Handlers
  const handleCriar = useCallback(
    (data: AssinaturaInsert) => {
      criarAssinatura.mutate(data, {
        onSuccess: () => {
          toast.success('Assinatura criada com sucesso!');
          setShowAddModal(false);
        },
        onError: () => {
          toast.error('Erro ao criar assinatura');
        },
      });
    },
    [criarAssinatura, toast],
  );

  const handleEditar = useCallback(
    (data: AssinaturaInsert) => {
      if (!editingAssinatura) return;
      atualizarAssinatura.mutate(
        { id: editingAssinatura.id, data },
        {
          onSuccess: () => {
            toast.success('Assinatura atualizada!');
            setEditingAssinatura(null);
          },
          onError: () => {
            toast.error('Erro ao atualizar assinatura');
          },
        },
      );
    },
    [atualizarAssinatura, editingAssinatura, toast],
  );

  const handleExcluir = useCallback(() => {
    if (!deletingAssinatura) return;
    excluirAssinatura.mutate(deletingAssinatura.id, {
      onSuccess: () => {
        toast.success('Assinatura excluida');
        setDeletingAssinatura(null);
      },
      onError: () => {
        toast.error('Erro ao excluir assinatura');
      },
    });
  }, [excluirAssinatura, deletingAssinatura, toast]);

  // --- Loading state ---
  if (isLoading) {
    return (
      <div className="animate-fadeSlide space-y-6">
        <div className="flex items-center justify-between">
          <div className="h-8 w-40 animate-pulse rounded bg-card2" />
          <div className="h-10 w-40 animate-pulse rounded-lg bg-card2" />
        </div>
        <SkeletonCard />
        <SkeletonList count={4} />
      </div>
    );
  }

  // --- Empty state ---
  if (!assinaturas || assinaturas.length === 0) {
    return (
      <div className="mx-auto w-full max-w-2xl animate-fadeSlide space-y-4">
        <CabecalhoPagina titulo="Assinaturas" contexto="O que se repete todo mês" acoes={<BotaoNova onClick={() => setShowAddModal(true)} />} />

        <EmptyState
          icon={<CreditCard size={48} />}
          title="Nenhuma assinatura cadastrada"
          description="Adicione suas assinaturas e servicos recorrentes para acompanhar seus gastos mensais."
          actionLabel="Adicionar primeira assinatura"
          onAction={() => setShowAddModal(true)}
        />

        <AssinaturaModal
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          onSubmit={handleCriar}
          isLoading={criarAssinatura.isPending}
          title="Nova Assinatura"
        />
      </div>
    );
  }

  const quantasSemana = vencendoSemana.length;
  return (
    <div className="mx-auto w-full max-w-2xl animate-fadeSlide space-y-3">
      <CabecalhoPagina
        titulo="Assinaturas"
        contexto="O que se repete todo mês"
        acoes={<BotaoNova onClick={() => setShowAddModal(true)} />}
        className="mb-2"
      />

      {/* Total do mês (bloco principal Astro G) */}
      <section aria-labelledby="total-assinaturas" className="lap-heroi px-5 pb-5 pt-5">
        <div className="flex min-h-6 items-center justify-between gap-2">
          <h2 id="total-assinaturas" className="lap-rotulo lap-texto-3 font-normal">
            Total do mês
          </h2>
          <span className="inline-flex h-[22px] shrink-0 items-center whitespace-nowrap rounded-full border border-accent/20 bg-accent/[0.12] px-2 text-[11px] font-medium text-accent">
            {assinaturas.length === 1 ? '1 ativa' : `${assinaturas.length} ativas`}
          </span>
        </div>
        <p className="mt-2.5 whitespace-nowrap text-[clamp(2rem,9vw,2.5rem)] font-light leading-[1.1] tracking-[-0.035em] tabular-nums">
          {formatBRL(totalMensal ?? 0)}
        </p>
        <p className="lap-texto-2 mt-2 text-[13px] leading-[18px]">
          {quantasSemana === 0
            ? 'Nenhuma vence esta semana.'
            : quantasSemana === 1
              ? 'Uma vence esta semana.'
              : `${quantasSemana} vencem esta semana.`}
        </p>
      </section>

      {/* Situação do mês (badges): carregando/erro não pode parecer "sem conta" */}
      {loadingContas && (
        <p role="status" className="text-sm text-muted">
          Carregando situação do mês…
        </p>
      )}
      {erroContas && (
        <div role="alert" className="lap-cartao flex items-center justify-between gap-3 p-3 text-sm text-text">
          <span>Não foi possível carregar a situação (paga/pendente/vencida) deste mês.</span>
          <Button variant="ghost" onClick={() => void refetchContas()} isLoading={fetchingContas}>
            Tentar de novo
          </Button>
        </div>
      )}

      {quantasSemana > 0 && (
        <section aria-labelledby="vencendo-semana" className="lap-cartao lap-cartao-alerta px-4 pb-2 pt-4">
          <h2 id="vencendo-semana" className="mb-2 text-base font-medium tracking-[-0.02em] text-text">
            Vencendo esta semana
          </h2>
          <ul>
            {vencendoSemana.map((assinatura) => (
              <AssinaturaCard
                key={assinatura.id}
                assinatura={assinatura}
                situacao={situacoes.get(assinatura.id)}
                highlight
                onEdit={() => setEditingAssinatura(assinatura)}
                onDelete={() => setDeletingAssinatura(assinatura)}
              />
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="todas-assinaturas" className="lap-cartao px-4 pb-2 pt-4">
        <h2 id="todas-assinaturas" className="mb-2 text-base font-medium tracking-[-0.02em] text-text">
          {quantasSemana > 0 ? 'Outras assinaturas' : 'Todas as assinaturas'}
        </h2>
        {outras.length > 0 ? (
          <ul>
            {outras.map((assinatura) => (
              <AssinaturaCard
                key={assinatura.id}
                assinatura={assinatura}
                situacao={situacoes.get(assinatura.id)}
                onEdit={() => setEditingAssinatura(assinatura)}
                onDelete={() => setDeletingAssinatura(assinatura)}
              />
            ))}
          </ul>
        ) : (
          <p className="pb-2 text-sm text-muted">Todas as assinaturas vencem esta semana.</p>
        )}
      </section>

      {/* Add Modal */}
      <AssinaturaModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSubmit={handleCriar}
        isLoading={criarAssinatura.isPending}
        title="Nova Assinatura"
      />

      {/* Edit Modal */}
      <AssinaturaModal
        isOpen={!!editingAssinatura}
        onClose={() => setEditingAssinatura(null)}
        onSubmit={handleEditar}
        defaultValues={
          editingAssinatura
            ? {
                nome: editingAssinatura.nome,
                valor: editingAssinatura.valor,
                dia_vencimento: editingAssinatura.dia_vencimento,
                icone: editingAssinatura.icone,
                cor: editingAssinatura.cor,
              }
            : undefined
        }
        isLoading={atualizarAssinatura.isPending}
        title="Editar Assinatura"
      />

      {/* Delete Confirm */}
      <ConfirmDialog
        isOpen={!!deletingAssinatura}
        onClose={() => setDeletingAssinatura(null)}
        onConfirm={handleExcluir}
        title="Excluir assinatura"
        message={`Tem certeza que deseja excluir "${deletingAssinatura?.nome}"? Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        isLoading={excluirAssinatura.isPending}
      />
    </div>
  );
}

// --- Subscription Card ---
interface AssinaturaCardProps {
  assinatura: Assinatura;
  situacao?: SituacaoOcorrencia;
  highlight?: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

function AssinaturaCard({ assinatura, situacao, highlight, onEdit, onDelete }: AssinaturaCardProps) {
  return (
    <li className="group grid grid-cols-[36px_minmax(0,1fr)_auto_auto] items-center gap-x-3 border-t border-border py-3 first:border-t-0 first:pt-1">
      <span
        aria-hidden="true"
        className="grid h-9 w-9 place-items-center rounded-[10px] bg-trilho text-lg"
        style={{ boxShadow: `inset 0 0 0 1px ${assinatura.cor}40` }}
      >
        {assinatura.icone}
      </span>

      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium text-text">
          <span className="min-w-0 max-w-full truncate">{assinatura.nome}</span>
          {situacao && (
            <Badge color={SITUACAO_BADGE[situacao].color} className="shrink-0 whitespace-nowrap">
              {SITUACAO_BADGE[situacao].label}
            </Badge>
          )}
        </p>
        <p className="mt-0.5 text-xs text-muted">
          Vence dia {assinatura.dia_vencimento}
          {highlight ? ' · esta semana' : ''}
        </p>
      </div>

      <div className="text-right">
        <strong className="block whitespace-nowrap text-sm font-medium tracking-[-0.02em] text-text tabular-nums">{formatBRL(assinatura.valor)}</strong>
        <span className="text-[11px] text-muted">Mensal</span>
      </div>

      {/* Mobile e touch (sem hover): sempre visível. Desktop com mouse: hover ou foco por teclado. */}
      <div className="-mr-2 flex shrink-0 transition-opacity md:[@media(hover:hover)_and_(pointer:fine)]:opacity-0 focus-within:opacity-100 group-hover:opacity-100">
        <Button variant="icon" onClick={onEdit} aria-label={`Editar assinatura ${assinatura.nome}`} className="h-11 w-9">
          <Pencil size={14} />
        </Button>
        <Button variant="icon" onClick={onDelete} aria-label={`Excluir assinatura ${assinatura.nome}`} className="h-11 w-9">
          <Trash2 size={14} />
        </Button>
      </div>
    </li>
  );
}

function BotaoNova({ onClick }: { onClick: () => void }) {
  return (
    <Button onClick={onClick} aria-label="Nova Assinatura" className="h-9 px-3">
      <Plus size={16} aria-hidden="true" />
      <span className="hidden sm:inline">Nova Assinatura</span>
      <span className="sm:hidden">Nova</span>
    </Button>
  );
}

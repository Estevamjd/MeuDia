'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { CreditCard, Plus, Calendar, DollarSign, Pencil, Trash2 } from 'lucide-react';
import { clsx } from 'clsx';
import type { Assinatura, AssinaturaInsert } from '@meudia/shared';

import {
  useAssinaturas,
  useCriarAssinatura,
  useAtualizarAssinatura,
  useExcluirAssinatura,
  useTotalMensal,
} from '../../../hooks';

import {
  Button,
  Input,
  Modal,
  StatCard,
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

function isVencendoEstaSemana(diaVencimento: number): boolean {
  const hoje = new Date();
  const diaAtual = hoje.getDate();
  const diffDias = diaVencimento - diaAtual;
  return diffDias >= 0 && diffDias <= 7;
}

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

// --- Main Page ---
export default function AssinaturasPage() {
  const toast = useToast();
  // Data hooks
  const { data: assinaturas, isLoading: loadingAssinaturas } = useAssinaturas();
  const { data: totalMensal, isLoading: loadingTotal } = useTotalMensal();

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
      if (isVencendoEstaSemana(a.dia_vencimento)) {
        vencendo.push(a);
      } else {
        rest.push(a);
      }
    }
    return { vencendoSemana: vencendo, outras: rest };
  }, [assinaturas]);

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
      <div className="animate-fadeSlide space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="font-syne text-3xl font-bold text-text">Assinaturas</h1>
          <Button onClick={() => setShowAddModal(true)}>
            <Plus size={16} />
            Nova Assinatura
          </Button>
        </div>

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

  return (
    <div className="animate-fadeSlide space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="font-syne text-3xl font-bold text-text">Assinaturas</h1>
        <Button onClick={() => setShowAddModal(true)}>
          <Plus size={16} />
          Nova Assinatura
        </Button>
      </div>

      {/* Total mensal card */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <StatCard
          label="Total mensal"
          value={formatBRL(totalMensal ?? 0)}
          icon={<DollarSign size={16} />}
          tag={{ text: `${assinaturas.length} assinaturas`, color: 'purple' }}
        />
        <StatCard
          label="Vencendo esta semana"
          value={vencendoSemana.length}
          icon={<Calendar size={16} />}
          tag={{
            text: vencendoSemana.length > 0 ? 'Atenção' : 'Nenhuma',
            color: vencendoSemana.length > 0 ? 'orange' : 'green',
          }}
        />
      </div>

      {/* Vencendo esta semana */}
      {vencendoSemana.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-syne text-lg font-semibold text-orange">
            Vencendo esta semana ({vencendoSemana.length})
          </h2>
          <div className="space-y-3">
            {vencendoSemana.map((assinatura) => (
              <AssinaturaCard
                key={assinatura.id}
                assinatura={assinatura}
                highlight
                onEdit={() => setEditingAssinatura(assinatura)}
                onDelete={() => setDeletingAssinatura(assinatura)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Todas as outras */}
      <div className="space-y-3">
        <h2 className="font-syne text-lg font-semibold text-text">
          {vencendoSemana.length > 0 ? 'Outras assinaturas' : 'Todas as assinaturas'} ({outras.length})
        </h2>
        {outras.length > 0 ? (
          <div className="space-y-3">
            {outras.map((assinatura) => (
              <AssinaturaCard
                key={assinatura.id}
                assinatura={assinatura}
                onEdit={() => setEditingAssinatura(assinatura)}
                onDelete={() => setDeletingAssinatura(assinatura)}
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">Todas as assinaturas vencem esta semana.</p>
        )}
      </div>

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
  highlight?: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

function AssinaturaCard({ assinatura, highlight, onEdit, onDelete }: AssinaturaCardProps) {
  return (
    <div
      className={clsx(
        'group flex items-center gap-4 rounded-card border bg-card p-4 transition-all hover:bg-card2',
        highlight ? 'border-orange/40' : 'border-border',
      )}
      style={{ borderLeftWidth: '4px', borderLeftColor: assinatura.cor }}
    >
      {/* Icon */}
      <div
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl"
        style={{ backgroundColor: `${assinatura.cor}20` }}
      >
        {assinatura.icone}
      </div>

      {/* Info */}
      <div className="flex flex-1 flex-col gap-0.5">
        <span className="text-sm font-semibold text-text">{assinatura.nome}</span>
        <span className="flex items-center gap-1 text-xs text-muted">
          <Calendar size={12} />
          Vence dia {assinatura.dia_vencimento}
        </span>
      </div>

      {/* Value */}
      <span className="text-sm font-bold text-text">{formatBRL(assinatura.valor)}</span>

      {/* Actions */}
      <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <Button variant="icon" onClick={onEdit} aria-label="Editar assinatura">
          <Pencil size={14} />
        </Button>
        <Button variant="icon" onClick={onDelete} aria-label="Excluir assinatura">
          <Trash2 size={14} />
        </Button>
      </div>
    </div>
  );
}

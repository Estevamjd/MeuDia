'use client';

import { useState, useMemo, useCallback } from 'react';
import { ShoppingCart, Plus, Check, Package, Trash2 } from 'lucide-react';
import { clsx } from 'clsx';
import type { ItemCompra } from '@meudia/shared';

import {
  useListas,
  useItensLista,
  useCriarLista,
  useExcluirLista,
  useCriarItem,
  useAtualizarItem,
  useExcluirItem,
  useToggleItem,
} from '../../../hooks/useCompras';

import {
  Button,
  Card,
  Input,
  Select,
  Modal,
  ConfirmDialog,
  ProgressBar,
  EmptyState,
  SkeletonList,
  SkeletonCard,
  useToast,
} from '../../../components/ui';
import { AgentBannerAuto } from '../../../components/agent';

/* ── Unidades disponíveis ── */
const UNIDADES = [
  { value: 'un', label: 'un' },
  { value: 'kg', label: 'kg' },
  { value: 'g', label: 'g' },
  { value: 'L', label: 'L' },
  { value: 'mL', label: 'mL' },
  { value: 'dz', label: 'dz' },
  { value: 'pct', label: 'pct' },
];

/* ── Helpers ── */
function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function groupByCategoria(itens: ItemCompra[]): Record<string, ItemCompra[]> {
  const groups: Record<string, ItemCompra[]> = {};
  for (const item of itens) {
    const cat = item.categoria || 'Sem categoria';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(item);
  }
  return groups;
}

export default function ComprasPage() {
  const toast = useToast();

  /* ── Data ── */
  const { data: listas, isLoading: loadingListas } = useListas();

  /* ── State ── */
  const [expandedListaId, setExpandedListaId] = useState<string | null>(null);
  const [showAddListaModal, setShowAddListaModal] = useState(false);
  const [novaListaNome, setNovaListaNome] = useState('Lista de Compras');
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [editingItem, setEditingItem] = useState<ItemCompra | null>(null);
  const [deletingLista, setDeletingLista] = useState<{ id: string; nome: string } | null>(null);
  const [deletingItem, setDeletingItem] = useState<{ id: string; listaId: string; nome: string } | null>(null);
  const [quickAddText, setQuickAddText] = useState<Record<string, string>>({});

  /* ── Item form state ── */
  const [itemForm, setItemForm] = useState({
    nome: '',
    quantidade: '1',
    unidade: 'un',
    categoria: '',
    preco_estimado: '',
  });

  /* ── Mutations ── */
  const criarLista = useCriarLista();
  const excluirLista = useExcluirLista();
  const criarItem = useCriarItem();
  const atualizarItem = useAtualizarItem();
  const excluirItem = useExcluirItem();
  const toggleItem = useToggleItem();

  /* ── Items query for expanded list ── */
  const { data: itensExpanded, isLoading: loadingItens } = useItensLista(expandedListaId);

  /* ── Computed ── */
  const itensGrouped = useMemo(() => {
    if (!itensExpanded) return {};
    return groupByCategoria(itensExpanded);
  }, [itensExpanded]);

  const resumoExpanded = useMemo(() => {
    if (!itensExpanded) return { total: 0, comprados: 0, custoEstimado: 0 };
    const total = itensExpanded.length;
    const comprados = itensExpanded.filter((i) => i.comprado).length;
    const custoEstimado = itensExpanded.reduce((acc, i) => {
      if (i.preco_estimado != null) return acc + i.preco_estimado * i.quantidade;
      return acc;
    }, 0);
    return { total, comprados, custoEstimado };
  }, [itensExpanded]);

  /* ── Handlers ── */
  const handleCriarLista = useCallback(() => {
    criarLista.mutate(
      { nome: novaListaNome || 'Lista de Compras' },
      {
        onSuccess: () => {
          toast.success('Lista criada com sucesso!');
          setShowAddListaModal(false);
          setNovaListaNome('Lista de Compras');
        },
        onError: () => toast.error('Erro ao criar lista'),
      },
    );
  }, [criarLista, novaListaNome, toast]);

  const handleExcluirLista = useCallback(() => {
    if (!deletingLista) return;
    excluirLista.mutate(deletingLista.id, {
      onSuccess: () => {
        toast.success('Lista excluída');
        setDeletingLista(null);
        if (expandedListaId === deletingLista.id) setExpandedListaId(null);
      },
      onError: () => toast.error('Erro ao excluir lista'),
    });
  }, [excluirLista, deletingLista, expandedListaId, toast]);

  const handleToggleItem = useCallback(
    (itemId: string, comprado: boolean) => {
      toggleItem.mutate(
        { id: itemId, comprado },
        {
          onSuccess: () => toast.success(comprado ? 'Item comprado!' : 'Item desmarcado'),
          onError: () => toast.error('Erro ao atualizar item'),
        },
      );
    },
    [toggleItem, toast],
  );

  const handleQuickAdd = useCallback(
    (listaId: string) => {
      const nome = quickAddText[listaId]?.trim();
      if (!nome) return;
      criarItem.mutate(
        { lista_id: listaId, nome, quantidade: 1, unidade: 'un' },
        {
          onSuccess: () => {
            toast.success('Item adicionado!');
            setQuickAddText((prev) => ({ ...prev, [listaId]: '' }));
          },
          onError: () => toast.error('Erro ao adicionar item'),
        },
      );
    },
    [criarItem, quickAddText, toast],
  );

  const resetItemForm = useCallback(() => {
    setItemForm({ nome: '', quantidade: '1', unidade: 'un', categoria: '', preco_estimado: '' });
  }, []);

  const openAddItemModal = useCallback(() => {
    resetItemForm();
    setEditingItem(null);
    setShowAddItemModal(true);
  }, [resetItemForm]);

  const openEditItemModal = useCallback((item: ItemCompra) => {
    setEditingItem(item);
    setItemForm({
      nome: item.nome,
      quantidade: String(item.quantidade),
      unidade: item.unidade,
      categoria: item.categoria || '',
      preco_estimado: item.preco_estimado != null ? String(item.preco_estimado) : '',
    });
    setShowAddItemModal(true);
  }, []);

  const handleSubmitItem = useCallback(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const payload: any = {
      nome: itemForm.nome.trim(),
      quantidade: parseFloat(itemForm.quantidade) || 1,
      unidade: itemForm.unidade,
      categoria: itemForm.categoria.trim() || null,
      preco_estimado: itemForm.preco_estimado ? parseFloat(itemForm.preco_estimado) : null,
    };

    if (!payload.nome) {
      toast.error('Nome do item é obrigatório');
      return;
    }

    if (editingItem) {
      atualizarItem.mutate(
        { id: editingItem.id, data: payload },
        {
          onSuccess: () => {
            toast.success('Item atualizado!');
            setShowAddItemModal(false);
            setEditingItem(null);
            resetItemForm();
          },
          onError: () => toast.error('Erro ao atualizar item'),
        },
      );
    } else {
      criarItem.mutate(
        { ...payload, lista_id: expandedListaId! },
        {
          onSuccess: () => {
            toast.success('Item adicionado!');
            setShowAddItemModal(false);
            resetItemForm();
          },
          onError: () => toast.error('Erro ao adicionar item'),
        },
      );
    }
  }, [itemForm, editingItem, expandedListaId, criarItem, atualizarItem, toast, resetItemForm]);

  const handleExcluirItem = useCallback(() => {
    if (!deletingItem) return;
    excluirItem.mutate(
      { id: deletingItem.id, listaId: deletingItem.listaId },
      {
        onSuccess: () => {
          toast.success('Item excluído');
          setDeletingItem(null);
        },
        onError: () => toast.error('Erro ao excluir item'),
      },
    );
  }, [excluirItem, deletingItem, toast]);

  /* ── Loading ── */
  if (loadingListas) {
    return (
      <div className="animate-fadeSlide space-y-6">
        <div className="flex items-center justify-between">
          <div className="h-8 w-32 animate-pulse rounded bg-card2" />
          <div className="h-10 w-32 animate-pulse rounded-lg bg-card2" />
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <SkeletonCard />
          <SkeletonCard />
        </div>
        <SkeletonList count={3} />
      </div>
    );
  }

  /* ── Empty ── */
  if (!listas || listas.length === 0) {
    return (
      <div className="animate-fadeSlide space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="font-syne text-3xl font-bold text-text">Compras</h1>
          <Button onClick={() => setShowAddListaModal(true)}>
            <Plus size={16} />
            Nova Lista
          </Button>
        </div>

        <EmptyState
          icon={<ShoppingCart size={48} />}
          title="Nenhuma lista de compras"
          description="Crie sua primeira lista para organizar suas compras de forma prática."
          actionLabel="Criar primeira lista"
          onAction={() => setShowAddListaModal(true)}
        />

        {/* Add Lista Modal */}
        <Modal
          isOpen={showAddListaModal}
          onClose={() => setShowAddListaModal(false)}
          title="Nova Lista de Compras"
        >
          <div className="space-y-4">
            <Input
              label="Nome da lista"
              value={novaListaNome}
              onChange={(e) => setNovaListaNome(e.target.value)}
              placeholder="Ex: Mercado da semana"
              onKeyDown={(e) => e.key === 'Enter' && handleCriarLista()}
            />
            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setShowAddListaModal(false)}>
                Cancelar
              </Button>
              <Button onClick={handleCriarLista} isLoading={criarLista.isPending}>
                Criar Lista
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    );
  }

  /* ── Expanded list view ── */
  const expandedLista = listas.find((l) => l.id === expandedListaId);

  return (
    <div className="animate-fadeSlide space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="font-syne text-3xl font-bold text-text">Compras</h1>
        <Button onClick={() => setShowAddListaModal(true)}>
          <Plus size={16} />
          Nova Lista
        </Button>
      </div>

      {/* Agente IA */}
      <AgentBannerAuto />

      {/* Lists grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {listas.map((lista) => {
          const isExpanded = expandedListaId === lista.id;
          return (
            <Card
              key={lista.id}
              hoverable
              variant={isExpanded ? 'green' : 'default'}
              className={clsx(isExpanded && 'md:col-span-2')}
              onClick={() => setExpandedListaId(isExpanded ? null : lista.id)}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
                    <ShoppingCart size={20} className="text-accent" />
                  </div>
                  <div>
                    <h3 className="font-syne font-semibold text-text">{lista.nome}</h3>
                    <p className="text-xs text-muted">
                      {lista.itens_count} {lista.itens_count === 1 ? 'item' : 'itens'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeletingLista({ id: lista.id, nome: lista.nome });
                  }}
                  className="rounded-lg p-1.5 text-muted transition-colors hover:bg-red/10 hover:text-red"
                  aria-label={`Excluir lista ${lista.nome}`}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Expanded list items */}
      {expandedLista && (
        <div className="animate-fadeSlide space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-syne text-lg font-semibold text-text">{expandedLista.nome}</h2>
            <Button onClick={openAddItemModal}>
              <Plus size={16} />
              Novo Item
            </Button>
          </div>

          {/* Progress */}
          {resumoExpanded.total > 0 && (
            <div className="space-y-2">
              <ProgressBar
                value={resumoExpanded.comprados}
                max={resumoExpanded.total}
                label={`${resumoExpanded.comprados}/${resumoExpanded.total} comprados`}
                showValue
                color={
                  resumoExpanded.comprados === resumoExpanded.total
                    ? 'green'
                    : resumoExpanded.comprados > 0
                      ? 'orange'
                      : 'red'
                }
              />
              {resumoExpanded.custoEstimado > 0 && (
                <p className="text-xs text-muted">
                  Custo estimado: <span className="font-semibold text-text">{formatBRL(resumoExpanded.custoEstimado)}</span>
                </p>
              )}
            </div>
          )}

          {/* Loading items */}
          {loadingItens && <SkeletonList count={4} />}

          {/* Items grouped by category */}
          {!loadingItens && itensExpanded && itensExpanded.length === 0 && (
            <div className="rounded-card border border-border bg-card p-8 text-center">
              <Package size={32} className="mx-auto mb-2 text-muted" />
              <p className="text-sm text-muted">Nenhum item nesta lista.</p>
              <p className="text-xs text-muted">Use o campo abaixo para adicionar rapidamente.</p>
            </div>
          )}

          {!loadingItens && itensExpanded && itensExpanded.length > 0 && (
            <div className="space-y-4">
              {Object.entries(itensGrouped).map(([categoria, itens]) => (
                <div key={categoria}>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">
                    {categoria}
                  </h3>
                  <div className="space-y-1">
                    {itens.map((item) => (
                      <div
                        key={item.id}
                        className={clsx(
                          'flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 transition-colors',
                          item.comprado && 'opacity-50',
                        )}
                      >
                        {/* Checkbox */}
                        <button
                          onClick={() => handleToggleItem(item.id, !item.comprado)}
                          className={clsx(
                            'flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors',
                            item.comprado
                              ? 'border-green bg-green text-white'
                              : 'border-border hover:border-accent',
                          )}
                          aria-label={item.comprado ? `Desmarcar ${item.nome}` : `Marcar ${item.nome} como comprado`}
                        >
                          {item.comprado && <Check size={12} />}
                        </button>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <span
                            className={clsx(
                              'text-sm text-text',
                              item.comprado && 'line-through text-muted',
                            )}
                          >
                            {item.nome}
                          </span>
                          <span className="ml-2 text-xs text-muted">
                            {item.quantidade} {item.unidade}
                          </span>
                        </div>

                        {/* Price */}
                        {item.preco_estimado != null && (
                          <span className={clsx('text-xs font-medium', item.comprado ? 'text-muted' : 'text-accent')}>
                            {formatBRL(item.preco_estimado)}
                          </span>
                        )}

                        {/* Actions */}
                        <button
                          onClick={() => openEditItemModal(item)}
                          className="rounded p-1 text-muted transition-colors hover:bg-card2 hover:text-text"
                          aria-label={`Editar ${item.nome}`}
                        >
                          <Package size={14} />
                        </button>
                        <button
                          onClick={() => setDeletingItem({ id: item.id, listaId: item.lista_id, nome: item.nome })}
                          className="rounded p-1 text-muted transition-colors hover:bg-red/10 hover:text-red"
                          aria-label={`Excluir ${item.nome}`}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Quick add */}
          <div className="flex gap-2">
            <Input
              placeholder="Adicionar item rapidamente..."
              value={quickAddText[expandedListaId!] || ''}
              onChange={(e) =>
                setQuickAddText((prev) => ({ ...prev, [expandedListaId!]: e.target.value }))
              }
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleQuickAdd(expandedListaId!);
              }}
              className="flex-1"
            />
            <Button
              onClick={() => handleQuickAdd(expandedListaId!)}
              isLoading={criarItem.isPending}
              disabled={!quickAddText[expandedListaId!]?.trim()}
            >
              <Plus size={16} />
            </Button>
          </div>
        </div>
      )}

      {/* Add Lista Modal */}
      <Modal
        isOpen={showAddListaModal}
        onClose={() => setShowAddListaModal(false)}
        title="Nova Lista de Compras"
      >
        <div className="space-y-4">
          <Input
            label="Nome da lista"
            value={novaListaNome}
            onChange={(e) => setNovaListaNome(e.target.value)}
            placeholder="Ex: Mercado da semana"
            onKeyDown={(e) => e.key === 'Enter' && handleCriarLista()}
          />
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setShowAddListaModal(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCriarLista} isLoading={criarLista.isPending}>
              Criar Lista
            </Button>
          </div>
        </div>
      </Modal>

      {/* Add/Edit Item Modal */}
      <Modal
        isOpen={showAddItemModal}
        onClose={() => {
          setShowAddItemModal(false);
          setEditingItem(null);
          resetItemForm();
        }}
        title={editingItem ? 'Editar Item' : 'Novo Item'}
      >
        <div className="space-y-4">
          <Input
            label="Nome"
            value={itemForm.nome}
            onChange={(e) => setItemForm((f) => ({ ...f, nome: e.target.value }))}
            placeholder="Ex: Arroz"
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Quantidade"
              type="number"
              step="0.01"
              min="0.01"
              value={itemForm.quantidade}
              onChange={(e) => setItemForm((f) => ({ ...f, quantidade: e.target.value }))}
            />
            <Select
              label="Unidade"
              options={UNIDADES}
              value={itemForm.unidade}
              onChange={(e) => setItemForm((f) => ({ ...f, unidade: e.target.value }))}
            />
          </div>
          <Input
            label="Categoria"
            value={itemForm.categoria}
            onChange={(e) => setItemForm((f) => ({ ...f, categoria: e.target.value }))}
            placeholder="Ex: Mercearia, Hortifrúti..."
          />
          <Input
            label="Preço estimado (R$)"
            type="number"
            step="0.01"
            min="0"
            value={itemForm.preco_estimado}
            onChange={(e) => setItemForm((f) => ({ ...f, preco_estimado: e.target.value }))}
            placeholder="0,00"
          />
          <div className="flex justify-end gap-3">
            <Button
              variant="ghost"
              onClick={() => {
                setShowAddItemModal(false);
                setEditingItem(null);
                resetItemForm();
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSubmitItem}
              isLoading={criarItem.isPending || atualizarItem.isPending}
            >
              {editingItem ? 'Salvar' : 'Adicionar'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Lista Confirm */}
      <ConfirmDialog
        isOpen={!!deletingLista}
        onClose={() => setDeletingLista(null)}
        onConfirm={handleExcluirLista}
        title="Excluir lista"
        message={`Tem certeza que deseja excluir "${deletingLista?.nome}"? Todos os itens serão removidos. Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        isLoading={excluirLista.isPending}
      />

      {/* Delete Item Confirm */}
      <ConfirmDialog
        isOpen={!!deletingItem}
        onClose={() => setDeletingItem(null)}
        onConfirm={handleExcluirItem}
        title="Excluir item"
        message={`Tem certeza que deseja excluir "${deletingItem?.nome}"?`}
        confirmLabel="Excluir"
        isLoading={excluirItem.isPending}
      />
    </div>
  );
}

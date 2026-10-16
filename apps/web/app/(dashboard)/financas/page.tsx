'use client';

import { useState, useMemo, useCallback } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Wallet, Plus, ChevronLeft, ChevronRight, Pencil, Trash2 } from 'lucide-react';
import type { Transacao, TransacaoInsert } from '@meudia/shared';
import { competenciaDe, hojeSP } from '@meudia/shared';
import { clsx } from 'clsx';

import {
  useTransacoesMes,
  useCriarTransacao,
  useAtualizarTransacao,
  useExcluirTransacao,
} from '../../../hooks';

import {
  Button,
  Badge,
  Modal,
  Input,
  Select,
  EmptyState,
  SkeletonList,
  ConfirmDialog,
  useToast,
} from '../../../components/ui';
import { AgentBannerAuto } from '../../../components/agent';
import { useAppMode } from '../../../components/AppModeProvider';
import { ContasDoMes } from '../../../components/financas/ContasDoMes';
import { ResumoMes } from '../../../components/financas/ResumoMes';
import {
  deslocarCompetencia,
  formatBRL,
  partesCompetencia,
  rotuloCompetencia,
} from '../../../lib/financas-ui';

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export default function FinancasPage() {
  const toast = useToast();
  const mode = useAppMode();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const hoje = useMemo(() => new Date(), []);

  // --- Month selector (competência em SP, igual ao backend) ---
  const [competencia, setCompetencia] = useState(() => competenciaDe(hojeSP()));
  const { ano, mes } = partesCompetencia(competencia);
  const mesAnterior = useCallback(() => setCompetencia((c) => deslocarCompetencia(c, -1)), []);
  const mesProximo = useCallback(() => setCompetencia((c) => deslocarCompetencia(c, 1)), []);
  const mesLabel = rotuloCompetencia(competencia);

  // --- Data hooks ---
  const { data: transacoes, isLoading: loadingTransacoes } = useTransacoesMes(ano, mes);

  // --- Mutations ---
  const criarTransacao = useCriarTransacao();
  const atualizarTransacao = useAtualizarTransacao();
  const excluirTransacao = useExcluirTransacao();

  // --- Modal state ---
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTransacao, setEditingTransacao] = useState<Transacao | null>(null);
  const [deletingTransacao, setDeletingTransacao] = useState<Transacao | null>(null);

  // --- Form state ---
  const [formTipo, setFormTipo] = useState<'receita' | 'despesa'>('despesa');
  const [formCategoria, setFormCategoria] = useState('');
  const [formDescricao, setFormDescricao] = useState('');
  const [formValor, setFormValor] = useState('');
  const [formData, setFormData] = useState(format(hoje, 'yyyy-MM-dd'));
  const [formBanco, setFormBanco] = useState('');


  // --- Group transactions by date ---
  const transacoesAgrupadas = useMemo(() => {
    if (!transacoes) return [];
    const groups = new Map<string, Transacao[]>();
    for (const t of transacoes) {
      const key = t.data;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(t);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => b.localeCompare(a));
  }, [transacoes]);

  // --- Reset form ---
  const resetForm = useCallback(() => {
    setFormTipo('despesa');
    setFormCategoria('');
    setFormDescricao('');
    setFormValor('');
    setFormData(format(hoje, 'yyyy-MM-dd'));
    setFormBanco('');
  }, [hoje]);

  const openAddModal = useCallback(() => {
    resetForm();
    setShowAddModal(true);
  }, [resetForm]);

  const openEditModal = useCallback((t: Transacao) => {
    setFormTipo(t.tipo);
    setFormCategoria(t.categoria);
    setFormDescricao(t.descricao);
    setFormValor(String(t.valor));
    setFormData(t.data);
    setFormBanco(t.banco ?? '');
    setEditingTransacao(t);
  }, []);

  // --- Handlers ---
  const handleSubmitAdd = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const payload: TransacaoInsert = {
        tipo: formTipo,
        categoria: formCategoria,
        descricao: formDescricao,
        valor: parseFloat(formValor),
        data: formData,
        banco: formBanco || undefined,
      };
      criarTransacao.mutate(payload, {
        onSuccess: () => {
          toast.success('Transacao criada com sucesso!');
          setShowAddModal(false);
          resetForm();
        },
        onError: () => {
          toast.error('Erro ao criar transacao');
        },
      });
    },
    [formTipo, formCategoria, formDescricao, formValor, formData, formBanco, criarTransacao, toast, resetForm],
  );

  const handleSubmitEdit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!editingTransacao) return;
      const payload: Partial<TransacaoInsert> = {
        tipo: formTipo,
        categoria: formCategoria,
        descricao: formDescricao,
        valor: parseFloat(formValor),
        data: formData,
        banco: formBanco || undefined,
      };
      atualizarTransacao.mutate(
        { id: editingTransacao.id, data: payload },
        {
          onSuccess: () => {
            toast.success('Transacao atualizada!');
            setEditingTransacao(null);
            resetForm();
          },
          onError: () => {
            toast.error('Erro ao atualizar transacao');
          },
        },
      );
    },
    [formTipo, formCategoria, formDescricao, formValor, formData, formBanco, atualizarTransacao, editingTransacao, toast, resetForm],
  );

  const handleExcluir = useCallback(() => {
    if (!deletingTransacao) return;
    excluirTransacao.mutate(deletingTransacao.id, {
      onSuccess: () => {
        toast.success('Transacao excluida');
        setDeletingTransacao(null);
      },
      onError: () => {
        toast.error('Erro ao excluir transacao');
      },
    });
  }, [excluirTransacao, deletingTransacao, toast]);

  // --- Form JSX (shared between add and edit) ---
  const renderForm = (onSubmit: (e: React.FormEvent) => void, isSubmitting: boolean) => (
    <form onSubmit={onSubmit} className="space-y-4">
      <Select
        label="Tipo"
        value={formTipo}
        onChange={(e) => setFormTipo(e.target.value as 'receita' | 'despesa')}
        options={[
          { value: 'despesa', label: 'Despesa' },
          { value: 'receita', label: 'Receita' },
        ]}
      />
      <Input
        label="Categoria"
        placeholder="Ex: Alimentacao, Transporte..."
        value={formCategoria}
        onChange={(e) => setFormCategoria(e.target.value)}
        required
      />
      <Input
        label="Descricao"
        placeholder="Descricao da transacao"
        value={formDescricao}
        onChange={(e) => setFormDescricao(e.target.value)}
        required
      />
      <Input
        label="Valor (R$)"
        type="number"
        step="0.01"
        min="0.01"
        placeholder="0,00"
        value={formValor}
        onChange={(e) => setFormValor(e.target.value)}
        required
      />
      <Input
        label="Data"
        type="date"
        value={formData}
        onChange={(e) => setFormData(e.target.value)}
      />
      <Input
        label="Banco (opcional)"
        placeholder="Ex: Nubank, Itau..."
        value={formBanco}
        onChange={(e) => setFormBanco(e.target.value)}
      />
      <div className="flex justify-end gap-3 pt-2">
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            setShowAddModal(false);
            setEditingTransacao(null);
          }}
        >
          Cancelar
        </Button>
        <Button type="submit" isLoading={isSubmitting}>
          Salvar
        </Button>
      </div>
    </form>
  );

  return (
    <div className="animate-fadeSlide space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="font-syne text-3xl font-bold text-text">Finanças</h1>
        <Button onClick={openAddModal}>
          <Plus size={16} />
          Nova Transacao
        </Button>
      </div>

      {/* Month selector */}
      <div className="flex items-center justify-center gap-4">
        <button
          onClick={mesAnterior}
          className="rounded-lg p-2 text-muted transition-colors hover:bg-card2 hover:text-text"
          aria-label="Mês anterior"
        >
          <ChevronLeft size={20} />
        </button>
        <span className="font-syne text-lg font-semibold text-text" aria-live="polite">{mesLabel}</span>
        <button
          onClick={mesProximo}
          className="rounded-lg p-2 text-muted transition-colors hover:bg-card2 hover:text-text"
          aria-label="Próximo mês"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Agente IA (fala de todos os módulos; fora do modo Finanças) */}
      {mode !== 'financas' && <AgentBannerAuto />}

      {/* Selo, renda × gasto, sobra, % comprometida, pagas no prazo, mês anterior */}
      <ResumoMes ano={ano} mes={mes} />

      <ContasDoMes competencia={competencia} />

      <h2 className="font-syne text-lg font-semibold text-text">Transações</h2>

      {loadingTransacoes ? (
        <SkeletonList count={5} />
      ) : !transacoes || transacoes.length === 0 ? (
        <EmptyState
          icon={<Wallet size={48} />}
          title="Nenhuma transacao neste mes"
          description="Registre suas receitas e despesas para acompanhar suas financas."
          actionLabel="Adicionar transacao"
          onAction={openAddModal}
        />
      ) : (
      /* Transaction list grouped by date */
      <div className="space-y-6">
        {transacoesAgrupadas.map(([data, items]) => {
          const dataFormatada = format(new Date(data + 'T12:00:00'), "dd 'de' MMMM", { locale: ptBR });
          return (
            <div key={data}>
              <h3 className="mb-3 font-syne text-sm font-semibold text-muted">
                {capitalize(dataFormatada)}
              </h3>
              <div className="space-y-2">
                {items.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center gap-4 rounded-card border border-border bg-card p-4 transition-colors hover:border-accent/30"
                  >
                    {/* Category badge */}
                    <Badge color={t.tipo === 'receita' ? 'green' : 'red'}>
                      {t.categoria}
                    </Badge>

                    {/* Description + banco */}
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm font-medium text-text">{t.descricao}</p>
                      {t.banco && (
                        <p className="text-xs text-muted">{t.banco}</p>
                      )}
                    </div>

                    {/* Valor */}
                    <span
                      className={clsx(
                        'whitespace-nowrap text-sm font-bold',
                        t.tipo === 'receita' ? 'text-green' : 'text-red',
                      )}
                    >
                      {t.tipo === 'receita' ? '+' : '-'} {formatBRL(Number(t.valor))}
                    </span>

                    {/* Actions */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEditModal(t)}
                        className="rounded-lg p-1.5 text-muted transition-colors hover:bg-card2 hover:text-text"
                        aria-label="Editar transacao"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => setDeletingTransacao(t)}
                        className="rounded-lg p-1.5 text-muted transition-colors hover:bg-red/[0.14] hover:text-red"
                        aria-label="Excluir transacao"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      )}

      {/* Add Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Nova Transacao"
      >
        {renderForm(handleSubmitAdd, criarTransacao.isPending)}
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={!!editingTransacao}
        onClose={() => setEditingTransacao(null)}
        title="Editar Transacao"
      >
        {renderForm(handleSubmitEdit, atualizarTransacao.isPending)}
      </Modal>

      {/* Delete Confirm */}
      <ConfirmDialog
        isOpen={!!deletingTransacao}
        onClose={() => setDeletingTransacao(null)}
        onConfirm={handleExcluir}
        title="Excluir transacao"
        message={`Tem certeza que deseja excluir "${deletingTransacao?.descricao}"? Esta acao nao pode ser desfeita.`}
        confirmLabel="Excluir"
        isLoading={excluirTransacao.isPending}
      />
    </div>
  );
}

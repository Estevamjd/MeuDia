'use client';

import { useState, useMemo, useCallback } from 'react';
import { format } from 'date-fns';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import type { Transacao, TransacaoInsert } from '@meudia/shared';
import { competenciaDe, hojeSP } from '@meudia/shared';

import {
  useCarteiras,
  useCriarTransacao,
  useAtualizarTransacao,
} from '../../../hooks';

import {
  Button,
  Modal,
  Input,
  Select,
  useToast,
} from '../../../components/ui';
import { AgentBannerAuto } from '../../../components/agent';
import { useAppMode } from '../../../components/AppModeProvider';
import { FinancasHomeView } from '../../../components/financas/home/FinancasHomeView';
import { useFinancasHome } from '../../../components/financas/home/useFinancasHome';
import { SeletorCarteira } from '../../../components/financas/SeletorCarteira';
import { LancamentoRapidoSheet } from '../../../components/financas/LancamentoRapidoSheet';
import { deslocarCompetencia, rotuloCompetencia } from '../../../lib/financas-ui';

export default function FinancasPage() {
  const toast = useToast();
  const listaCarteiras = useCarteiras();
  const carteiras = useMemo(() => (listaCarteiras.data ?? []).filter((c) => !c.arquivada), [listaCarteiras.data]);
  const [formCarteira, setFormCarteira] = useState<string | null>(null);

  const mode = useAppMode();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const hoje = useMemo(() => new Date(), []);
  const hojeISO = useMemo(() => hojeSP(hoje), [hoje]);

  // --- Month selector (competência em SP, igual ao backend) ---
  const [competencia, setCompetencia] = useState(() => competenciaDe(hojeISO));
  const mesAnterior = useCallback(() => setCompetencia((c) => deslocarCompetencia(c, -1)), []);
  const mesProximo = useCallback(() => setCompetencia((c) => deslocarCompetencia(c, 1)), []);
  const mesLabel = rotuloCompetencia(competencia);

  // --- Mutations ---
  const criarTransacao = useCriarTransacao();
  const atualizarTransacao = useAtualizarTransacao();

  // --- Modal state ---
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTransacao, setEditingTransacao] = useState<Transacao | null>(null);
  // Novo: carteira escolhida ou a primeira ativa. Edição: exatamente a do lançamento (NULL em lançamento antigo =
  // "Sem carteira"); nunca cai na primeira carteira por conta própria.
  const carteiraId = editingTransacao
    ? formCarteira
    : carteiras.find((c) => c.id === formCarteira)?.id ?? carteiras[0]?.id ?? null;
  // Desktop: a BottomNav (com o "+") só existe no mobile.
  const [acoesAbertas, setAcoesAbertas] = useState(false);

  // --- Form state ---
  const [formTipo, setFormTipo] = useState<'receita' | 'despesa'>('despesa');
  const [formCategoria, setFormCategoria] = useState('');
  const [formDescricao, setFormDescricao] = useState('');
  const [formValor, setFormValor] = useState('');
  const [formData, setFormData] = useState(format(hoje, 'yyyy-MM-dd'));
  const [formBanco, setFormBanco] = useState('');

  // --- Reset form ---
  const resetForm = useCallback(() => {
    setFormTipo('despesa');
    setFormCategoria('');
    setFormDescricao('');
    setFormValor('');
    setFormData(format(hoje, 'yyyy-MM-dd'));
    setFormBanco('');
    setFormCarteira(null);
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
    setFormCarteira(t.carteira_id ?? null);
    setEditingTransacao(t);
  }, []);

  // --- Home (hooks → props da view pura) ---
  const home = useFinancasHome(competencia, hojeISO, {
    onNovo: openAddModal,
    onEditar: openEditModal,
  });

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
        carteira_id: carteiraId ?? undefined,
        banco: carteiras.find((c) => c.id === carteiraId)?.nome ?? (formBanco || undefined),
      };
      criarTransacao.mutate(payload, {
        onSuccess: () => {
          toast.success('Lançamento criado!');
          setShowAddModal(false);
          resetForm();
        },
        onError: () => {
          toast.error('Erro ao criar lançamento');
        },
      });
    },
    [carteiraId, carteiras, formTipo, formCategoria, formDescricao, formValor, formData, formBanco, criarTransacao, toast, resetForm],
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
      };
      if (carteiras.length === 0) {
        // Sem carteiras (ou consulta falhou): só o campo texto do banco está na tela.
        if (formBanco) payload.banco = formBanco;
      } else if (carteiraId !== (editingTransacao.carteira_id ?? null)) {
        // Só quando o usuário trocou: senão carteira_id e o banco digitado (ex.: "Itaú") ficam como estavam.
        payload.carteira_id = carteiraId;
        payload.banco = carteiras.find((c) => c.id === carteiraId)?.nome ?? null;
      }
      atualizarTransacao.mutate(
        { id: editingTransacao.id, data: payload },
        {
          onSuccess: () => {
            toast.success('Lançamento atualizado!');
            setEditingTransacao(null);
            resetForm();
          },
          onError: () => {
            toast.error('Erro ao atualizar lançamento');
          },
        },
      );
    },
    [carteiraId, carteiras, formTipo, formCategoria, formDescricao, formValor, formData, formBanco, atualizarTransacao, editingTransacao, toast, resetForm],
  );

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
        placeholder="Ex.: Alimentação, Transporte…"
        value={formCategoria}
        onChange={(e) => setFormCategoria(e.target.value)}
        required
      />
      <Input
        label="Descrição"
        placeholder="Descrição do lançamento"
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
      {carteiras.length > 0 ? (
        <SeletorCarteira
          id="lancamento-carteira" label="Banco ou carteira" carteiras={carteiras} value={carteiraId} onChange={setFormCarteira}
          onSemCarteira={editingTransacao && !editingTransacao.carteira_id ? () => setFormCarteira(null) : undefined}
        />
      ) : <Input
        label="Banco (opcional)"
        placeholder="Ex.: Nubank, Itaú…"
        value={formBanco}
        onChange={(e) => setFormBanco(e.target.value)}
      />}
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
        {/* Espera só enquanto carrega; se a consulta falhar, o lançamento segue pelo campo texto do banco. */}
        <Button type="submit" disabled={listaCarteiras.isPending} isLoading={isSubmitting}>
          Salvar
        </Button>
      </div>
    </form>
  );

  return (
    <div className="animate-fadeSlide space-y-5">
      {/* Cabeçalho: título + seletor de mês compacto */}
      <div className="flex items-center justify-between gap-2">
        <h1 className="font-syne text-3xl font-bold text-text">Finanças</h1>
        <div className="flex items-center gap-2">
          <Button onClick={() => setAcoesAbertas(true)} className="hidden md:inline-flex">
            <Plus size={16} aria-hidden="true" /> Lançar
          </Button>
        <div className="flex items-center">
          <button
            onClick={mesAnterior}
            className="rounded-lg p-2 text-muted transition-colors hover:bg-card2 hover:text-text"
            aria-label="Mês anterior"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="whitespace-nowrap text-[15px] font-medium text-text" aria-live="polite">
            {mesLabel}
          </span>
          <button
            onClick={mesProximo}
            className="rounded-lg p-2 text-muted transition-colors hover:bg-card2 hover:text-text"
            aria-label="Próximo mês"
          >
            <ChevronRight size={18} />
          </button>
        </div>
        </div>
      </div>

      <LancamentoRapidoSheet open={acoesAbertas} onClose={() => setAcoesAbertas(false)} />

      {/* Agente IA (fala de todos os módulos; fora do modo Finanças) */}
      {mode !== 'financas' && <AgentBannerAuto />}

      <FinancasHomeView {...home} />

      {/* Add Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Novo lançamento"
      >
        {renderForm(handleSubmitAdd, criarTransacao.isPending)}
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={!!editingTransacao}
        onClose={() => setEditingTransacao(null)}
        title="Editar lançamento"
      >
        {renderForm(handleSubmitEdit, atualizarTransacao.isPending)}
      </Modal>

    </div>
  );
}

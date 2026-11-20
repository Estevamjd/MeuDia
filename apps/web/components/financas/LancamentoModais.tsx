'use client';

import { useState, useMemo, useCallback, useRef } from 'react';
import { rotuloParcela, type Transacao, type TransacaoInsert } from '@meudia/shared';
import { useCarteiras, useCriarTransacao, useAtualizarTransacao, useCriarDespesaParcelada } from '../../hooks';
import { hojeSP } from '../../lib/hoje';
import { Button, Modal, Input, Select, useToast } from '../ui';
import { SeletorCarteira } from './SeletorCarteira';
import { CampoParcelado, MENSAGEM_TOTAL_VAZIO, PARCELAS_PADRAO, avaliarParcelas } from './CampoParcelado';
import { formatBRL } from '../../lib/financas-ui';

/**
 * "Novo lançamento" (receita ou despesa, com banco em texto quando não há carteira) e "Editar lançamento":
 * os mesmos modais na Início e em Gastos. Devolve as ações e o JSX dos modais.
 */
export function useLancamentoModais() {
  const toast = useToast();
  const listaCarteiras = useCarteiras();
  const carteiras = useMemo(() => (listaCarteiras.data ?? []).filter((c) => !c.arquivada), [listaCarteiras.data]);
  const [formCarteira, setFormCarteira] = useState<string | null>(null);

  const hoje = useMemo(() => new Date(), []);

  // --- Mutations ---
  const criarTransacao = useCriarTransacao();
  const atualizarTransacao = useAtualizarTransacao();
  const criarParcelada = useCriarDespesaParcelada();

  // --- Modal state ---
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTransacao, setEditingTransacao] = useState<Transacao | null>(null);
  // Novo: carteira escolhida ou a primeira ativa. Edição: exatamente a do lançamento (NULL em lançamento antigo =
  // "Sem carteira"); nunca cai na primeira carteira por conta própria.
  const carteiraId = editingTransacao
    ? formCarteira
    : carteiras.find((c) => c.id === formCarteira)?.id ?? carteiras[0]?.id ?? null;

  // --- Form state ---
  const [formTipo, setFormTipo] = useState<'receita' | 'despesa'>('despesa');
  const [formCategoria, setFormCategoria] = useState('');
  const [formDescricao, setFormDescricao] = useState('');
  const [formValor, setFormValor] = useState('');
  const [formData, setFormData] = useState(hojeSP(hoje));
  const [formBanco, setFormBanco] = useState('');
  // Parcelado no cartão: só em despesa nova (nunca receita nem edição).
  const [formParcelar, setFormParcelar] = useState(false);
  const [formParcelas, setFormParcelas] = useState(PARCELAS_PADRAO);

  // --- Reset form ---
  const resetForm = useCallback(() => {
    setFormTipo('despesa');
    setFormCategoria('');
    setFormDescricao('');
    setFormValor('');
    setFormData(hojeSP(hoje));
    setFormBanco('');
    setFormCarteira(null);
    setFormParcelar(false);
    setFormParcelas(PARCELAS_PADRAO);
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

  // Trava síncrona do parcelado: dois envios antes do re-render (isPending) criariam dois grupos de parcelas.
  // Liberada quando a gravação termina (sucesso ou erro).
  const enviandoParceladoRef = useRef(false);

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
      if (formTipo === 'despesa' && formParcelar) {
        if (enviandoParceladoRef.current) return;
        const { plano, erro } = avaliarParcelas(payload.valor, formParcelas, formData);
        if (!plano) return toast.error(erro ?? MENSAGEM_TOTAL_VAZIO);
        enviandoParceladoRef.current = true;
        criarParcelada.mutate(
          { base: payload, total: payload.valor, parcelas: formParcelas },
          {
            onSuccess: () => {
              toast.success(`Compra salva em ${formParcelas}× de ${formatBRL(plano[1]!.valor)}`);
              setShowAddModal(false);
              resetForm();
            },
            onError: () => toast.error('Não foi possível salvar a compra parcelada. Tente de novo.'),
            onSettled: () => {
              enviandoParceladoRef.current = false;
            },
          },
        );
        return;
      }
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
    [carteiraId, carteiras, formTipo, formCategoria, formDescricao, formValor, formData, formBanco, formParcelar, formParcelas, criarTransacao, criarParcelada, toast, resetForm],
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
  const renderForm = (onSubmit: (e: React.FormEvent) => void, isSubmitting: boolean, modo: 'novo' | 'editar') => {
    // Parcela: edita só esta linha; continua despesa (o banco recusa parcela como receita), então o Tipo some.
    const parcelaEditada = modo === 'editar' && editingTransacao ? rotuloParcela(editingTransacao) : null;
    return (
    <form onSubmit={onSubmit} className="space-y-4">
      {parcelaEditada && (
        <p className="rounded-lg border border-border bg-card2 px-3 py-2 text-[13px] text-muted" data-testid="nota-parcela-edicao">
          Parcela {parcelaEditada}. Você muda só esta; as outras ficam como estão.
        </p>
      )}
      {!parcelaEditada && <Select
        label="Tipo"
        value={formTipo}
        onChange={(e) => setFormTipo(e.target.value as 'receita' | 'despesa')}
        options={[
          { value: 'despesa', label: 'Despesa' },
          { value: 'receita', label: 'Receita' },
        ]}
      />}
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
        label={modo === 'novo' && formTipo === 'despesa' && formParcelar ? 'Valor total da compra (R$)' : 'Valor (R$)'}
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
      {modo === 'novo' && formTipo === 'despesa' && (
        <CampoParcelado
          ligado={formParcelar}
          onLigado={setFormParcelar}
          parcelas={formParcelas}
          onParcelas={setFormParcelas}
          total={Number(formValor) || 0}
          dataPrimeira={formData}
        />
      )}
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
  };

  const modais = (
    <>
      {/* Add Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Novo lançamento"
      >
        {renderForm(handleSubmitAdd, criarTransacao.isPending || criarParcelada.isPending, 'novo')}
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={!!editingTransacao}
        onClose={() => setEditingTransacao(null)}
        title="Editar lançamento"
      >
        {renderForm(handleSubmitEdit, atualizarTransacao.isPending, 'editar')}
      </Modal>

    </>
  );

  return { abrirNovo: openAddModal, abrirEdicao: openEditModal, modais };
}

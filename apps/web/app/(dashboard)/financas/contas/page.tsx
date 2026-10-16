'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Plus, Receipt, Pencil, Trash2 } from 'lucide-react';
import type { ContaPagar, Recorrencia } from '@meudia/shared';
import { competenciaDe, hojeSP } from '@meudia/shared';
import { useAtualizarConta, useContas, useCriarConta, useDesativarConta } from '../../../../hooks';
import {
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  Input,
  Modal,
  Select,
  SkeletonList,
  useToast,
} from '../../../../components/ui';
import { LembretesPush } from '../../../../components/financas/LembretesPush';
import {
  CONTA_FORM_VAZIO,
  RECORRENCIA_LABEL,
  contaParaForm,
  descreverVencimento,
  montarContaInsert,
  type ContaForm,
} from '../../../../lib/contas-form';
import { formatBRL } from '../../../../lib/financas-ui';

export default function ContasPage() {
  const toast = useToast();
  const { data: contas, isLoading, isError, refetch } = useContas();
  const criar = useCriarConta();
  const atualizar = useAtualizarConta();
  const desativar = useDesativarConta();

  const [form, setForm] = useState<ContaForm | null>(null);
  const [editando, setEditando] = useState<ContaPagar | null>(null);
  const [excluindo, setExcluindo] = useState<ContaPagar | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const competencia = competenciaDe(hojeSP());

  const abrirNova = () => {
    setEditando(null);
    setErro(null);
    setForm(CONTA_FORM_VAZIO);
  };
  const abrirEdicao = (conta: ContaPagar) => {
    setEditando(conta);
    setErro(null);
    setForm(contaParaForm(conta));
  };
  const fechar = () => setForm(null);

  const salvar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    const resultado = montarContaInsert(form);
    if (!resultado.ok) {
      setErro(resultado.erro);
      return;
    }
    const opcoes = {
      onSuccess: () => {
        toast.success(editando ? 'Conta atualizada!' : 'Conta criada!');
        fechar();
      },
      onError: () => toast.error('Não foi possível salvar a conta.'),
    };
    if (editando) atualizar.mutate({ id: editando.id, data: resultado.data }, opcoes);
    else criar.mutate(resultado.data, opcoes);
  };

  const confirmarExclusao = () => {
    if (!excluindo) return;
    desativar.mutate(excluindo.id, {
      onSuccess: () => {
        toast.success('Conta excluída. O histórico de pagamentos foi mantido.');
        setExcluindo(null);
      },
      onError: () => toast.error('Não foi possível excluir a conta.'),
    });
  };

  const set = (parcial: Partial<ContaForm>) => setForm((f) => (f ? { ...f, ...parcial } : f));

  return (
    <div className="animate-fadeSlide space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-syne text-3xl font-bold text-text">Contas</h1>
        <Button onClick={abrirNova}>
          <Plus size={16} aria-hidden="true" /> Nova conta
        </Button>
      </div>

      <LembretesPush />

      {isLoading ? (
        <SkeletonList count={4} />
      ) : isError ? (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-card border border-red/40 bg-card p-3 text-sm">
          <span>Não foi possível carregar suas contas.</span>
          <Button variant="ghost" onClick={() => void refetch()}>Tentar de novo</Button>
        </div>
      ) : !contas || contas.length === 0 ? (
        <EmptyState
          icon={<Receipt size={48} />}
          title="Nenhuma conta cadastrada"
          description="Cadastre luz, aluguel, cartão... com o vencimento para receber lembretes."
          actionLabel="Cadastrar conta"
          onAction={abrirNova}
        />
      ) : (
        <ul className="space-y-2">
          {contas.map((conta) => (
            <li key={conta.id} className="flex flex-wrap items-center gap-3 rounded-card border border-border bg-card p-4">
              <Link
                href={`/financas/contas/${conta.id}?competencia=${competencia}`}
                className="min-w-0 flex-1 basis-full sm:basis-0 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
              >
                {/* Selos quebram de linha em vez de serem cortados (375px). */}
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium text-text">
                  <span className="min-w-0 max-w-full truncate" title={conta.descricao}>{conta.descricao}</span>
                  <Badge color="purple" className="shrink-0 whitespace-nowrap">{RECORRENCIA_LABEL[conta.recorrencia]}</Badge>
                  {conta.assinatura_id && <Badge color="teal" className="shrink-0 whitespace-nowrap">Assinatura</Badge>}
                </p>
                <p className="text-xs text-muted">
                  {descreverVencimento(conta)} · {conta.categoria}
                </p>
              </Link>
              <span className="shrink-0 whitespace-nowrap text-sm font-bold text-text">{formatBRL(Number(conta.valor))}</span>
              {conta.assinatura_id ? (
                // Espelho de assinatura: editar/excluir pela tela de assinaturas.
                <Link href="/assinaturas" className="shrink-0 whitespace-nowrap text-xs text-accent hover:underline">
                  Editar em Assinaturas
                </Link>
              ) : (
                <div className="flex shrink-0 gap-1">
                  <Button variant="icon" onClick={() => abrirEdicao(conta)} aria-label={`Editar conta ${conta.descricao}`}>
                    <Pencil size={14} />
                  </Button>
                  <Button variant="icon" onClick={() => setExcluindo(conta)} aria-label={`Excluir conta ${conta.descricao}`}>
                    <Trash2 size={14} />
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <Modal isOpen={!!form} onClose={fechar} title={editando ? 'Editar conta' : 'Nova conta'}>
        {form && (
          <form onSubmit={salvar} className="space-y-4" noValidate>
            <Input label="Nome" placeholder="Ex: Luz, Aluguel..." value={form.descricao} onChange={(e) => set({ descricao: e.target.value })} required />
            <Input
              label="Valor (R$)"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0.01"
              placeholder="0,00"
              value={form.valor}
              onChange={(e) => set({ valor: e.target.value })}
              required
            />
            <Select
              label="Recorrência"
              value={form.recorrencia}
              onChange={(e) => set({ recorrencia: e.target.value as Recorrencia })}
              options={(Object.keys(RECORRENCIA_LABEL) as Recorrencia[]).map((r) => ({ value: r, label: RECORRENCIA_LABEL[r] }))}
            />
            {form.recorrencia !== 'unica' && (
              <Input
                label="Dia do vencimento"
                type="number"
                inputMode="numeric"
                min="1"
                max="31"
                placeholder="1-31"
                value={form.dia}
                onChange={(e) => set({ dia: e.target.value })}
                required
              />
            )}
            {form.recorrencia === 'anual' && (
              <Input
                label="Mês do vencimento"
                type="number"
                inputMode="numeric"
                min="1"
                max="12"
                placeholder="1-12"
                value={form.mes}
                onChange={(e) => set({ mes: e.target.value })}
                required
              />
            )}
            {form.recorrencia === 'unica' && (
              <Input label="Data do vencimento" type="date" value={form.data} onChange={(e) => set({ data: e.target.value })} required />
            )}
            <Input label="Categoria" placeholder="Ex: Casa, Transporte..." value={form.categoria} onChange={(e) => set({ categoria: e.target.value })} />
            {erro && (
              <p role="alert" className="text-sm text-red">
                {erro}
              </p>
            )}
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="ghost" onClick={fechar}>
                Cancelar
              </Button>
              <Button type="submit" isLoading={criar.isPending || atualizar.isPending}>
                Salvar
              </Button>
            </div>
          </form>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={!!excluindo}
        onClose={() => setExcluindo(null)}
        onConfirm={confirmarExclusao}
        title="Excluir conta"
        message={`Excluir "${excluindo?.descricao}"? Ela para de gerar lembretes; os pagamentos já registrados continuam no histórico.`}
        confirmLabel="Excluir"
        isLoading={desativar.isPending}
      />
    </div>
  );
}

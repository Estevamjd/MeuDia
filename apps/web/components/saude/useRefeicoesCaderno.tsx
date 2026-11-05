'use client';

import { useMemo, useState } from 'react';
import type { ItemRefeicao } from '@meudia/shared';
import { useAtualizarRefeicao, useCriarRefeicao, useExcluirRefeicao, useRefeicoesDoDia } from '../../hooks';
import { useToast } from '../ui/Toast';
import { ConfirmarExclusao } from '../financas/ConfirmarExclusao';
import { copiaRefeicao, linhaDoTempo, totaisDosItens, type EntradaRefeicao } from '../../lib/refeicoes-dia';
import { EditarRefeicao, type ModoEditor } from './EditarRefeicao';

/**
 * Refeições do dia no Caderno (Hoje e Dieta). Sem a 009: feita = registro em `refeicoes`.
 * Marcar uma pendente cria o registro com os itens do modelo (sem valor); desmarcar apaga o registro,
 * sempre depois de "Isso não pode ser desfeito.".
 */
export function useRefeicoesCaderno(data: string) {
  const toast = useToast();
  const q = useRefeicoesDoDia(data);
  const criar = useCriarRefeicao();
  const atualizar = useAtualizarRefeicao();
  const excluir = useExcluirRefeicao();
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [editor, setEditor] = useState<{ entrada: EntradaRefeicao; modo: ModoEditor } | null>(null);
  const [desmarcando, setDesmarcando] = useState<EntradaRefeicao | null>(null);

  const entradas = useMemo(() => linhaDoTempo(q.data ?? []), [q.data]);

  const registrar = async (e: EntradaRefeicao, itens: ItemRefeicao[]) => {
    await criar.mutateAsync({ tipo: e.tipo, data, items: itens, ...totaisDosItens(itens) });
  };

  const onPonto = async (e: EntradaRefeicao) => {
    if (e.feita) {
      setDesmarcando(e);
      return;
    }
    setOcupado(e.chave);
    try {
      await registrar(e, e.itens);
    } catch {
      toast.error('Não deu para marcar a refeição. Tente de novo.');
    } finally {
      setOcupado(null);
    }
  };

  const salvarEditor = async (itens: ItemRefeicao[]) => {
    if (!editor) return;
    const { entrada } = editor;
    try {
      if (entrada.refeicao) {
        await atualizar.mutateAsync({ id: entrada.refeicao.id, data: { items: itens, ...totaisDosItens(itens) } });
      } else {
        await registrar(entrada, itens);
      }
      setEditor(null);
    } catch {
      toast.error('Não deu para salvar a refeição. Tente de novo.');
    }
  };

  const duplicar = async (e: EntradaRefeicao) => {
    if (!e.refeicao) return;
    setOcupado(e.chave);
    try {
      await criar.mutateAsync(copiaRefeicao(e.refeicao));
      toast.success(`${e.nome} duplicada.`);
    } catch {
      toast.error('Não deu para duplicar. Tente de novo.');
    } finally {
      setOcupado(null);
    }
  };

  const confirmarDesmarcar = async () => {
    if (!desmarcando?.refeicao) return;
    try {
      await excluir.mutateAsync(desmarcando.refeicao.id);
      setDesmarcando(null);
    } catch {
      toast.error('Não deu para desmarcar. Tente de novo.');
    }
  };

  const modais = (
    <>
      {editor && (
        <EditarRefeicao
          key={`${editor.entrada.chave}-${editor.modo}`}
          aberto
          modo={editor.modo}
          nome={editor.entrada.nome}
          itens={editor.entrada.itens}
          salvando={criar.isPending || atualizar.isPending}
          onFechar={() => setEditor(null)}
          onSalvar={(itens) => void salvarEditor(itens)}
        />
      )}
      <ConfirmarExclusao
        isOpen={!!desmarcando}
        onClose={() => setDesmarcando(null)}
        onConfirm={() => void confirmarDesmarcar()}
        titulo={`Desmarcar ${desmarcando?.nome.toLowerCase() ?? 'refeição'}`}
        detalhe="O registro desta refeição sai do dia e ela volta a ficar pendente."
        isLoading={excluir.isPending}
      />
    </>
  );

  return {
    query: q,
    entradas,
    ocupado,
    onPonto: (e: EntradaRefeicao) => void onPonto(e),
    abrirEditor: (entrada: EntradaRefeicao, modo: ModoEditor) => setEditor({ entrada, modo }),
    duplicar: (e: EntradaRefeicao) => void duplicar(e),
    modais,
  };
}

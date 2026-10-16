'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Competencia, Transacao } from '@meudia/shared';
import {
  useContasMes,
  useCriarRenda,
  useOrcamento,
  usePushLembretes,
  useRendas,
  useResumoFinanceiroMes,
  useTransacoesMes,
} from '../../../hooks';
import { useToast } from '../../ui';
import { partesCompetencia } from '../../../lib/financas-ui';
import { usePagamentoAcoes } from '../usePagamentoAcoes';
import { AVISO_LEMBRETES_DISPENSADO_KEY, mostrarAvisoLembretes } from './AvisoLembretes';
import type { FinancasHomeViewProps } from './FinancasHomeView';
import { montarHome } from './montarHome';

const RENDA_PADRAO = 'Renda principal';

function lerDispensado(): boolean {
  try {
    return localStorage.getItem(AVISO_LEMBRETES_DISPENSADO_KEY) === '1';
  } catch {
    return false;
  }
}

interface AcoesLancamento {
  onNovo: () => void;
  onEditar: (t: Transacao) => void;
  onExcluir: (t: Transacao) => void;
}

/** Container da home: chama os hooks e entrega as props prontas para `FinancasHomeView`. */
export function useFinancasHome(competencia: Competencia, hojeISO: string, acoes: AcoesLancamento): FinancasHomeViewProps {
  const { ano, mes } = partesCompetencia(competencia);
  const toast = useToast();
  const resumo = useResumoFinanceiroMes(ano, mes);
  const contas = useContasMes(competencia);
  const orcamento = useOrcamento();
  const transacoes = useTransacoesMes(ano, mes);
  const rendas = useRendas();
  const push = usePushLembretes();
  const criarRenda = useCriarRenda();
  const { pagarConta, contaOcupada } = usePagamentoAcoes();
  const [expandido, setExpandido] = useState(false);
  const [rendaAberta, setRendaAberta] = useState(false);
  // Começa dispensado até ler o localStorage (no cliente): evita piscar o aviso.
  const [avisoDispensado, setAvisoDispensado] = useState(true);
  useEffect(() => setAvisoDispensado(lerDispensado()), []);

  const secoes = useMemo(
    () =>
      resumo.data
        ? montarHome({
            competencia,
            hojeISO,
            resumo: resumo.data,
            ocorrencias: contas.data ?? [],
            orcamento: orcamento.data ?? [],
            transacoes: transacoes.data ?? [],
          })
        : null,
    [competencia, hojeISO, resumo.data, contas.data, orcamento.data, transacoes.data],
  );

  // Falha em qualquer consulta que alimenta as seções vira erro (nada de lista vazia silenciosa).
  const consultas = [resumo, contas, orcamento, transacoes];
  const comErro = consultas.filter((q) => q.isError);

  const rendaCadastrada = (rendas.data ?? []).some((r) => r.ativo);
  const temContas = (contas.data ?? []).length > 0;
  // Sem a lista de rendas carregada, só o resumo vazio garante que falta o passo 1.
  const mostrarBoasVindas = rendas.isSuccess ? !rendaCadastrada || !temContas : !!secoes?.vazio;

  return {
    estado: resumo.isLoading || contas.isLoading ? 'carregando' : comErro.length > 0 || !secoes ? 'erro' : 'pronto',
    onTentarDeNovo: () => {
      for (const q of comErro.length > 0 ? comErro : [resumo]) void q.refetch();
    },
    secoes,
    hojeISO,
    boasVindas: mostrarBoasVindas
      ? {
          rendaCadastrada,
          onCadastrarRenda: () => {
            criarRenda.reset();
            setRendaAberta(true);
          },
        }
      : null,
    avisoLembretes: mostrarAvisoLembretes(temContas, push.estado, avisoDispensado)
      ? {
          estado: push.estado,
          ativando: push.ocupado,
          onAtivar: () =>
            void push.ativar().catch(() => toast.error('Não foi possível ativar os lembretes. Tente de novo.')),
          onDispensar: () => {
            setAvisoDispensado(true);
            try {
              localStorage.setItem(AVISO_LEMBRETES_DISPENSADO_KEY, '1');
            } catch {
              // Sem storage (modo privado): dispensa só nesta sessão.
            }
          },
        }
      : null,
    rendaSheet: {
      open: rendaAberta,
      onClose: () => setRendaAberta(false),
      salvando: criarRenda.isPending,
      erro: criarRenda.isError ? 'Não foi possível salvar a renda. Tente de novo.' : undefined,
      onSalvar: (valor, dia) =>
        criarRenda.mutate(
          { descricao: RENDA_PADRAO, valor, dia_recebimento: dia },
          {
            onSuccess: () => {
              setRendaAberta(false);
              toast.success('Renda salva');
            },
          },
        ),
    },
    contaOcupada,
    onPagar: (c) => pagarConta({ contaId: c.contaId, competencia: c.competencia, descricao: c.descricao }),
    lancamentos: {
      ...acoes,
      carregando: transacoes.isLoading,
      expandido,
      onAlternarExpandido: () => setExpandido((v) => !v),
    },
  };
}

'use client';

import { useMemo, useState } from 'react';
import type { Competencia, Transacao } from '@meudia/shared';
import {
  useContasMes,
  useOrcamento,
  usePushLembretes,
  useRendas,
  useResumoFinanceiroMes,
  useTransacoesMes,
} from '../../../hooks';
import { useToast } from '../../ui';
import { partesCompetencia } from '../../../lib/financas-ui';
import { usePagamentoAcoes } from '../usePagamentoAcoes';
import type { FinancasHomeViewProps } from './FinancasHomeView';
import { montarHome } from './montarHome';

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
  const { pagarConta, contaOcupada } = usePagamentoAcoes();
  const [expandido, setExpandido] = useState(false);

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

  return {
    estado: resumo.isLoading || contas.isLoading ? 'carregando' : resumo.isError || !secoes ? 'erro' : 'pronto',
    onTentarDeNovo: () => void resumo.refetch(),
    secoes,
    hojeISO,
    boasVindas: {
      rendaCadastrada: (rendas.data ?? []).some((r) => r.ativo),
      contasCadastradas: (contas.data ?? []).length > 0,
      estadoLembretes: push.estado,
      ativandoLembretes: push.ocupado,
      onAtivarLembretes: () =>
        void push.ativar().catch(() => toast.error('Não foi possível ativar os lembretes. Tente de novo.')),
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

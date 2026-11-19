'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Competencia } from '@meudia/shared';
import {
  useContas,
  useContasMes,
  useCriarRenda,
  useFecharMesCofrinho,
  usePainelSaldo,
  useReceberRenda,
  useRendas,
  useResumoFinanceiroMes,
  useTransacoesMes,
} from '../../../hooks';
import { useToast } from '../../ui';
import { formatBRL, partesCompetencia } from '../../../lib/financas-ui';
import { usePagamentoAcoes } from '../usePagamentoAcoes';
import type { FinancasHomeViewProps } from './FinancasHomeView';
import { montarHome } from './montarHome';
import { montarDashboard } from './montarDashboard';
import { montarResumoMes } from '../resumo/montarResumoMes';
import type { RendaAReceberItem } from './CardRendaAReceber';
import { lerEsconderValores, salvarEsconderValores } from '../../../lib/carteiras-ui';

const RENDA_PADRAO = 'Renda principal';

/** Container da home: chama os hooks e entrega as props prontas para `FinancasHomeView`. */
export function useFinancasHome(competencia: Competencia, hojeISO: string, onGastei: () => void): FinancasHomeViewProps {
  const { ano, mes } = partesCompetencia(competencia);
  const toast = useToast();
  const resumo = useResumoFinanceiroMes(ano, mes);
  const contas = useContasMes(competencia);
  const transacoes = useTransacoesMes(ano, mes);
  const rendas = useRendas();
  const contasCadastradas = useContas();
  const criarRenda = useCriarRenda();
  const { pagarConta, contaOcupada } = usePagamentoAcoes();
  const painel = usePainelSaldo(hojeISO);
  const receber = useReceberRenda();
  const fecharMes = useFecharMesCofrinho();
  // "X"/fundo fecha sem responder: só nesta visita (a pergunta volta no próximo acesso).
  const [fechamentoAdiado, setFechamentoAdiado] = useState<string | null>(null);
  const [recebendo, setRecebendo] = useState<RendaAReceberItem | null>(null);
  const [escondido, setEscondido] = useState(false);
  useEffect(() => setEscondido(lerEsconderValores()), []);
  const [rendaAberta, setRendaAberta] = useState(false);

  const secoes = useMemo(
    () =>
      resumo.data
        ? montarHome({
            competencia,
            hojeISO,
            resumo: resumo.data,
            ocorrencias: contas.data ?? [],
            transacoes: transacoes.data ?? [],
          })
        : null,
    [competencia, hojeISO, resumo.data, contas.data, transacoes.data],
  );

  const dados = useMemo(
    () => (painel.data ? montarDashboard(competencia, hojeISO, painel.data, transacoes.data ?? []) : null),
    [competencia, hojeISO, painel.data, transacoes.data],
  );
  const resumoMes = useMemo(
    () => (transacoes.data ? montarResumoMes(competencia, transacoes.data, dados?.sobraMes ?? null) : null),
    [competencia, transacoes.data, dados],
  );
  const carteirasAtivas = painel.data?.carteiras.map((s) => s.carteira) ?? [];
  const carteiraPadrao = carteirasAtivas.find((c) => c.id === painel.data?.carteiraPadraoId)?.id ?? carteirasAtivas[0]?.id ?? null;
  const podePagar = !!painel.data && !painel.isError && !painel.isLoading;

  // Falha em qualquer consulta que alimenta as seções ou o onboarding vira erro (nada de lista vazia silenciosa).
  const consultas = [resumo, contas, transacoes, rendas, contasCadastradas];
  const comErro = consultas.filter((q) => q.isError);
  const carregando = resumo.isLoading || contas.isLoading || rendas.isLoading || contasCadastradas.isLoading;

  const rendaCadastrada = (rendas.data ?? []).some((r) => r.ativo);
  // Definições cadastradas (não as ocorrências do mês): conta anual/avulsa de outro mês também conta.
  const temContas = (contasCadastradas.data ?? []).some((c) => c.ativo);
  // Sem a lista de rendas carregada, só o resumo vazio garante que falta o passo 1.
  const mostrarBoasVindas = rendas.isSuccess ? !rendaCadastrada || !temContas : !!secoes?.vazio;

  return {
    estado: carregando ? 'carregando' : comErro.length > 0 || !secoes ? 'erro' : 'pronto',
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
    pagamentoBloqueado: !podePagar,
    erroPainel: painel.isError ? ((painel.error as { code?: string })?.code === 'SCHEMA_DESATUALIZADO'
      ? 'O MeuDia está terminando uma atualização. Tente de novo em alguns minutos.'
      : 'Não foi possível carregar seus bancos. Tente de novo.') : undefined,
    // "Paguei" em 1 toque: debita do último banco usado (ou do primeiro), se houver.
    onPagar: (c) =>
      podePagar && pagarConta({ contaId: c.contaId, competencia: c.competencia, descricao: c.descricao }, carteiraPadrao ? { carteira_id: carteiraPadrao } : {}),
    // Painel indisponível (ex.: carregando ou falha): a home segue com o resumo do mês.
    dashboard: dados
      ? {
          ...dados,
          escondido,
          onAlternarOlho: () =>
            setEscondido((v) => {
              salvarEsconderValores(!v);
              return !v;
            }),
          onRecebi: (r) => {
            receber.reset();
            setRecebendo(r);
          },
          fechamentoSheet: {
            pergunta: dados.fechamento,
            aberto: !!dados.fechamento && fechamentoAdiado !== dados.fechamento.competencia,
            salvando: fecharMes.isPending,
            onClose: () => setFechamentoAdiado(dados.fechamento?.competencia ?? null),
            onAgoraNao: () => {
              const p = dados.fechamento;
              if (!p) return;
              fecharMes.mutate(
                { competencia: p.competencia, guardar: false },
                { onError: () => toast.error('Não foi possível salvar. Tente de novo.') },
              );
            },
            onGuardar: (valor) => {
              const p = dados.fechamento;
              if (!p) return;
              fecharMes.mutate(
                { competencia: p.competencia, guardar: true, valor },
                {
                  onSuccess: () => toast.success(`Guardado no Cofrinho: ${formatBRL(valor)}`),
                  onError: () => toast.error('Não foi possível guardar. Tente de novo.'),
                },
              );
            },
          },
          recebiSheet: {
            renda: recebendo,
            carteiras: carteirasAtivas,
            // Carteira da renda só se ainda estiver ativa (arquivada daria P0002 no receber_renda).
            carteiraPadrao:
              carteirasAtivas.find(
                (c) => recebendo && c.id === painel.data?.rendasAReceber.find((x) => x.renda.id === recebendo.rendaId)?.renda.carteira_id,
              )?.id ?? carteiraPadrao,
            salvando: receber.isPending,
            onClose: () => setRecebendo(null),
            onConfirmar: (carteiraId) => {
              if (!recebendo) return;
              receber.mutate(
                { rendaId: recebendo.rendaId, competencia: recebendo.competencia, carteira_id: carteiraId },
                {
                  onSuccess: () => {
                    toast.success(`Recebido: ${recebendo.descricao}`);
                    setRecebendo(null);
                  },
                  onError: () => toast.error('Não foi possível registrar o recebimento. Tente de novo.'),
                },
              );
            },
          },
        }
      : null,
    onGastei,
    resumo: resumoMes,
    escondido,
    onAlternarOlho: () =>
      setEscondido((v) => {
        salvarEsconderValores(!v);
        return !v;
      }),
  };
}


'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Competencia, Transacao } from '@meudia/shared';
import {
  useVinculosTransacoes,
  useDesfazerRecebimento,
  useContas,
  useContasMes,
  useCriarRenda,
  usePainelSaldo,
  useReceberRenda,
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
import { montarDashboard } from './montarDashboard';
import type { RendaAReceberItem } from './CardRendaAReceber';
import { lerEsconderValores, salvarEsconderValores } from '../../../lib/carteiras-ui';

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
  const vinculos = useVinculosTransacoes((transacoes.data ?? []).map((t) => t.id));
  const desfazerRecebimento = useDesfazerRecebimento();
  const rendas = useRendas();
  const contasCadastradas = useContas();
  const push = usePushLembretes();
  const criarRenda = useCriarRenda();
  const { pagarConta, desfazerPagamento, contaOcupada } = usePagamentoAcoes();
  const painel = usePainelSaldo(hojeISO);
  const receber = useReceberRenda();
  const [recebendo, setRecebendo] = useState<RendaAReceberItem | null>(null);
  const [escondido, setEscondido] = useState(false);
  useEffect(() => setEscondido(lerEsconderValores()), []);
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

  const dados = useMemo(
    () => (painel.data ? montarDashboard(competencia, hojeISO, painel.data, transacoes.data ?? []) : null),
    [competencia, hojeISO, painel.data, transacoes.data],
  );
  const carteirasAtivas = painel.data?.carteiras.map((s) => s.carteira) ?? [];
  const carteiraPadrao = carteirasAtivas.find((c) => c.id === painel.data?.carteiraPadraoId)?.id ?? carteirasAtivas[0]?.id ?? null;
  const podePagar = !!painel.data && !painel.isError && !painel.isLoading;

  // Falha em qualquer consulta que alimenta as seções, o onboarding ou o aviso vira erro (nada de lista vazia silenciosa).
  const consultas = [resumo, contas, orcamento, transacoes, rendas, contasCadastradas];
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
          recebiSheet: {
            renda: recebendo,
            carteiras: carteirasAtivas,
            carteiraPadrao:
              (recebendo && painel.data?.rendasAReceber.find((x) => x.renda.id === recebendo.rendaId)?.renda.carteira_id) || carteiraPadrao,
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
    lancamentos: {
      ...acoes,
      vinculos: Object.fromEntries([
        ...(vinculos.data?.recebimentos ?? []).filter((r) => r.transacao_id).map((r) => [r.transacao_id!, 'recebimento']),
        ...(vinculos.data?.pagamentos ?? []).filter((p) => p.transacao_id).map((p) => [p.transacao_id!, 'pagamento']),
      ]) as Record<string, 'recebimento' | 'pagamento'>,
      acoesBloqueadas: !vinculos.isSuccess,
      onDesfazer: (t) => {
        const r = vinculos.data?.recebimentos.find((r) => r.transacao_id === t.id);
        if (r) {
          desfazerRecebimento.mutate({ rendaId: r.renda_id, competencia: r.competencia }, {
            onSuccess: () => { void vinculos.refetch(); toast.success('Recebimento desfeito'); },
            onError: () => toast.error('Não foi possível desfazer o recebimento. Tente de novo.'),
          });
          return;
        }
        const p = vinculos.data?.pagamentos.find((p) => p.transacao_id === t.id);
        if (p) desfazerPagamento({ contaId: p.conta_id, competencia: p.competencia, descricao: t.descricao });
      },
      carregando: transacoes.isLoading,
      expandido,
      onAlternarExpandido: () => setExpandido((v) => !v),
    },
  };
}

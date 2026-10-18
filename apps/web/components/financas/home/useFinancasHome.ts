'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Competencia, Transacao } from '@meudia/shared';
import {
  useVinculosTransacoes,
  useDesfazerPagamento,
  useDesfazerRecebimento,
  useExcluirTransacao,
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
}

type Vinculo = 'recebimento' | 'pagamento';

/** O que a confirmação diz além de "Excluir? Isso não pode ser desfeito.". */
export function detalheExclusaoLancamento(t: Pick<Transacao, 'ajuste' | 'carteira_id'>, vinculo: Vinculo | undefined): string {
  if (vinculo === 'pagamento') return 'Ele veio do "Paguei": o lançamento sai e a conta volta a ficar a pagar.';
  if (vinculo === 'recebimento') return 'Ele veio do "Recebi": o lançamento sai e a renda volta a ficar a receber.';
  if (t.ajuste) return 'É um ajuste de saldo: o saldo do banco volta ao que era antes da correção.';
  return t.carteira_id ? 'O lançamento sai e o saldo do banco volta ao que era.' : 'O lançamento sai do mês.';
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
  const desfazerPagamentoVinculado = useDesfazerPagamento();
  const excluirTransacao = useExcluirTransacao();
  const [excluindo, setExcluindo] = useState<Transacao | null>(null);
  const rendas = useRendas();
  const contasCadastradas = useContas();
  const push = usePushLembretes();
  const criarRenda = useCriarRenda();
  const { pagarConta, contaOcupada } = usePagamentoAcoes();
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

  const mapaVinculos = Object.fromEntries([
    ...(vinculos.data?.recebimentos ?? []).filter((r) => r.transacao_id).map((r) => [r.transacao_id!, 'recebimento']),
    ...(vinculos.data?.pagamentos ?? []).filter((p) => p.transacao_id).map((p) => [p.transacao_id!, 'pagamento']),
  ]) as Record<string, Vinculo>;

  const rendaCadastrada = (rendas.data ?? []).some((r) => r.ativo);
  // Definições cadastradas (não as ocorrências do mês): conta anual/avulsa de outro mês também conta.
  const temContas = (contasCadastradas.data ?? []).some((c) => c.ativo);
  // Sem a lista de rendas carregada, só o resumo vazio garante que falta o passo 1.
  const mostrarBoasVindas = rendas.isSuccess ? !rendaCadastrada || !temContas : !!secoes?.vazio;

  const vinculoDe = (t: Transacao) => mapaVinculos[t.id];
  const fecharExclusao = () => setExcluindo(null);
  const aoExcluir = (mensagem: string) => ({
    onSuccess: () => {
      void vinculos.refetch?.();
      toast.success(mensagem);
      setExcluindo(null);
    },
    onError: () => toast.error('Não foi possível excluir. Tente de novo.'),
  });
  // Lançamento vinculado nunca sai por DELETE (trg_vinculo_* da 006): excluir = desfazer o Recebi/Paguei.
  const confirmarExclusao = (t: Transacao) => {
    const r = vinculos.data?.recebimentos.find((x) => x.transacao_id === t.id);
    if (r) return desfazerRecebimento.mutate({ rendaId: r.renda_id, competencia: r.competencia }, aoExcluir('Lançamento excluído. A renda voltou a ficar a receber.'));
    const p = vinculos.data?.pagamentos.find((x) => x.transacao_id === t.id);
    if (p) return desfazerPagamentoVinculado.mutate({ contaId: p.conta_id, competencia: p.competencia }, aoExcluir('Lançamento excluído. A conta voltou a ficar a pagar.'));
    excluirTransacao.mutate(t.id, aoExcluir('Lançamento excluído'));
  };

  return {
    exclusao: excluindo
      ? {
          transacao: excluindo,
          detalhe: detalheExclusaoLancamento(excluindo, vinculoDe(excluindo)),
          carregando: excluirTransacao.isPending || desfazerRecebimento.isPending || desfazerPagamentoVinculado.isPending,
          onConfirmar: () => confirmarExclusao(excluindo),
          onCancelar: fecharExclusao,
        }
      : null,
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
    lancamentos: {
      ...acoes,
      vinculos: mapaVinculos,
      acoesBloqueadas: !vinculos.isSuccess,
      onExcluir: setExcluindo,
      carregando: transacoes.isLoading,
      expandido,
      onAlternarExpandido: () => setExpandido((v) => !v),
    },
  };
}

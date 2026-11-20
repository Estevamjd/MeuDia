'use client';

import { useState, useEffect, useCallback, useMemo, useRef, type PointerEvent as ReactPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { clsx } from 'clsx';
import { X, Bot, Bell, CheckCheck } from 'lucide-react';
import type { NotificacaoAgente } from '@meudia/shared';
import {
  useNotificacoes,
  useMensagensChat,
  useEnviarMensagem,
  useMarcarNotificacaoLida,
  useDispensarNotificacao,
} from '../../hooks/useAgente';
import { useAuth } from '../../hooks/useAuth';
import { anoMesSP, diaSemanaDe, hojeSP } from '../../lib/hoje';
import { useProfile, useTreinos, useSessoesSemana, useResumoMensal } from '../../hooks';
import { useTravaScroll } from '../../hooks/useTravaScroll';
import { obterSaudacao, processarMensagem, type ContextoAssistente } from '../../lib/assistente/chat';
import {
  ABAS_AGENTE,
  SUGESTOES_AGENTE,
  filtrarMensagens,
  filtrarNotificacoes,
  isAcaoPermitida,
  type AbaAgente,
} from '../../lib/agente-modo';
import { AgentChat } from './AgentChat';
import { CardGastoIA } from './CardGastoIA';
import { deveConsultarIA, pedirPropostaIA } from '../../lib/ia/cliente';
import type { PropostaGasto } from '../../lib/ia/proposta';
import { NotificacaoItem } from './NotificacaoItem';

type Tab = AbaAgente;

/** Arrastar o topo do sheet mais que isso para baixo fecha o painel (px). */
export const LIMIAR_ARRASTE_FECHAR = 80;

interface AgentPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * O layout monta o painel em toda página: fechado, ele só cuida do portal e da trava de scroll.
 * Queries e mutations vivem no `AgentPanelContent`, que só monta aberto (nada de requisição em segundo plano).
 */
export function AgentPanel({ isOpen, onClose }: AgentPanelProps) {
  // Portal só no cliente (após montar): sem `document` no SSR.
  const [montado, setMontado] = useState(false);
  useEffect(() => setMontado(true), []);
  useTravaScroll(isOpen);

  // Estado React puro (sem consulta) que sobrevive a fechar/reabrir: o card do gasto pendente e o
  // "consultando a IA". Uma resposta da IA que chega com o painel fechado aparece ao reabrir.
  const [proposta, setProposta] = useState<PropostaPendente | null>(null);
  const [consultandoIA, setConsultandoIA] = useState(false);
  const idProposta = useRef(0);
  const estado = useMemo<EstadoPainel>(
    () => ({
      proposta,
      consultandoIA,
      setConsultandoIA,
      mostrarProposta: (dados) => setProposta({ id: ++idProposta.current, dados, salvando: false, erroGravacao: null }),
      marcarSalvando: (salvando) => setProposta((p) => (p ? { ...p, salvando } : p)),
      marcarErroGravacao: (erroGravacao) => setProposta((p) => (p ? { ...p, erroGravacao } : p)),
      limparProposta: () => setProposta(null),
    }),
    [proposta, consultandoIA],
  );

  if (!isOpen || !montado) return null;
  return <AgentPanelContent onClose={onClose} estado={estado} />;
}

interface PropostaPendente {
  /** Reinicia o card a cada proposta nova. */
  id: number;
  dados: PropostaGasto;
  /** Confirmar em curso (pode ter começado numa abertura anterior). */
  salvando: boolean;
  /** Falha da gravação: vive aqui para aparecer no card reaberto, mesmo se a rejeição chegou com o card desmontado. */
  erroGravacao: string | null;
}

interface EstadoPainel {
  proposta: PropostaPendente | null;
  consultandoIA: boolean;
  setConsultandoIA: (v: boolean) => void;
  mostrarProposta: (dados: PropostaGasto) => void;
  marcarSalvando: (salvando: boolean) => void;
  marcarErroGravacao: (erro: string | null) => void;
  limparProposta: () => void;
}

function AgentPanelContent({ onClose, estado }: { onClose: () => void; estado: EstadoPainel }) {
  const { proposta, consultandoIA, setConsultandoIA, mostrarProposta, marcarSalvando, marcarErroGravacao, limparProposta } =
    estado;
  const queryClient = useQueryClient();
  const router = useRouter();
  // Monta a cada abertura: começa no Chat.
  const [activeTab, setActiveTab] = useState<Tab>('treino');
  const { user } = useAuth();

  // Dados do chat: treino de hoje (`useTreinos`; as sessões da semana não consultam no modo Finanças por padrão)
  // e o resumo do mês. Nada de hábitos/agenda (módulos removidos).
  const { data: profile } = useProfile();
  const { data: treinos } = useTreinos();
  const { data: sessoesSemana } = useSessoesSemana();
  const now = new Date();
  const { data: resumoMensal } = useResumoMensal(anoMesSP(now).ano, anoMesSP(now).mes);

  // Agent hooks
  const { data: notificacoes, isLoading: loadingNotif } = useNotificacoes();
  const { data: mensagens, isLoading: loadingChat } = useMensagensChat();
  const enviarMensagem = useEnviarMensagem();
  const marcarLida = useMarcarNotificacaoLida();
  const dispensar = useDispensarNotificacao();

  // `onClose` chega inline do layout: em ref, para o efeito abaixo não re-rodar a cada render.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const painelRef = useRef<HTMLDivElement>(null);

  // Esc fecha; foco vai para o painel ao abrir e volta para o gatilho (ex.: "Chat" da BottomNav) ao fechar.
  // Roda só ao montar/desmontar (abrir/fechar): não rouba o foco de quem está digitando no chat.
  useEffect(() => {
    const gatilho = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
    };
    document.addEventListener('keydown', handler);
    const timer = setTimeout(() => {
      if (!painelRef.current?.contains(document.activeElement)) painelRef.current?.focus();
    }, 0);
    return () => {
      document.removeEventListener('keydown', handler);
      clearTimeout(timer);
      if (gatilho?.isConnected) gatilho.focus();
    };
  }, []);

  // Arrastar para baixo pelo topo do sheet (alça + cabeçalho). Só toque/caneta e fora de botões;
  // o conteúdo rolável não tem esses handlers, então o scroll interno segue normal.
  const [arraste, setArraste] = useState(0);
  const inicioArraste = useRef<number | null>(null);
  const iniciarArraste = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' || (e.target as HTMLElement).closest('button')) return;
    inicioArraste.current = e.clientY;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ponteiro sintético/inválido: segue sem captura.
    }
  };
  const moverArraste = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (inicioArraste.current === null) return;
    setArraste(Math.max(0, e.clientY - inicioArraste.current));
  };
  const terminarArraste = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (inicioArraste.current === null) return;
    const dy = e.clientY - inicioArraste.current;
    inicioArraste.current = null;
    setArraste(0);
    if (e.type === 'pointerup' && dy > LIMIAR_ARRASTE_FECHAR) onCloseRef.current();
  };

  // Contexto das respostas locais (lib/assistente).
  const contexto: ContextoAssistente = useMemo(() => {
    const hojeStr = hojeSP(now);
    const diaSemana = diaSemanaDe(hojeStr);
    const treinoHoje = treinos?.find((t) => t.dia_semana === diaSemana) ?? null;
    const sessoesConcluidas = sessoesSemana?.filter((s) => s.concluido).length ?? 0;
    const treinoHojeConcluido = sessoesSemana?.some(
      (s) => s.treino_id === treinoHoje?.id && s.data === hojeStr && s.concluido,
    ) ?? false;

    return {
      nome: profile?.nome ?? user?.email?.split('@')[0] ?? 'Usuário',
      horaAtual: now.getHours(),
      treinoHoje: treinoHoje
        ? { nome: treinoHoje.nome, exercicios: treinoHoje.exercicios?.length ?? 0, concluido: treinoHojeConcluido }
        : null,
      sessoesSemana: sessoesConcluidas,
      metaTreinosSemana: 5,
      saldoMes: resumoMensal?.saldo ?? 0,
      despesasMes: resumoMensal?.totalDespesas ?? 0,
      receitasMes: resumoMensal?.totalReceitas ?? 0,
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [treinos, sessoesSemana, resumoMensal, profile, user]);

  // Handler de enviar mensagem no chat (definido antes de handleAcao pois COMANDO depende dele)
  const handleEnviarChat = useCallback(
    async (texto: string) => {
      const consultarIA = deveConsultarIA(texto);
      // No caminho IA, aguardamos a confirmação explícita de gravação da rota.
      if (!consultarIA) {
        await enviarMensagem.mutateAsync({ role: 'user', conteudo: texto });
      }

      // Montar histórico recente (últimas 10 mensagens)
      const historico = (mensagens ?? []).slice(-10).map((m) => ({
        role: m.role,
        conteudo: m.conteudo,
      }));
      // Adicionar a mensagem atual que acabou de ser enviada
      historico.push({ role: 'user', conteudo: texto });

      // A rota grava o chat; o gasto só é gravado no Confirmar.
      // Sem card (fallback, cota, erro, timeout), segue com as regras, sem erro na tela.
      if (consultarIA) {
        setConsultandoIA(true);
        const dados = await pedirPropostaIA(texto).finally(() => setConsultandoIA(false));
        if (dados?.gravada !== true) {
          // Num timeout, o servidor pode ainda estar gravando: uma duplicata é preferível a perder a mensagem.
          await enviarMensagem.mutateAsync({ role: 'user', conteudo: texto });
        }
        // Invalida em vez de `refetch()`: o painel pode ter fechado durante a espera e um refetch explícito
        // consultaria sem observador. Com `active`, aberto recarrega já; fechado fica stale até reabrir.
        await queryClient.invalidateQueries({ queryKey: ['chat-agente'], refetchType: 'active' });
        if (dados?.proposta) {
          mostrarProposta(dados.proposta);
          return;
        }
      }

      // Resposta local (regras): agenda/hábitos/notas respondem que não estão disponíveis.
      const resposta = processarMensagem(texto, contexto, historico);

      // Salvar resposta do agente
      await enviarMensagem.mutateAsync({
        role: 'agent',
        conteudo: resposta.mensagem,
        acoes: resposta.acoes,
      });
    },
    [enviarMensagem, contexto, mensagens, queryClient, setConsultandoIA, mostrarProposta],
  );

  // Handler de ações (NAVEGAR + COMANDO)
  const handleAcao = useCallback(
    (acao: string, payload?: Record<string, unknown>) => {
      // Ignora ações de módulos removidos (ex.: respostas antigas do chat ou notificações).
      if (!isAcaoPermitida({ acao, payload })) return;
      if (acao === 'NAVEGAR' && payload?.rota) {
        router.push(payload.rota as string);
        onClose();
      }
      if (acao === 'COMANDO' && payload?.comando) {
        handleEnviarChat(payload.comando as string);
      }
    },
    [router, onClose, handleEnviarChat],
  );

  const notificacoesVisiveis = useMemo(() => filtrarNotificacoes(notificacoes ?? []), [notificacoes]);
  const mensagensVisiveis = useMemo(() => filtrarMensagens(mensagens ?? []), [mensagens]);
  // O contador do servidor inclui notificações que não aparecem aqui; conta só as visíveis.
  const naoLidas = notificacoesVisiveis.filter((n) => !n.lida).length;

  const todasTabs: { id: Tab; label: string; icon: typeof Bot; badge?: number }[] = [
    { id: 'treino', label: 'Chat', icon: Bot },
    { id: 'alertas', label: 'Alertas', icon: Bell, badge: naoLidas },
  ];
  const tabs = todasTabs.filter((tab) => ABAS_AGENTE.includes(tab.id));

  // Portal no body + camada `z-agente` (lib/camadas.ts): acima de Topbar, banner de instalação, BottomNav
  // e modais. No mobile é um bottom sheet que nunca cobre o topo (`.agente-sheet` em globals.css):
  // o X fica sempre visível e a faixa de cima do backdrop continua tocável para fechar.
  return createPortal(
    <div className="fixed inset-0 z-agente">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
        data-testid="agente-backdrop"
      />

      <div
        ref={painelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="agent-panel-titulo"
        tabIndex={-1}
        className={clsx(
          'agente-sheet absolute inset-x-0 bottom-0 flex flex-col overflow-hidden rounded-t-2xl border-t border-border bg-surface shadow-2xl outline-none',
          'md:inset-x-auto md:inset-y-0 md:right-0 md:h-auto md:max-h-none md:w-[380px] md:rounded-none md:border-l md:border-t-0',
          'animate-slideUp md:animate-slideIn',
          // Durante o arraste o sheet segue o dedo; ao soltar sem fechar, volta com transição.
          arraste === 0 && 'transition-transform duration-200',
        )}
        style={{
          paddingBottom: 'env(safe-area-inset-bottom)',
          transform: arraste > 0 ? `translateY(${arraste}px)` : undefined,
        }}
      >
        {/* Topo fixo: alça de arrastar + cabeçalho com o X */}
        <div
          className="shrink-0 touch-none select-none"
          onPointerDown={iniciarArraste}
          onPointerMove={moverArraste}
          onPointerUp={terminarArraste}
          onPointerCancel={terminarArraste}
          data-testid="agente-alca"
        >
          <div className="flex justify-center pb-1 pt-2 md:hidden" aria-hidden="true">
            <span className="h-1.5 w-10 rounded-full bg-text/20" />
          </div>
          <div className="flex items-center justify-between border-b border-border py-1 pl-4 pr-2 md:py-2">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-accent to-accent2">
                <Bot size={16} className="text-accent-fg" />
              </div>
              <div>
                <h2 id="agent-panel-titulo" className="text-sm font-semibold text-text">Agente MeuDia</h2>
                <p className="text-[11px] text-muted">{obterSaudacao(now.getHours())}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-11 w-11 items-center justify-center rounded-lg text-muted transition-colors hover:bg-card2 hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
              aria-label="Fechar assistente"
            >
              <X size={20} aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex shrink-0 border-b border-border">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={clsx(
                  'relative flex flex-1 items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors',
                  activeTab === tab.id
                    ? 'border-b-2 border-accent text-accent'
                    : 'text-muted hover:text-text',
                )}
              >
                <Icon size={14} />
                {tab.label}
                {tab.badge && tab.badge > 0 ? (
                  <span className="ml-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red px-1 text-[10px] font-bold text-white">
                    {tab.badge}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        {/* Conteúdo: só ele rola (cada aba tem o próprio overflow-y-auto) */}
        <div className="min-h-0 flex-1 overflow-hidden">
          {activeTab === 'treino' && (
            <AgentChat
              mensagens={mensagensVisiveis}
              isLoading={loadingChat}
              isSending={enviarMensagem.isPending || consultandoIA}
              onEnviar={handleEnviarChat}
              onAcao={handleAcao}
              rodape={
                proposta && (
                  <CardGastoIA
                    key={proposta.id}
                    proposta={proposta.dados}
                    salvando={proposta.salvando}
                    onSalvando={marcarSalvando}
                    erroGravacao={proposta.erroGravacao}
                    onErroGravacao={marcarErroGravacao}
                    onConfirmado={(resumoGasto) => {
                      limparProposta();
                      void enviarMensagem.mutateAsync({ role: 'agent', conteudo: resumoGasto }).catch(() => {});
                    }}
                    onCancelado={() => {
                      limparProposta();
                      void enviarMensagem.mutateAsync({ role: 'agent', conteudo: 'Tudo bem, não salvei esse gasto.' }).catch(() => {});
                    }}
                  />
                )
              }
              sugestoesIniciais={[...SUGESTOES_AGENTE]}
              dicaInicial="Pergunte sobre gastos, contas, orçamento ou assinaturas."
            />
          )}
          {activeTab === 'alertas' && (
            <AlertasTab
              notificacoes={notificacoesVisiveis}
              isLoading={loadingNotif}
              onMarcarLida={(id) => marcarLida.mutate(id)}
              onMarcarTodasLidas={() =>
                // Não marca como lidas as notificações que não aparecem aqui.
                notificacoesVisiveis.filter((n) => !n.lida).forEach((n) => marcarLida.mutate(n.id))
              }
              onDispensar={(id) => dispensar.mutate(id)}
              onAcao={handleAcao}
              countNaoLidas={naoLidas}
            />
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Sub-componentes internos
// ══════════════════════════════════════════════════════════════════════════════

function AlertasTab({
  notificacoes,
  isLoading,
  onMarcarLida,
  onMarcarTodasLidas,
  onDispensar,
  onAcao,
  countNaoLidas,
}: {
  notificacoes: NotificacaoAgente[];
  isLoading: boolean;
  onMarcarLida: (id: string) => void;
  onMarcarTodasLidas: () => void;
  onDispensar: (id: string) => void;
  onAcao: (acao: string, payload?: Record<string, unknown>) => void;
  countNaoLidas: number;
}) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    );
  }

  if (notificacoes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center px-4">
        <Bell size={32} className="text-muted/30 mb-3" />
        <p className="text-sm font-medium text-text">Sem notificações</p>
        <p className="mt-1 text-xs text-muted">O agente vai te alertar quando necessário.</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto overscroll-contain">
      {/* Header com marcar todas */}
      {countNaoLidas > 0 && (
        <div className="flex items-center justify-between px-4 py-2 border-b border-border">
          <span className="text-xs text-muted">{countNaoLidas} não lida{countNaoLidas > 1 ? 's' : ''}</span>
          <button
            onClick={onMarcarTodasLidas}
            className="flex items-center gap-1 text-[11px] text-accent hover:text-accent/80 transition-colors"
          >
            <CheckCheck size={12} />
            Marcar todas como lidas
          </button>
        </div>
      )}

      <div className="px-3 py-3 space-y-2">
        {notificacoes.map((n) => (
          <NotificacaoItem
            key={n.id}
            notificacao={n}
            onMarcarLida={onMarcarLida}
            onDispensar={onDispensar}
            onAcao={onAcao}
          />
        ))}
      </div>
    </div>
  );
}

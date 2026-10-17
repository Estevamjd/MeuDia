'use client';

import { useState, useEffect, useCallback, useMemo, useRef, type PointerEvent as ReactPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { clsx } from 'clsx';
import { X, Bot, Bell, LayoutDashboard, CheckCheck } from 'lucide-react';
import {
  processarMensagem,
  acoesRapidasPadrao,
  gerarResumoDiario,
  obterSaudacao,
} from '@meudia/ai';
import type { ContextoUsuario, AcaoRapida, ResumoDiario, ItemResumo, NotificacaoAgente } from '@meudia/shared';
import {
  useNotificacoes,
  useMensagensChat,
  useEnviarMensagem,
  useMarcarNotificacaoLida,
  useMarcarTodasLidas,
  useDispensarNotificacao,
  useContarNaoLidas,
} from '../../hooks/useAgente';
import { useAuth } from '../../hooks/useAuth';
import { useProfile, useTreinos, useSessoesSemana, useHabitos, useRegistrosHoje, useResumoMensal } from '../../hooks';
import { useCriarCompromisso } from '../../hooks/useAgenda';
import { useTravaScroll } from '../../hooks/useTravaScroll';
import { useAppMode } from '../AppModeProvider';
import {
  abaInicialAgente,
  abasAgente,
  filtrarMensagens,
  filtrarNotificacoes,
  isAcaoPermitida,
  sugestoesAgente,
  type AbaAgente,
} from '../../lib/agente-modo';
import { AgentChat } from './AgentChat';
import { NotificacaoItem } from './NotificacaoItem';

type Tab = AbaAgente;

/** Arrastar o topo do sheet mais que isso para baixo fecha o painel (px). */
export const LIMIAR_ARRASTE_FECHAR = 80;

interface AgentPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AgentPanel({ isOpen, onClose }: AgentPanelProps) {
  const router = useRouter();
  const mode = useAppMode();
  const [activeTab, setActiveTab] = useState<Tab>(() => abaInicialAgente(mode));
  const { user } = useAuth();

  // Data hooks
  const { data: profile } = useProfile();
  const { data: treinos } = useTreinos();
  const { data: sessoesSemana } = useSessoesSemana();
  const { data: habitos } = useHabitos();
  const { data: registrosHoje } = useRegistrosHoje();
  const now = new Date();
  const { data: resumoMensal } = useResumoMensal(now.getFullYear(), now.getMonth() + 1);

  // Agent hooks
  const { data: notificacoes, isLoading: loadingNotif } = useNotificacoes();
  const { data: mensagens, isLoading: loadingChat } = useMensagensChat();
  const { data: countNaoLidas } = useContarNaoLidas();
  const enviarMensagem = useEnviarMensagem();
  const marcarLida = useMarcarNotificacaoLida();
  const marcarTodasLidas = useMarcarTodasLidas();
  const dispensar = useDispensarNotificacao();
  const criarCompromisso = useCriarCompromisso();

  // Cada abertura começa na aba inicial do modo (Finanças: Chat).
  useEffect(() => {
    if (isOpen) setActiveTab(abaInicialAgente(mode));
  }, [isOpen, mode]);

  // `onClose` chega inline do layout: em ref, para o efeito abaixo não re-rodar a cada render.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Portal só no cliente (após montar): sem `document` no SSR.
  const [montado, setMontado] = useState(false);
  useEffect(() => setMontado(true), []);

  const painelRef = useRef<HTMLDivElement>(null);
  useTravaScroll(isOpen);

  // Esc fecha; foco vai para o painel ao abrir e volta para o gatilho (ex.: "Chat" da BottomNav) ao fechar.
  // Só depende de `isOpen`: não re-roda a cada render (não rouba o foco de quem está digitando no chat).
  useEffect(() => {
    if (!isOpen) return;
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
  }, [isOpen]);

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

  // Contexto do usuário
  const contexto: ContextoUsuario = useMemo(() => {
    const diaSemana = now.getDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6;
    const treinoHoje = treinos?.find((t) => t.dia_semana === diaSemana) ?? null;
    const hojeStr = now.toISOString().split('T')[0];
    const sessoesConcluidas = sessoesSemana?.filter((s) => s.concluido).length ?? 0;
    const treinoHojeConcluido = sessoesSemana?.some(
      (s) => s.treino_id === treinoHoje?.id && s.data === hojeStr && s.concluido,
    ) ?? false;

    const habitosAtivos = habitos?.filter(
      (h) => h.ativo && (h.frequencia === 'diario' || h.dias_semana.includes(diaSemana)),
    ) ?? [];
    const registrosMap = new Map<string, boolean>();
    registrosHoje?.forEach((r) => {
      if (r.concluido) registrosMap.set(r.habito_id, true);
    });
    const habitosConcluidos = habitosAtivos.filter((h) => registrosMap.has(h.id)).length;
    const habitosPendentes = habitosAtivos
      .filter((h) => !registrosMap.has(h.id))
      .map((h) => h.nome);

    return {
      userId: user?.id ?? '',
      nome: profile?.nome ?? user?.email?.split('@')[0] ?? 'Usuário',
      objetivo: profile?.objetivo ?? null,
      horaAtual: now.getHours(),
      diaSemana,
      treinoHoje: treinoHoje
        ? {
            nome: treinoHoje.nome,
            exercicios: treinoHoje.exercicios?.length ?? 0,
            concluido: treinoHojeConcluido,
          }
        : null,
      sessoesSemana: sessoesConcluidas,
      metaTreinosSemana: 5,
      habitosTotal: habitosAtivos.length,
      habitosConcluidos,
      habitosPendentes,
      percentualHabitos:
        habitosAtivos.length > 0
          ? Math.round((habitosConcluidos / habitosAtivos.length) * 100)
          : 0,
      compromissosHoje: 0,
      proximoCompromisso: null,
      saldoMes: resumoMensal?.saldo ?? 0,
      despesasMes: resumoMensal?.totalDespesas ?? 0,
      receitasMes: resumoMensal?.totalReceitas ?? 0,
      streakAtual: 0,
      scoreHoje: 0,
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [treinos, sessoesSemana, habitos, registrosHoje, resumoMensal, profile, user]);

  // Resumo diário
  const resumo: ResumoDiario = useMemo(() => gerarResumoDiario(contexto), [contexto]);

  // Handler de enviar mensagem no chat (definido antes de handleAcao pois COMANDO depende dele)
  const handleEnviarChat = useCallback(
    async (texto: string) => {
      // Salvar mensagem do usuário
      await enviarMensagem.mutateAsync({
        role: 'user',
        conteudo: texto,
      });

      // Montar histórico recente (últimas 10 mensagens)
      const historico = (mensagens ?? []).slice(-10).map((m) => ({
        role: m.role,
        conteudo: m.conteudo,
      }));
      // Adicionar a mensagem atual que acabou de ser enviada
      historico.push({ role: 'user', conteudo: texto });

      // Processar e gerar resposta do agente
      const resposta = processarMensagem(texto, contexto, historico);

      // Salvar resposta do agente
      await enviarMensagem.mutateAsync({
        role: 'agent',
        conteudo: resposta.mensagem,
        acoes: resposta.acoes,
      });
    },
    [enviarMensagem, contexto, mensagens],
  );

  // Handler de ações (NAVEGAR + COMANDO + CRIAR_COMPROMISSO)
  const handleAcao = useCallback(
    async (acao: string, payload?: Record<string, unknown>) => {
      // Modo Finanças: ignora ações de módulos ocultos (ex.: respostas antigas do chat).
      if (!isAcaoPermitida({ acao, payload }, mode)) return;
      if (acao === 'NAVEGAR' && payload?.rota) {
        router.push(payload.rota as string);
        onClose();
      }
      if (acao === 'COMANDO' && payload?.comando) {
        handleEnviarChat(payload.comando as string);
      }
      if (acao === 'CRIAR_COMPROMISSO' && payload?.titulo && payload?.data_inicio) {
        try {
          await criarCompromisso.mutateAsync({
            titulo: payload.titulo as string,
            data_inicio: payload.data_inicio as string,
            data_fim: (payload.data_fim as string) ?? null,
            descricao: (payload.descricao as string) ?? null,
            local: (payload.local as string) ?? null,
            tipo: (payload.tipo as string) ?? 'geral',
            prioridade: (payload.prioridade as 'baixa' | 'media' | 'alta' | 'urgente') ?? 'media',
          });
          // Confirmar no chat que foi criado
          await enviarMensagem.mutateAsync({
            role: 'agent',
            conteudo: `Compromisso "${payload.titulo}" criado com sucesso na sua agenda!`,
          });
        } catch {
          await enviarMensagem.mutateAsync({
            role: 'agent',
            conteudo: 'Ops, não consegui criar o compromisso. Tente pela página da agenda.',
            acoes: [{ label: 'Abrir Agenda', acao: 'NAVEGAR', payload: { rota: '/agenda' } }],
          });
        }
      }
    },
    [router, onClose, handleEnviarChat, criarCompromisso, enviarMensagem, mode],
  );

  const notificacoesModo = useMemo(() => filtrarNotificacoes(notificacoes ?? [], mode), [notificacoes, mode]);
  const mensagensModo = useMemo(() => filtrarMensagens(mensagens ?? [], mode), [mensagens, mode]);
  // Modo Finanças: o contador do servidor inclui módulos ocultos; conta só as visíveis.
  const naoLidas = mode === 'padrao' ? (countNaoLidas ?? 0) : notificacoesModo.filter((n) => !n.lida).length;

  if (!isOpen || !montado) return null;

  const todasTabs: { id: Tab; label: string; icon: typeof LayoutDashboard; badge?: number }[] = [
    { id: 'resumo', label: 'Resumo', icon: LayoutDashboard },
    { id: 'treino', label: 'Chat', icon: Bot },
    { id: 'alertas', label: 'Alertas', icon: Bell, badge: naoLidas },
  ];
  const tabs = todasTabs.filter((tab) => abasAgente(mode).includes(tab.id));

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
            <span className="h-1.5 w-10 rounded-full bg-white/20" />
          </div>
          <div className="flex items-center justify-between border-b border-border py-1 pl-4 pr-2 md:py-2">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-accent to-accent2">
                <Bot size={16} className="text-white" />
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
          {activeTab === 'resumo' && (
            <ResumoTab resumo={resumo} onAcao={handleAcao} />
          )}
          {activeTab === 'treino' && (
            <AgentChat
              mensagens={mensagensModo}
              isLoading={loadingChat}
              isSending={enviarMensagem.isPending}
              onEnviar={handleEnviarChat}
              onAcao={handleAcao}
              sugestoesIniciais={sugestoesAgente(mode, () => acoesRapidasPadrao(contexto))}
              dicaInicial={
                mode === 'financas' ? 'Pergunte sobre gastos, contas, orçamento ou assinaturas.' : undefined
              }
            />
          )}
          {activeTab === 'alertas' && (
            <AlertasTab
              notificacoes={notificacoesModo}
              isLoading={loadingNotif}
              onMarcarLida={(id) => marcarLida.mutate(id)}
              onMarcarTodasLidas={() =>
                mode === 'padrao'
                  ? marcarTodasLidas.mutate()
                  : // Não marca como lidas as notificações ocultas no modo.
                    notificacoesModo.filter((n) => !n.lida).forEach((n) => marcarLida.mutate(n.id))
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

function ResumoTab({
  resumo,
  onAcao,
}: {
  resumo: ResumoDiario;
  onAcao: (acao: string, payload?: Record<string, unknown>) => void;
}) {
  const priorityBorder: Record<string, string> = {
    info: 'border-accent/20',
    aviso: 'border-yellow/20',
    alerta: 'border-red/20',
  };

  return (
    <div className="h-full overflow-y-auto overscroll-contain px-4 py-4 space-y-4">
      {/* Saudação */}
      <div>
        <p className="font-syne text-base font-bold text-text">{resumo.saudacao}</p>
        <p className="mt-1 text-sm text-muted leading-relaxed">{resumo.mensagemPrincipal}</p>
      </div>

      {/* Itens */}
      <div className={clsx('space-y-2 rounded-xl border p-3', priorityBorder[resumo.prioridade] ?? 'border-border')}>
        {resumo.itens.map((item: ItemResumo, i: number) => (
          <div key={i} className="flex items-start gap-2.5">
            <span className="text-sm shrink-0">{item.icone}</span>
            <p className="text-sm text-text/90">{item.texto}</p>
          </div>
        ))}
      </div>

      {/* Ações */}
      {resumo.acoes.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {resumo.acoes.map((acao: AcaoRapida, i: number) => (
            <button
              key={i}
              onClick={() => onAcao(acao.acao, acao.payload)}
              className={clsx(
                'rounded-lg px-3 py-2 text-xs font-medium transition-colors',
                i === 0
                  ? 'bg-accent text-white hover:bg-accent/80'
                  : 'border border-border text-muted hover:text-text hover:border-accent/30',
              )}
            >
              {acao.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

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

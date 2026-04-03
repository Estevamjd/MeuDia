'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
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
import { AgentChat } from './AgentChat';
import { NotificacaoItem } from './NotificacaoItem';

type Tab = 'resumo' | 'treino' | 'alertas';

interface AgentPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AgentPanel({ isOpen, onClose }: AgentPanelProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('resumo');
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

  // ESC para fechar
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

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
    [router, onClose, handleEnviarChat, criarCompromisso, enviarMensagem],
  );

  if (!isOpen) return null;

  const tabs: { id: Tab; label: string; icon: typeof LayoutDashboard; badge?: number }[] = [
    { id: 'resumo', label: 'Resumo', icon: LayoutDashboard },
    { id: 'treino', label: 'Chat', icon: Bot },
    { id: 'alertas', label: 'Alertas', icon: Bell, badge: countNaoLidas ?? 0 },
  ];

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div className="fixed right-0 top-0 z-40 flex h-screen w-full max-w-[380px] flex-col border-l border-border bg-surface animate-[slideIn_0.3s_ease]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-accent to-accent2">
              <Bot size={16} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-text">Agente MeuDia</p>
              <p className="text-[11px] text-muted">{obterSaudacao(now.getHours())}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted transition-colors hover:bg-card2 hover:text-text"
            aria-label="Fechar painel"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border">
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

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {activeTab === 'resumo' && (
            <ResumoTab resumo={resumo} onAcao={handleAcao} />
          )}
          {activeTab === 'treino' && (
            <AgentChat
              mensagens={mensagens ?? []}
              isLoading={loadingChat}
              isSending={enviarMensagem.isPending}
              onEnviar={handleEnviarChat}
              onAcao={handleAcao}
              sugestoesIniciais={acoesRapidasPadrao(contexto)}
            />
          )}
          {activeTab === 'alertas' && (
            <AlertasTab
              notificacoes={notificacoes ?? []}
              isLoading={loadingNotif}
              onMarcarLida={(id) => marcarLida.mutate(id)}
              onMarcarTodasLidas={() => marcarTodasLidas.mutate()}
              onDispensar={(id) => dispensar.mutate(id)}
              onAcao={handleAcao}
              countNaoLidas={countNaoLidas ?? 0}
            />
          )}
        </div>
      </div>
    </>
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
    <div className="h-full overflow-y-auto px-4 py-4 space-y-4">
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
    <div className="h-full overflow-y-auto">
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

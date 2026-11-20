import type { AcaoRapida, MensagemChat, NotificacaoAgente } from '@meudia/shared';
import { isRotaLegada } from './app-mode';
import { mensagemModuloIndisponivel, SUGESTOES_ASSISTENTE, type ModuloIndisponivel } from './assistente/chat';

/**
 * O que o AgentPanel mostra, igual nos dois modos. As respostas novas (lib/assistente) já não citam agenda,
 * hábitos nem notas; o filtro daqui cuida do que veio do banco: mensagens antigas do chat (`chat_agente`) e
 * notificações (`notificacoes_agente`) que ofereciam ações desses módulos ou de rotas que saíram do app.
 */

export type AbaAgente = 'treino' | 'alertas';

/** Chat (id histórico 'treino') e Alertas; a aba Resumo (treinos/hábitos) saiu com os módulos legados. */
export const ABAS_AGENTE: readonly AbaAgente[] = ['treino', 'alertas'];

export const SUGESTOES_AGENTE: readonly AcaoRapida[] = SUGESTOES_ASSISTENTE;

export function isAcaoPermitida(acao: Pick<AcaoRapida, 'acao' | 'payload'>): boolean {
  if (acao.acao === 'CRIAR_COMPROMISSO') return false;
  if (acao.acao === 'NAVEGAR') {
    const rota = acao.payload?.rota;
    return typeof rota === 'string' && !isRotaLegada(rota);
  }
  return true;
}

export function filtrarAcoes(acoes: readonly AcaoRapida[] | null | undefined): AcaoRapida[] {
  return (acoes ?? []).filter(isAcaoPermitida);
}

/** Só notificações de finanças (como no modo Finanças em produção), sem ações para rotas que saíram. */
export function filtrarNotificacoes(notificacoes: readonly NotificacaoAgente[]): NotificacaoAgente[] {
  return notificacoes.filter((n) => n.modulo === 'financas').map((n) => ({ ...n, acoes: filtrarAcoes(n.acoes) }));
}

/** Módulo que uma ação antiga levaria (Criar Agora, Abrir Agenda, Ver Hábitos...). */
function moduloDaAcao(acao: AcaoRapida): ModuloIndisponivel | null {
  if (acao.acao === 'CRIAR_COMPROMISSO') return 'agenda';
  const rota = acao.acao === 'NAVEGAR' ? acao.payload?.rota : undefined;
  if (typeof rota !== 'string') return null;
  return (['agenda', 'habitos', 'notas'] as const).find((m) => isRotaLegada(rota) && rota.startsWith(`/${m}`)) ?? null;
}

/** Mensagem antiga do agente que oferecia agenda/hábitos/notas é reescrita (sem botão órfão no texto). */
export function filtrarMensagens(mensagens: readonly MensagemChat[]): MensagemChat[] {
  return mensagens.map((m) => {
    const modulo = m.role === 'agent' ? ((m.acoes ?? []).map(moduloDaAcao).find(Boolean) ?? null) : null;
    return { ...m, ...(modulo ? { conteudo: mensagemModuloIndisponivel(modulo) } : {}), acoes: filtrarAcoes(m.acoes) };
  });
}

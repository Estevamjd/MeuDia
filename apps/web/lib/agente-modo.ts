import type { AcaoRapida, MensagemChat, NotificacaoAgente } from '@meudia/shared';
import { isRotaVisivel, type AppMode } from './app-mode';

/** Conteúdo do AgentPanel filtrado pelo APP_MODE (modo Finanças: só finanças). */

export type AbaAgente = 'resumo' | 'treino' | 'alertas';

/** Modo Finanças: sem a aba Resumo (treinos/hábitos) e abre direto no Chat. */
export function abasAgente(mode: AppMode): AbaAgente[] {
  return mode === 'financas' ? ['treino', 'alertas'] : ['resumo', 'treino', 'alertas'];
}

export function abaInicialAgente(mode: AppMode): AbaAgente {
  return mode === 'financas' ? 'treino' : 'resumo';
}

// Ações que dependem de módulos ocultos no modo Finanças.
const ACOES_SO_PADRAO = new Set(['CRIAR_COMPROMISSO']);

export function isAcaoPermitida(acao: Pick<AcaoRapida, 'acao' | 'payload'>, mode: AppMode): boolean {
  if (mode === 'padrao') return true;
  if (ACOES_SO_PADRAO.has(acao.acao)) return false;
  if (acao.acao === 'NAVEGAR') {
    const rota = acao.payload?.rota;
    return typeof rota === 'string' && isRotaVisivel(rota.split('?')[0] ?? rota, mode);
  }
  return true;
}

export function filtrarAcoes(acoes: readonly AcaoRapida[] | null | undefined, mode: AppMode): AcaoRapida[] {
  return (acoes ?? []).filter((a) => isAcaoPermitida(a, mode));
}

const SUGESTOES_FINANCAS: AcaoRapida[] = [
  { label: 'Resumo financeiro', acao: 'COMANDO', payload: { comando: 'como estão minhas finanças?' } },
  { label: 'Quanto gastei?', acao: 'COMANDO', payload: { comando: 'quanto gastei este mês?' } },
  { label: 'Ver contas', acao: 'NAVEGAR', payload: { rota: '/financas/contas' } },
  { label: 'Ver orçamento', acao: 'NAVEGAR', payload: { rota: '/financas/orcamento' } },
];

/** Sugestões iniciais do chat; no modo padrão mantém as do agente. */
export function sugestoesAgente(mode: AppMode, padrao: () => AcaoRapida[]): AcaoRapida[] {
  return mode === 'financas' ? SUGESTOES_FINANCAS : padrao();
}

/** Modo Finanças: só notificações do módulo finanças, e só com ações permitidas. */
export function filtrarNotificacoes(notificacoes: readonly NotificacaoAgente[], mode: AppMode): NotificacaoAgente[] {
  if (mode === 'padrao') return [...notificacoes];
  return notificacoes
    .filter((n) => n.modulo === 'financas')
    .map((n) => ({ ...n, acoes: filtrarAcoes(n.acoes, mode) }));
}

/** Remove das mensagens do chat ações que levariam a módulos ocultos. */
export function filtrarMensagens(mensagens: readonly MensagemChat[], mode: AppMode): MensagemChat[] {
  if (mode === 'padrao') return [...mensagens];
  return mensagens.map((m) => ({ ...m, acoes: filtrarAcoes(m.acoes, mode) }));
}

import { AppError } from '@meudia/shared';
import type {
  NotificacaoAgente,
  NotificacaoAgenteInsert,
  MensagemChat,
  MensagemChatInsert,
  PreferenciasAgente,
  PreferenciasAgenteUpdate,
} from '@meudia/shared';
import {
  notificacaoAgenteRepository,
  chatAgenteRepository,
  preferenciasAgenteRepository,
} from '../repositories';

// ══════════════════════════════════════════════════════════════════════════════
// Notificações
// ══════════════════════════════════════════════════════════════════════════════

export async function listarNotificacoes(userId: string): Promise<NotificacaoAgente[]> {
  if (!userId) throw new AppError('userId é obrigatório', 'VALIDATION_ERROR');
  return notificacaoAgenteRepository.findByUserId(userId);
}

export async function notificacoesNaoLidas(userId: string): Promise<NotificacaoAgente[]> {
  if (!userId) throw new AppError('userId é obrigatório', 'VALIDATION_ERROR');
  return notificacaoAgenteRepository.findNaoLidas(userId);
}

export async function contarNaoLidas(userId: string): Promise<number> {
  if (!userId) throw new AppError('userId é obrigatório', 'VALIDATION_ERROR');
  return notificacaoAgenteRepository.countNaoLidas(userId);
}

export async function criarNotificacao(
  userId: string,
  data: NotificacaoAgenteInsert,
): Promise<NotificacaoAgente> {
  if (!userId) throw new AppError('userId é obrigatório', 'VALIDATION_ERROR');
  return notificacaoAgenteRepository.create(userId, data);
}

export async function marcarNotificacaoLida(notificacaoId: string): Promise<void> {
  return notificacaoAgenteRepository.marcarLida(notificacaoId);
}

export async function marcarTodasNotificacoesLidas(userId: string): Promise<void> {
  return notificacaoAgenteRepository.marcarTodasLidas(userId);
}

export async function dispensarNotificacao(notificacaoId: string): Promise<void> {
  return notificacaoAgenteRepository.dispensar(notificacaoId);
}

// ══════════════════════════════════════════════════════════════════════════════
// Chat
// ══════════════════════════════════════════════════════════════════════════════

export async function listarMensagens(
  userId: string,
  limit = 50,
): Promise<MensagemChat[]> {
  if (!userId) throw new AppError('userId é obrigatório', 'VALIDATION_ERROR');
  return chatAgenteRepository.findByUserId(userId, limit);
}

export async function mensagensRecentes(
  userId: string,
  limit = 20,
): Promise<MensagemChat[]> {
  if (!userId) throw new AppError('userId é obrigatório', 'VALIDATION_ERROR');
  return chatAgenteRepository.findRecentes(userId, limit);
}

export async function enviarMensagem(
  userId: string,
  data: MensagemChatInsert,
): Promise<MensagemChat> {
  if (!userId) throw new AppError('userId é obrigatório', 'VALIDATION_ERROR');
  return chatAgenteRepository.create(userId, data);
}

export async function limparChat(userId: string): Promise<void> {
  if (!userId) throw new AppError('userId é obrigatório', 'VALIDATION_ERROR');
  return chatAgenteRepository.limparHistorico(userId);
}

// ══════════════════════════════════════════════════════════════════════════════
// Preferências
// ══════════════════════════════════════════════════════════════════════════════

export async function obterPreferencias(userId: string): Promise<PreferenciasAgente | null> {
  if (!userId) throw new AppError('userId é obrigatório', 'VALIDATION_ERROR');
  return preferenciasAgenteRepository.findByUserId(userId);
}

export async function atualizarPreferencias(
  userId: string,
  data: PreferenciasAgenteUpdate,
): Promise<PreferenciasAgente> {
  if (!userId) throw new AppError('userId é obrigatório', 'VALIDATION_ERROR');
  return preferenciasAgenteRepository.upsert(userId, data);
}

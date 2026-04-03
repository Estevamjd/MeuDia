'use client';

import {
  treinoService,
  habitoService,
  agendaService,
  financasService,
  comprasService,
  veiculoService,
} from '@meudia/api';

/**
 * Handler central para processar ações da fila offline.
 * Mapeia action strings para chamadas de API reais.
 */
export async function handleOfflineAction(action: string, payload: unknown): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = payload as any;

  switch (action) {
    // === TREINOS ===
    case 'treino:criar':
      await treinoService.criarTreino(p.userId, p.data);
      break;
    case 'treino:atualizar':
      await treinoService.atualizarTreino(p.userId, p.id, p.data);
      break;
    case 'treino:excluir':
      await treinoService.excluirTreino(p.userId, p.id);
      break;
    case 'treino:registrar-serie':
      await treinoService.registrarSerie(p.data);
      break;

    // === HABITOS ===
    case 'habito:criar':
      await habitoService.criarHabito(p.userId, p.data);
      break;
    case 'habito:atualizar':
      await habitoService.atualizarHabito(p.userId, p.id, p.data);
      break;
    case 'habito:excluir':
      await habitoService.excluirHabito(p.userId, p.id);
      break;
    case 'habito:marcar':
      await habitoService.marcarHabito(p.userId, p.habitoId, p.date, p.concluido, p.valor);
      break;

    // === AGENDA ===
    case 'agenda:criar':
      await agendaService.criarCompromisso(p.userId, p.data);
      break;
    case 'agenda:atualizar':
      await agendaService.atualizarCompromisso(p.userId, p.id, p.data);
      break;
    case 'agenda:excluir':
      await agendaService.excluirCompromisso(p.userId, p.id);
      break;
    case 'agenda:concluir':
      await agendaService.atualizarCompromisso(p.userId, p.id, { concluido: p.concluido });
      break;

    // === FINANCAS ===
    case 'financas:criar':
      await financasService.criarTransacao(p.userId, p.data);
      break;
    case 'financas:atualizar':
      await financasService.atualizarTransacao(p.userId, p.id, p.data);
      break;
    case 'financas:excluir':
      await financasService.excluirTransacao(p.userId, p.id);
      break;

    // === COMPRAS ===
    case 'compras:criar-lista':
      await comprasService.criarLista(p.userId, p.data);
      break;
    case 'compras:excluir-lista':
      await comprasService.excluirLista(p.id);
      break;
    case 'compras:criar-item':
      await comprasService.adicionarItem(p.data);
      break;
    case 'compras:toggle-item':
      await comprasService.toggleItem(p.id, p.comprado);
      break;
    case 'compras:excluir-item':
      await comprasService.excluirItem(p.id);
      break;

    // === VEICULO ===
    case 'veiculo:criar':
      await veiculoService.criarVeiculo(p.userId, p.data);
      break;
    case 'veiculo:atualizar':
      await veiculoService.atualizarVeiculo(p.id, p.data);
      break;
    case 'veiculo:excluir':
      await veiculoService.excluirVeiculo(p.id);
      break;
    case 'veiculo:criar-manutencao':
      await veiculoService.criarManutencao(p.data);
      break;
    case 'veiculo:excluir-manutencao':
      await veiculoService.excluirManutencao(p.id);
      break;

    default:
      console.warn(`[OfflineSync] Ação desconhecida: "${action}"`);
  }
}

import { beforeEach, expect, it, vi } from 'vitest';
import { usuarioAtualId } from '../usuario-atual';
import { atualizarRefeicao, excluirRefeicao } from '../dieta.service';
import { marcarNotificacaoLida, dispensarNotificacao } from '../agente.service';
import { finalizarSessao } from '../treino.service';
const { getSession, update, remove } = vi.hoisted(() => ({ getSession: vi.fn(), update: vi.fn(), remove: vi.fn() }));
vi.mock('../../repositories/supabase', () => ({ getSupabase: () => ({ auth: { getSession } }) }));
vi.mock('../../repositories', () => ({
  dietaRepository: { updateRefeicao: update, removeRefeicao: remove },
  notificacaoAgenteRepository: { marcarLida: remove, dispensar: remove },
  sessaoRepository: { update },
}));
beforeEach(() => {
  vi.clearAllMocks();
  getSession.mockResolvedValue({ data: { session: { user: { id: 'dono' } } }, error: null });
});
it('retorna apenas identidade validada pelo Auth', async () => {
  expect(await usuarioAtualId()).toBe('dono');
});
it('recusa sessão ausente', async () => {
  getSession.mockResolvedValue({ data: { session: null }, error: null });
  await expect(usuarioAtualId()).rejects.toMatchObject({ status: 401 });
});
it('preserva erro original de fetch/retryable', async () => {
  const error = Object.assign(new Error('fetch falhou'), { name: 'AuthRetryableFetchError', status: 503 });
  getSession.mockResolvedValue({ data: { session: null }, error });
  await expect(usuarioAtualId()).rejects.toBe(error);
  getSession.mockRejectedValue(error);
  await expect(usuarioAtualId()).rejects.toBe(error);
});
it.each([
  ['refeição', () => atualizarRefeicao('alvo', {})],
  ['sessão', () => finalizarSessao('alvo', 30)],
] as const)('update %s encaminha identidade e interrompe em sessão inválida', async (_name, run) => {
  await run();
  expect(update.mock.calls[0]).toEqual(['alvo', expect.any(Object), 'dono']);
  vi.clearAllMocks();
  getSession.mockResolvedValue({ data: { session: null }, error: null });
  await expect(run()).rejects.toMatchObject({ status: 401 });
  expect(update).not.toHaveBeenCalled();
});
it.each([
  ['refeição', excluirRefeicao], ['notificação lida', marcarNotificacaoLida], ['notificação dispensada', dispensarNotificacao],
] as const)('%s encaminha dono nas exclusões/atualizações sem payload', async (_name, run) => {
  await run('alvo');
  expect(remove).toHaveBeenCalledWith('alvo', 'dono');
});

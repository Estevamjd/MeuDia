import { beforeEach, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { contasPagarRepository as contas, pagamentosContaRepository as pagamentos, pushSubscriptionsRepository as push, lembretesEnviadosRepository as lembretes } from '../../repositories';
import { enviarLembretesDoDia } from '../lembretes.service';
vi.mock('../../repositories', () => ({
  contasPagarRepository: { contasAtivasComInscricaoParaCron: vi.fn() },
  pagamentosContaRepository: { pagamentosDasCompetenciasParaCron: vi.fn() },
  pushSubscriptionsRepository: { inscricoesDoUsuarioParaCron: vi.fn(), removerInscricaoParaCron: vi.fn() },
  lembretesEnviadosRepository: { reservarLembreteParaCron: vi.fn(), liberarLembreteParaCron: vi.fn() },
}));
const client = {} as SupabaseClient;
const conta = { id: 'c', user_id: 'u', descricao: 'Fixture', valor: 1234.5, recorrencia: 'mensal', dia_vencimento: 15, ativo: true, created_at: '2026-01-01T03:00:00Z' };
const sub = { id: 's', user_id: 'u', endpoint: 'https://example.invalid', auth: 'fixture', p256dh: 'fixture' };
const send = vi.fn();
const run = (hojeISO = '2026-10-13') => enviarLembretesDoDia({ client, sender: { send }, hojeISO });
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(contas.contasAtivasComInscricaoParaCron).mockResolvedValue([conta] as never);
  vi.mocked(pagamentos.pagamentosDasCompetenciasParaCron).mockResolvedValue([]);
  vi.mocked(push.inscricoesDoUsuarioParaCron).mockResolvedValue([sub] as never);
  const reservas = new Set<string>();
  vi.mocked(lembretes.reservarLembreteParaCron).mockImplementation(async (_, row) => {
    const key = JSON.stringify(row); if (reservas.has(key)) return false; reservas.add(key); return true;
  });
  vi.mocked(lembretes.liberarLembreteParaCron).mockImplementation(async (_, row) => { reservas.delete(JSON.stringify(row)); });
  send.mockResolvedValue({ statusCode: 201 });
});
it.each([
  ['2026-10-13', 'D-2', 'Vence em breve', 'Fixture — R$ 1.234,50 vence 15/10'],
  ['2026-10-14', 'D-1', 'Já foi pago?', 'Fixture vence amanhã. Toque para marcar como paga.'],
  ['2026-10-15', 'D0', 'Tá tudo certo?', 'Fixture vence hoje. Já pagou?'],
])('texto e reserva antes de enviar %s', async (hoje, etapa, title, body) => {
  expect(await run(hoje)).toMatchObject({ enviados: 1, contas: 1 });
  expect(send).toHaveBeenCalledWith(sub, { title, body, url: '/financas/contas/c?competencia=2026-10', tag: 'conta-c-2026-10' });
  expect(lembretes.reservarLembreteParaCron).toHaveBeenCalledWith(client, { user_id: 'u', conta_id: 'c', competencia: '2026-10', etapa, canal: 'push' });
  expect(vi.mocked(lembretes.reservarLembreteParaCron).mock.invocationCallOrder[0]).toBeLessThan(send.mock.invocationCallOrder[0]!);
  expect(await run(hoje)).toMatchObject({ enviados: 0 });
  expect(send).toHaveBeenCalledTimes(1);
  expect(lembretes.liberarLembreteParaCron).not.toHaveBeenCalled();
});
it.each(['2026-10-12', '2026-10-16'])('sem retroativo nem antecipação extra %s', async hoje => {
  expect(await run(hoje)).toMatchObject({ enviados: 0 });
  expect(send).not.toHaveBeenCalled(); expect(lembretes.reservarLembreteParaCron).not.toHaveBeenCalled();
});
it('inativa e paga não reservam; pagamento não bloqueia mês seguinte', async () => {
  vi.mocked(contas.contasAtivasComInscricaoParaCron).mockResolvedValue([{ ...conta, ativo: false }] as never);
  expect(await run()).toMatchObject({ enviados: 0 });
  vi.mocked(contas.contasAtivasComInscricaoParaCron).mockResolvedValue([conta] as never);
  vi.mocked(pagamentos.pagamentosDasCompetenciasParaCron).mockResolvedValue([{ conta_id: 'c', competencia: '2026-10' }] as never);
  expect(await run()).toMatchObject({ enviados: 0 });
  expect(lembretes.reservarLembreteParaCron).not.toHaveBeenCalled();
  expect(await run('2026-11-13')).toMatchObject({ enviados: 1 });
});
it.each([
  ['2026-11-30', 2, '2026-11', '2026-12'],
  ['2027-01-31', 2, '2027-01', '2027-02'],
  ['2026-12-30', 1, '2026-12', '2027-01'],
])('D-2 atravessa mês/ano: %s, dia %i', async (hoje, dia, atual, proxima) => {
  vi.mocked(contas.contasAtivasComInscricaoParaCron).mockResolvedValue([{ ...conta, dia_vencimento: dia }] as never);
  expect(await run(hoje)).toMatchObject({ enviados: 1 });
  expect(send).toHaveBeenLastCalledWith(sub, expect.objectContaining({ url: `/financas/contas/c?competencia=${proxima}`, title: 'Vence em breve' }));
  expect(lembretes.reservarLembreteParaCron).toHaveBeenCalledWith(client, expect.objectContaining({ competencia: proxima, etapa: 'D-2' }));
  expect(pagamentos.pagamentosDasCompetenciasParaCron).toHaveBeenCalledWith(client, [atual, proxima], ['u']);
});
it.each([404, 410])('falha ao remover inscrição %s é logada e continua o cron', async statusCode => {
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  try {
    vi.mocked(push.inscricoesDoUsuarioParaCron).mockResolvedValue([sub, { ...sub, id: 's2' }] as never);
    vi.mocked(push.removerInscricaoParaCron).mockRejectedValue(new Error(sub.endpoint));
    send.mockRejectedValueOnce({ statusCode });
    expect(await run()).toMatchObject({ enviados: 1, inscricoesRemovidas: 0 });
    expect(send).toHaveBeenCalledTimes(2);
    expect(log).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith('Falha ao remover inscrição push expirada');
  } finally { log.mockRestore(); }
});
it.each([404, 410])('remove inscrição expirada %s e envia nas demais', async statusCode => {
  vi.mocked(push.inscricoesDoUsuarioParaCron).mockResolvedValue([sub, { ...sub, id: 's2' }] as never);
  send.mockRejectedValueOnce({ statusCode });
  expect(await run()).toMatchObject({ enviados: 1, inscricoesRemovidas: 1 });
  expect(push.removerInscricaoParaCron).toHaveBeenCalledWith(client, 's');
});
it.each([undefined, 429, 500, 503, 599])('falha transitória %s libera reserva e permite nova tentativa', async statusCode => {
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  try {
    send.mockRejectedValueOnce(statusCode === undefined ? new Error(sub.endpoint) : { statusCode, message: sub.endpoint });
    expect(await run()).toMatchObject({ enviados: 0 });
    expect(lembretes.liberarLembreteParaCron).toHaveBeenCalledWith(client, { user_id: 'u', conta_id: 'c', competencia: '2026-10', etapa: 'D-2', canal: 'push' });
    expect(await run()).toMatchObject({ enviados: 1 });
    expect(await run()).toMatchObject({ enviados: 0 });
    expect(send).toHaveBeenCalledTimes(2);
    expect(log).toHaveBeenCalledWith('Falha no envio de lembrete push');
    expect(push.removerInscricaoParaCron).not.toHaveBeenCalled();
  } finally { log.mockRestore(); }
});
it('falha ao liberar reserva da primeira conta é logada e a segunda ainda recebe', async () => {
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  try {
    vi.mocked(contas.contasAtivasComInscricaoParaCron).mockResolvedValue([conta, { ...conta, id: 'c2' }] as never);
    vi.mocked(lembretes.liberarLembreteParaCron).mockRejectedValueOnce(new Error(sub.endpoint));
    send.mockRejectedValueOnce({ statusCode: 503 });
    await expect(run()).resolves.toMatchObject({ contas: 2, enviados: 1 });
    expect(send).toHaveBeenCalledTimes(2);
    expect(send).toHaveBeenLastCalledWith(sub, expect.objectContaining({ url: '/financas/contas/c2?competencia=2026-10' }));
    expect(lembretes.liberarLembreteParaCron).toHaveBeenCalledTimes(1);
    expect(lembretes.liberarLembreteParaCron).toHaveBeenCalledWith(client, expect.objectContaining({ conta_id: 'c' }));
    expect(log.mock.calls).toEqual([
      ['Falha no envio de lembrete push'],
      ['Falha ao liberar reserva de lembrete push'],
    ]);
    await expect(run()).resolves.toMatchObject({ enviados: 0 });
    expect(send).toHaveBeenCalledTimes(2);
  } finally { log.mockRestore(); }
});
it.each([404, 410])('expirada %s mantém reserva mesmo sem sucesso', async statusCode => {
  send.mockRejectedValue({ statusCode });
  expect(await run()).toMatchObject({ enviados: 0, inscricoesRemovidas: 1 });
  await run();
  expect(send).toHaveBeenCalledTimes(1);
  expect(push.removerInscricaoParaCron).toHaveBeenCalledWith(client, sub.id);
  expect(lembretes.liberarLembreteParaCron).not.toHaveBeenCalled();
});
it.each([true, false])('sucesso parcial mantém reserva (falha primeiro: %s)', async falhaPrimeiro => {
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  try {
    vi.mocked(push.inscricoesDoUsuarioParaCron).mockResolvedValue([sub, { ...sub, id: 's2' }] as never);
    if (falhaPrimeiro) send.mockRejectedValueOnce({ statusCode: 503 });
    else send.mockResolvedValueOnce({ statusCode: 201 }).mockRejectedValueOnce({ statusCode: 429 });
    expect(await run()).toMatchObject({ enviados: 1 });
    await run();
    expect(send).toHaveBeenCalledTimes(2);
    expect(lembretes.liberarLembreteParaCron).not.toHaveBeenCalled();
  } finally { log.mockRestore(); }
});
it('libera após todas as inscrições falharem, inclusive expirada junto de transitória', async () => {
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  try {
    vi.mocked(push.inscricoesDoUsuarioParaCron).mockResolvedValue([sub, { ...sub, id: 's2' }] as never);
    send.mockRejectedValueOnce({ statusCode: 410 }).mockRejectedValueOnce({ statusCode: 500 });
    await run();
    expect(lembretes.liberarLembreteParaCron).toHaveBeenCalledTimes(1);
    vi.mocked(push.inscricoesDoUsuarioParaCron).mockResolvedValue([{ ...sub, id: 's2' }] as never);
    expect(await run()).toMatchObject({ enviados: 1 });
    expect(send).toHaveBeenCalledTimes(3);
  } finally { log.mockRestore(); }
});
it('sem inscrição não reserva; falha na reserva impede envio', async () => {
  vi.mocked(push.inscricoesDoUsuarioParaCron).mockResolvedValue([]);
  await run(); expect(lembretes.reservarLembreteParaCron).not.toHaveBeenCalled();
  vi.mocked(push.inscricoesDoUsuarioParaCron).mockResolvedValue([sub] as never);
  vi.mocked(lembretes.reservarLembreteParaCron).mockRejectedValue(new Error('fixture'));
  await expect(run()).rejects.toThrow('fixture'); expect(send).not.toHaveBeenCalled();
});
it('duas execuções concorrentes enviam só uma vez', async () => {
  const resultados = await Promise.all([run(), run()]);
  expect(resultados.reduce((n, r) => n + r.enviados, 0)).toBe(1);
  expect(send).toHaveBeenCalledTimes(1);
});

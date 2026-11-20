import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as dieta from '../dieta.service';
import * as treino from '../treino.service';
import { dietaRepository, sessaoRepository } from '../../repositories';

vi.mock('../../repositories', () => ({
  dietaRepository: {
    findRefeicoesByDate: vi.fn(), upsertRegistroPeso: vi.fn(),
  },
  sessaoRepository: { create: vi.fn(), findByUserAndDateRange: vi.fn() },
}));

const tzOriginal = process.env.TZ;
process.env.TZ = 'UTC';
afterAll(() => {
  if (tzOriginal === undefined) delete process.env.TZ;
  else process.env.TZ = tzOriginal;
});

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
  // Segunda-feira em UTC; ainda domingo às 22h30 em São Paulo.
  vi.setSystemTime(new Date('2026-11-23T01:30:00Z'));
  vi.mocked(dietaRepository.findRefeicoesByDate).mockResolvedValue([]);
  vi.mocked(sessaoRepository.findByUserAndDateRange).mockResolvedValue([]);
});
afterEach(() => vi.useRealTimers());

describe.each(['UTC', 'Asia/Tokyo'])('dia civil de São Paulo no servidor %s', (tz) => {
  beforeEach(() => { process.env.TZ = tz; });
  it('inicia sessão no dia BRT e busca a semana que ainda termina no domingo', async () => {
    await treino.iniciarSessao('u', null);
    expect(sessaoRepository.create).toHaveBeenCalledWith('u', expect.objectContaining({ data: '2026-11-22' }));
    await treino.obterSessoesSemana('u');
    expect(sessaoRepository.findByUserAndDateRange).toHaveBeenCalledWith('u', '2026-11-16', '2026-11-22');
  });

  it('consulta refeições e grava peso no dia BRT', async () => {
    await dieta.refeicoesDoDia('u');
    await dieta.registrarPesoDoDia('u', { peso: 70 });
    expect(dietaRepository.findRefeicoesByDate).toHaveBeenCalledWith('u', '2026-11-22');
    expect(dietaRepository.upsertRegistroPeso).toHaveBeenCalledWith('u', { peso: 70, data: '2026-11-22' });
  });

  it('preserva datas fornecidas para dieta', async () => {
    await dieta.refeicoesDoDia('u', '2026-10-10');
    await dieta.registrarPesoDoDia('u', { peso: 70, data: '2026-10-10' });
    expect(dietaRepository.findRefeicoesByDate).toHaveBeenCalledWith('u', '2026-10-10');
    expect(dietaRepository.upsertRegistroPeso).toHaveBeenCalledWith('u', { peso: 70, data: '2026-10-10' });
  });
});

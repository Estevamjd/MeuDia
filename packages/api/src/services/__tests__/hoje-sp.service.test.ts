import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as dieta from '../dieta.service';
import * as treino from '../treino.service';
import * as habito from '../habito.service';
import * as score from '../score.service';
import { dietaRepository, sessaoRepository, habitoRepository, scoreRepository } from '../../repositories';

vi.mock('../../repositories', () => ({
  dietaRepository: {
    findRefeicoesByDate: vi.fn(), findRegistroAguaByDate: vi.fn(),
    upsertRegistroAgua: vi.fn(), upsertRegistroPeso: vi.fn(),
  },
  sessaoRepository: { create: vi.fn(), findByUserAndDateRange: vi.fn() },
  habitoRepository: {
    findByUserId: vi.fn(), findRegistrosByDate: vi.fn(),
    findRegistrosByDateRange: vi.fn(), upsertRegistro: vi.fn(),
  },
  scoreRepository: { findByDate: vi.fn(), findByDateRange: vi.fn() },
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
  vi.mocked(habitoRepository.findByUserId).mockResolvedValue([]);
  vi.mocked(habitoRepository.findRegistrosByDate).mockResolvedValue([]);
  vi.mocked(scoreRepository.findByDateRange).mockResolvedValue([]);
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

  it('consulta refeições e água e grava água/peso no dia BRT', async () => {
    await dieta.refeicoesDoDia('u');
    await dieta.resumoNutricionalDia('u');
    await dieta.aguaHoje('u');
    await dieta.registrarAgua('u');
    await dieta.registrarPesoDoDia('u', { peso: 70 });
    expect(dietaRepository.findRefeicoesByDate).toHaveBeenNthCalledWith(1, 'u', '2026-11-22');
    expect(dietaRepository.findRefeicoesByDate).toHaveBeenNthCalledWith(2, 'u', '2026-11-22');
    expect(dietaRepository.findRegistroAguaByDate).toHaveBeenCalledWith('u', '2026-11-22');
    expect(dietaRepository.upsertRegistroAgua).toHaveBeenCalledWith('u', expect.objectContaining({ data: '2026-11-22' }));
    expect(dietaRepository.upsertRegistroPeso).toHaveBeenCalledWith('u', { peso: 70, data: '2026-11-22' });
  });

  it('preserva datas fornecidas para dieta e hábito', async () => {
    await dieta.refeicoesDoDia('u', '2026-10-10');
    await dieta.registrarPesoDoDia('u', { peso: 70, data: '2026-10-10' });
    await habito.marcarHabito('u', 'h', '2026-10-10', true);
    expect(dietaRepository.findRefeicoesByDate).toHaveBeenCalledWith('u', '2026-10-10');
    expect(dietaRepository.upsertRegistroPeso).toHaveBeenCalledWith('u', { peso: 70, data: '2026-10-10' });
    expect(habitoRepository.upsertRegistro).toHaveBeenCalledWith('u', 'h', '2026-10-10', true, 1);
  });

  it('usa domingo BRT para hábitos de hoje e sua semana', async () => {
    vi.mocked(habitoRepository.findByUserId).mockResolvedValue([{ id: 'h', dias_semana: [0] }] as never);
    expect(await habito.calcularPercentualDia('u')).toEqual({ total: 1, concluidos: 0, percentual: 0 });
    await habito.obterRegistrosHoje('u');
    await habito.marcarHabito('u', 'h', undefined, true);
    await habito.obterRegistrosSemana('u');
    expect(habitoRepository.findRegistrosByDate).toHaveBeenCalledWith('u', '2026-11-22');
    expect(habitoRepository.upsertRegistro).toHaveBeenCalledWith('u', 'h', '2026-11-22', true, 1);
    expect(habitoRepository.findRegistrosByDateRange).toHaveBeenCalledWith('u', '2026-11-16', '2026-11-22');
  });

  it('score de hoje, histórico e streak ficam no dia BRT', async () => {
    await score.obterScoreHoje('u');
    expect(scoreRepository.findByDate).toHaveBeenCalledWith('u', '2026-11-22');
    await score.obterHistorico('u', 2);
    expect(scoreRepository.findByDateRange).toHaveBeenCalledWith('u', '2026-11-20', '2026-11-22');
    vi.mocked(scoreRepository.findByDateRange).mockResolvedValue([
      { data: '2026-11-22', score: 100 }, { data: '2026-11-21', score: 100 },
    ] as never);
    expect(await score.calcularStreak('u')).toBe(2);
    expect(await score.calcularScoreDiario('u')).toMatchObject({ data: '2026-11-22' });
  });
});

import { describe, it, expect } from 'vitest';
import { vencimentoNoMes, proximoVencimento, diasAte, hojeSP, competenciaDe, etapaLembrete } from '../vencimentos';

describe('BE-01: datas de vencimento', () => {
  it.each([[31, 2027, 2, '2027-02-28'], [29, 2028, 2, '2028-02-29'], [31, 2026, 4, '2026-04-30'], [31, 2026, 10, '2026-10-31']] as const)('limita %i em %i/%i', (dia, ano, mes, esperado) => {
    expect(vencimentoNoMes(dia, ano, mes)).toBe(esperado);
  });
  it.each([[28, '2026-10-28', '2026-10-28', 0], [2, '2026-10-28', '2026-11-02', 5], [5, '2026-12-30', '2027-01-05', 6], [31, '2027-02-28', '2027-02-28', 0]] as const)('inclui hoje e vira mês/ano', (dia, hoje, esperado, dias) => {
    expect(proximoVencimento(dia, hoje)).toBe(esperado);
    expect(diasAte(esperado, hoje)).toBe(dias);
  });
  it('usa calendário e fuso SP', () => {
    expect(hojeSP(new Date('2026-10-15T02:00:00Z'))).toBe('2026-10-14');
    expect(diasAte('2018-11-05', '2018-11-03')).toBe(2);
    expect(competenciaDe('2027-02-28')).toBe('2027-02');
  });
  it.each([['2027-01-03', null], ['2027-01-02', 'D-2'], ['2027-01-01', 'D-1'], ['2026-12-31', 'D0'], ['2026-12-30', null]] as const)('etapa %s', (data, etapa) => {
    expect(etapaLembrete(data, '2026-12-31')).toBe(etapa);
  });
});

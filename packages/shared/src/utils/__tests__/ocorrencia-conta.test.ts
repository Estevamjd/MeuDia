import { describe, expect, it } from 'vitest';
import type { ContaPagar } from '../../types/financas';
import { ocorrenciaDaConta } from '../ocorrencia-conta';

const conta: ContaPagar = {
  id: 'conta', user_id: 'user', assinatura_id: null, descricao: 'Conta', categoria: 'Contas', valor: 10,
  recorrencia: 'mensal', dia_vencimento: 31, mes_vencimento: null, data_vencimento: null,
  ativo: true, created_at: '2026-10-01T03:00:00Z', updated_at: null,
};
describe('BE-04: ocorrência pura', () => {
  it('limita dia 31 em fevereiro comum e bissexto', () => {
    expect(ocorrenciaDaConta(conta, '2027-02')).toEqual({ vencimento: '2027-02-28' });
    expect(ocorrenciaDaConta(conta, '2028-02')).toEqual({ vencimento: '2028-02-29' });
  });
  it('anual só no mês definido', () => {
    const anual = { ...conta, recorrencia: 'anual' as const, mes_vencimento: 2 };
    expect(ocorrenciaDaConta(anual, '2027-02')).toEqual({ vencimento: '2027-02-28' });
    expect(ocorrenciaDaConta(anual, '2027-03')).toBeNull();
  });
  it('única só na sua competência, mesmo com criação posterior', () => {
    const unica = { ...conta, recorrencia: 'unica' as const, dia_vencimento: null, data_vencimento: '2026-09-15' };
    expect(ocorrenciaDaConta(unica, '2026-09')).toEqual({ vencimento: '2026-09-15' });
    expect(ocorrenciaDaConta(unica, '2026-10')).toBeNull();
  });
  it('recorrente não existe antes da criação (fuso SP)', () => {
    expect(ocorrenciaDaConta({ ...conta, created_at: '2026-11-02T00:00:00Z' }, '2026-10')).toBeNull();
    expect(ocorrenciaDaConta({ ...conta, created_at: '2026-11-01T02:00:00Z' }, '2026-10')).toEqual({ vencimento: '2026-10-31' });
  });
  it.each(['mensal', 'anual', 'unica'] as const)('inativa %s não gera ocorrência nem lembrete', recorrencia => {
    expect(ocorrenciaDaConta({ ...conta, recorrencia, mes_vencimento: 10, data_vencimento: '2026-10-31', ativo: false }, '2026-10')).toBeNull();
  });
});

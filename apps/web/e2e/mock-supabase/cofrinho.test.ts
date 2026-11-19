import { describe, expect, it } from 'vitest';
// @ts-expect-error módulo .mjs do mock sem tipos
import { rpcCofrinho, totalBancos } from './cofrinho.mjs';

class PgError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}
const montar = () => {
  const tables: Record<string, Record<string, unknown>[]> = {
    carteiras: [{ id: 'c', user_id: 'u', saldo_inicial: 300, saldo_inicial_em: '2026-10-18T05:00:00Z', incluir_no_total: true, arquivada: false }],
    transacoes: [{ user_id: 'u', carteira_id: 'c', tipo: 'despesa', valor: 100, data: '2026-11-01', created_at: '2026-11-01T12:00:00Z' }],
    transferencias: [],
  };
  const ctx = { uid: 'u', rowsOf: (t: string) => (tables[t] ??= []), PgError, hojeSP: () => '2026-11-19', nowIso: () => '2026-11-19T15:00:00Z' };
  return { tables, chamar: (fn: string, args: Record<string, unknown> = {}) => rpcCofrinho(fn, { ...ctx, args }) };
};

describe('mock do Cofrinho (014)', () => {
  it('inicial = total dos bancos; gasto depois não muda; guardar/tirar/corrigir; fechar uma vez', () => {
    const { tables, chamar } = montar();
    expect(totalBancos({ uid: 'u', rowsOf: (t: string) => tables[t] ?? [], hojeSP: () => '2026-11-19' })).toBe(200);
    expect(chamar('cofrinho_iniciar')).toBe(200);
    tables.transacoes!.push({ user_id: 'u', carteira_id: 'c', tipo: 'despesa', valor: 50, data: '2026-11-19', created_at: '2026-11-19T16:00:00Z' });
    expect(chamar('cofrinho_iniciar')).toBe(200);
    chamar('cofrinho_mover', { p_tipo: 'guardar', p_valor: 10, p_chave: 'k1' });
    chamar('cofrinho_mover', { p_tipo: 'guardar', p_valor: 10, p_chave: 'k1' });
    expect(() => chamar('cofrinho_mover', { p_tipo: 'tirar', p_valor: 500, p_chave: 'k2' })).toThrow('insuficiente');
    expect(chamar('cofrinho_corrigir', { p_valor_real: 250, p_chave: 'k3' })[0].valor).toBe(40);
    chamar('cofrinho_fechar_mes', { p_competencia: '2026-10', p_guardar: true, p_valor: 99 });
    chamar('cofrinho_fechar_mes', { p_competencia: '2026-10', p_guardar: true, p_valor: 99 });
    expect(() => chamar('cofrinho_fechar_mes', { p_competencia: '2026-08', p_guardar: false })).toThrow('Competência');
    expect(tables.cofrinho_movimentos!.reduce((s, m) => s + Number(m.valor), 0)).toBeCloseTo(349, 2);
    expect(tables.cofrinho_fechamentos).toHaveLength(1);
  });
});

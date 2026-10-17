import { expect, it } from 'vitest';
import { resolve } from 'node:path';
const caminho = resolve('apps/web/e2e/mock-supabase/corrigir-saldo.mjs');
const { corrigirSaldo } = await import(caminho);
const HOJE = '2026-10-17';
function preparar() {
  const carteira = { id: 'c', nome: 'Nu', saldo_inicial: 100, saldo_inicial_em: '2026-10-17T12:00:00Z' };
  const tabelas: Record<string, Record<string, unknown>[]> = { transacoes: [], transferencias: [] };
  class PgError extends Error { constructor(public status: number, public code: string, msg: string) { super(msg); } }
  const contexto = { uid: 'u', rowsOf: (t: string) => tabelas[t], carteiraAtivaDe: () => carteira, PgError, hojeSP: () => HOJE, defaults: () => ({ created_at: '2026-10-17T14:00:00Z' }) };
  const executar = (real: number, chave = 'chave', id = 'c') => corrigirSaldo({ ...contexto, args: { p_valor_real: real, p_chave: chave, p_carteira_id: id } });
  return { tabelas, executar };
}
it('duas correções para 80 criam só um ajuste; retry de resposta perdida devolve o mesmo', () => {
  const { tabelas, executar } = preparar();
  const primeira = executar(80, 'aba-a');
  expect(primeira[0]).toMatchObject({ tipo: 'despesa', valor: 20, ajuste: true });
  expect(executar(80, 'aba-b')).toEqual([]);
  expect(executar(80, 'aba-a')).toEqual(primeira);
  expect(tabelas.transacoes).toHaveLength(1);
  expect(() => executar(80, 'aba-a', 'outra')).toThrow('Chave já usada');
});
it('inclui transferências e somente movimentos posteriores à âncora; aceita saldo negativo', () => {
  const { tabelas, executar } = preparar();
  tabelas.transacoes!.push(
    { user_id: 'u', carteira_id: 'c', tipo: 'despesa', valor: 999, data: HOJE, created_at: '2026-10-17T11:00:00Z' },
    { user_id: 'u', carteira_id: 'c', tipo: 'despesa', valor: 10, data: HOJE, created_at: '2026-10-17T13:00:00Z' },
  );
  tabelas.transferencias!.push({ user_id: 'u', origem_id: 'c', destino_id: 'outra', valor: 20, data: HOJE, created_at: '2026-10-17T13:00:00Z' });
  expect(executar(-10)[0]).toMatchObject({ tipo: 'despesa', valor: 80 });
});
it('não cria ajuste sem diferença e rejeita valor/chave inválidos', () => {
  const { tabelas, executar } = preparar();
  expect(executar(100)).toEqual([]);
  expect(executar(150)[0]).toMatchObject({ tipo: 'receita', valor: 50 });
  expect(() => executar(12.345)).toThrow();
  expect(() => executar(20, '')).toThrow();
  expect(tabelas.transacoes).toHaveLength(1);
});
it('chave repetida com outro valor e diferença acima de DECIMAL(10,2) são 22023 (como na 006)', () => {
  const { tabelas, executar } = preparar();
  executar(80, 'k');
  expect(() => executar(81, 'k')).toThrow('outro valor');
  expect(() => executar(100000100, 'k2')).toThrow('grande demais');
  expect(tabelas.transacoes).toHaveLength(1);
});

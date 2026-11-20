import { beforeEach, expect, it, vi } from 'vitest';
import { logger } from '@meudia/shared';
import type { TransacaoInsert } from '@meudia/shared';
import * as service from '../financas.service';
import * as repo from '../../repositories/transacao.repository';

const { getSupabase } = vi.hoisted(() => ({ getSupabase: vi.fn() }));
vi.mock('../../repositories/supabase', () => ({ getSupabase }));
vi.mock('../../repositories', async () => ({
  transacaoRepository: await vi.importActual('../../repositories/transacao.repository'),
  pagamentosContaRepository: { findByTransacoes: vi.fn().mockResolvedValue([]) },
  recebimentosRendaRepository: { findByTransacoes: vi.fn().mockResolvedValue([]) },
}));
let result: { data: unknown; error: unknown; count?: number | null };
let inserted: Record<string, unknown>[];
const query = {
  select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), gte: vi.fn().mockReturnThis(),
  insert: vi.fn((rows: Record<string, unknown>[]) => { inserted = rows; return query; }),
  delete: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(), single: vi.fn().mockReturnThis(),
  then: (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve),
};
const from = vi.fn(() => query);
const base: TransacaoInsert = { tipo: 'despesa', categoria: 'Compras', descricao: 'Tênis', valor: 100, data: '2026-01-31' };
beforeEach(() => {
  vi.clearAllMocks();
  inserted = [];
  result = { data: [], error: null, count: 3 };
  getSupabase.mockReturnValue({ from });
});
it('cria N parcelas com UM insert, dono imposto, UUID comum, centavos e datas ancoradas', async () => {
  await service.criarDespesaParcelada('dono', { base: { ...base, parcela_grupo: 'ignorado', parcela_num: 8, parcela_total: 9 }, total: 100, parcelas: 3 });
  expect(from).toHaveBeenCalledTimes(1);
  expect(from).toHaveBeenCalledWith('transacoes');
  expect(query.insert).toHaveBeenCalledTimes(1);
  expect(inserted).toHaveLength(3);
  expect(inserted.every(r => r.user_id === 'dono' && r.descricao === 'Tênis' && r.parcela_total === 3)).toBe(true);
  expect(new Set(inserted.map(r => r.parcela_grupo)).size).toBe(1);
  expect(inserted[0]?.parcela_grupo).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  expect(inserted.map(r => [r.parcela_num, r.valor, r.data])).toEqual([
    [1, 33.34, '2026-01-31'], [2, 33.33, '2026-02-28'], [3, 33.33, '2026-03-31'],
  ]);
  expect(inserted.reduce((s, r) => s + Math.round(Number(r.valor) * 100), 0)).toBe(10000);
  expect(query.select).toHaveBeenCalledWith(expect.stringContaining('parcela_grupo, parcela_num, parcela_total'));
});
it('sem data usa hoje SP inclusive na virada UTC; total prevalece sobre valor da base', async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-12-01T01:30:00Z'));
  try {
    await service.criarDespesaParcelada('dono', { base: { ...base, data: undefined, valor: 0 }, total: 100, parcelas: 2 });
    expect(inserted.map(r => r.data)).toEqual(['2026-11-30', '2026-12-30']);
  } finally { vi.useRealTimers(); }
});
it.each([
  { base: { ...base, tipo: 'receita' as const }, total: 100, parcelas: 3 },
  { base: { ...base, ajuste: true }, total: 100, parcelas: 3 },
  ...[0, 1, 25, 2.5, NaN].map(parcelas => ({ base, total: 100, parcelas })),
  ...[0, -1, 1.001, Infinity].map(total => ({ base, total, parcelas: 2 })),
  { base: { ...base, descricao: '' }, total: 100, parcelas: 3 },
  { base: { ...base, data: '2026-02-30' }, total: 100, parcelas: 3 },
])('rejeita antes de qualquer DB: %j', async input => {
  await expect(service.criarDespesaParcelada('dono', input)).rejects.toThrow();
  expect(getSupabase).not.toHaveBeenCalled();
});
it('createMany impõe user_id até em entrada adulterada e ordena retorno por parcela_num', async () => {
  result.data = [{ parcela_num: 2 }, { parcela_num: 1 }];
  expect(await repo.createMany('dono', [{ ...base, user_id: 'outro' } as TransacaoInsert])).toEqual([{ parcela_num: 1 }, { parcela_num: 2 }]);
  expect(inserted[0]?.user_id).toBe('dono');
});
it('exclui por dono + grupo + num >= k e retorna count sem truncar no max-rows', async () => {
  result.count = 24;
  expect(await service.excluirParcelasDesde('dono', '10000000-0000-4000-8000-000000000001', 3)).toBe(24);
  expect(query.delete).toHaveBeenCalledWith({ count: 'exact' });
  expect(query.eq.mock.calls).toEqual([['user_id', 'dono'], ['parcela_grupo', '10000000-0000-4000-8000-000000000001']]);
  expect(query.gte).toHaveBeenCalledWith('parcela_num', 3);
});
it('nenhuma parcela apagada = zero', async () => {
  result.count = 0;
  expect(await repo.removeParcelasDesde('dono', 'grupo', 1)).toBe(0);
});
it.each([0, -1, 25, 1.5, NaN])('exclusão rejeita número inválido %s antes do DB', async n => {
  await expect(service.excluirParcelasDesde('dono', '10000000-0000-4000-8000-000000000001', n)).rejects.toThrow();
  expect(getSupabase).not.toHaveBeenCalled();
});
it('edição de uma linha remove parcela_* e não altera outras parcelas', async () => {
  result.data = { id: 't' };
  await service.atualizarTransacao('dono', 't', { valor: 42, descricao: 'Outro', parcela_grupo: null, parcela_num: 5, parcela_total: 10 });
  expect(query.update).toHaveBeenCalledWith({ valor: 42, descricao: 'Outro' });
  expect(query.eq.mock.calls).toEqual([['id', 't'], ['user_id', 'dono']]);
});
it.each(['create', 'delete'])('erro DB em %s propaga sem retorno parcial', async op => {
  const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
  result.error = { code: '23514', message: 'constraint' };
  try {
    await expect(op === 'create' ? repo.createMany('dono', [base]) : repo.removeParcelasDesde('dono', 'grupo', 1)).rejects.toMatchObject({ code: 'VALIDATION_ERROR', status: 400 });
    expect(warn.mock.calls).toEqual([['[db] check violado', { code: '23514' }]]);
  } finally { warn.mockRestore(); }
});

it.each([{ tipo: 'receita' }, { ajuste: true }])('revisão 3: parcela rejeita %j antes do UPDATE', async patch => {
  result.data = { id: 't', parcela_grupo: '10000000-0000-4000-8000-000000000001' };
  await expect(service.atualizarTransacao('dono', 't', patch)).rejects.toMatchObject({ code: 'VALIDATION_ERROR', status: 400 });
  expect(query.update).not.toHaveBeenCalled();
  expect(query.eq).toHaveBeenCalledWith('user_id', 'dono');
});
it.each([
  { total: 0.01, parcelas: 2, data: '2026-11-01' },
  { total: 100, parcelas: 1, data: '2026-11-01' },
  { total: 100, parcelas: 2, data: '2026-02-30' },
])('revisão 4: plano inválido vira 400 %j', async input => {
  await expect(service.criarDespesaParcelada('dono', { ...input, base: { ...base, data: input.data } })).rejects.toMatchObject({ code: 'VALIDATION_ERROR', status: 400 });
  expect(getSupabase).not.toHaveBeenCalled();
});
it.each(['grupo', '', '10000000-0000-4000-8000-00000000000z'])('revisão 8: UUID inválido %j não chega ao banco', async grupo => {
  await expect(service.excluirParcelasDesde('dono', grupo, 1)).rejects.toMatchObject({ code: 'VALIDATION_ERROR', status: 400 });
  expect(getSupabase).not.toHaveBeenCalled();
});
it('revisão 3: 23514 não revela mensagem PG', async () => {
  const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
  result.error = { code: '23514', message: 'raw PG private row' };
  await expect(repo.createMany('dono', [base])).rejects.toMatchObject({ code: 'VALIDATION_ERROR', status: 400, message: 'Os dados informados não são válidos.' });
  expect(warn.mock.calls).toEqual([['[db] check violado', { code: '23514' }]]);
  warn.mockRestore();
});

it('lançamento não parcelado permite mudar para receita', async () => {
  result.data = { id: 't', parcela_grupo: null };
  await service.atualizarTransacao('dono', 't', { tipo: 'receita' });
  expect(query.update).toHaveBeenCalledWith({ tipo: 'receita' });
  expect(query.eq.mock.calls).toEqual([['id', 't'], ['user_id', 'dono'], ['id', 't'], ['user_id', 'dono']]);
});

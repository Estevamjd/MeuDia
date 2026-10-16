import { describe, expect, it } from 'vitest';
import { competenciaSchema, contaPagarInsertSchema, pagarContaSchema } from '../contas-pagar.validator';
import { assinaturaInsertSchema } from '../assinaturas.validator';
import { rendaInsertSchema } from '../rendas.validator';
import { orcamentoInsertSchema } from '../orcamento.validator';
import { pushSubscriptionSchema } from '../push-subscription.validator';

const conta = { descricao: 'Conta', valor: 50, recorrencia: 'mensal', dia_vencimento: 31 };
describe('BE-03: validators financeiros', () => {
  it('aplica defaults e aceita as três recorrências', () => {
    expect(contaPagarInsertSchema.parse(conta)).toMatchObject({ categoria: 'Contas', ativo: true });
    expect(contaPagarInsertSchema.safeParse({ ...conta, recorrencia: 'anual', mes_vencimento: 2 }).success).toBe(true);
    expect(contaPagarInsertSchema.safeParse({ descricao: 'Conta', valor: 1, recorrencia: 'unica', data_vencimento: '2028-02-29' }).success).toBe(true);
    expect(rendaInsertSchema.parse({ descricao: 'Renda', valor: 1 }).ativo).toBe(true);
    expect(orcamentoInsertSchema.parse({ categoria: 'Contas', valor_planejado: 0 }).valor_planejado).toBe(0);
  });
  it.each([0, -1])('recusa valor %i em conta e renda', valor => {
    expect(contaPagarInsertSchema.safeParse({ ...conta, valor }).success).toBe(false);
    expect(rendaInsertSchema.safeParse({ descricao: 'Renda', valor }).success).toBe(false);
  });
  it.each([
    { recorrencia: 'anual' }, { recorrencia: 'unica', dia_vencimento: null },
    { data_vencimento: '2026-10-15' }, { mes_vencimento: 1 },
    { dia_vencimento: 0 }, { dia_vencimento: 32 }, { dia_vencimento: 1.5 },
    { recorrencia: 'unica', dia_vencimento: null, data_vencimento: '15/10/2026' },
    { recorrencia: 'unica', dia_vencimento: null, data_vencimento: '2027-02-29' },
    { descricao: '' }, { descricao: 'a'.repeat(501) }, { categoria: 'a'.repeat(101) },
  ])('recusa definição incoerente %j', patch => {
    expect(contaPagarInsertSchema.safeParse({ ...conta, ...patch }).success).toBe(false);
  });
  it.each(['2026-13', '2026-1', '2026-10-01'])('recusa competência %s', competencia => {
    expect(competenciaSchema.safeParse(competencia).success).toBe(false);
    expect(pagarContaSchema.safeParse({ competencia }).success).toBe(false);
  });
  it('valida pagamento, renda e orçamento', () => {
    expect(pagarContaSchema.safeParse({ competencia: '2026-10', pago_em: '15/10/2026' }).success).toBe(false);
    expect(pagarContaSchema.parse({ competencia: '2026-10', banco: null })).toEqual({ competencia: '2026-10', banco: null });
    expect(pagarContaSchema.safeParse({ competencia: '2026-10', banco: 'a'.repeat(101) }).success).toBe(false);
    expect(rendaInsertSchema.safeParse({ descricao: 'Renda', valor: 1, dia_recebimento: 32 }).success).toBe(false);
    expect(orcamentoInsertSchema.safeParse({ categoria: 'Contas', valor_planejado: -1 }).success).toBe(false);
  });
  it('aceita só endpoint HTTPS e chaves preenchidas', () => {
    const sub = { endpoint: 'https://example.invalid/push', keys: { p256dh: 'fixture', auth: 'fixture' } };
    expect(pushSubscriptionSchema.safeParse(sub).success).toBe(true);
    expect(pushSubscriptionSchema.safeParse({ ...sub, endpoint: 'http://example.invalid' }).success).toBe(false);
    expect(pushSubscriptionSchema.safeParse({ ...sub, keys: { p256dh: '', auth: '' } }).success).toBe(false);
  });
});

it('R5-1: valor respeita centavos e DECIMAL(10,2)', () => {
  const base = { descricao: 'Fixture', recorrencia: 'mensal', dia_vencimento: 1 };
  for (const valor of [0.01, 12.34, 99999999.99]) expect(contaPagarInsertSchema.safeParse({ ...base, valor }).success).toBe(true);
  for (const valor of [1.001, 100000000, 0, -1]) expect(contaPagarInsertSchema.safeParse({ ...base, valor }).success).toBe(false);
});

it('user_agent aceita exatamente 500 caracteres e rejeita 501', () => {
  const sub = { endpoint: 'https://example.invalid', keys: { p256dh: 'fixture', auth: 'fixture' } };
  expect(pushSubscriptionSchema.safeParse({ ...sub, user_agent: 'x'.repeat(500) }).success).toBe(true);
  expect(pushSubscriptionSchema.safeParse({ ...sub, user_agent: 'x'.repeat(501) }).success).toBe(false);
});

it.each([0.01, 12.34, 99999999.99, 1.001, 100000000, -1])('limites monetários de assinatura, renda e orçamento: %s', valor => {
  const valido = [0.01, 12.34, 99999999.99].includes(valor);
  expect(assinaturaInsertSchema.safeParse({ nome: 'Fixture', dia_vencimento: 1, valor }).success).toBe(valido);
  expect(rendaInsertSchema.safeParse({ descricao: 'Fixture', valor }).success).toBe(valido);
  expect(orcamentoInsertSchema.safeParse({ categoria: 'Fixture', valor_planejado: valor }).success).toBe(valido);
});

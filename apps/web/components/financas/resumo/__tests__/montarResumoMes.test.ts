import { describe, expect, it } from 'vitest';
import type { SobraDoMes, Transacao } from '@meudia/shared';
import { montarResumoMes, situacaoDo } from '../montarResumoMes';
import { origemDe } from '../../OrigemSelo';

const t = (id: string, tipo: Transacao['tipo'], categoria: string, valor: number, data: string, over: Partial<Transacao> = {}): Transacao => ({
  id, user_id: 'u', tipo, categoria, descricao: id, valor, data, banco: null, automatico: false, created_at: `${data}T12:00:00Z`, ...over,
});

const transacoes = [
  t('salario', 'receita', 'Salário', 4800, '2026-11-05', { automatico: true }),
  t('mercado', 'despesa', 'Mercado', 1140, '2026-11-10'),
  t('aluguel', 'despesa', 'Casa', 890, '2026-11-06', { automatico: true }),
  t('uber', 'despesa', 'Transporte', 18.4, '2026-11-17', { origem: 'whatsapp' }),
  t('ajuste', 'despesa', 'Ajuste de saldo', 500, '2026-11-17', { ajuste: true }),
  t('outubro', 'despesa', 'Mercado', 999, '2026-10-30'),
];

describe('montarResumoMes', () => {
  it('sem painel: entrou/saiu/sobra do mês sem ajustes nem outro mês; categorias com % do gasto', () => {
    const r = montarResumoMes('2026-11', transacoes, null);
    expect(r.entrou).toBe(4800);
    expect(r.saiu).toBe(2048.4);
    expect(r.sobra).toBe(2751.6);
    expect(r.prevista).toBeNull();
    expect(r.pctUsado).toBe(43);
    expect(r.situacao).toBe('no-controle');
    expect(r.categorias.map((c) => [c.categoria, c.pct])).toEqual([['Mercado', 56], ['Casa', 43], ['Transporte', 1]]);
    expect(r.ultimos.map((x) => x.id)).toEqual(['uber', 'mercado', 'aluguel', 'salario']);
    expect(r.quantidade).toEqual({ total: 4, whatsapp: 1 });
    expect(r.vazio).toBe(false);
  });

  it('com painel: renda do mês inclui a receber; prevista e próxima conta vêm da sobra', () => {
    const sobra: SobraDoMes = {
      competencia: '2026-11', renda: { lancada: 4800, aReceber: 200, total: 5000 },
      rendasAReceber: [{ id: 'r', descricao: 'Freela', valor: 200, data: '2026-11-25' }], despesasLancadas: 2048.4,
      contasAPagar: [{ id: 'c', descricao: 'Academia', categoria: 'Saúde', valor: 129.9, vencimento: '2026-11-20' }],
      despesas: 2178.3, valor: 2821.7,
    };
    const r = montarResumoMes('2026-11', transacoes, sobra);
    expect(r.aReceber).toBe(200);
    expect(r.renda).toBe(5000);
    expect(r.sobra).toBe(2951.6);
    expect(r.prevista).toBe(2821.7);
    expect(r.proximaConta).toEqual({ descricao: 'Academia', vencimento: '2026-11-20' });
  });

  it('mês sem nada: vazio, sem situação', () => {
    const r = montarResumoMes('2026-12', transacoes, null);
    expect(r.vazio).toBe(true);
    expect(r.situacao).toBeNull();
    expect(r.ultimos).toEqual([]);
  });

  it('situação: até 85% no controle, até 100% atenção, acima ou prevista negativa passou', () => {
    expect(situacaoDo(85, 10)).toBe('no-controle');
    expect(situacaoDo(86, 10)).toBe('atencao');
    expect(situacaoDo(101, 10)).toBe('passou');
    expect(situacaoDo(50, -1)).toBe('passou');
  });
});

describe('origemDe', () => {
  it('só origem whatsapp vira WhatsApp; automatico (Paguei/Recebi) e legado sem coluna são Manual', () => {
    expect(origemDe({ origem: 'whatsapp' })).toBe('whatsapp');
    expect(origemDe({ origem: 'app' })).toBe('manual');
    expect(origemDe({})).toBe('manual');
  });
});

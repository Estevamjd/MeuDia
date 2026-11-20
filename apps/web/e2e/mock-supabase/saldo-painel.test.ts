import { describe, expect, it } from 'vitest';
import type { Carteira, Transacao, Transferencia } from '@meudia/shared';
import { dataAncora, saldoCarteira, somarDias } from '@meudia/shared';
// @ts-expect-error módulo .mjs do mock sem tipos
import { rpcSaldoPainel } from './saldo-painel.mjs';

class PgError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}
type Tabelas = Record<string, Record<string, unknown>[]>;
const chamar = (tables: Tabelas, uid: string, fn: string, args: Record<string, unknown>) =>
  rpcSaldoPainel(fn, { uid, args, rowsOf: (t: string) => (tables[t] ??= []), PgError });

const A = 'c0140000-0000-4000-8000-0000000000a1';
const B = 'c0140000-0000-4000-8000-0000000000b1';
const id = (s: string) => `c0140000-0000-4000-8000-0000000000${s}`;

/** Mesmo cenário de packages/database/tests/015_rpc_saldo_painel.sql. */
function cenarioSql(): Tabelas {
  const banco = (s: string, user: string, nome: string, saldo: number, total = true, arquivada = false) => ({
    id: id(s), user_id: user, nome, tipo: 'banco', saldo_inicial: saldo, saldo_inicial_em: '2026-10-18T05:00:00Z',
    incluir_no_total: total, arquivada, ordem: 0, created_at: '2026-10-18T05:00:00Z', updated_at: null,
  });
  let n = 0;
  const t = (tipo: string, valor: number, data: string, carteira: string | null, created_at: string, ajuste = false) =>
    ({ id: `t${++n}`, user_id: A, tipo, valor, data, carteira_id: carteira && id(carteira), ajuste, created_at });
  const tr = (origem: string | null, destino: string | null, valor: number, data: string, created_at: string) =>
    ({ id: `tr${++n}`, user_id: A, origem_id: origem && id(origem), destino_id: destino && id(destino), valor, data, created_at });
  return {
    carteiras: [banco('a2', A, 'Banco 1', 240), banco('a3', A, 'Banco 2', 50), banco('a4', A, 'Fora', 1000, false), banco('a5', A, 'Arquivado', 500, true, true), banco('b2', B, 'Banco B', 10)],
    transacoes: [
      t('despesa', 100, '2026-10-16', 'a2', '2026-10-17T00:08:00Z'),
      t('despesa', 7, '2026-10-18', 'a2', '2026-10-18T04:30:00Z'),
      t('despesa', 5, '2026-10-18', 'a2', '2026-10-18T06:00:00Z'),
      t('despesa', 20.10, '2026-10-25', 'a2', '2026-10-25T19:28:38Z', true),
      t('receita', 11.87, '2026-10-31', 'a2', '2026-10-31T03:14:58Z', true),
      t('despesa', 270, '2026-10-31', null, '2026-10-31T03:13:49Z'),
      t('despesa', 20, '2026-11-05', 'a3', '2026-11-05T17:59:32Z'),
      t('despesa', 300, '2026-11-05', 'a4', '2026-11-05T17:59:32Z'),
      t('despesa', 999, '2027-01-01', 'a2', '2099-01-01T00:00:00Z'),
      t('receita', 999, '2026-10-18', 'a2', '2026-10-18T05:00:00.000999Z'),
    ],
    transferencias: [
      tr('a2', 'a3', 30, '2026-11-01', '2026-11-01T12:00:00Z'),
      tr('a4', 'a2', 40, '2026-11-02', '2026-11-02T12:00:00Z'),
      tr(null, 'a2', 3, '2026-11-03', '2026-11-03T12:00:00Z'),
      tr('a2', null, 2, '2026-11-03', '2026-11-03T12:00:00Z'),
      tr(null, 'a2', 999, '2026-10-18', '2026-10-18T05:00:00.000999Z'),
      tr(null, 'a2', 999, '2027-01-01', '2027-01-01T12:00:00Z'),
    ],
  };
}

describe('mock das RPCs da 015 (resumo_painel_saldo, saldos_carteiras_em)', () => {
  it('mesmos números do teste SQL: âncora no dia SP, ms, lado NULL, futuro fora, fora do total e arquivado', () => {
    const tabelas = cenarioSql();
    const saldos = chamar(tabelas, A, 'saldos_carteiras_em', { p_ate: '2026-11-20' }) as { carteira_id: string; saldo: number }[];
    expect([...saldos].sort((a, b) => a.carteira_id.localeCompare(b.carteira_id)).map((s) => s.saldo)).toEqual([237.77, 60, 660, 500]);
    const resumo = chamar(tabelas, A, 'resumo_painel_saldo', { p_hoje: '2026-11-20' });
    expect(resumo.carteiras).toHaveLength(4);
    expect(resumo.ultima_carteira_id).toBe(id('a2'));
    expect(resumo.carteiras.find((c: { nome: string }) => c.nome === 'Banco 1').saldo_fim_mes_anterior).toBe(226.77);
    expect(Object.keys(resumo.carteiras[0]).sort()).toEqual(
      ['arquivada', 'created_at', 'id', 'incluir_no_total', 'nome', 'ordem', 'saldo', 'saldo_fim_mes_anterior', 'saldo_inicial', 'saldo_inicial_em', 'tipo', 'updated_at', 'user_id'],
    );
    expect((chamar(tabelas, A, 'saldos_carteiras_em', { p_ate: '2026-10-17' }) as { carteira_id: string; saldo: number }[])
      .find((s) => s.carteira_id === id('a2'))!.saldo).toBe(240);
  });

  it('só o dono (RLS): B vê o próprio banco; sem banco não há carteira padrão', () => {
    const tabelas = cenarioSql();
    expect(chamar(tabelas, B, 'saldos_carteiras_em', { p_ate: '2026-11-20' })).toEqual([{ carteira_id: id('b2'), saldo: 10 }]);
    expect(chamar(tabelas, B, 'resumo_painel_saldo', { p_hoje: '2026-11-20' }).ultima_carteira_id).toBeNull();
    expect(chamar(tabelas, 'ninguem', 'resumo_painel_saldo', { p_hoje: '2026-11-20' })).toEqual({ carteiras: [], ultima_carteira_id: null });
  });

  it('data inválida é 22007; outra função não é desta RPC', () => {
    expect(() => chamar(cenarioSql(), A, 'saldos_carteiras_em', { p_ate: 'ontem' })).toThrow(/date/);
    expect(chamar(cenarioSql(), A, 'outra', {})).toBeUndefined();
  });

  it('equivale a saldoCarteira e à regra da carteira padrão do JS em 100 cenários', () => {
    let seed = 15;
    const r = (n: number) => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed % n; };
    for (let run = 0; run < 100; run++) {
      const primeiro = '2026-10-01';
      const hora = () => `${String(r(24)).padStart(2, '0')}:${String(r(60)).padStart(2, '0')}:00.${String(r(1000)).padStart(3, '0')}Z`;
      const cs: Carteira[] = Array.from({ length: 4 }, (_, i) => ({
        id: `c${i}`, user_id: 'u', nome: `${i}`, tipo: 'banco', saldo_inicial: (r(50000) - 10000) / 100,
        saldo_inicial_em: `${somarDias(primeiro, r(60) - 30)}T${hora()}`, incluir_no_total: !!r(2), arquivada: !r(4), ordem: r(3),
        created_at: `2026-01-0${i + 1}T12:00:00Z`, updated_at: null,
      }));
      const ts = Array.from({ length: 60 }, (_, i) => {
        const data = somarDias(primeiro, r(80) - 40);
        return { id: `t${String(i).padStart(3, '0')}`, user_id: r(10) ? 'u' : 'outro', carteira_id: r(6) ? `c${r(4)}` : null,
          tipo: r(2) ? 'receita' : 'despesa', valor: r(10000) / 100, data, ajuste: !r(5), categoria: 'Outros',
          created_at: r(8) ? `${somarDias(data, r(3) - 1)}T${hora()}` : null } as Transacao;
      });
      const trs = Array.from({ length: 30 }, (_, i) => {
        const data = somarDias(primeiro, r(80) - 40);
        return { id: `tr${i}`, user_id: 'u', origem_id: r(5) ? `c${r(4)}` : null, destino_id: r(5) ? `c${r(4)}` : null,
          valor: r(1000) / 100, data, created_at: `${data}T${hora()}` } as Transferencia;
      });
      const tabelas = { carteiras: cs, transacoes: ts, transferencias: trs } as unknown as Tabelas;
      const hoje = somarDias(primeiro, r(40));
      const meus = ts.filter((t) => t.user_id === 'u');
      const saldos = chamar(tabelas, 'u', 'saldos_carteiras_em', { p_ate: hoje }) as { carteira_id: string; saldo: number }[];
      expect(saldos).toEqual(cs.map((c) => ({ carteira_id: c.id, saldo: saldoCarteira(c, meus, trs, hoje) })));
      const desde = cs.map(dataAncora).sort()[0]!;
      const ativas = new Set(cs.filter((c) => !c.arquivada).map((c) => c.id));
      // Regra do JS antigo (painelSaldo sem a 015), com o desempate do Codex.
      const ultima = meus.filter((t) => t.data >= desde && t.carteira_id && ativas.has(t.carteira_id) && !t.ajuste)
        .sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? '') || a.data.localeCompare(b.data) || a.id.localeCompare(b.id))[0]?.carteira_id ?? null;
      const resumo = chamar(tabelas, 'u', 'resumo_painel_saldo', { p_hoje: hoje });
      expect(resumo.ultima_carteira_id).toBe(ultima);
      const fimAnterior = somarDias(`${hoje.slice(0, 7)}-01`, -1);
      for (const c of resumo.carteiras) {
        const original = cs.find((x) => x.id === c.id)!;
        expect(c.saldo).toBe(saldoCarteira(original, meus, trs, hoje));
        expect(c.saldo_fim_mes_anterior).toBe(saldoCarteira(original, meus, trs, fimAnterior));
      }
    }
  });
});

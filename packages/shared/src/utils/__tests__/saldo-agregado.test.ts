import { expect, it } from 'vitest';
import type { Carteira, Transacao, Transferencia } from '../../types/financas';
import { comecouMesCom, dataAncora, evolucaoMes, evolucaoMesComBase, painelDeSaldosAgregados, saldoCarteira, saldoHoje, saldosCarteiras, somarDias } from '../saldo';

it('bases e painel agregado equivalem ao histórico em 150 cenários determinísticos', () => {
  let seed = 159;
  const random = (n: number) => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed % n; };
  for (let run = 0; run < 150; run++) {
    const competencia = `2026-${String(9 + random(3)).padStart(2, '0')}`;
    const primeiro = `${competencia}-01`;
    const hoje = `${competencia}-20`;
    const cs: Carteira[] = Array.from({ length: 5 }, (_, i) => ({
      id: `${i}`, user_id: 'u', nome: `${i}`, tipo: 'banco', saldo_inicial: (random(50000) - 10000) / 100,
      saldo_inicial_em: `${somarDias(primeiro, random(100) - 60)}T12:00:00.123Z`,
      incluir_no_total: !!random(2), arquivada: !random(4), ordem: random(3),
      created_at: `2026-01-0${i + 1}T12:00:00Z`, updated_at: null,
    }));
    const ts = Array.from({ length: 90 }, (_, i) => {
      const c = cs[random(cs.length)]!;
      return { id: `${i}`.padStart(4, '0'), carteira_id: random(6) ? c.id : null,
        tipo: random(2) ? 'receita' : 'despesa', valor: random(10000) / 100,
        data: somarDias(primeiro, random(110) - 70), created_at: `${somarDias(primeiro, random(90) - 60)}T12:00:00Z`,
        ajuste: !random(5), categoria: 'Outros' } as Transacao;
    });
    const trs = Array.from({ length: 50 }, () => ({
      origem_id: random(6) ? `${random(5)}` : null, destino_id: `${random(5)}`,
      data: somarDias(primeiro, random(110) - 70), valor: random(1000) / 100,
      created_at: `${somarDias(primeiro, random(90) - 60)}T12:00:00Z`,
    } as Transferencia));
    const fimAnterior = somarDias(primeiro, -1);
    const bases = Object.fromEntries(cs.map((c) => [c.id, saldoCarteira(c, ts, trs, fimAnterior)]));
    const mes = ts.filter((t) => t.data.startsWith(competencia));
    expect(evolucaoMesComBase(competencia, hoje, mes, cs, bases, trs.filter((t) => t.data.startsWith(competencia))))
      .toEqual(evolucaoMes(competencia, hoje, mes, cs, ts, trs));
    const desde = cs.map(dataAncora).sort()[0]!;
    const ativas = new Set(cs.filter((c) => !c.arquivada).map((c) => c.id));
    const ultima = ts.filter((t) => t.data >= desde && t.carteira_id && ativas.has(t.carteira_id) && !t.ajuste)
      .sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? '') || a.data.localeCompare(b.data) || a.id.localeCompare(b.id))[0]?.carteira_id ?? null;
    const agregado = painelDeSaldosAgregados(cs.map((c) => ({ ...c, saldo: saldoCarteira(c, ts, trs, hoje), saldo_fim_mes_anterior: bases[c.id]! })), competencia, ultima);
    expect(agregado).toEqual({ carteiras: saldosCarteiras(cs, ts, trs, hoje), arquivadas: cs.filter((c) => c.arquivada),
      saldoHoje: saldoHoje(cs, ts, trs, hoje), comecouMes: comecouMesCom(cs, ts, trs, competencia),
      carteiraPadraoId: ultima ?? saldosCarteiras(cs, ts, trs, hoje)[0]?.carteira.id ?? null });
  }
});

it('painel vazio não inventa saldo inicial do mês nem carteira padrão', () => {
  expect(painelDeSaldosAgregados([], '2026-11', null)).toEqual({
    carteiras: [], arquivadas: [], saldoHoje: 0, comecouMes: null, carteiraPadraoId: null,
  });
});

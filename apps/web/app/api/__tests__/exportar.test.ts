import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from '../financas/exportar/route';
import { createServerSupabaseClient } from '../../../lib/supabase/server';
import { createClient } from '@supabase/supabase-js';

vi.mock('../../../lib/supabase/server', () => ({ createServerSupabaseClient: vi.fn() }));
vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn() }));

/**
 * Cliente falso no formato do supabase-js (from/select/eq/order/range). SEM RLS de propósito: devolve tudo o que
 * os filtros pedirem, então só a filtragem explícita por user_id da rota separa A de B.
 */
type Linha = Record<string, unknown>;
interface OpcoesFalso {
  /** max-rows do projeto: o servidor nunca devolve mais que isso por requisição. */
  maxRows?: number;
  /** Roda depois de cada página servida (simula escrita concorrente entre páginas). */
  depoisDaPagina?: (tabela: string, pagina: number) => void;
}
function clienteFalso(tabelas: Record<string, Linha[]>, usuario: { id: string } | null, { maxRows = Infinity, depoisDaPagina }: OpcoesFalso = {}) {
  const chamadas: { tabela: string; filtros: [string, unknown][]; select: string }[] = [];
  const paginas: Record<string, number> = {};
  const from = vi.fn((tabela: string) => {
    const reg = { tabela, filtros: [] as [string, unknown][], select: '' };
    chamadas.push(reg);
    let ini = 0, fim = Infinity, depoisDe: string | null = null, ordem: string | null = null;
    const q = {
      select(cols: string) { reg.select = cols; return q; },
      eq(col: string, v: unknown) { reg.filtros.push([col, v]); return q; },
      gt(col: string, v: string) { if (col === 'id') depoisDe = v; return q; },
      order(col: string) { ordem = col; return q; },
      range(a: number, b: number) { ini = a; fim = b; return q; },
      limit(n: number) { ini = 0; fim = n - 1; return q; },
      then(ok: (r: { data: Linha[]; error: null }) => unknown) {
        let rows = (tabelas[tabela] ?? []).filter((r) => reg.filtros.every(([c, v]) => r[c] === v));
        if (ordem === 'id') rows = [...rows].sort((a, b) => String(a.id).localeCompare(String(b.id)));
        if (depoisDe !== null) rows = rows.filter((r) => String(r.id) > depoisDe!);
        const pagina = rows.slice(ini, Math.min(fim + 1, ini + maxRows));
        paginas[tabela] = (paginas[tabela] ?? 0) + 1;
        depoisDaPagina?.(tabela, paginas[tabela]!);
        return Promise.resolve({ data: pagina, error: null }).then(ok);
      },
    };
    return q;
  });
  return {
    client: { auth: { getUser: vi.fn(async () => ({ data: { user: usuario }, error: null })) }, from },
    chamadas,
  };
}

const A = 'user-a', B = 'user-b';
const tabelas: Record<string, Linha[]> = {
  carteiras: [
    { id: 'ca', user_id: A, nome: 'Nubank da Ana', tipo: 'banco', saldo_inicial: 100, saldo_inicial_em: '2026-10-01T12:00:00Z', incluir_no_total: true, arquivada: false },
    { id: 'cb', user_id: B, nome: 'Banco do Bruno', tipo: 'banco', saldo_inicial: 999, saldo_inicial_em: '2026-10-01T12:00:00Z', incluir_no_total: true, arquivada: false },
  ],
  transacoes: [
    { id: 'ta', user_id: A, data: '2026-10-17', tipo: 'despesa', descricao: 'Feira da Ana', categoria: 'Mercado', valor: 50, banco: null, carteira_id: 'ca', chave_ajuste: 'k-a' },
    { id: 'tb', user_id: B, data: '2026-10-17', tipo: 'despesa', descricao: 'Segredo do Bruno', categoria: 'Lazer', valor: 70, banco: null, carteira_id: 'cb', chave_ajuste: 'k-b' },
  ],
  metas: [{ id: 'mb', user_id: B, nome: 'Meta do Bruno', icone: null, valor_alvo: 10, valor_guardado: 0, data_limite: null }],
  push_subscriptions: [{ id: 'p', user_id: A, endpoint: 'https://push.example/a', p256dh: 'k', auth: 'x' }],
};

beforeEach(() => vi.resetAllMocks());

describe('GET /api/financas/exportar', () => {
  it('401 sem sessão, sem consultar tabela nenhuma', async () => {
    const { client, chamadas } = clienteFalso(tabelas, null);
    vi.mocked(createServerSupabaseClient).mockReturnValue(client as never);
    const res = await GET();
    expect(res.status).toBe(401);
    expect(chamadas).toHaveLength(0);
  });

  it('só linhas do usuário logado, filtrando user_id explicitamente em toda tabela', async () => {
    const { client, chamadas } = clienteFalso(tabelas, { id: A });
    vi.mocked(createServerSupabaseClient).mockReturnValue(client as never);
    const res = await GET();
    expect(res.status).toBe(200);
    const csv = await res.text();
    expect(csv).toContain('Feira da Ana');
    expect(csv).toContain('Nubank da Ana');
    expect(csv).not.toContain('Segredo do Bruno');
    expect(csv).not.toContain('Banco do Bruno');
    expect(csv).not.toContain('Meta do Bruno');
    expect(csv).not.toContain(A);
    expect(csv).not.toContain('k-a');
    const consultadas = new Set(chamadas.map((c) => c.tabela));
    expect([...consultadas].sort()).toEqual(
      ['carteiras', 'contas_pagar', 'metas', 'orcamento_categorias', 'pagamentos_conta', 'rendas', 'recebimentos_renda', 'transacoes', 'transferencias'].sort(),
    );
    for (const c of chamadas) {
      expect(c.filtros, c.tabela).toContainEqual(['user_id', A]);
      expect(c.select, c.tabela).not.toMatch(/\*|chave_ajuste|endpoint/);
    }
    // Nunca service_role: só o cliente com a sessão (cookies).
    expect(createClient).not.toHaveBeenCalled();
  });

  it('cabeçalhos: CSV UTF-8, anexo meudia-dados-AAAA-MM-DD.csv (dia em SP) e no-store', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-20T01:00:00Z')); // 19/10 22:00 em SP
    try {
      const { client } = clienteFalso(tabelas, { id: A });
      vi.mocked(createServerSupabaseClient).mockReturnValue(client as never);
      const res = await GET();
      expect(res.headers.get('content-type')).toBe('text/csv; charset=utf-8');
      expect(res.headers.get('content-disposition')).toBe('attachment; filename="meudia-dados-2026-10-19.csv"');
      expect(res.headers.get('cache-control')).toBe('no-store');
      const bytes = new Uint8Array(await res.arrayBuffer());
      expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('pagina além de 1.000 linhas (max-rows do PostgREST) sem perder nada', async () => {
    const muitas = Array.from({ length: 2345 }, (_, i) => ({
      id: `t${i}`, user_id: A, data: '2026-10-01', tipo: 'despesa', descricao: `Gasto ${i}`, categoria: 'Outros', valor: 1, banco: null, carteira_id: null,
    }));
    const { client } = clienteFalso({ transacoes: muitas }, { id: A });
    vi.mocked(createServerSupabaseClient).mockReturnValue(client as never);
    const csv = await (await GET()).text();
    expect(csv.split('\r\n').filter((l) => l.startsWith('transacoes;'))).toHaveLength(2345);
  });

  // ids com zero à esquerda: a ordem por texto é a mesma do uuid no Postgres.
  const gastos = (n: number) => Array.from({ length: n }, (_, i) => ({
    id: `t${String(i).padStart(5, '0')}`, user_id: A, data: '2026-10-01', tipo: 'despesa', descricao: `Gasto ${i}`, categoria: 'Outros', valor: 1, banco: null, carteira_id: null,
  }));
  const linhasDeGasto = (csv: string) => csv.split('\r\n').filter((l) => l.startsWith('transacoes;'));

  it('Revisão Codex 1: max-rows do projeto menor (500) não trunca: 2.345 de 2.345', async () => {
    const { client } = clienteFalso({ transacoes: gastos(2345) }, { id: A }, { maxRows: 500 });
    vi.mocked(createServerSupabaseClient).mockReturnValue(client as never);
    expect(linhasDeGasto(await (await GET()).text())).toHaveLength(2345);
  });

  it('Revisão Codex 2: exclusão entre páginas não faz pular nenhuma linha que ainda existe', async () => {
    const tabela = { transacoes: gastos(2345) };
    // Depois da 1ª página, some uma linha já lida: com offset, a 1ª linha da página seguinte seria pulada.
    // Sem max-rows (páginas cheias): isola o problema do offset do da 1ª revisão.
    const { client, chamadas } = clienteFalso(tabela, { id: A }, {
      depoisDaPagina: (t, n) => { if (t === 'transacoes' && n === 1) tabela.transacoes.splice(0, 1); },
    });
    vi.mocked(createServerSupabaseClient).mockReturnValue(client as never);
    const csv = await (await GET()).text();
    for (const r of tabela.transacoes) expect(csv, `pulou ${r.descricao}`).toContain(`;${r.descricao};`);
    expect(linhasDeGasto(csv).length).toBeGreaterThanOrEqual(2344);
    // Sem duplicar: cada gasto uma vez só.
    expect(new Set(linhasDeGasto(csv)).size).toBe(linhasDeGasto(csv).length);
    expect(chamadas.filter((c) => c.tabela === 'transacoes').every((c) => c.filtros.some(([col, v]) => col === 'user_id' && v === A))).toBe(true);
  });

  it('erro do banco vira 500 genérico, sem CSV parcial', async () => {
    const { client } = clienteFalso(tabelas, { id: A });
    client.from.mockImplementation(() => {
      const q = { select: () => q, eq: () => q, gt: () => q, order: () => q, range: () => q, limit: () => q, then: (ok: (r: unknown) => unknown) => Promise.resolve({ data: null, error: { message: 'boom', code: 'XX000' } }).then(ok) };
      return q as never;
    });
    vi.mocked(createServerSupabaseClient).mockReturnValue(client as never);
    const res = await GET();
    expect(res.status).toBe(500);
    expect(await res.text()).not.toContain('boom');
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { findEntre } from '../transacoes-faixa.repository';

const { getSupabase } = vi.hoisted(() => ({ getSupabase: vi.fn() }));
vi.mock('../supabase', () => ({ getSupabase }));

type Linha = { id: string; data: string; user_id: string };

/** Tabela falsa que respeita eq/gte/lte, o cursor (data,id) do `paginasPorChave` e um max-rows do projeto. */
function tabela(linhas: Linha[], maxRows: number) {
  const chamadas: { filtros: [string, string, unknown][]; cursor?: string }[] = [];
  const client = {
    from: vi.fn(() => {
      const atual: { filtros: [string, string, unknown][]; cursor?: string } = { filtros: [] };
      chamadas.push(atual);
      const q = {
        select: () => q,
        eq: (c: string, v: unknown) => (atual.filtros.push(['eq', c, v]), q),
        gte: (c: string, v: unknown) => (atual.filtros.push(['gte', c, v]), q),
        lte: (c: string, v: unknown) => (atual.filtros.push(['lte', c, v]), q),
        or: (f: string) => ((atual.cursor = f), q),
        order: () => q,
        limit: (n: number) => {
          let rows = linhas.filter((l) => atual.filtros.every(([op, c, v]) => {
            const x = l[c as keyof Linha];
            return op === 'eq' ? x === v : op === 'gte' ? x >= (v as string) : x <= (v as string);
          }));
          if (atual.cursor) {
            const m = /^data\.gt\.([^,]+),and\(data\.eq\.([^,]+),id\.gt\.([^)]+)\)$/.exec(atual.cursor);
            if (!m) throw new Error(`cursor inesperado: ${atual.cursor}`);
            rows = rows.filter((l) => l.data > m[1]! || (l.data === m[2] && l.id > m[3]!));
          }
          rows.sort((a, b) => a.data.localeCompare(b.data) || a.id.localeCompare(b.id));
          return Promise.resolve({ data: rows.slice(0, Math.min(n, maxRows)), error: null });
        },
      };
      return q;
    }),
  };
  return { client, chamadas };
}

beforeEach(() => vi.clearAllMocks());

describe('transacoes-faixa.repository findEntre', () => {
  // 6 meses × 230 = 1.380 linhas do dono (passa do max-rows padrão de 1.000) + linhas fora da faixa e de outro dono.
  const linhas: Linha[] = [];
  for (let m = 6; m <= 11; m++) {
    for (let i = 0; i < 230; i++) {
      linhas.push({ id: `a${m}-${String(i).padStart(3, '0')}`, data: `2026-${String(m).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`, user_id: 'dono' });
    }
  }
  linhas.push({ id: 'fora-antes', data: '2026-05-31', user_id: 'dono' });
  linhas.push({ id: 'fora-depois', data: '2026-12-01', user_id: 'dono' });
  linhas.push({ id: 'outro', data: '2026-08-10', user_id: 'outra' });

  it.each([1000, 120])('max-rows %i não trunca: volta tudo da faixa, só do dono, em ordem (data,id)', async (maxRows) => {
    const { client, chamadas } = tabela(linhas, maxRows);
    getSupabase.mockReturnValue(client);
    const rows = await findEntre('dono', '2026-06-01', '2026-11-30');
    expect(rows).toHaveLength(6 * 230);
    expect(new Set(rows.map((r) => r.id)).size).toBe(rows.length);
    expect(rows.some((r) => r.id.startsWith('fora') || r.id === 'outro')).toBe(false);
    const ordenadas = [...rows].sort((a, b) => a.data.localeCompare(b.data) || a.id.localeCompare(b.id));
    expect(rows.map((r) => r.id)).toEqual(ordenadas.map((r) => r.id));
    expect(chamadas.length).toBeGreaterThan(2);
    for (const c of chamadas) {
      expect(c.filtros).toContainEqual(['eq', 'user_id', 'dono']);
      expect(c.filtros).toContainEqual(['gte', 'data', '2026-06-01']);
      expect(c.filtros).toContainEqual(['lte', 'data', '2026-11-30']);
    }
  });
});

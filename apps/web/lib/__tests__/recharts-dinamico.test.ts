import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Recharts (~100 kB gz) nunca entra no JS inicial de uma rota: todo arquivo que importa 'recharts' só pode ser
 * carregado por `import()` (next/dynamic com ssr:false e Skeleton), nunca por import estático nem por barrel.
 * Evidência no build: /(dashboard)/financas/page sem recharts nos chunks do app-build-manifest.
 */
const raiz = path.resolve(__dirname, '../..');
const PASTAS = ['app', 'components', 'hooks', 'lib'];

function fontes(dir: string): string[] {
  return readdirSync(dir).flatMap((nome) => {
    const p = path.join(dir, nome);
    if (statSync(p).isDirectory()) return nome === 'node_modules' || nome === '__tests__' ? [] : fontes(p);
    return /\.(ts|tsx)$/.test(nome) && !/\.test\.tsx?$/.test(nome) ? [p] : [];
  });
}

const todos = PASTAS.flatMap((d) => fontes(path.join(raiz, d)));
const usamRecharts = todos.filter((f) => /from ['"]recharts['"]/.test(readFileSync(f, 'utf8')));

function resolve(de: string, spec: string): string | null {
  if (!spec.startsWith('.')) return null;
  const base = path.resolve(path.dirname(de), spec);
  for (const c of [base, `${base}.tsx`, `${base}.ts`, path.join(base, 'index.ts'), path.join(base, 'index.tsx')]) {
    try { if (statSync(c).isFile()) return c; } catch { /* segue */ }
  }
  return null;
}

describe('recharts só por next/dynamic', () => {
  it('acha os gráficos (a varredura não está vazia)', () => {
    expect(usamRecharts.length).toBeGreaterThanOrEqual(5);
  });

  it('nenhum arquivo importa estaticamente (import/export from) um arquivo que usa recharts', () => {
    const alvos = new Set(usamRecharts);
    const estaticos: string[] = [];
    for (const f of todos) {
      const src = readFileSync(f, 'utf8');
      for (const m of src.matchAll(/^\s*(?:import|export)\s[^;]*?from\s+['"]([^'"]+)['"]/gm)) {
        if (/^\s*import\s+type\s/.test(m[0])) continue;
        const alvo = resolve(f, m[1]!);
        if (alvo && alvos.has(alvo)) estaticos.push(`${path.relative(raiz, f)} → ${m[1]}`);
      }
    }
    expect(estaticos).toEqual([]);
  });
});

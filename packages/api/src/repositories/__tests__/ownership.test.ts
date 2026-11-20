import { beforeEach, expect, it, vi } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import ts from 'typescript';
import * as veiculo from '../veiculo.repository';
import * as medicamento from '../medicamento.repository';
import * as dieta from '../dieta.repository';
import * as compras from '../compras.repository';
import * as notificacao from '../notificacao-agente.repository';
import * as sessao from '../sessao.repository';
import * as push from '../push-subscriptions.repository';

const { getSupabase } = vi.hoisted(() => ({ getSupabase: vi.fn() }));
vi.mock('../supabase', () => ({ getSupabase }));
const filters: [string, unknown][] = [];
let action = '', affected = 0;
const row = { id: 'alvo', user_id: 'outro', inicio: '2026-11-01T10:00:00Z' };
const query = {
  select: vi.fn().mockReturnThis(),
  eq: vi.fn((key: string, value: unknown) => { filters.push([key, value]); return query; }),
  update: vi.fn(() => { action = 'update'; return query; }),
  delete: vi.fn(() => { action = 'delete'; return query; }),
  single: vi.fn().mockReturnThis(),
  then(resolve: (value: unknown) => unknown) {
    const matches = filters.every(([key, value]) => row[key as keyof typeof row] === value);
    if (matches && action) affected++;
    return Promise.resolve({ data: matches ? row : null, error: matches || action === 'delete' || (action === 'update' && !query.single.mock.calls.length) ? null : { message: 'não encontrado' } }).then(resolve);
  },
};
const client = { from: vi.fn(() => query) };
beforeEach(() => { vi.clearAllMocks(); filters.length = 0; action = ''; affected = 0; getSupabase.mockReturnValue(client); });
const cases: [string, () => Promise<unknown>][] = [
  ['veículo findById', () => veiculo.findById('alvo', 'dono')],
  ['veículo update', () => veiculo.update('alvo', { modelo: 'x' }, 'dono')],
  ['veículo remove', () => veiculo.remove('alvo', 'dono')],
  ['medicamento findById', () => medicamento.findById('alvo', 'dono')],
  ['medicamento update', () => medicamento.update('alvo', { nome: 'x' }, 'dono')],
  ['medicamento remove', () => medicamento.remove('alvo', 'dono')],
  ['refeição update', () => dieta.updateRefeicao('alvo', {}, 'dono')],
  ['refeição remove', () => dieta.removeRefeicao('alvo', 'dono')],
  ['lista findById', () => compras.findListaById('alvo', 'dono')],
  ['lista update', () => compras.updateLista('alvo', { nome: 'x' }, 'dono')],
  ['lista remove', () => compras.removeLista('alvo', 'dono')],
  ['notificação lida', () => notificacao.marcarLida('alvo', 'dono')],
  ['notificação dispensar', () => notificacao.dispensar('alvo', 'dono')],
  ['sessão findById', () => sessao.findById('alvo', 'dono')],
  ['sessão update', () => sessao.update('alvo', { concluido: true }, 'dono')],
  ['push cron remove', () => push.removerInscricaoParaCron(client as never, 'alvo', 'dono')],
];
it.each(cases)('%s não lê/altera dado de outro dono mesmo sem RLS', async (_name, run) => {
  await run().catch(() => undefined);
  expect(filters).toContainEqual(['id', 'alvo']);
  expect(filters).toContainEqual(['user_id', 'dono']);
  expect(affected).toBe(0);
});

it('toda consulta por id com user_id filtra o dono; filhas não inventam coluna', () => {
  const dir = 'packages/api/src/repositories';
  const children = new Set(['exercicios', 'series_realizadas', 'itens_compras', 'manutencoes']);
  let checked = 0;
  for (const name of readdirSync(dir).filter((name) => name.endsWith('.repository.ts'))) {
    const source = ts.createSourceFile(name, readFileSync(`${dir}/${name}`, 'utf8'), ts.ScriptTarget.Latest, true);
    const constants = new Map<string, string>();
    function scanConstants(node: ts.Node) {
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer && ts.isStringLiteral(node.initializer)) constants.set(node.name.text, node.initializer.text);
      ts.forEachChild(node, scanConstants);
    }
    scanConstants(source);
    function visit(node: ts.Node) {
      if (ts.isCallExpression(node)) {
        const calls: { method: string; args: readonly ts.Expression[] }[] = [];
        let current: ts.Expression = node;
        while (ts.isCallExpression(current) && ts.isPropertyAccessExpression(current.expression)) {
          calls.push({ method: current.expression.name.text, args: current.arguments });
          current = current.expression.expression;
        }
        const from = calls.find((c) => c.method === 'from');
        if (from) {
          const arg = from.args[0];
          const table = arg && (ts.isStringLiteral(arg) ? arg.text : ts.isIdentifier(arg) ? constants.get(arg.text) : undefined);
          const hasUser = calls.some((c) => c.method === 'eq' && c.args[0] && ts.isStringLiteral(c.args[0]) && c.args[0].text === 'user_id');
          const byId = calls.some((c) => ['eq', 'in'].includes(c.method) && c.args[0] && ts.isStringLiteral(c.args[0]) && c.args[0].text === 'id');
          if (table && children.has(table)) expect(hasUser, `${name}: filtro inválido em ${table}`).toBe(false);
          else if (table && table !== 'profiles' && byId) {
            // Só checa a cadeia externa completa: .eq(id) pode vir antes do .eq(user_id).
            const parent = node.parent;
            if (!(ts.isPropertyAccessExpression(parent) && parent.expression === node)) {
              checked++;
              expect(hasUser, `${name}:${source.getLineAndCharacterOfPosition(node.pos).line + 1} ${table}`).toBe(true);
            }
          }
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
  expect(checked).toBeGreaterThan(35);
});

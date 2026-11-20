import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { DELETE } from '../delete-account/route';

const { getUser, deleteUser, from, createClient } = vi.hoisted(() => ({
  getUser: vi.fn(), deleteUser: vi.fn(), from: vi.fn(), createClient: vi.fn(),
}));
vi.mock('../../../lib/supabase/server', () => ({ createServerSupabaseClient: () => ({ auth: { getUser } }) }));
vi.mock('@supabase/supabase-js', () => ({ createClient }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.invalid');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'chave-sintetica');
  getUser.mockResolvedValue({ data: { user: { id: 'dono' } }, error: null });
  deleteUser.mockResolvedValue({ error: null });
  // Proíbe pré-limpeza: pedidos separados não compartilham a transação do Auth.
  from.mockImplementation(() => { throw new Error('DELETE HTTP parcial proibido'); });
  createClient.mockReturnValue({ from, auth: { admin: { deleteUser } } });
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

it('sucesso: exclui somente o usuário autenticado, em uma cascata atômica', async () => {
  const response = await DELETE();
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ success: true });
  expect(deleteUser).toHaveBeenCalledTimes(1);
  expect(deleteUser).toHaveBeenCalledWith('dono');
  expect(from).not.toHaveBeenCalled();
});
it.each([null, { id: 'dono' }])('sem autenticação válida retorna 401', async (user) => {
  getUser.mockResolvedValue({ data: { user }, error: user ? new Error('token inválido') : null });
  expect((await DELETE()).status).toBe(401);
  expect(createClient).not.toHaveBeenCalled();
  expect(deleteUser).not.toHaveBeenCalled();
});
it('sem configuração retorna 500 antes de qualquer exclusão', async () => {
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '');
  expect((await DELETE()).status).toBe(500);
  expect(deleteUser).not.toHaveBeenCalled();
});
it.each(['error', 'throw'])('falha no DELETE atômico (%s): erro claro sem vazar dados nem repetir', async (mode) => {
  const erro = new Error('PII pessoa@example.com token-secreto');
  if (mode === 'error') deleteUser.mockResolvedValue({ error: erro });
  else deleteUser.mockRejectedValue(erro);
  const response = await DELETE();
  expect(response.status).toBe(500);
  expect(await response.text()).not.toContain('PII');
  expect(deleteUser).toHaveBeenCalledTimes(1);
  expect(from).not.toHaveBeenCalled();
  expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toMatch(/PII|pessoa@|token-secreto/);
});
it('falha ao autenticar não chama deleteUser', async () => {
  getUser.mockRejectedValue(new Error('rede'));
  expect((await DELETE()).status).toBe(500);
  expect(deleteUser).not.toHaveBeenCalled();
});
it('inventário inclui cada tabela criada nas todas as migrations, inclusive private', () => {
  const dir = 'packages/database/migrations';
  const inventory = readFileSync('apps/web/app/api/delete-account/INVENTARIO.md', 'utf8');
  const names = new Set<string>();
  for (const file of readdirSync(dir).filter((name) => /\.sql$/.test(name) && !name.includes('_down'))) {
    const sql = readFileSync(`${dir}/${file}`, 'utf8').replace(/--[^\n]*|\/\*[\s\S]*?\*\//g, '');
    for (const match of sql.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:(public|private)\.)?(\w+)/gi)) {
      names.add(`${match[1] === 'private' ? 'private.' : ''}${match[2]}`);
    }
  }
  expect(names.size).toBeGreaterThan(0);
  for (const name of names) expect(inventory).toContain(`| ${name} |`);
});
it('SQL permite cascata e adia a checagem de órfãos até o commit', () => {
  const sql = readFileSync('packages/database/migrations/006_carteiras.sql', 'utf8');
  expect(sql).toContain('DEFERRABLE INITIALLY DEFERRED FOR EACH ROW');
  expect(sql).toMatch(/FUNCTION public.proteger_vinculo\(\)[\s\S]*?IF pg_catalog.pg_trigger_depth\(\) > 1 THEN/);
  expect(sql).toContain('WHERE id = $1 AND transacao_id IS NULL');
});

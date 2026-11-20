import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
const read = (p: string) => readFileSync(resolve(__dirname, '../../../../..', p), 'utf8');
it('revisão 2: roteiro exige schema antes do código e rollback inverso', () => {
  const doc = read('docs/deploy-vps.md').split('## Wave 3A (017)')[1];
  expect(doc).toBeDefined();
  expect(doc).toMatch(/017 antes do código/);
  expect(doc).toMatch(/psql -1/);
  expect(doc).toContain("NOTIFY pgrst, 'reload schema'");
  expect(doc).toMatch(/reverter o código primeiro/);
  expect(doc).toContain('017_parcelamento_down.sql');
});
it('revisão 5: timeout local e CHECK criado sem scan antes de validar', () => {
  const sql = read('packages/database/migrations/017_parcelamento.sql');
  expect(sql).toContain("SET LOCAL lock_timeout = '5s'");
  expect(sql).toMatch(/\) NOT VALID;/);
  expect(sql.indexOf('VALIDATE CONSTRAINT')).toBeGreaterThan(sql.indexOf('NOT VALID'));
  expect(sql).not.toMatch(/^BEGIN;|^COMMIT;/m);
});
it('revisão 11: consultas compartilham a única lista de colunas', () => {
  const repo = read('packages/api/src/repositories/transacao.repository.ts');
  const faixa = read('packages/api/src/repositories/transacoes-faixa.repository.ts');
  expect(repo).toMatch(/export const COLUMNS =/);
  expect(faixa).toContain("import { COLUMNS } from './transacao.repository'");
  expect(faixa).not.toMatch(/const COLUMNS\s*=/);
});

it.each(['017_parcelamento.sql', '017_parcelamento_down.sql'])('NIT 1: %s verifica timeout local antes do DDL', file => {
  const sql = read('packages/database/migrations/' + file);
  expect(sql).toMatch(/SET LOCAL lock_timeout = '5s';\s*DO/);
  expect(sql).toContain("pg_catalog.current_setting('lock_timeout') <> '5s'");
  expect(sql).toContain("RAISE EXCEPTION '017: execute em transação única'");
  expect(sql).not.toMatch(/^SET lock_timeout/m);
});

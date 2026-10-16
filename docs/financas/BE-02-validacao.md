# BE-02 — Resultado da validação

Entrega somente em arquivos; nenhuma conexão em banco, aplicação de migration,
deploy, leitura/alteração de `.env*` ou commit/push foi realizada.
`000_baseline.sql` e `schema.sql` foram preservados.

- Migration: `packages/database/migrations/005_contas_pagar.sql`.
- Rollback: `packages/database/migrations/005_contas_pagar_down.sql`.
- Tipos e exports: `packages/shared/src/types/{financas,agente,index}.ts`.
- SQL de teste preparado: `packages/database/tests/005_contas_pagar.sql`.

## Verificações executadas

- `git diff --check`: passou.
- Comparação estática em Python: corpo de `contas_pagar` idêntico ao da seção 4
  da SPEC após normalizar espaços; passou.
- Inspeção estática: RPCs `SECURITY INVOKER`, `search_path`, `FOR UPDATE`, filtro
  por `auth.uid()`, policy com `USING`/`WITH CHECK`, índice único parcial e
  guards de policy/trigger presentes; passou.
- `pnpm -r --parallel --if-present run type-check`: não iniciou. Corepack
  falhou com `EROFS` ao preparar pnpm em `/usr/local/share/corepack`.
  Não existe `node_modules/.bin/tsc` nem `tsc` global disponível.
  O comando evita Turbo, que referencia arquivos `.env` em globalDependencies.

## Verificações pendentes (banco proibido nesta execução)

O roteiro SQL não foi executado. Foi escrito para Supabase local descartável,
via psql como postgres, e contém transação com rollback de DDL, grants e fixtures:

- baseline e migration 005 executada duas vezes;
- dois usuários autenticados, leitura e ambas as RPCs contra conta alheia;
- bloqueio de troca de proprietário por RLS;
- CHECK de status/pago_em e rejeição de pagamento sem data;
- atualização automática de updated_at;
- criação da despesa com campos esperados e rejeição de pagamento duplicado;
- desfazer sem transação órfã e desfazer após exclusão prévia da transação;
- rejeição de pagamento de conta cancelada;
- rollback da migration duas vezes e recriação.

Idempotência em execução, atomicidade, concorrência e RLS efetivo ainda precisam
ser confirmados em banco local quando seu uso for autorizado. O typecheck do
monorepo também permanece pendente de um ambiente com dependências instaladas.

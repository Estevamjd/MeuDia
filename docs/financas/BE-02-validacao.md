# BE-02 — Validação por competência

Entrega somente em arquivos, conforme SPEC v3 e prompts/BE-02.md.
Nenhum banco/psql, git, `.env` ou segredo foi acessado. Baseline e schema preservados.

- Migration: `packages/database/migrations/005_financas.sql`.
- Down: `packages/database/migrations/005_financas_down.sql`.
- Roteiro do executor: `packages/database/tests/005_financas.sql`.
- Tipos e constantes exportados por `packages/shared/src/types/{financas,index}.ts`.

`contas_pagar` define a recorrência; `pagamentos_conta` guarda pagamentos por
`competencia TEXT YYYY-MM`. FKs compostas isolam proprietários, e SET NULL
preserva `user_id`. Assinaturas recebem somente a UNIQUE composta, sem novas
colunas. RPCs mantêm SECURITY INVOKER, search_path vazio e EXECUTE revogado de
PUBLIC/anon: P0002 para conta inexistente/invisível, 22023 para competência ou
estado inválido. Desfazer sem pagamento usa 22023; UNIQUE direto usa 23505.

## Verificações realizadas

- Inspeção estática das tabelas, FKs, CHECKs, policies, triggers, RPCs e down.
- Verificação por Python de espaços finais, delimitadores SQL e arquivos `\ir`: passou.
- Comparação estática das seis definições de tabela com a SPEC: passou.
- Typecheck tentado com `COREPACK_HOME=/tmp/meudia-be02-corepack COREPACK_ENABLE_NETWORK=0 pnpm -r --parallel --if-present run type-check`.
  Não iniciou: Corepack precisava obter pnpm do registro npm; rede desabilitada.
  Não havia tsc local/global disponível. Turbo não foi executado.

## Roteiro SQL preparado; execução pendente pelo executor

O roteiro usa transação com ROLLBACK e inclui:

- 005 duas vezes; down duas vezes e novo up duas vezes;
- privilégios das RPCs, SECURITY INVOKER e search_path vazio;
- isolamento RLS de contas/pagamentos A/B e bloqueio de troca de proprietário;
- FKs cruzadas para assinatura, conta, transação e lembrete;
- outubro pago sem afetar novembro; dois pagamentos em competências distintas;
- duplicidade por RPC (22023) e INSERT direto (23505), sem transação extra;
- desfazer só outubro preservando pagamento/transação de novembro;
- desfazer sem pagamento e após remoção prévia da transação;
- formatos inválidos/nulos, mensal anterior à criação, anual no mês errado,
  única fora de sua competência, conta inativa e CHECK de recorrência;
- campos da despesa, data padrão em São Paulo e trigger updated_at;
- lembretes únicos por competência, CHECK, SELECT do dono e escrita bloqueada;
- SET NULL preservando proprietário e down/up preservando dados do baseline.

SQL não executado: idempotência, RLS, atomicidade e demais resultados em banco
ficam para o executor. Concorrência foi tratada com locks na conta e no pagamento,
mas não foi exercitada em sessões paralelas. Typecheck permanece pendente.

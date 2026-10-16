# TICKETS — MeuDia Finanças

Referência: [SPEC.md](./SPEC.md) · BRIEF: `missions/meudia-financas/BRIEF.md`. Backend → **Codex** (prompt em `prompts/BE-XX.md`). Frontend → **Claude Code**. Revisão → **QA bot** (autor não aprova o próprio PR).

Regras para todos os tickets: um PR por ticket/etapa, com Vercel Preview. Não aplicar migrations em banco remoto, não rodar `supabase db push`/`link`, não fazer redeploy, não ler nem alterar `.env*`, não imprimir segredos, não fazer commit/push direto na main. Cada ticket termina com typecheck, lint e testes passando localmente.

## Ordem / dependências

```
BE-00 ─┐
BE-01 ─┼─> BE-02 ─> BE-03 ─┬─> BE-04 ─┬─> BE-07 (push + cron)
       │                   │          └─> BE-05 (orçamento/selo) ─> BE-08 (chat)
       └───────────────────┴─> BE-06 (assinaturas)
FE-01 (flag, independente)
FE-02 (após BE-03) ─> FE-03 (após BE-05), FE-04 (após BE-04), FE-05 (após BE-05)
FE-06 (após BE-07) · FE-07 (após BE-08)
```

---

## Backend (Codex)

### BE-00 — Validar `000_baseline.sql` e levantar os gaps
Validar o baseline num Postgres/Supabase **local e descartável** e escrever `docs/financas/SCHEMA_GAPS.md`.
**Aceite**
- [ ] Roda 2x seguidas sem erro; a 2ª não cria objetos novos (`pg_tables`, `pg_indexes`, `pg_policies`, `pg_trigger`).
- [ ] Com `registros_agua(id, user_id, data, quantidade_ml, meta_ml, created_at, updated_at)` preexistente e só com policy de INSERT, o baseline não altera a tabela e passa a cobrir SELECT/UPDATE/DELETE (`users_own_data`); 2ª execução não cria policy nova.
- [ ] Trigger `trg_notas_updated_at` atualiza `notas.updated_at` em UPDATE e não é duplicado.
- [ ] `SCHEMA_GAPS.md` confirma nomes canônicos (GAP-02) e as colunas de `registros_agua` em schema.sql/001/baseline/código; lista divergências restantes.
- [ ] Nenhuma alteração em banco remoto.

### BE-01 — Utilitário de datas em `@meudia/shared`
`hojeSP`, `vencimentoNoMes`, `proximoVencimento`, `diasAte`, `competenciaDe` (`yyyy-MM`), `etapaLembrete` (SPEC 5.1).
**Aceite**
- [ ] Funções puras exportadas, com testes: dia 31 em fev (normal e bissexto), dia 30 em abr, vence hoje (=0), virada de mês e de ano, `etapaLembrete` para 3/2/1/0/-1 dias.
- [ ] `hojeSP()` com relógio fixo em 02:00 UTC devolve o dia anterior.
- [ ] Nenhum `new Date(ano, mes, dia)` com dia > último dia do mês.

### BE-02 — Migration `005_financas.sql` + tipos
`contas_pagar` (definição recorrente/única, sem status por mês), `pagamentos_conta` (um por competência `YYYY-MM`), `rendas`, `orcamento_categorias`, `push_subscriptions`, `lembretes_enviados` (por competência), RLS, triggers `updated_at`, RPCs `pagar_conta(p_conta_id, p_competencia, ...)` e `desfazer_pagamento(p_conta_id, p_competencia)` (SPEC 4 e 4.1).
**Aceite**
- [ ] Idempotente (`IF NOT EXISTS`, constraints/policies/triggers em DO block, `CREATE OR REPLACE FUNCTION`); roda 2x no banco local.
- [ ] **FK composta `(id, user_id)`**: `UNIQUE (id, user_id)` em `assinaturas`, `transacoes` e `contas_pagar`; `contas_pagar(assinatura_id, user_id)` e `pagamentos_conta(transacao_id, user_id)` com `ON DELETE SET NULL (coluna)`; `pagamentos_conta(conta_id, user_id)` e `lembretes_enviados(conta_id, user_id)` com `ON DELETE CASCADE`. Teste: referenciar assinatura/conta/transação de outro usuário falha.
- [ ] `UNIQUE (conta_id, competencia)` em `pagamentos_conta`; único `lembretes_enviados(conta_id, competencia, etapa, canal)`; parcial `contas_pagar(assinatura_id)`; CHECK regex `^[0-9]{4}-(0[1-9]|1[0-2])$` nas duas `competencia`; CHECK de coerência recorrência × campos de vencimento.
- [ ] RPCs `SECURITY INVOKER`, `SET search_path = public`, `FOR UPDATE`; `pagar_conta` em competência já paga ou inválida para a recorrência e `desfazer_pagamento` em competência sem pagamento → `RAISE EXCEPTION`; pagar + desfazer volta ao estado inicial sem transação órfã; pagar `2026-10` não marca `2026-11`.
- [ ] RLS: A não lê/paga conta de B nem lê `pagamentos_conta` de B; usuário só lê `lembretes_enviados`.
- [ ] `005_financas_down.sql` correspondente.
- [ ] Tipos e constantes de SPEC 8 em `@meudia/shared`. Não aplicada em banco remoto.

### BE-03 — Validators + repositories
`contas-pagar`, `pagamentos-conta`, `rendas`, `orcamento`, `push-subscriptions`, `lembretes-enviados`.
**Aceite**
- [ ] Validators exportados em `validators/index.ts`, com testes (valor ≤ 0, data inválida, competência `2026-13`/`2026-1` inválida, `anual` sem `mes_vencimento`, `unica` sem `data_vencimento`, endpoint não-https).
- [ ] Repositories exportados; **toda query filtra `user_id`** (exceto as de uso do cron, explicitamente nomeadas `*ParaCron` e recebendo o client admin); erros → `AppError(..., 'DB_ERROR')`.
- [ ] `pagamentosContaRepository.findByCompetencia(userId, competencia)` e `findByConta(userId, contaId)`; `reservarLembrete` usa insert com `ignoreDuplicates` e informa se reservou.
- [ ] `rpcPagar(contaId, competencia, ...)`/`rpcDesfazer(contaId, competencia)` chamam `supabase.rpc(...)`.

### BE-04 — Service de contas
`listarContasDoMes`, `obterContaDoMes`, `criarConta`, `atualizarConta`, `desativarConta`, `pagarConta`, `desfazerPagamento` (SPEC 5.2), com `ocorrenciaDaConta` pura em `@meudia/shared`.
**Aceite**
- [ ] Ocorrências derivadas (nada gravado por mês): anual só no `mes_vencimento`; única só na sua competência; nada antes do `created_at`; dia 31 em fev → último dia.
- [ ] `situacao` (`pendente/vencida/paga`) derivada de `pagamentos_conta` + `hojeSP()`, sem gravar; pagamento de uma competência não afeta outra.
- [ ] `desativarConta` → `ativo=false`, histórico preservado; conta inativa some das competências sem pagamento.
- [ ] Testes com repository mockado e `hoje` injetado.

### BE-05 — Rendas, orçamento, dashboard e selo
`orcamento.service.ts`: CRUD de rendas e orçamento por categoria, `resumoFinanceiroMes`, `calcularSelo` (SPEC 5.4 e 5.5).
**Aceite**
- [ ] Todas as métricas da tabela 5.4, incluindo `vsMesAnterior` (inclusive jan → dez do ano anterior).
- [ ] `SELO_LIMITES` exportado; testes nos limites exatos (0.70/0.90), sobra negativa, conta vencida, renda 0.
- [ ] Fixture de teste bate com valores calculados à mão (anexar a tabela no PR).

### BE-06 — Ajustes em assinaturas (SPEC 11)
**Aceite**
- [ ] `proximoVencimento` usa o util do BE-01 e inclui a que vence hoje.
- [ ] `assinatura.repository.ts › findById/update/remove` recebem `userId` e filtram; callers atualizados.
- [ ] Espelho em `contas_pagar` (`assinatura_id`, `recorrencia='mensal'`, `categoria='Assinaturas'`): criar/editar assinatura faz upsert da conta; ativar/desativar espelha `ativo`. Pagamentos já feitos não mudam.

### BE-07 — Web Push server + rota de cron
`lembretes.service.ts › enviarLembretesDoDia`, `POST/DELETE /api/push/subscribe`, `GET /api/cron/lembretes` (SPEC 5.3, 6, 7).
**Aceite**
- [ ] Rota de cron: 401 sem `Authorization: Bearer ${CRON_SECRET}`; usa `hojeSP()`; service role só no servidor.
- [ ] Reserva em `lembretes_enviados` **antes** de enviar; 2 execuções no mesmo dia → 0 envios na 2ª; conta paga na competência ou inativa → 0 envios; competência seguinte volta a lembrar; URL com `?competencia=`; D-2/D-1/D0 com os textos de `LEMBRETE_TEXTOS`.
- [ ] 404/410 remove a inscrição; logs sem endpoint, chaves ou dados pessoais.
- [ ] `web-push` com VAPID lido de env (sem fallback hardcoded); sender injetável nos testes.
- [ ] **Sem criar job real**: o PR descreve o trecho `crons` (`0 12 * * *`) para o `vercel.json` e a alternativa `pg_cron`; não habilitar.

### BE-08 — Chat de finanças por regras
Refocar `packages/ai/src/agent` (intenções/respostas) em finanças quando `APP_MODE=financas` (SPEC 5.6).
**Aceite**
- [ ] Intenções: sobra, o que vence (hoje/semana), gasto por categoria, selo, renda; fallback com sugestões.
- [ ] Respostas calculadas só com `resumoFinanceiroMes`/contas; nenhuma chamada externa ou LLM.
- [ ] Sem a flag, o chat atual segue igual (testes existentes passam). Testes por intenção.

---

## Frontend (Claude Code)

### FE-01 — `APP_MODE=financas`
`apps/web/lib/app-mode.ts` (fonte única), menu, middleware, onboarding e manifest (SPEC 5.7).
**Aceite**
- [ ] Flag ligada: só finanças no menu, rotas de outros módulos redirecionam para `/financas`, onboarding só com passos de finanças, `shortcuts` do manifest filtrados.
- [ ] Flag desligada: app idêntico ao atual. Nenhum módulo removido.
- [ ] Testes para os dois modos.

### FE-02 — Hooks React Query
`useContasMes(competencia)`, `useContaDoMes(id, competencia)`, `useCriarConta`, `useAtualizarConta`, `useDesativarConta`, `usePagarConta`, `useDesfazerPagamento` (ambos recebem `{ contaId, competencia }`), `useRendas`, `useOrcamento`, `useResumoFinanceiroMes`.
**Aceite**
- [ ] Exportados no barrel de `hooks`; sem `any`; tipos de `@meudia/shared`; query keys incluem a competência.
- [ ] Pagar/desfazer invalidam contas da competência, conta, resumo financeiro, transações do mês e assinaturas.

### FE-03 — Dashboard `/financas`
**Aceite**
- [ ] Selo, renda × gasto, sobra prevista × real, % comprometida, pagas no prazo, comparação com o mês anterior, seletor de mês.
- [ ] Seção "Contas do mês" com chips e atalho para o detalhe; Skeleton/EmptyState; estado "Cadastre sua renda" quando selo `null`.

### FE-04 — Contas: lista, cadastro e detalhe com "Paguei"
`/financas/contas`, `/financas/contas/[id]`, ajustes em `/assinaturas`.
**Aceite**
- [ ] Cadastro com nome, valor, recorrência (mensal/anual/única), vencimento conforme a recorrência (dia / dia+mês / data), categoria; validação igual ao validator; "Excluir" = desativar.
- [ ] Detalhe `/financas/contas/[id]?competencia=YYYY-MM` (default competência atual) com botão grande **"Paguei"** daquela competência (data default hoje, banco opcional), toast, "Desfazer", histórico de pagamentos; abre direto pelo link do push.
- [ ] `/assinaturas`: badge do mês (pagamento da conta espelhada na competência atual), `isVencendoEstaSemana` substituído por `diasAte(proximoVencimento(...)) <= 7`, ações acessíveis por teclado.

### FE-05 — Rendas e orçamento
`/financas/orcamento`.
**Aceite**
- [ ] CRUD de rendas (1+ fontes) e valor planejado por categoria; sobra prevista atualiza ao salvar.

### FE-06 — Push no cliente
`sw.js` (cache `meudia-v6`, handlers `push`/`notificationclick`), botão "Ativar lembretes", tela "Como instalar no iPhone" (SPEC 6).
**Aceite**
- [ ] Permissão pedida só no toque; inscrição enviada a `/api/push/subscribe`; estados ativado/negado/não suportado.
- [ ] `notificationclick` foca/abre `/financas/contas/<id>?competencia=<YYYY-MM>` (URL do payload, sem reconstruir).
- [ ] Tela de instalação aparece fora do modo `standalone`.
- [ ] Teste real no iPhone (iOS 16.4+, PWA instalado) registrado no PR (sem dados reais em prints).

### FE-07 — Chat de finanças (UI)
**Aceite**
- [ ] Sugestões de perguntas de finanças no modo finanças; textos sem menção a outros módulos.

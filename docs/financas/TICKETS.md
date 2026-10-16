# TICKETS — Lembretes de assinaturas e contas a pagar

Referência: [SPEC.md](./SPEC.md). Backend → **Codex** (prompt em `prompts/BE-XX.md`). Frontend → **Claude Code**.

Regras para todos os tickets: não aplicar migrations em banco remoto, não rodar `supabase db push`, não fazer redeploy, não ler nem alterar `.env*`, não fazer commit/push. Cada ticket termina com typecheck e testes passando localmente.

## Ordem / dependências

```
BE-00 ─┐
BE-01 ─┼─> BE-02 ─> BE-03 ─> BE-04 ─> BE-05
       └─> BE-06                 │
FE-01 (após BE-03/BE-04) ─> FE-02, FE-03 ─> FE-04 (após BE-05)
```

---

## Backend (Codex)

### BE-00 — Validar `000_baseline.sql` e levantar os gaps no banco
Validar o baseline num Postgres/Supabase **local e descartável** e escrever `docs/financas/SCHEMA_GAPS.md` com o estado real de cada gap.
**Aceite**
- [ ] `000_baseline.sql` roda 2x seguidas no banco local sem erro (a 2ª execução não cria nada novo).
- [ ] Rodar com as tabelas alternativas do GAP-02 já existentes (ex.: `registros_agua`) emite NOTICE e não cria `registro_agua`.
- [ ] `SCHEMA_GAPS.md` lista, para cada um dos 6 pares do GAP-02, qual nome o código usa e uma recomendação, sem renomear nada.
- [ ] Nenhuma alteração em banco remoto.

### BE-01 — Utilitário de datas de vencimento em `@meudia/shared`
`vencimentoNoMes`, `proximoVencimento`, `diasAte`, `hojeSP` (SPEC 5.1).
**Aceite**
- [ ] Funções puras exportadas por `@meudia/shared`, com testes para: dia 31 em fev (ano normal e bissexto), dia 30 em abr, vence hoje (=0), virada de mês (hoje 28 → dia 2 = 4 ou 5 dias, conforme o mês), virada de ano (dez→jan).
- [ ] `hojeSP()` respeita `America/Sao_Paulo` (teste com relógio fixo em 02:00 UTC = dia anterior em SP).
- [ ] Nenhum uso de `new Date(ano, mes, dia)` com dia > último dia do mês.

### BE-02 — Migration `005_contas_pagar.sql` + tipos
Tabela `contas_pagar`, colunas novas em `assinaturas` e `preferencias_agente`, índices, RLS `users_own_data`, RPCs `pagar_conta` e `desfazer_pagamento` (SPEC 4 e 5.3).
**Aceite**
- [ ] Idempotente: `IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, policies em DO block, `CREATE OR REPLACE FUNCTION`.
- [ ] RPCs `SECURITY INVOKER`, com `SET search_path = public`, `FOR UPDATE` na conta; `pagar_conta` em conta não pendente → `RAISE EXCEPTION`.
- [ ] Arquivo `005_contas_pagar_down.sql` correspondente.
- [ ] Tipos `ContaPagar`, `ContaPagarInsert`, `StatusContaPagar` e os campos novos de `Assinatura`/`PreferenciasAgente` em `@meudia/shared`.
- [ ] Rodada 2x no banco local sem erro; não aplicada em banco remoto.

### BE-03 — Validator + repository de `contas_pagar`
**Aceite**
- [ ] `validators/contas-pagar.validator.ts` exportado em `validators/index.ts`, com testes em `validators/__tests__/contas-pagar.validator.test.ts` (valor ≤ 0, data inválida, lembrete fora de 0–30).
- [ ] `repositories/contas-pagar.repository.ts` exportado como `contasPagarRepository`; **toda query filtra `user_id`**; erros viram `AppError(..., 'DB_ERROR')`, no mesmo padrão de `transacao.repository.ts`.
- [ ] `upsertFromAssinaturas` usa `onConflict: 'assinatura_id,vencimento'` + `ignoreDuplicates: true`.
- [ ] `rpcPagar` / `rpcDesfazer` chamam `supabase.rpc(...)`.

### BE-04 — Service de contas a pagar
`listarContasDoMes` (gera o mês antes de listar), `criarContaAvulsa`, `atualizarConta`, `cancelarConta`, `pagarConta`, `desfazerPagamento`, `resumoContasDoMes`.
**Aceite**
- [ ] `listarContasDoMes` chamado 2x seguidas não duplica contas.
- [ ] Status `vencida` derivado no retorno (`pendente` + `vencimento < hojeSP()`), sem gravar no banco.
- [ ] `cancelarConta` em conta paga → `AppError('...', 'VALIDATION_ERROR')`.
- [ ] `resumoContasDoMes` retorna `{ totalPendente, totalPago, totalVencido, qtdVencidas }`.
- [ ] Testes unitários com repository mockado.

### BE-05 — Lembretes em `notificacoes_agente`
`gerarContasDoMes` (mês atual + seguinte) e `verificarLembretes` (SPEC 5.4), ligados ao fluxo do agente.
**Aceite**
- [ ] Rodar 2x no mesmo dia → 0 notificações novas na 2ª vez.
- [ ] `notif_contas_pagar=false` → nenhuma notificação.
- [ ] Precedência de `diasAntes`: conta > preferência > 3.
- [ ] Vence hoje → `tipo='alerta'`; vencida → 1 alerta "Conta vencida"; paga/cancelada → nada.
- [ ] Chamada integrada ao ponto onde o agente já gera notificações (citar arquivo:linha no PR).
- [ ] Testes com `hoje` injetado.

### BE-06 — Ajustes em assinaturas (bugs da SPEC 7)
**Aceite**
- [ ] `proximoVencimento` usa o util do BE-01 e inclui a assinatura que vence hoje.
- [ ] `assinatura.repository.ts › findById/update/remove` recebem `userId` e filtram por ele; os callers do service são atualizados.
- [ ] `assinaturaInsertSchema` aceita `categoria` (default `'Assinaturas'`) e `lembrete_dias_antes` (0–30, nullable, opcional).
- [ ] Desativar assinatura → contas `pendente` futuras dela viram `cancelada`; mudar o valor → contas `pendente` futuras são atualizadas.
- [ ] Testes cobrindo os 4 itens.

---

## Frontend (Claude Code)

### FE-01 — Hooks React Query para contas a pagar
Em `apps/web/hooks`, seguindo o padrão de `useTransacoesMes`/`useCriarTransacao`: `useContasMes(ano, mes)`, `useResumoContasMes`, `useCriarConta`, `useAtualizarConta`, `useCancelarConta`, `usePagarConta`, `useDesfazerPagamento`.
**Aceite**
- [ ] Exportados no barrel de `hooks`.
- [ ] `usePagarConta`/`useDesfazerPagamento` invalidam contas do mês, resumo de contas, `useTransacoesMes`, `useResumoMensal` e assinaturas.
- [ ] Sem `any`; tipos vindos de `@meudia/shared`.

### FE-02 — `/assinaturas`: lembrete, status do mês e pagar
**Aceite**
- [ ] O modal ganha os campos *Categoria* e *Lembrar X dias antes* (vazio = padrão); editar preserva os valores.
- [ ] O badge do card mostra `Paga` / `Vence hoje` / `Vence em N dias` / `Vencida há N dias` com base na conta do mês corrente.
- [ ] Botão *Marcar como paga* (só se pendente) abre o modal de pagamento (data default hoje, banco opcional) e mostra toast de sucesso/erro.
- [ ] `isVencendoEstaSemana` removido e substituído por `diasAte(proximoVencimento(...)) <= 7` (corrige a virada do mês).
- [ ] Botões de ação acessíveis por teclado (hoje só aparecem com `group-hover`).

### FE-03 — `/financas`: seção "Contas do mês"
**Aceite**
- [ ] A seção respeita o seletor de mês e mostra 3 StatCards (*A pagar*, *Pago*, *Vencido*).
- [ ] A lista é ordenada por vencimento, com chips `pendente`/`vencida`/`paga`/`cancelada` e ações *Pagar*, *Desfazer*, *Editar*, *Cancelar* (com `ConfirmDialog`).
- [ ] Botão *Nova conta* (avulsa) com validação no cliente igual ao validator.
- [ ] Depois de pagar, a despesa aparece na lista de transações do mês sem recarregar a página.
- [ ] Estados de loading (Skeleton) e vazio (EmptyState) iguais aos do restante da página.
- [ ] O estado vazio de transações não esconde a seção de contas.

### FE-04 — Notificações e preferências de lembrete
**Aceite**
- [ ] `AgentBannerAuto` em `/financas` exibe notificações de `modulo='financas'`; a ação leva até a conta.
- [ ] Toggle "Lembrar contas a pagar" e input "Dias de antecedência" (0–30) na tela onde as preferências do agente já são editadas, persistidos em `preferencias_agente`.
- [ ] Desligar o toggle → nenhum lembrete novo (verificado contra o BE-05).

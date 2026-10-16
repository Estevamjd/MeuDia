# SPEC — Lembretes de assinaturas e contas a pagar

Status: rascunho · Data: 2026-10-15 · Rotas afetadas: `/financas`, `/assinaturas`

## 1. Problema

Hoje o MeuDia tem `assinaturas` (recorrentes, `dia_vencimento` 1–31) e `transacoes` (receitas/despesas lançadas à mão), mas:

- não existe "conta a pagar" com vencimento, status ou vínculo com o pagamento;
- não há nenhum lembrete. O único sinal é o card "Vencendo esta semana" em `/assinaturas`, calculado no cliente;
- pagar uma assinatura não gera transação, então `/financas` não mostra o gasto, a não ser que o usuário lance de novo.

## 2. Objetivos

1. Cada assinatura ativa gera uma **conta do mês** (uma ocorrência por competência), sem duplicar.
2. O usuário cadastra **contas avulsas** (boleto, IPVA, fatura) com data de vencimento.
3. **Lembretes** em `notificacoes_agente` (módulo `financas`): N dias antes, no dia do vencimento e quando vencer sem pagamento.
4. **Marcar como paga** cria a despesa em `transacoes` (de forma atômica) e a conta passa a aparecer no resumo do mês em `/financas`.
5. Corrigir os bugs de cálculo de vencimento que já existem (seção 7).

## 3. Fora do escopo (v1)

- Push/e-mail/WhatsApp (só notificação in-app via `notificacoes_agente`).
- Cron/Edge Function. A verificação roda no fluxo do agente que já existe (ver 5.4).
- Ajuste de vencimento para dia útil, parcelamento, juros/multa, integração bancária.
- Agrupar várias contas numa única notificação.

## 4. Modelo de dados (migration `005_contas_pagar.sql`, idempotente)

> Depende do `000_baseline.sql` (ou de um banco que já tenha `profiles`, `assinaturas`, `transacoes`, `preferencias_agente`).

```sql
-- assinaturas: novos campos
ALTER TABLE public.assinaturas
  ADD COLUMN IF NOT EXISTS categoria TEXT NOT NULL DEFAULT 'Assinaturas',
  ADD COLUMN IF NOT EXISTS lembrete_dias_antes INTEGER
    CHECK (lembrete_dias_antes BETWEEN 0 AND 30);       -- NULL = usa preferência

-- preferências do usuário
ALTER TABLE public.preferencias_agente
  ADD COLUMN IF NOT EXISTS notif_contas_pagar BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS lembrete_dias_antes INTEGER DEFAULT 3
    CHECK (lembrete_dias_antes BETWEEN 0 AND 30);

-- ocorrências de contas (geradas a partir de assinaturas ou avulsas)
CREATE TABLE IF NOT EXISTS public.contas_pagar (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  assinatura_id             UUID REFERENCES public.assinaturas(id) ON DELETE SET NULL,
  descricao                 TEXT NOT NULL,
  categoria                 TEXT NOT NULL DEFAULT 'Contas',
  valor                     DECIMAL(10,2) NOT NULL CHECK (valor > 0),
  vencimento                DATE NOT NULL,
  status                    TEXT NOT NULL DEFAULT 'pendente'
                              CHECK (status IN ('pendente','paga','cancelada')),
  pago_em                   DATE,
  transacao_id              UUID REFERENCES public.transacoes(id) ON DELETE SET NULL,
  lembrete_dias_antes       INTEGER CHECK (lembrete_dias_antes BETWEEN 0 AND 30),
  lembrete_enviado_em       TIMESTAMPTZ,
  alerta_atraso_enviado_em  TIMESTAMPTZ,
  created_at                TIMESTAMPTZ DEFAULT NOW(),
  updated_at                TIMESTAMPTZ DEFAULT NOW(),
  CHECK ((status = 'paga') = (pago_em IS NOT NULL))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_contas_pagar_assinatura_venc
  ON public.contas_pagar(assinatura_id, vencimento) WHERE assinatura_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contas_pagar_user_venc
  ON public.contas_pagar(user_id, vencimento);
CREATE INDEX IF NOT EXISTS idx_contas_pagar_user_status
  ON public.contas_pagar(user_id, status);

-- RLS users_own_data (DO block com checagem em pg_policies)
-- RPCs: public.pagar_conta(...) e public.desfazer_pagamento(...) (ver 5.3)
```

O status "vencida" **não é guardado**. É derivado: `status = 'pendente' AND vencimento < hoje`.

## 5. Regras de negócio

### 5.1 Datas (fuso `America/Sao_Paulo`, sempre strings `yyyy-MM-dd`)

Utilitário puro em `@meudia/shared`, usado por API e web:

| Função | Regra |
|---|---|
| `vencimentoNoMes(dia, ano, mes)` | `min(dia, últimoDiaDoMês)`. Ex.: dia 31 em fev/2027 → `2027-02-28`. Nunca transborda para o mês seguinte. |
| `proximoVencimento(dia, hojeISO)` | Se `vencimentoNoMes(mês atual) >= hoje`, ele; senão, o do mês seguinte. **Inclui hoje.** |
| `diasAte(dataISO, hojeISO)` | Diferença em dias de calendário (inteiro, pode ser negativa). |
| `hojeSP()` | Data de hoje em `America/Sao_Paulo`. |

### 5.2 Geração de contas a partir de assinaturas

`gerarContasDoMes(userId, ano, mes)`:
- para cada assinatura `ativo = true`: upsert de `contas_pagar` com `vencimento = vencimentoNoMes(...)`, `descricao = nome`, `categoria`, `valor`, `lembrete_dias_antes` copiado da assinatura;
- `ON CONFLICT (assinatura_id, vencimento) DO NOTHING`: rodar de novo não duplica e não sobrescreve conta já paga ou editada;
- não gera contas para meses anteriores ao `created_at` da assinatura;
- é chamada (a) ao listar contas de um mês, para o mês pedido, e (b) na verificação de lembretes, para o mês atual e o seguinte.

Quando uma assinatura é **desativada** (`remove` = `ativo=false`), as contas `pendente` dela com `vencimento >= hoje` passam a `cancelada`. Quando o **valor muda**, as contas `pendente` futuras dela são atualizadas, e as pagas não mudam.

### 5.3 Pagamento (atômico, via RPC)

`public.pagar_conta(p_conta_id uuid, p_pago_em date DEFAULT CURRENT_DATE, p_banco text DEFAULT NULL)`: `plpgsql`, `SECURITY INVOKER` (RLS se aplica):
1. trava a conta (`FOR UPDATE`) e exige `status = 'pendente'`;
2. insere em `transacoes` (`tipo='despesa'`, `categoria`, `descricao`, `valor`, `data=p_pago_em`, `banco`, `automatico=true`);
3. atualiza a conta: `status='paga'`, `pago_em`, `transacao_id`, `updated_at`;
4. retorna a conta.

`public.desfazer_pagamento(p_conta_id uuid)`: apaga a transação vinculada (se ainda existir), volta `status='pendente'`, zera `pago_em`/`transacao_id`.

Cancelar uma conta paga não é permitido (é preciso desfazer o pagamento antes).

### 5.4 Lembretes

`verificarLembretes(userId, hojeISO)`:
- se `preferencias_agente.notif_contas_pagar = false` → não faz nada;
- `diasAntes = coalesce(conta.lembrete_dias_antes, prefs.lembrete_dias_antes, 3)`;
- **aviso**: `status='pendente'`, `0 <= diasAte(vencimento) <= diasAntes`, `lembrete_enviado_em IS NULL` → notificação `tipo='aviso'` (ou `'alerta'` quando vence hoje), título "Conta vence em N dias" / "Conta vence hoje", mensagem `"<descricao> — R$ <valor> — vence dd/MM"`, `modulo='financas'`. Grava `lembrete_enviado_em`;
- **atraso**: `status='pendente'`, `vencimento < hoje`, `alerta_atraso_enviado_em IS NULL` → `tipo='alerta'`, título "Conta vencida". Grava `alerta_atraso_enviado_em`;
- no máximo 1 aviso + 1 alerta de atraso por conta (idempotente; rodar 2x no mesmo dia não duplica);
- `acoes` segue o formato já usado em `notificacoes_agente` (ver tipo `NotificacaoAgente` em `@meudia/shared`), com link para `/financas` e ação "marcar como paga" se o formato permitir;
- **ponto de chamada**: o mesmo fluxo em que o agente já gera notificações (`packages/api/src/services/agente.service.ts`). Confirmar no código; não criar cron.

## 6. API (packages/api)

| Camada | Arquivo | Conteúdo |
|---|---|---|
| Tipos | `@meudia/shared` | `ContaPagar`, `ContaPagarInsert`, `StatusContaPagar`; `Assinatura` ganha `categoria`, `lembrete_dias_antes`; `PreferenciasAgente` ganha os 2 campos |
| Validator | `validators/contas-pagar.validator.ts` | `contaPagarInsertSchema` (descricao, categoria, valor>0, vencimento ISO, lembrete_dias_antes 0–30 opcional), `pagarContaSchema` (pago_em ISO opcional, banco opcional) |
| Repository | `repositories/contas-pagar.repository.ts` | `findByMonth`, `findPendentesAte`, `findById`, `create`, `update`, `upsertFromAssinaturas`, `marcarLembrete`, `rpcPagar`, `rpcDesfazer`. **Todas as queries filtram `user_id`**, além do RLS |
| Service | `services/contas-pagar.service.ts` | `gerarContasDoMes`, `listarContasDoMes`, `criarContaAvulsa`, `atualizarConta`, `cancelarConta`, `pagarConta`, `desfazerPagamento`, `resumoContasDoMes` → `{ totalPendente, totalPago, totalVencido, qtdVencidas }` |
| Service | `services/lembretes-financas.service.ts` | `verificarLembretes` (reaproveita `gerarContasDoMes`) |

## 7. Bugs existentes que entram no escopo

1. `assinaturas.service.ts › proximoVencimento`: compara `new Date(ano, mes, dia)` (meia-noite) com `new Date()` (agora), então a conta que **vence hoje é ignorada**. Além disso, `dia_vencimento=31` em meses curtos transborda para o mês seguinte.
2. `assinatura.repository.ts › update/remove`: não filtram por `user_id` (dependem só do RLS), diferente de `transacao.repository.ts`.
3. `/assinaturas › isVencendoEstaSemana`: `dia - diaAtual` ignora a virada do mês (hoje 28, vence dia 2 → não destaca).

## 8. UX

### `/assinaturas`
- O modal ganha **Categoria** e **Lembrar X dias antes** (vazio = padrão das preferências).
- O card mostra um badge com o estado do mês corrente: `Paga` (verde) · `Vence hoje` (laranja) · `Vence em N dias` · `Vencida há N dias` (vermelho).
- Botão **Marcar como paga** no card quando a conta do mês está pendente.
- "Vencendo esta semana" passa a usar `diasAte(proximoVencimento(...)) <= 7`.

### `/financas`
- Nova seção **Contas do mês** (acima da lista de transações), filtrada pelo mês do seletor, com 3 StatCards: *A pagar*, *Pago*, *Vencido*.
- Lista ordenada por vencimento, com chips de status, ações *Pagar* (modal: data, banco) / *Desfazer* / *Editar* / *Cancelar*.
- Botão **Nova conta** (avulsa).
- Depois de pagar: invalida as transações e o resumo do mês, e a despesa aparece na lista.
- `AgentBannerAuto` já está na página e deve mostrar as notificações de `modulo='financas'`.

### Preferências
- Toggle "Lembrar contas a pagar" + "Dias de antecedência (padrão)" onde as preferências do agente já são editadas.

## 9. Métricas de sucesso

- % de contas do mês marcadas como pagas até o vencimento.
- Nº de transações `automatico=true` vindas de `pagar_conta` em relação a lançamentos manuais de assinaturas.
- Zero notificações duplicadas por conta (checar com query de auditoria).

## 10. Riscos e dependências

- **Baseline/gaps de schema**: ver cabeçalho de `packages/database/migrations/000_baseline.sql`. Em especial `registro_agua` × `registros_agua` (fora do domínio, mas bloqueia confiar no baseline).
- O ponto de chamada dos lembretes depende do fluxo atual do agente, que precisa ser confirmado no BE-05.
- Fuso: servidor em UTC → usar sempre `hojeSP()`.

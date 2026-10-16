# SPEC — MeuDia Finanças (contas, lembretes por push, orçamento)

Status: rascunho v3 (pagamentos por competência) · Data: 2026-10-16 · Fonte: `missions/meudia-financas/BRIEF.md` (fechado 15/10/2026)
Rotas afetadas: `/financas` (+ subrotas), `/assinaturas`, `/api/cron/lembretes`, `/api/push/*`, `sw.js`, manifest, menu/onboarding.

## 1. Problema

A usuária (iPhone, PWA) quer cadastrar contas e assinaturas, ser lembrada por push antes do vencimento e ver quanto entra, quanto sai e quanto sobra no mês. Hoje o MeuDia tem `assinaturas` (dia 1–31) e `transacoes` (lançamento manual), mas:

- não existe conta com vencimento, recorrência e status do mês;
- não há lembrete (só o card "Vencendo esta semana", calculado no cliente e com bug na virada do mês);
- pagar não gera transação, então `/financas` não mostra o gasto;
- não há renda planejada, orçamento nem visão "sobra prevista × real";
- o banco de produção está atrás do repo (ver `000_baseline.sql`); finanças/assinaturas provavelmente quebram lá.

## 2. Objetivos

1. **Conta** com nome, valor, vencimento (dia do mês ou data), recorrência `mensal | anual | unica`, categoria e situação **por competência** (`pendente | vencida | paga`, derivada de `pagamentos_conta`).
2. **Lembretes por Web Push às 09h (America/Sao_Paulo)**: D-2 "Vence em breve", D-1 "Já foi pago?", D0 "Tá tudo certo?". Cada (conta, competência, etapa, canal) é enviado **no máximo uma vez**.
3. Tocar no push abre a conta naquela competência com botão grande **"Paguei"**. Paga na competência → nenhum push a mais daquela conta naquela competência.
4. **Orçamento**: rendas mensais (1+ fontes), valor planejado por categoria, sobra prevista × real.
5. **Dashboard mensal** com renda × gasto, contas pagas no prazo, % da renda comprometida, sobra, comparação com o mês anterior e **selo** "No controle" / "Atenção" / "Apertado".
6. **Chat** atual refocado em finanças, só por regras sobre os números dela (sem LLM/API externa).
7. **Modo Finanças** (`APP_MODE=financas`): demais módulos ocultos; nenhum código removido.
8. Corrigir os bugs de vencimento existentes (seção 11).

## 3. Fora do escopo

WhatsApp, SMS, e-mail (fase 2; o modelo já aceita `canal='email'`), Open Finance, App Store, push via Expo, LLM no chat, várias moedas, compartilhamento, ajuste para dia útil, juros/multa, parcelamento.

## 4. Modelo de dados — migration `005_financas.sql` (+ `005_financas_down.sql`)

Depende de `000_baseline.sql` (profiles, assinaturas, transacoes). Só arquivo; **nada é aplicado sem o OK do Estevam**. Padrão de idempotência do baseline: `IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, policies em DO block (`pg_policies`), `CREATE OR REPLACE FUNCTION`, triggers criados só se não existirem. Reusa `public.set_updated_at()` do baseline.

**Decisão (Partner, 16/10/2026):** `contas_pagar` é a **definição** da conta (recorrente ou única), **sem status por mês**. Cada pagamento é uma linha em `pagamentos_conta`, única por `(conta_id, competencia)`. A "ocorrência do mês" não é gravada: é derivada da definição + competência (5.2). **Competência** = `TEXT 'YYYY-MM'` em todo o modelo. `assinaturas` continua como está (só bugs da seção 11); cada assinatura ativa é espelhada numa conta `mensal` via `contas_pagar.assinatura_id` (BE-06) para ganhar lembretes e "Paguei".

**Regras confirmadas (Partner, 16/10/2026):**
1. Cada assinatura ativa gera **uma** conta mensal via `contas_pagar.assinatura_id`. Lembretes saem **só pela conta**; `assinaturas` não gera notificação própria (sem duplicidade).
2. "Apagar" conta = `ativo=false`. Conta inativa **não gera lembrete** nem aparece nas competências sem pagamento.

```sql
-- Chaves para FK composta (garante que a linha referenciada é do mesmo user_id)
-- UNIQUE (id, user_id) em assinaturas e transacoes (DO block: só cria se a constraint não existir)
ALTER TABLE public.assinaturas ADD CONSTRAINT assinaturas_id_user_key UNIQUE (id, user_id);
ALTER TABLE public.transacoes  ADD CONSTRAINT transacoes_id_user_key  UNIQUE (id, user_id);

-- contas_pagar = definição (sem status/pago_em por mês)
CREATE TABLE IF NOT EXISTS public.contas_pagar (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  assinatura_id   UUID,                       -- espelho de uma assinatura (opcional)
  descricao       TEXT NOT NULL,
  categoria       TEXT NOT NULL DEFAULT 'Contas',
  valor           DECIMAL(10,2) NOT NULL CHECK (valor > 0),
  recorrencia     TEXT NOT NULL CHECK (recorrencia IN ('mensal','anual','unica')),
  dia_vencimento  INTEGER CHECK (dia_vencimento BETWEEN 1 AND 31),   -- mensal/anual
  mes_vencimento  INTEGER CHECK (mes_vencimento BETWEEN 1 AND 12),   -- anual
  data_vencimento DATE,                                              -- unica
  ativo           BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (id, user_id),
  CHECK (
    (recorrencia = 'mensal' AND dia_vencimento IS NOT NULL AND mes_vencimento IS NULL AND data_vencimento IS NULL) OR
    (recorrencia = 'anual'  AND dia_vencimento IS NOT NULL AND mes_vencimento IS NOT NULL AND data_vencimento IS NULL) OR
    (recorrencia = 'unica'  AND data_vencimento IS NOT NULL AND dia_vencimento IS NULL AND mes_vencimento IS NULL)
  ),
  -- FK composta (id, user_id): impede apontar para assinatura de outro usuário
  FOREIGN KEY (assinatura_id, user_id) REFERENCES public.assinaturas (id, user_id)
    ON DELETE SET NULL (assinatura_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_contas_pagar_assinatura
  ON public.contas_pagar(assinatura_id) WHERE assinatura_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contas_pagar_user_ativo ON public.contas_pagar(user_id) WHERE ativo;

-- um pagamento por (conta, competência)
CREATE TABLE IF NOT EXISTS public.pagamentos_conta (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_id     UUID NOT NULL,
  user_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  competencia  TEXT NOT NULL CHECK (competencia ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  pago_em      DATE NOT NULL,
  transacao_id UUID,                          -- despesa criada por pagar_conta (opcional)
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (conta_id, competencia),
  FOREIGN KEY (conta_id, user_id) REFERENCES public.contas_pagar (id, user_id) ON DELETE CASCADE,
  FOREIGN KEY (transacao_id, user_id) REFERENCES public.transacoes (id, user_id)
    ON DELETE SET NULL (transacao_id)
);
CREATE INDEX IF NOT EXISTS idx_pagamentos_conta_user_comp ON public.pagamentos_conta(user_id, competencia);

CREATE TABLE IF NOT EXISTS public.rendas (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  descricao       TEXT NOT NULL,
  valor           DECIMAL(10,2) NOT NULL CHECK (valor > 0),
  dia_recebimento INTEGER CHECK (dia_recebimento BETWEEN 1 AND 31),
  ativo           BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.orcamento_categorias (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  categoria       TEXT NOT NULL,
  valor_planejado DECIMAL(10,2) NOT NULL CHECK (valor_planejado >= 0),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, categoria)
);

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  endpoint     TEXT NOT NULL UNIQUE,
  p256dh       TEXT NOT NULL,
  auth         TEXT NOT NULL,
  user_agent   TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON public.push_subscriptions(user_id);

CREATE TABLE IF NOT EXISTS public.lembretes_enviados (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  conta_id    UUID NOT NULL,
  competencia TEXT NOT NULL CHECK (competencia ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  etapa       TEXT NOT NULL CHECK (etapa IN ('D-2','D-1','D0')),
  canal       TEXT NOT NULL DEFAULT 'push' CHECK (canal IN ('push','email')),
  enviado_em  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (conta_id, user_id) REFERENCES public.contas_pagar (id, user_id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_lembretes_enviados
  ON public.lembretes_enviados(conta_id, competencia, etapa, canal);
```

- RLS em todas as tabelas novas (inclusive `pagamentos_conta`) + `users_own_data` (`FOR ALL USING/WITH CHECK auth.uid() = user_id`) em DO block. `lembretes_enviados`: só SELECT para o usuário; escrita apenas pelo cron (service role).
- Trigger `updated_at` (`set_updated_at`) em `contas_pagar`, `rendas`, `orcamento_categorias` (`pagamentos_conta` é imutável: paga ou apaga).
- `ON DELETE SET NULL (coluna)` exige Postgres 15+ (Supabase atual). Sem a lista de colunas o SET NULL zeraria `user_id` (NOT NULL) e falharia.
- Situação **não é guardada**: `paga` = existe `pagamentos_conta` na competência; `vencida` = sem pagamento e `vencimento < hojeSP()`; senão `pendente`.
- Conta não é apagada pela UI: "excluir" = `ativo=false` (preserva histórico de pagamentos). Apagar a linha cascateia pagamentos e lembretes; as transações ficam.
- Down: drop de funções, triggers, tabelas novas e constraints adicionadas (`IF EXISTS`), sem tocar em dados do baseline.

### 4.1 RPCs (mesma migration)

Ambas `plpgsql`, `SECURITY INVOKER` (RLS vale), `SET search_path = public`.

`public.pagar_conta(p_conta_id uuid, p_competencia text, p_pago_em date DEFAULT NULL, p_banco text DEFAULT NULL) RETURNS public.pagamentos_conta`:
1. `SELECT ... FOR UPDATE` da conta (não encontrada → `RAISE EXCEPTION`);
2. valida `p_competencia` contra a definição: formato `YYYY-MM`; `anual` → mês = `mes_vencimento`; `unica` → `= to_char(data_vencimento, 'YYYY-MM')`; recorrente → não anterior à competência de `created_at`. Inválida → `RAISE EXCEPTION`;
3. já existe pagamento em `(conta, competência)` → `RAISE EXCEPTION` (o UNIQUE é a última barreira);
4. `pago_em = coalesce(p_pago_em, (now() AT TIME ZONE 'America/Sao_Paulo')::date)`;
5. insere em `transacoes` (`tipo='despesa'`, `categoria`, `descricao`, `valor` atual da conta, `data=pago_em`, `banco`, `automatico=true`, `user_id` da conta);
6. insere e retorna a linha de `pagamentos_conta` (`competencia`, `pago_em`, `transacao_id`).

`public.desfazer_pagamento(p_conta_id uuid, p_competencia text) RETURNS void`: `SELECT ... FOR UPDATE` do pagamento em `(conta, competência)`; inexistente → `RAISE EXCEPTION`; apaga a transação vinculada (se houver) e o pagamento. Lembretes já enviados naquela competência não são reenviados.

## 5. Regras de negócio

### 5.1 Datas (`@meudia/shared`, fuso `America/Sao_Paulo`, strings `yyyy-MM-dd`)

| Função | Regra |
|---|---|
| `hojeSP(now?)` | Data de hoje em SP. |
| `vencimentoNoMes(dia, ano, mes)` | `min(dia, últimoDia)`. Dia 31 em fev/2027 → `2027-02-28`. Nunca transborda. |
| `proximoVencimento(dia, hoje)` | Mês atual se `>= hoje` (**inclui hoje**), senão mês seguinte (dez → jan do ano seguinte). |
| `diasAte(data, hoje)` | Dias de calendário (pode ser negativo). |
| `competenciaDe(data)` | `yyyy-MM` (mesmo formato de `pagamentos_conta.competencia`). |
| `etapaLembrete(vencimento, hoje)` | `diasAte` 2 → `'D-2'`, 1 → `'D-1'`, 0 → `'D0'`, senão `null`. |

### 5.2 Ocorrências por competência (derivadas, nada é gravado)

`ocorrenciaDaConta(conta, competencia)` (pura, `@meudia/shared`) → `{ vencimento } | null`:
- `mensal` ativa: `vencimento = vencimentoNoMes(dia_vencimento, ano, mes)`;
- `anual` ativa: só quando `mes = mes_vencimento`;
- `unica`: só na competência de `data_vencimento` (`vencimento = data_vencimento`), ativa;
- recorrente: nada antes da competência de `created_at`.

`listarContasDoMes(userId, competencia)` = contas do usuário com ocorrência na competência + `pagamentos_conta` dessa competência → `OcorrenciaConta { conta, competencia, vencimento, situacao, pagamento | null }`. Competências passadas também listam contas inativas que tenham pagamento nelas (histórico).
- Desativar conta (`ativo=false`) → some das competências sem pagamento e para de gerar lembretes; pagamentos antigos ficam.
- Editar valor/categoria/vencimento altera só competências **sem** pagamento (as pagas têm a transação com o valor da época).

### 5.3 Lembretes (cron diário)

`enviarLembretesDoDia(hoje = hojeSP())`, executado pela rota de cron com cliente service role:
1. carrega contas ativas de usuários com `push_subscriptions` e os `pagamentos_conta` das competências de `hoje` e `hoje+2` (podem ser duas, na virada);
2. para cada conta, calcula a ocorrência das datas em `[hoje, hoje+2]` sem pagamento na competência; `etapa = etapaLembrete(vencimento, hoje)`;
3. **reserva antes de enviar**: `INSERT INTO lembretes_enviados (conta_id, competencia, etapa, canal) ... ON CONFLICT DO NOTHING RETURNING id`. Sem linha retornada → já enviado, pula. Isso garante "no máximo uma vez" por competência mesmo com cron duplicado/concorrente;
4. envia para todas as inscrições do usuário (payload abaixo); 404/410 → `DELETE` da inscrição; outros erros são logados (sem endpoint/chaves) e **não** liberam a reserva;
5. retorna `{ contas, enviados, ignorados, inscricoesRemovidas }`.

Conta com pagamento na competência ou inativa não entra no passo 2 → "Paguei" interrompe a sequência daquela competência (a do mês seguinte segue normal). Dia perdido (cron não rodou) não é enviado retroativamente.

| Etapa | Título | Corpo |
|---|---|---|
| D-2 | Vence em breve | `<descricao> — R$ <valor> vence <dd/MM>` |
| D-1 | Já foi pago? | `<descricao> vence amanhã. Toque para marcar como paga.` |
| D0 | Tá tudo certo? | `<descricao> vence hoje. Já pagou?` |

Payload: `{ title, body, url: '/financas/contas/<id>?competencia=<YYYY-MM>', tag: 'conta-<id>-<competencia>' }`. Textos e valores em constantes testáveis (`LEMBRETE_TEXTOS`).

### 5.4 Orçamento e dashboard (`resumoFinanceiroMes(userId, ano, mes)`)

| Métrica | Fórmula |
|---|---|
| `rendaPrevista` | Σ `rendas.valor` ativas |
| `rendaReal` | Σ `transacoes` `receita` do mês |
| `gastoReal` | Σ `transacoes` `despesa` do mês (inclui as criadas por `pagar_conta`) |
| `contasMes` | Σ `valor` das ocorrências da competência (5.2) |
| `gastoPrevisto` | Σ por categoria de `max(orcado_categoria, contas_da_categoria)` (categoria sem orçamento conta só as contas) |
| `sobraPrevista` / `sobraReal` | `rendaPrevista − gastoPrevisto` / `rendaReal − gastoReal` (se `rendaReal = 0`, usa `rendaPrevista`) |
| `pctComprometida` | `contasMes / rendaPrevista` (`null` se renda 0) |
| `pagasNoPrazo` | ocorrências com `vencimento <= hoje` e `pagamento.pago_em <= vencimento` / ocorrências com `vencimento <= hoje` |
| `vsMesAnterior` | delta absoluto e % de `gastoReal` e `sobraReal` |

### 5.5 Selo (`calcularSelo`, `@meudia/shared`)

Limites em `SELO_LIMITES` (constantes exportadas e testadas):

```ts
export const SELO_LIMITES = { NO_CONTROLE_MAX: 0.7, ATENCAO_MAX: 0.9 } as const;
```

- **Apertado**: `sobraPrevista < 0`, ou `pctComprometida > ATENCAO_MAX`, ou renda 0 com contas > 0;
- **Atenção**: `pctComprometida > NO_CONTROLE_MAX`, ou há ocorrência vencida (sem pagamento e vencimento < hoje);
- **No controle**: o resto. Sem dados (renda 0 e contas 0) → `null` (UI mostra "Cadastre sua renda").

### 5.6 Chat por regras

Reaproveita `packages/ai/src/agent` (`intencao.ts`, `chat.ts`). Em modo finanças, intenções e respostas só sobre os números dela, calculadas por `resumoFinanceiroMes`/`listarContasDoMes`: "quanto sobra", "o que vence (hoje/semana)", "quanto gastei com <categoria>", "estou no controle?" (selo), "quanto ganho", fallback com sugestões. Sem LLM, sem chamada externa.

### 5.7 Modo Finanças (`APP_MODE`)

- `APP_MODE=financas` (env do servidor, criada pelo Estevam na Vercel). Ausente/outro valor → app atual inalterado.
- Fonte única: `apps/web/lib/app-mode.ts` com `getAppMode()` e `MODULOS_VISIVEIS[mode]`; o valor chega ao cliente via layout do servidor (prop/contexto), sem `NEXT_PUBLIC_` duplicado.
- Oculta módulos no **menu**, **rotas** (middleware redireciona rotas de módulos ocultos para `/financas`), **onboarding** (só passos de finanças) e **atalhos do manifest** (manifest gerado pelo servidor filtrando `shortcuts`).
- Nenhum arquivo de módulo é removido. Testes com a flag ligada e desligada.

## 6. Web Push

- **VAPID**: `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (`mailto:`). Geradas e cadastradas na Vercel pelo Estevam; nunca no repo, logs ou prompts. Biblioteca `web-push` (server only).
- **Service worker existente** (`apps/web/public/sw.js`): subir `CACHE_NAME` de `meudia-v5` para `meudia-v6`; adicionar `push` (exibe `showNotification(title, { body, tag, data: { url }, icon })`) e `notificationclick` (fecha, foca janela aberta do app e navega para `data.url`, senão `clients.openWindow(url)`). Fetch/cache atuais não mudam.
- **Inscrição** (só no toque em "Ativar lembretes", nunca no load): `Notification.requestPermission()` → `pushManager.subscribe({ userVisibleOnly: true, applicationServerKey })` → `POST /api/push/subscribe` (upsert por `endpoint`, `user_id` da sessão). `DELETE /api/push/subscribe` remove. Negada → mensagem explicando como liberar nos Ajustes.
- **iOS**: push só funciona com PWA instalado (iOS 16.4+). Tela "Como instalar no iPhone" (Safari → Compartilhar → Adicionar à Tela de Início) aparece quando `display-mode` não é `standalone`.

## 7. Agendador

- **Vercel Cron (Hobby, 1x/dia)**: `GET /api/cron/lembretes` às `0 12 * * *` (12:00 UTC = 09h em SP; Brasil sem horário de verão). Rota exige `Authorization: Bearer ${CRON_SECRET}` (401 caso contrário), `runtime = 'nodejs'`, `dynamic = 'force-dynamic'`. Toda lógica de data usa `hojeSP()`, nunca a hora do servidor.
- **Sem criar job real neste ciclo**: o PR traz a rota e o trecho `crons` do `vercel.json` documentado no PR; o Estevam habilita o cron (e cria `CRON_SECRET`) quando aprovar.
- **Alternativa documentada** (não criar): Supabase `pg_cron` + `pg_net` chamando a mesma rota com o mesmo header, caso o cron da Vercel não sirva.
- Teste manual: `curl` local com o header contra `next dev`, com `hoje` injetável só em teste (não por query string em produção).

## 8. API (packages/api) e rotas (apps/web)

| Camada | Arquivo | Conteúdo |
|---|---|---|
| Tipos/consts | `@meudia/shared` | `Competencia` (`YYYY-MM`), `ContaPagar`, `ContaPagarInsert`, `Recorrencia`, `PagamentoConta`, `SituacaoOcorrencia` (`pendente/vencida/paga`), `OcorrenciaConta`, `Renda`, `OrcamentoCategoria`, `PushSubscriptionRow`, `LembreteEnviado`, `EtapaLembrete`, `Selo`; `ocorrenciaDaConta`; `SELO_LIMITES`, `LEMBRETE_TEXTOS` |
| Validators | `contas-pagar`, `rendas`, `orcamento`, `push-subscription` | zod; valor > 0, datas ISO, competência `YYYY-MM`, campos de vencimento coerentes com a recorrência |
| Repositories | `contas-pagar`, `pagamentos-conta`, `rendas`, `orcamento`, `push-subscriptions`, `lembretes-enviados` | **toda query filtra `user_id`** (além do RLS); `AppError(..., 'DB_ERROR')` |
| Services | `contas-pagar.service.ts` | `listarContasDoMes`, `obterContaDoMes`, `criarConta`, `atualizarConta`, `desativarConta`, `pagarConta`, `desfazerPagamento` |
| Services | `orcamento.service.ts` | CRUD rendas/orçamento, `resumoFinanceiroMes`, `calcularSelo` |
| Services | `lembretes.service.ts` | `enviarLembretesDoDia` (sender injetável para teste) |
| Rotas | `apps/web/app/api/cron/lembretes/route.ts`, `apps/web/app/api/push/subscribe/route.ts` | cron (service role, padrão de `api/delete-account`) e inscrição (sessão do usuário) |

## 9. UX (design system atual: `v3-card` etc.)

- `/financas`: cabeçalho do mês com **selo**, cards renda × gasto, sobra prevista × real, % comprometida, pagas no prazo, comparação com mês anterior; seção **Contas do mês** (chips pendente/vencida/paga) da competência selecionada.
- `/financas/contas/[id]?competencia=YYYY-MM` (default: competência atual): detalhe com botão grande **"Paguei"** para aquela competência (data default hoje, banco opcional), "Desfazer" quando paga e histórico de pagamentos. Destino do push.
- `/financas/contas` (lista + nova conta: nome, valor, recorrência, vencimento conforme a recorrência — dia / dia+mês / data —, categoria; "Excluir" = desativar) e `/financas/orcamento` (rendas e valor por categoria).
- `/assinaturas`: badge do mês (paga/pendente da conta espelhada na competência atual), "Vencendo esta semana" com `diasAte(proximoVencimento(...)) <= 7`.
- Botão **"Ativar lembretes"** + tela **"Como instalar no iPhone"**.
- Chat com sugestões de perguntas de finanças.

## 10. Testes (DoD)

- Datas: meses de 28/29/30/31 dias, dia 31, virada de mês e de ano, `hojeSP` às 02:00 UTC.
- Pagamento: `pagar_conta` 2x na mesma competência → exceção; pagar `2026-10` não afeta `2026-11`; competência inválida para a recorrência → exceção.
- Idempotência: `enviarLembretesDoDia` 2x no mesmo dia → 0 envios na 2ª; paga na competência → 0 envios (e a competência seguinte ainda lembra); 404/410 remove inscrição.
- Selo nos limites exatos (0.70 / 0.90), sobra negativa, renda 0.
- Flag: com `APP_MODE=financas` só finanças no menu/rotas/onboarding/manifest; sem flag, nada muda.
- Chat: cada intenção e o fallback.
- RLS (banco local): usuário A não lê/paga conta de B nem lê `pagamentos_conta` de B; FK composta recusa `assinatura_id`, `conta_id` ou `transacao_id` de outro usuário.

## 11. Bugs existentes no escopo

1. `assinaturas.service.ts › proximoVencimento`: ignora a conta que vence hoje e transborda o dia 31.
2. `assinatura.repository.ts › update/remove`: não filtram `user_id`.
3. `/assinaturas › isVencendoEstaSemana`: ignora a virada do mês.

## 12. Riscos e dependências

- Banco atrás do repo: `000_baseline.sql` precisa ser validado (BE-00) e aplicado pelo Estevam antes do `005`.
- Push no iOS depende do PWA instalado e da permissão; testar no aparelho dela (DoD).
- Vercel Hobby: cron 1x/dia e com janela de execução imprecisa (pode atrasar); aceitável para lembretes diários.
- Env vars (VAPID, `CRON_SECRET`, `APP_MODE`, `SUPABASE_SERVICE_ROLE_KEY`) criadas só pelo Estevam.
- Dados reais dela nunca em prints/fixtures.

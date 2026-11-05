# PLANO-F1 — MeuDia "Saúde e Treino"
**Data:** 04/11/2026 · **Autor:** backend/arquitetura (Claude Code local, só leitura) · **Repo:** `/home/box/repos/meudia-ci`, branch `feat/saude-treino` = `a618475` (limpa)
**Status:** proposta. Nada de código, migration ou SQL aplicável foi criado. Nenhum arquivo do repo foi alterado. Sem rede, sem banco, sem deploy. `.env` e segredos não foram lidos.
**Fontes lidas:** `prompts/00`–`04`, `01-backend-claudecode.md`, `BRIEF.md` v1.2, `PROMPT-ORIGINAL-ESTEVAM.md`, `stack-decision.md`, `MEDICAO-SUPABASE-F1.md`, `research/ANEXO-TACO-E-GANHO-PESO.md`, `research/ANEXO-ONBOARDING.md`.

---

## 0. Conflitos encontrados (aviso antes de tudo)

| # | Onde | Conflito | O que este plano segue |
|---|---|---|---|
| C1 | `00-OVERVIEW.md` e `04-REFS.md` dizem que o `ANEXO-ONBOARDING.md` "ainda não chegou" | O arquivo existe em `research/` (04/11, 20:30) | O anexo. A seção 10 foi escrita com ele |
| C2 | BRIEF §3.7 e §9 falam em 0,25–0,5 **kg**/semana, pendente | `00-OVERVIEW` e o anexo TACO fecham em **% do peso**: 0,25–0,5%/semana (Iraki 2019) | % do peso. Nada em kg fixo |
| C3 | Código TS x banco real, tabela `exercicios` | `exercicio.repository.ts` pede `tempo_descanso`; o baseline (`000_baseline.sql:132`, "estado real do banco, GAP-10") tem `descanso_segundos`. Tipo TS diz `repeticoes: string`; banco tem `INTEGER` | Pela regra do Estevam, vale o código como intenção e o banco como fato. **Provável erro 400 hoje** ao listar exercícios em produção (mesmo tipo de bug que o C-1 corrigiu em `sessoes_treino`). Conferir por consulta de catálogo só leitura antes da F2 |
| C4 | Código TS x banco real, tabela `series_realizadas` | Código usa `numero_serie`, `carga_usada`, `reps_feitas`, `concluido`; baseline tem `serie_numero`, `carga`, `repeticoes`, `concluida` | Idem C3. Corrigir no repositório com um mapeador (como `paraSessao`), sem renomear coluna no banco |
| C5 | `apps/web/app/onboarding/StepPerfil.tsx:12` | Calcula meta com Harris-Benedict revisada, idade fixa 30, só a versão masculina, ×1,55 e ×0,8/×1,15. Nada disso está no anexo | O anexo (Mifflin-St Jeor). Proposta: tirar esse cálculo na F3 (pergunta P12) |
| C6 | `AGENTS.md` (regras "Chat no modo Finanças… treino… não está disponível" e commit `a618475` "não consulta no modo Finanças") | Decisão do Estevam: o módulo aparece para todos, inclusive com `APP_MODE=financas` | A decisão do Estevam. Essas regras, `agente-modo.ts`, seus testes e a tabela do `AGENTS.md` mudam na F2, na mesma mudança |
| C7 | BRIEF §4 "tema claro e escuro se o app já tiver os dois" | O app só tem tema escuro (`globals.css`, um único `:root`, sem `.dark`/light) | Só escuro. Não criar tema claro |
| C8 | `01-backend` item 6 manda medir se a medição não cobrir | O pedido desta tarefa manda usar `MEDICAO-SUPABASE-F1.md` e não conectar | A medição de 04/11 ~20:30. Não conectei em nada |

---

## 1. Mapa do que existe

### 1.1 Telas (`apps/web/app/(dashboard)/`)
| Tela | Arquivo (linhas) | Estado |
|---|---|---|
| `treinos` | `treinos/page.tsx` (644) | Lista treinos por dia, exercícios, sessão com timer de descanso (`@meudia/ai`), `ExercicioCard`, `AddExercicioModal`. Depende das colunas com drift (C3/C4) |
| `dieta` | `dieta/page.tsx` (495) | Refeições por tipo, água, peso. Itens em JSONB com `calorias` obrigatório (`ItemRefeicao.calorias: number`) |
| `compras` | `compras/page.tsx` (635) | Listas e itens, `preco_estimado` |
| `agenda` | `agenda/page.tsx` (511) | `compromissos`, sem campo de origem |
| `habitos` | `habitos/page.tsx` (518) | Não muda |
| `medicamentos` | `medicamentos/page.tsx` (349) | Não muda |
| `inicio` | `inicio/page.tsx` (383) | Painel do modo padrão. No modo Finanças a rota é oculta |
| `onboarding` | `app/onboarding/*` | Modo padrão: Objetivo → Perfil (C5) → Módulos. Modo Finanças: Financas → Carteiras. `lib/onboarding.ts` com `comTempoLimite` e cache `profileKey` |
| `privacidade` | `app/privacidade/page.tsx` (60) | Cita "treinos" mas não dados de saúde |

### 1.2 Tabelas do BRIEF §2 (baseline `000_baseline.sql`)
- `profiles` (id = auth.uid): `peso_atual`, `altura`, `meta_peso`, `meta_calorias` (default 2000), `meta_agua`, `objetivo` (`saude_geral|emagrecer|ganhar_massa|condicionamento`), `onboarding_feito`.
- `treinos` (user_id, nome, dia_semana 0–6, descricao, ativo, tipo, ordem) → `exercicios` (treino_id, **sem user_id**, series INT, repeticoes INT, carga, descanso_segundos, ordem, observacao) → `sessoes_treino` (user_id, treino_id, inicio, fim, duracao_minutos, concluida, observacao) → `series_realizadas` (sessao_id, exercicio_id, **sem user_id**, serie_numero, repeticoes, carga, concluida).
- `registros_peso` (user_id, peso DECIMAL(5,2), data, observacao, UNIQUE(user_id, data)).
- `refeicoes` (user_id, tipo CHECK de 6 valores, data, items JSONB, totais com DEFAULT 0).
- `registros_agua`, `compromissos` (sem origem), `listas_compras` → `itens_compras` (sem user_id), `medicamentos` → `registro_medicamentos`, `habitos` → `registros_habito`.
- Também úteis: `preferencias_agente` (user_id PK, `notif_faltou_treino`, `horario_verificacao`…), `metas` (007, é de Finanças: guardar dinheiro; não serve para peso).

### 1.3 Web push e envio idempotente (Finanças)
- `push_subscriptions` (005): UNIQUE(user_id, endpoint), RLS `users_own_data`.
- `apps/web/app/api/push/subscribe` grava a inscrição; `apps/web/lib/web-push.ts` (`createPushSender`, VAPID por env, adaptador injetável para teste).
- `apps/web/app/api/cron/lembretes/route.ts`: `CRON_SECRET` com comparação em tempo constante, client service-role só no servidor, chama `lembretesService.enviarLembretesDoDia`.
- Idempotência: `lembretes_enviados` com UNIQUE(conta_id, competencia, etapa, canal). O serviço **reserva** com `upsert … ignoreDuplicates` antes de enviar e **libera** se o envio falhar; 404/410 apaga a inscrição morta. RLS só SELECT (escrita via service role, de propósito).
- `vercel.json`: **um cron só, `0 12 * * *`** (uma vez por dia, 09h BRT). Isso importa para lembretes com horário (seção 9).
- `lembretes_enviados` tem FK para `contas_pagar` e `etapa IN ('D-2','D-1','D0')`: não dá para reusar a tabela sem mudar o contrato de Finanças.

### 1.4 `APP_MODE=financas`
`apps/web/lib/app-mode.ts`: `MODULOS_VISIVEIS.financas = ['/financas', '/assinaturas', '/configuracoes']`; o middleware redireciona o resto. `lib/navegacao.ts` monta Sidebar, Drawer e BottomNav (5 abas fixas no modo Finanças). `lib/agente-modo.ts` responde "não disponível" para treino/hábito/notas.

### 1.5 Gráficos e tema
- `recharts ^2.15.0` já instalado; wrappers `components/ui/LineChart.tsx`, `BarChart.tsx`, `DonutChart.tsx`. **Nenhuma lib nova de gráfico.**
- `lucide-react`, `zod`, `date-fns` já existem.
- Tema: só escuro (C7).

### 1.6 Medição atual (de `MEDICAO-SUPABASE-F1.md`, 04/11 ~20:30)
Banco total **13 MB (14.085.267 bytes) de 500 MB**. RLS ligado nas 36 tabelas `public`. `exercicios`, `series_realizadas`, `sessoes_treino`, `treinos` com 4 políticas (S/I/U/D). Migrations aplicadas até `007_excluir_metas`. Nenhuma 008.

---

## 2. Reaproveitar x criar (BRIEF §3)

| Item do BRIEF §3 | Reaproveita | Cria | Por que criar |
|---|---|---|---|
| 1. Contas separadas | RLS atual; padrão `users_own_data` e FK composta `(id, user_id)` da 005/006 | — | — |
| 2. Painel de saúde | `registros_peso`, `sessoes_treino`, `refeicoes`, wrappers de `recharts`; rota nova `/saude` com componentes do design system | `perfil_saude` (ver 3.6) | Respostas do onboarding, metas calculadas x manuais e a marca de origem não cabem em `profiles` sem espalhar dado de saúde no perfil que o app inteiro lê (seção 10.3) |
| 3. Treino semanal | `treinos`, `exercicios`, `sessoes_treino`, `series_realizadas`, tela `treinos` | Colunas novas em `exercicios` e `series_realizadas` | Faixa 8–12 e "prancha 3 séries" não cabem em `repeticoes INTEGER` |
| 4. Alimentação | `refeicoes` (registro do dia), tela `dieta` | `alimentos_taco` (referência, sem user_id); `plano_refeicoes` (modelo diário editável); `receitas_favoritas`; `alimentos_usuario` | TACO é dado de referência global; o plano diário (6 refeições com horário) não é o registro do dia; receitas e alimentos fora da TACO não têm tabela |
| 5. Suplementos | — (`medicamentos` tem `dosagem TEXT` e estoque, não tem composição nem creatina por dose) | `suplementos`, `registros_suplemento` | Precisa de creatina por dose nula (Profit), composição pelo rótulo e soma sem dobra. Usar `medicamentos` misturaria remédio com suplemento e mudaria aquele módulo |
| 6. Peso e evolução | `registros_peso` como está (UNIQUE por dia). Médias 7/30/90 calculadas na leitura | — | — |
| 7. Metas | `perfil_saude` (meta de peso, prazo, kcal, proteína). Dias de meta cumprida calculados de `refeicoes` | `metas_saude_historico` (pequena) | Sem histórico, mudar a meta hoje muda os "dias cumpridos" do passado. Candidata a corte (seção 13) |
| 8. Compras da dieta | `listas_compras`, `itens_compras`, tela `compras` | Colunas novas em `listas_compras` | Chave da semana para não gerar a mesma lista duas vezes e copiar a anterior |
| 9. Agenda e notificações | `compromissos`, `push_subscriptions`, `createPushSender`, padrão reservar/liberar; `preferencias_agente` para liga/desliga | Colunas de origem em `compromissos`; `notificacoes_saude_enviadas` | `lembretes_enviados` é amarrada a `contas_pagar` (FK + CHECK de etapa) |
| 10. Editar/excluir, sem apagar dado atual | Todas as colunas novas são `NULL`/com default; nenhuma coluna antiga muda de tipo ou nome; nenhum UPDATE em dado existente | — | — |

---

## 3. Modelo de dados proposto (texto, nada aplicado)

Convenções para toda tabela nova: `id UUID PK default gen_random_uuid()`, `user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE`, `created_at`/`updated_at` com o trigger `set_updated_at` já existente, `UNIQUE (id, user_id)` para servir de alvo de FK composta, RLS `users_own_data` e `REVOKE ALL … FROM PUBLIC, anon, authenticated` antes do `GRANT SELECT, INSERT, UPDATE, DELETE … TO authenticated` (padrão da 007). Unidades: kg, g, kcal, ml (decisão do Estevam).

### 3.1 Treino (F2)
- `exercicios` + `repeticoes_min SMALLINT NULL`, `repeticoes_max SMALLINT NULL`, CHECK `repeticoes_min IS NULL OR repeticoes_min >= 1`, CHECK `repeticoes_max IS NULL OR repeticoes_max >= COALESCE(repeticoes_min, 1)`.
  - Faixa 8–12 → min 8, max 12. Número fixo 10 → min 10, max 10. "Prancha 3 séries" → `series = 3`, min e max NULL (série sem repetição).
  - `repeticoes` antigo fica intacto. O app lê min/max e, se os dois forem NULL e `repeticoes` tiver valor, mostra `repeticoes` (linhas antigas seguem iguais). Sem backfill.
- `exercicios` + `modelo_origem TEXT NULL` (ex.: `'modelo-estevam-v1'`), só para idempotência do modelo (3.8).
- `treinos` + `horario TIME NULL` (hora do treino para agenda e notificação) e `modelo_origem TEXT NULL`. Índice único parcial `(user_id, modelo_origem, dia_semana) WHERE modelo_origem IS NOT NULL`.
- `series_realizadas` + `observacao TEXT NULL`. Repetições feitas, carga e concluída já existem (C4: corrigir o código, não o banco). Histórico de cargas = `series_realizadas` por `exercicio_id`, ordenado por `sessoes_treino.inicio`.
- Descanso planejado: `exercicios.descanso_segundos` (já existe). Descanso real por série não é gravado (candidato a corte, seção 13).
- Dias Qua/Sáb/Dom do modelo: `treinos.tipo = 'descanso'` (CHECK já aceita) sem exercícios.

### 3.2 Alimentação (F3)
- **`alimentos_taco`** (referência, global, sem `user_id`): `id INTEGER PK` = número do alimento na TACO; `nome TEXT NOT NULL`; `categoria TEXT NULL`; valores por 100 g, todos `NUMERIC NULL` (NULL = "NA", "Tr", "*" ou vazio). Colunas mínimas: `energia_kcal`, `proteina_g`, `lipidios_g`, `carboidrato_g`, `fibra_g`. Os nomes exatos e as demais colunas saem do cabeçalho do arquivo: **PENDENTE até o arquivo ser obtido** (seção 8). Opcional: `tracos TEXT[]` com os nomes das colunas que eram "Tr" (pergunta P9).
- **`plano_refeicoes`** (modelo do dia, editável): `user_id`, `nome TEXT` ("Café da manhã", "Vitamina"…), `horario TIME`, `tipo TEXT` com o mesmo CHECK de `refeicoes.tipo`, `ordem SMALLINT`, `itens JSONB`, `ativo BOOLEAN`, `modelo_origem TEXT NULL`; índice único parcial `(user_id, modelo_origem, ordem) WHERE modelo_origem IS NOT NULL`.
- **`refeicoes`** (registro do dia, já existe) + `nome TEXT NULL`, `horario TIME NULL`, `feita BOOLEAN NOT NULL DEFAULT false`, `plano_refeicao_id UUID NULL` (FK composta com `user_id`, `ON DELETE SET NULL`), `totais_incompletos BOOLEAN NOT NULL DEFAULT false`. Índice único parcial `(user_id, plano_refeicao_id, data) WHERE plano_refeicao_id IS NOT NULL` (abrir o app várias vezes não cria a refeição do plano duas vezes). Linhas antigas ficam com os defaults e seguem iguais.
  - Os 6 horários do Estevam e o CHECK de `tipo`: 07h `cafe`, 10h `lanche_manha`, 12h30 `almoco`, 17h `lanche_tarde`, 20h30 `jantar` com `nome = 'Vitamina'`, 21h30 `ceia` com `nome = 'Jantar'`. A tela mostra `nome`; `tipo` vira só categoria. Pergunta P13 (alternativa: afrouxar o CHECK).
- **Item de refeição (JSONB, contrato novo, compatível com o antigo):** `nome`, `gramas` (número ou null), `kcal`, `proteina_g`, `carbo_g`, `gordura_g` (cada um número **ou null**), `fonte` (`'taco' | 'rotulo' | 'manual'`), `taco_id` (número ou null), `alimento_usuario_id` ou `suplemento_id` (ou null), `editado_manual` (boolean). Item antigo (`calorias`, `proteina`…) é lido como `fonte='manual'`.
  - Valor TACO do item = valor por 100 g × gramas ÷ 100; se o valor por 100 g for NULL, o item fica NULL naquele nutriente (nunca 0).
  - Total da refeição soma só números; se algum item tiver NULL em um nutriente, `totais_incompletos = true` e a tela mostra "total parcial". As colunas `total_*` continuam (DEFAULT 0 antigo), mas a tela confia no flag.
  - Editar um valor TACO à mão → `fonte = 'manual'`, `editado_manual = true`, e o selo "referência TACO" sai daquele valor.
- **`alimentos_usuario`** (fora da TACO, ex.: Profit 28500 como alimento): `user_id`, `nome`, `porcao_g NUMERIC NULL`, `kcal`/`proteina_g`/`carbo_g`/`gordura_g` por porção, todos `NULL` até a pessoa digitar do rótulo, `fonte TEXT CHECK IN ('rotulo','manual')`.
- **`receitas_favoritas`**: `user_id`, `nome`, `itens JSONB` (mesmo contrato do item). Duplicar refeição não precisa de tabela (copia a linha).

### 3.3 Suplementos (F3)
- **`suplementos`**: `user_id`, `nome`, `dose_padrao NUMERIC NULL`, `unidade TEXT CHECK IN ('g','ml','un')`, `horario TIME NULL`, `creatina_g_por_dose NUMERIC NULL`, `kcal_por_dose`/`proteina_g_por_dose`/`carbo_g_por_dose`/`gordura_g_por_dose NUMERIC NULL`, `ativo BOOLEAN`, `modelo_origem TEXT NULL`.
  - Modelo: "Profit 28500" com **todos os campos de composição vazios, inclusive `creatina_g_por_dose = NULL`**; "Creatina" com `dose_padrao = NULL` (o BRIEF não dá a dose; a pessoa preenche) e `creatina_g_por_dose` igual à dose quando ela preencher (regra da tela, não valor inventado).
- **`registros_suplemento`**: `user_id`, `suplemento_id` (FK composta `(suplemento_id, user_id)`), `data DATE`, `horario TIME NULL`, `doses NUMERIC NOT NULL DEFAULT 1`, `refeicao_id UUID NULL` (FK composta, `ON DELETE SET NULL`), `creatina_g NUMERIC NULL` (copiado do suplemento na hora do registro, para o histórico não mudar se o rótulo for corrigido depois).
  - Índice único parcial `(user_id, suplemento_id, refeicao_id) WHERE refeicao_id IS NOT NULL`: marcar a vitamina como feita cria **um** registro do Profit ligado àquela refeição; marcar de novo não cria outro.
  - **Creatina do dia** = soma de `doses × creatina_g` dos registros do dia, cada registro uma vez. A refeição **não** soma creatina por conta própria; ela só aponta para o registro. Assim a creatina do Profit entra uma vez, e a avulsa entra pelo registro dela. Se algum registro do dia tiver `creatina_g` NULL (Profit vazio), a tela avisa "o total pode estar incompleto".

### 3.4 Peso, metas e ritmo (F4)
- Peso: `registros_peso` como está. Médias de 7, 30 e 90 dias e média semanal calculadas na leitura (função pura em `packages/shared`).
- Meta de peso em `perfil_saude`: `meta_peso_kg NUMERIC(5,2) NULL`, `meta_prazo DATE NULL`.
- Constantes em `packages/shared/src/constants/saude.ts`: `GANHO_SEMANAL_MIN_PCT = 0.25`, `GANHO_SEMANAL_MAX_PCT = 0.5`, `GANHO_SEMANAL_MAX_PCT_AVANCADO = 0.25` (Iraki et al. 2019, *Sports* 7(7):154).
- Regra (anexo TACO §2): semanas = dias até o prazo ÷ 7; ritmo pedido = (meta − peso atual) ÷ semanas; faixa de referência = peso atual × 0,25% até peso atual × 0,5% por semana (0,25% no teto para avançado); **realista se ritmo pedido ≤ peso atual × 0,5%**.
- Texto neutro (do anexo): "Nesse prazo a meta pede X kg/semana; a faixa usada como referência é Y–Z kg/semana." Com a fonte citada e sem tom de recomendação médica.
- Conta de teste (do anexo): 66,5 kg → faixa 0,17–0,33 kg/semana; 75 kg em ~26 semanas no teto. 1 mês ou 3 meses: não realista.
- Calorias do dia: "cumprida" quando a soma de kcal das refeições do dia ≥ 100% da meta vigente naquela data. Com `totais_incompletos` em alguma refeição, o dia mostra "parcial".
- **`metas_saude_historico`**: `user_id`, `vigente_desde DATE`, `meta_kcal INTEGER`, `meta_proteina_min_g`, `meta_proteina_max_g`; UNIQUE(user_id, vigente_desde). Uma linha nova por mudança de meta (poucas por ano).

### 3.5 Compras (F4)
- `listas_compras` + `semana_inicio DATE NULL`, `origem TEXT NULL CHECK IN ('dieta')`; índice único parcial `(user_id, origem, semana_inicio) WHERE origem IS NOT NULL` (gerar duas vezes não duplica).
- `itens_compras`: reusa `quantidade`, `unidade`, `comprado`, `preco_estimado` (vira "preço" na tela). Total = soma dos preços preenchidos; item sem preço não entra e a tela diz quantos ficaram sem preço. Pergunta P14 (preço do item ou por unidade).
- Copiar a semana anterior = nova lista com os mesmos itens, `comprado = false`.

### 3.6 Perfil de saúde e onboarding (F3; detalhe na seção 10)
**`perfil_saude`** (1 linha por pessoa): `user_id UUID PK REFERENCES profiles(id) ON DELETE CASCADE`; `sexo_formula TEXT NULL CHECK IN ('masculino','feminino')`; `ano_nascimento SMALLINT NULL`; `altura_cm NUMERIC(5,1) NULL`; `nivel_atividade TEXT NULL` (valores na seção 10); `objetivo TEXT NULL CHECK IN ('ganhar','manter','perder')`; `experiencia_treino TEXT NULL CHECK IN ('iniciante_intermediario','avancado')`; `proteina_g_kg NUMERIC(3,2) NOT NULL DEFAULT 1.8 CHECK BETWEEN 1.4 AND 2.2`; `meta_kcal INTEGER NULL`; `meta_kcal_calculada INTEGER NULL`; `meta_kcal_origem TEXT CHECK IN ('calculada','manual') NULL`; `meta_proteina_min_g`, `meta_proteina_max_g INTEGER NULL`; `meta_proteina_calculada_g INTEGER NULL`; `meta_proteina_origem TEXT CHECK IN ('calculada','manual') NULL`; `formula_versao TEXT NULL`; `meta_peso_kg`, `meta_prazo`; `consentimento_saude_em TIMESTAMPTZ NULL`; `respondido_em TIMESTAMPTZ NULL`; `created_at`, `updated_at`. O peso atual não fica aqui: vem do último `registros_peso`.

### 3.7 Agenda e notificações (agenda F4; notificação de treino F2)
- `compromissos` + `origem TEXT NULL CHECK IN ('treino','refeicao','suplemento')`, `origem_id UUID NULL`, `data_origem DATE NULL`; índice único parcial `(user_id, origem, origem_id, data_origem) WHERE origem IS NOT NULL`. Linhas antigas ficam com `origem NULL` e fora do índice. O BRIEF fala em "usuário + origem + data"; com 6 refeições no mesmo dia é preciso também `origem_id`, senão a segunda refeição do dia bateria na chave da primeira.
- Geração da agenda: `upsert … onConflict (user_id, origem, origem_id, data_origem), ignoreDuplicates`.
- `preferencias_agente` + `notif_treino BOOLEAN NOT NULL DEFAULT false`, `notif_refeicao BOOLEAN NOT NULL DEFAULT false`, `notif_suplemento BOOLEAN NOT NULL DEFAULT false`, `agenda_saude TEXT NOT NULL DEFAULT 'nao' CHECK IN ('nao','compromisso','lembrete')`. Tudo desligado por padrão (BRIEF §5).
- **`notificacoes_saude_enviadas`**: `user_id`, `tipo TEXT CHECK IN ('treino','refeicao','suplemento')`, `origem_id UUID`, `data DATE`, `canal TEXT DEFAULT 'push' CHECK IN ('push')`, `enviado_em`; UNIQUE(user_id, tipo, origem_id, data, canal). RLS só SELECT para o dono (escrita pelo cron com service role), igual a `lembretes_enviados`.

### 3.8 Modelo inicial (treino e dieta do Estevam) chegando às contas
- O modelo fica **em código**, como constante versionada (`packages/shared/src/constants/modelo-saude.ts`, `MODELO_SAUDE_V1`), com os exercícios e séries do BRIEF §3.3 e as 6 refeições do §3.4. Itens das refeições **sem valores nutricionais**: cada item só tem nome; na primeira edição a pessoa escolhe o alimento TACO e as gramas (o BRIEF não dá gramas; não invento).
- A migration **não insere dado de usuário**. Quem aplica o modelo é a própria pessoa, logada, pelo client da sessão (RLS), num botão "Usar o modelo de treino e dieta" na primeira visita ao módulo.
- Idempotência: `modelo_origem = 'modelo-estevam-v1'` + índices únicos parciais (3.1, 3.2). Clicar duas vezes ou abrir em duas abas não duplica.
- Conta que já tem treinos ou plano: o app **não aplica sozinho** e não mexe no que existe. Mostra a opção "adicionar o modelo" (entra com `ativo = false` para não bagunçar o dia de hoje) ou "começar do zero". Nenhum UPDATE/DELETE em linha antiga.
- **Terceira conta (a convidar), proposta para o Estevam aprovar:** ela cria a conta pelo cadastro normal (não muda o fluxo de convite), passa pelo onboarding de saúde, e no fim vê o mesmo botão do modelo, já marcado. Alternativa rejeitada: semear dentro do trigger `handle_new_user` (mexe em `auth.users`, roda com SECURITY DEFINER e é mais difícil de desfazer).

---

## 4. RLS

### 4.1 Regras para as tabelas novas
- Com `user_id`: `users_own_data FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)`; `notificacoes_saude_enviadas` só `FOR SELECT`.
- Referência entre tabelas do mesmo dono por **FK composta `(x_id, user_id)`** (padrão da 006): impede apontar para linha de outra pessoa mesmo que o UUID vaze.
- `alimentos_taco`: `FOR SELECT TO authenticated USING (true)`; sem política nem GRANT de escrita; `REVOKE ALL` de `anon`. Carga só pela migration/seed (dono do banco).
- Tabelas filhas sem `user_id` continuam por tabela pai (`exercicios` via `treinos`, `series_realizadas` via `sessoes_treino`, `itens_compras` via `listas_compras`).

### 4.2 Conferência das políticas atuais e buracos
A medição confirma RLS ligado nas 36 tabelas e 4 políticas em `exercicios`/`series_realizadas`/`sessoes_treino`/`treinos`. Lendo o baseline:

| # | Buraco | Efeito | Proposta |
|---|---|---|---|
| B1 | `sessoes_treino`: WITH CHECK só olha `user_id`, não se `treino_id` é de quem grava | A grava sessão apontando para treino de B (se souber o UUID). Pior: `ON DELETE CASCADE` faz **B apagar a sessão de A** ao excluir o treino dele | Na 008: trocar a política para exigir também `EXISTS (treino do mesmo user)` |
| B2 | `series_realizadas`: checa só a sessão, não o `exercicio_id` | A grava série com exercício de B; B apagando o exercício apaga o histórico de A em cascata | Na 008: exigir que o exercício pertença a um treino do mesmo user |
| B3 | `registros_habito.habito_id`, `registro_medicamentos.medicamento_id` | Mesmo tipo de B1 | Fora do módulo: listar e propor (pergunta P11), não mexer sem OK |
| B4 | `exercicios` e `series_realizadas` sem `user_id` | Cada leitura faz subconsulta na tabela pai | Aceitável no volume (3 contas). Não adicionar `user_id` (mudaria dado atual) |
| B5 | `delete-account/route.ts` tenta `.delete().eq('user_id')` em `exercicios`, `series_realizadas`, `itens_compras` (sem `user_id`) e ignora o erro | Não vaza nada: o `deleteUser` final apaga em cascata. Só ruído | Tabelas novas com `ON DELETE CASCADE`; na F2, conferir o retorno de erro ou tirar as três da lista |

Antes da F2, conferir as 4 políticas reais de `exercicios`/`series_realizadas`/`sessoes_treino`/`treinos` por consulta só leitura em `pg_policies` (texto `qual`/`with_check`), porque o baseline cria a política só se o banco não tiver outra equivalente.

### 4.3 Teste com duas contas (A e B)
Arquivo `packages/database/tests/008_saude_treino.sql`, rodando no `scripts/verify.sh db` (Postgres local + `supabase_stub.sql`, como 006/007). **Nunca no Supabase real.** Passos:
1. Como dono: cria A e B em `auth.users`/`profiles`.
2. `SET LOCAL ROLE authenticated` + `request.jwt.claim.sub = B`: B cria treino, exercício (com faixa e sem repetição), sessão, série, suplemento (Profit com creatina NULL), registro de suplemento, refeição, plano, `perfil_saude`, compromisso com origem, preferência.
3. Troca para A e, para **cada** tabela (novas e antigas do módulo):
   - `SELECT count(*)` = 0;
   - `UPDATE … WHERE id = <id de B>` afeta 0 linhas (`GET DIAGNOSTICS`);
   - `DELETE … WHERE id = <id de B>` afeta 0 linhas;
   - `INSERT` com `user_id = B` falha com `42501`;
   - `INSERT` de sessão com treino de B, de série com exercício de B e de registro com suplemento de B falham (B1/B2 e FK composta: `42501` ou `23503`).
4. Volta para B: todas as linhas de B continuam lá, com os mesmos valores (compara com um snapshot no início).
5. `anon` não lê nada; `alimentos_taco`: A lê; INSERT/UPDATE/DELETE de A falham.
6. `notificacoes_saude_enviadas`: A não insere; lê só as próprias.
7. Índices únicos: segundo upsert do mesmo compromisso/notificação/registro do Profit da refeição não cria linha.

---

## 5. Migrations

### 5.1 Número
Conferido: `git log --all` em todas as refs locais e remotas buscadas (inclui `feat/ia-f1-lancamento` e as branches do PR #27) **não tem nenhum arquivo `008*`**; `packages/database/migrations/` termina em `007_excluir_metas(.sql|_down.sql)`; a medição diz que não há 008 aplicada. Antes de criar o arquivo, repetir a busca depois de um `git fetch` (não fiz fetch: sem rede).

Proposta: **uma migration por fase**, cada uma com backup e OK próprios:
- `008_saude_treino` (F2), `009_saude_alimentacao` (F3), `010_saude_metas_agenda` (F4).
- Cada uma com `_down.sql` e com `tests/0NN_*.sql` no `verify.sh db`.
- Alternativa: tudo numa 008 só (um backup, um OK), com mais risco de uma vez. Pergunta P1.

### 5.2 008 — ida (descrita, não escrita)
1. `exercicios`: ADD `repeticoes_min`, `repeticoes_max`, `modelo_origem` (todas NULL) + os 2 CHECKs.
2. `treinos`: ADD `horario TIME NULL`, `modelo_origem TEXT NULL` + índice único parcial.
3. `series_realizadas`: ADD `observacao TEXT NULL`.
4. Políticas B1/B2: `DROP POLICY IF EXISTS` das políticas de INSERT/UPDATE de `sessoes_treino` e `series_realizadas` e `CREATE POLICY` com a checagem do pai. Só depois de conferir os nomes reais (4.2).
5. `preferencias_agente`: ADD `notif_treino`, `notif_refeicao`, `notif_suplemento` (DEFAULT false), `agenda_saude` (DEFAULT 'nao').
6. CREATE `notificacoes_saude_enviadas` + UNIQUE + RLS só SELECT + REVOKE/GRANT.
7. Tudo com `IF NOT EXISTS` / `to_regclass`, como 005–007, para poder rodar duas vezes sem erro.
8. Sem nenhum `UPDATE`/`DELETE` em linha existente. ADD COLUMN NULL sem default volátil é só metadado no Postgres (não reescreve a tabela).

### 5.3 008 — down (descrito)
Aviso no topo, como na 007: "Destrutivo, faça backup antes".
1. DROP `notificacoes_saude_enviadas`.
2. `preferencias_agente`: DROP das 4 colunas novas.
3. Políticas: volta exatamente às do baseline (mesmos nomes e expressões).
4. `series_realizadas`: DROP `observacao`; `treinos`: DROP índice, `horario`, `modelo_origem`; `exercicios`: DROP CHECKs, `repeticoes_min`, `repeticoes_max`, `modelo_origem`.
5. **Perde:** faixas digitadas, horários de treino, observações de série, preferências e o registro de notificações. **Não perde:** nenhuma coluna ou linha que existia antes da 008. Treinos criados pelo modelo continuam (são linhas comuns); apagá-los é decisão da pessoa no app.

### 5.4 009 e 010 (resumo; detalhar antes de cada fase)
- 009 ida: CREATE `alimentos_taco`, `plano_refeicoes`, `alimentos_usuario`, `receitas_favoritas`, `suplementos`, `registros_suplemento`, `perfil_saude`; ADD colunas em `refeicoes` (3.2). Down: DROP das tabelas novas e das colunas novas de `refeicoes`. A carga da TACO **não** fica na 009: vai num seed separado (seção 8), aplicado depois, também com OK.
- 010 ida: CREATE `metas_saude_historico`; ADD colunas em `compromissos` e `listas_compras` + índices únicos parciais. Down: DROP das colunas e índices (compromissos gerados viram compromissos comuns se o down rodar sem antes apagá-los: o down **não** apaga compromissos; pergunta P15).

### 5.5 Ordem de deploy
Como no README de Finanças: migration aplicada (com OK) **antes** do código que usa as colunas novas. O código da F2 trata coluna ausente com erro identificável e log sem dado de saúde (padrão da 006 em `carteiras.repository`).

---

## 6. Tamanho no banco (contra 500 MB)

**Medição atual:** 13 MB (14.085.267 bytes). Folga hoje: ~487 MB.

**Hipótese de tamanho por linha** (não medida; Postgres: ~24 B de cabeçalho + 4 B de ponteiro + colunas, mais entradas de índice): uso **500 B por linha já com índices** para linhas comuns e **2 KB por linha** para `refeicoes`/`plano_refeicoes` (JSONB com itens). É um teto largo de propósito. Na F2 medir de verdade com `pg_total_relation_size` (só leitura) e corrigir esta conta.

**Linhas por pessoa por dia (pior caso: tudo ligado):**
| Origem | Conta | Linhas/dia |
|---|---|---|
| `series_realizadas` | modelo = 14+14+14+13 = 55 séries/semana ÷ 7 | 7,9 |
| `sessoes_treino` | 4 treinos/semana ÷ 7 | 0,6 |
| `refeicoes` | 6 refeições | 6,0 |
| `registros_suplemento` | Profit + creatina | 2,0 |
| `registros_peso` | 1 por dia (máximo, UNIQUE) | 1,0 |
| `compromissos` gerados | 6 refeições + 4/7 treino | 6,6 |
| `notificacoes_saude_enviadas` | 6 refeições + 2 suplementos + 4/7 treino | 8,6 |
| `itens_compras` | ~30 itens/semana ÷ 7 (hipótese) | 4,3 |
| **Total** | | **≈ 37 linhas/dia** (31 comuns + 6 refeições) |

**Conta para 3 contas × 12 meses:**
- Linhas comuns: 31 × 3 × 365 = **33.945 linhas** × 500 B = **≈ 17,0 MB**
- Refeições: 6 × 3 × 365 = **6.570 linhas** × 2 KB = **≈ 13,1 MB**
- Tabelas pequenas (`perfil_saude`, `plano_refeicoes`, `suplementos`, `receitas_favoritas`, `alimentos_usuario`, `metas_saude_historico`, modelo de treino: ~200 linhas no total): **< 0,5 MB**
- TACO: 597 alimentos × ~400 B (nome + ~15–30 números) + PK ≈ **0,25 MB**; arredondo para **≤ 1 MB**. Busca por nome no navegador (lista baixada uma vez, ~60 KB), sem índice de texto
- **Subtotal ano 1 ≈ 31,6 MB.** Margem ×2 para inchaço (UPDATE/DELETE, MVCC, índices maiores que o previsto): **≈ 63 MB/ano**

**Resultado:** 13 MB + 63 MB = **≈ 76 MB no fim do ano 1, folga ≈ 424 MB (≈ 85% livre).** No mesmo ritmo, os 500 MB seriam atingidos em ~(500 − 13 − 1) ÷ 63 ≈ **7,7 anos**. O maior item é o registro de notificações e a agenda gerada; se apertar, dá para apagar registros de notificação com mais de 90 dias (proposta, não feita).

Gatilho de alerta proposto: medir `pg_database_size` a cada fase; se passar de 250 MB, rever.

---

## 7. Backup (plano; nada rodado)

O projeto é o mesmo da produção, no plano grátis. Não conto com backup automático baixável do painel (conferir no painel: pergunta P2). Plano para **cada** migration (008, 009, 010 e o seed da TACO):

1. **Quem roda:** o Estevam, na máquina dele, com a string de conexão dele. Nenhum segredo no chat, no plano ou em log.
2. **Como:** `supabase db dump` (Supabase CLI) em 3 arquivos: `roles.sql`, `schema.sql`, `data.sql` (`--data-only`), ou `pg_dump -Fc` da base inteira. Nome com data e hora: `backup-AAAAMMDD-HHMM-pre-008`.
3. **Prova de que o backup presta (verificável):**
   - `sha256sum` dos arquivos, anotado no `ENTREGA.md` da fase;
   - restaurar num Postgres local vazio (o mesmo do `verify.sh db`, ou `supabase start`) e rodar sem erro;
   - comparar a contagem de linhas por tabela `public` (`count(*)` em cada uma) entre produção (consulta só leitura antes do dump) e a cópia restaurada: tem de bater 100%;
   - comparar a lista de migrations (`list_migrations`) e de políticas (`pg_policies`) entre as duas.
4. Só com esses 3 itens conferidos o Estevam digita o OK, na hora. OK passado por agente não vale.
5. Guardar o backup fora do repo (não commitar: tem dado pessoal e de saúde).
6. Volta atrás: primeiro o `_down.sql`; se algo der muito errado, restaurar o dump.

---

## 8. TACO

**Fonte:** UNICAMP/NEPA. *Tabela Brasileira de Composição de Alimentos – TACO*. 4. ed. rev. e ampl. Campinas: NEPA-UNICAMP, 2011. Termo do PDF oficial: "É permitida a reprodução total ou parcial desta obra, desde que citada a fonte." Não há licença formal (anexo TACO §1). **Uso exige citar a fonte.** A TACO não é mais pendência; o que falta é o arquivo.

**Plano de importação:**
- **Etapa 0, obter o arquivo (falta fazer).** O Excel ainda não foi baixado. A página `https://nepa.unicamp.br/publicacoes/tabela-taco-excel/` carrega o link por script (o Research não achou o link direto). Proposta: o Estevam (ou um agente, com OK, num ambiente com rede) abre a página no navegador, baixa o Excel e anota URL final, data e `sha256`. Se o Excel não estiver disponível: usar o PDF oficial (`…/taco_4_edicao_ampliada_e_revisada.pdf`), com conferência manual maior. **PENDENTE.** O arquivo original fica fora do repo ou em `packages/database/seeds/taco/` com `FONTE.md` (URL, data, sha256, citação), decisão na P8.
- **Etapa 1, converter sem lib nova.** Exportar o Excel para CSV (LibreOffice/Excel) e ler o CSV com um script Node sem dependência (`scripts/taco/converter.mjs`). Evita adicionar `xlsx`. Regras do conversor:
  - cabeçalho conferido contra uma lista fixa de colunas esperadas; coluna faltando ou a mais → para com erro;
  - `"NA"`, `"Tr"`, `"*"` e célula vazia (depois de `trim`) → **NULL**;
  - número com vírgula → ponto; `0` continua `0` (zero real da tabela é diferente de sem valor);
  - qualquer outro texto em coluna numérica → **para e mostra linha e coluna** (não adivinha);
  - número de alimentos esperado: **597** (anexo); diferente disso → para.
- **Etapa 2, gerar o seed** `seeds/taco_4ed.sql`: `INSERT … ON CONFLICT (id) DO NOTHING`, gerado pelo script, revisado no PR.
- **Etapa 3, testar:** teste unitário do conversor (NA/Tr/*/vazio → null; "0" → 0; "1,5" → 1.5; texto estranho → erro; contagem); teste SQL de que `alimentos_taco` tem 597 linhas e nenhum 0 onde o CSV tinha NA/Tr/*/vazio; conferência manual de 5 alimentos do modelo contra o PDF, feita por pessoa (QA ou Estevam), sem copiar valor neste plano.
- **Etapa 4, aplicar** só com backup e OK do Estevam (Nível D), depois da 009.

**Onde a fonte aparece no app:**
- Selo "referência TACO" ao lado de cada valor que veio da TACO (some quando a pessoa edita).
- Rodapé da busca de alimentos e da tela de alimentação: "Valores de referência: TACO 4ª ed. (NEPA-UNICAMP, 2011)".
- Citação completa numa seção "Fontes" da página `privacidade` ou de uma página "Sobre" (decisão do designer), junto com Mifflin-St Jeor (1990), Iraki et al. (2019), Jäger et al./ISSN (2017) e FAO/WHO/UNU (2004), se esta última for a escolhida (seção 10).

---

## 9. Notificações e agenda

**Reuso de Finanças:** `push_subscriptions` (mesma inscrição do navegador), `createPushSender` (VAPID), `PushSender`/`PushPayload`, `paginas()` de `cron-pagination.ts`, `hojeSP()`, limpeza de inscrição em 404/410 e o padrão **reservar antes de enviar, liberar se falhar**. Rota nova `app/api/cron/lembretes-saude/route.ts` copiando a proteção por `CRON_SECRET` da rota atual. Serviço novo `lembretes-saude.service.ts` e repositório `notificacoes-saude-enviadas.repository.ts`.

**Liga/desliga por tipo:** `preferencias_agente.notif_treino | notif_refeicao | notif_suplemento`, todos `false` por padrão, na tela Configurações (bloco Notificações que já existe). O cron só lê quem tem o tipo ligado e tem inscrição push.

**Idempotência:** chave única `(user_id, tipo, origem_id, data, canal)` em `notificacoes_saude_enviadas`. Rodar o cron duas vezes, ou duas execuções ao mesmo tempo, manda uma notificação só. Teste: chamar o serviço 2× com o mesmo relógio fixo → 1 envio.

**Agenda:** geração por `upsert` com a chave da 3.7; abrir o app várias vezes não duplica. Teste: gerar 3× o mesmo dia → mesmo número de compromissos. Editar um compromisso gerado não é sobrescrito pela próxima geração (`ignoreDuplicates`). Apagar um gerado: proposta de não recriar no mesmo dia (marca `concluido`/flag; pergunta P15).

**Texto da notificação:** genérico, sem número de saúde ("Hora do treino de hoje", "Lembrete da refeição das 12h30"). O push passa por servidores de terceiros (Google/Apple/Mozilla); mesmo cifrado, o texto não leva peso, carga, calorias nem nome de suplemento.

**Problema de horário (risco alto):** o `vercel.json` tem um cron só por dia (`0 12 * * *`). Lembrete de refeição às 07h, 10h, 12h30… precisa de disparos várias vezes ao dia. No plano Vercel atual isso pode não ser possível (conferir o limite de cron do plano: P3). Opções a R$ 0:
- (a) GitHub Actions `schedule` a cada 15–30 min chamando a rota com `CRON_SECRET` (segredo no GitHub; atraso de alguns minutos é comum);
- (b) `pg_cron` + `pg_net` no Supabase chamando a rota (exige ligar extensões no banco de produção: Nível D);
- (c) só o lembrete do treino, uma vez por dia, no cron atual, e refeição/suplemento ficam só na agenda (sem push) até decidir.
Recomendo (a). Nada é criado sem OK.

---

## 10. Onboarding e metas calculadas

Fonte obrigatória: `research/ANEXO-ONBOARDING.md`. Tudo abaixo vem dele; o que ele não fecha está marcado PENDENTE.

### 10.1 Perguntas (cadastro inicial de saúde)
Do anexo §5.1 e do pedido: **peso (kg), altura (cm), idade (anos), sexo, nível de atividade, objetivo**. Mais duas que o anexo cita e a conta usa: **ritmo semanal** (em % do peso, dentro de 0,25–0,5%) e, proposta minha para escolher o teto de Iraki, **experiência de treino** (iniciante/intermediário ou avançado; P6). Peso-meta e prazo: só para mostrar progresso, não mudam as calorias (como o MyFitnessPal, anexo §1). Número de telas: decisão de design (anexo §6).
- Sexo: rótulo "Sexo (usado só na fórmula)", opções masculino/feminino, porque a equação só tem esses dois coeficientes. Opção "prefiro não informar" → o app não calcula e a pessoa digita as metas (origem "manual").
- Idade: pergunta em anos, guarda `ano_nascimento = ano atual − idade` (PII mínima: sem data de nascimento). Erro de até 1 ano ≈ 5 kcal na conta.

### 10.2 Cálculo (exatamente como no anexo)
1. **TMB, Mifflin-St Jeor versão simplificada** (Mifflin et al., Am J Clin Nutr 1990;51(2):241–247, PMID 2305711):
   - homens: `10 × peso(kg) + 6,25 × altura(cm) − 5 × idade(anos) + 5`
   - mulheres: `10 × peso(kg) + 6,25 × altura(cm) − 5 × idade(anos) − 161`
   - coeficientes numa constante com o PMID.
2. **Um único fator de atividade, que já inclui o treino** (anexo §5.3: escolher um modelo só; o MeuDia não soma calorias de exercício). O anexo **não fixa os números**; traz três conjuntos:
   - FAO/WHO/UNU 2004 (PAL = gasto total ÷ TMB, inclui toda a atividade): sedentário ou leve **1,40–1,69**; ativo ou moderado **1,70–1,99**; vigoroso **2,00–2,40** (tabela vista por resumo, confiança média);
   - Cronometer: TMB × (1 + 0,2 / 0,375 / 0,5 / 0,9) (no Cronometer é a atividade **sem** o exercício);
   - 1,2 / 1,375 / 1,55 / 1,725 / 1,9 (blog do MyFitnessPal, origem científica não verificada).
   - **Recomendação:** FAO/WHO/UNU 2004, porque é o único conjunto do anexo que já conta o treino junto (bate com "um fator só"), com 3 níveis. **PENDENTE (P4):** o Estevam escolhe o valor dentro de cada faixa. Proposta: a borda de baixo, que é valor exato do anexo (1,40 / 1,70 / 2,00), por ser a mais conservadora. Até o OK, o código não sai.
   - Manutenção = TMB × fator.
3. **Objetivo:**
   - manter: meta = manutenção;
   - ganhar: Iraki 2019 (anexo TACO §2): **+10–20% acima da manutenção** para iniciante/intermediário, **+5–10%** para avançado. PENDENTE (P5): qual ponto da faixa (proposta: a borda de baixo, +10% / +5%);
   - perder: **o anexo não traz número de déficit** ("energia por kg: valor não verificado aqui, não inventar"). PENDENTE: até o Research trazer fonte, "perder" mostra só a manutenção calculada e pede que a pessoa digite a meta (origem "manual"). Alternativa: tirar "perder" da lista (P7).
   - O anexo §5.4 também sugere usar a meta fixa do BRIEF para o Estevam e ajustar pela tendência de peso: ver 10.5.
4. **Ritmo de ganho:** `GANHO_SEMANAL_MIN_PCT = 0.25`, `GANHO_SEMANAL_MAX_PCT = 0.5` (avançado: 0,25), só para o aviso de meta realista (3.4). Não entra na conta de calorias (o anexo não dá kcal por kg).
5. **Proteína:** `meta_proteina_calculada_g = arredonda(peso × proteina_g_kg)`, com `proteina_g_kg` padrão **1,8**, editável **entre 1,4 e 2,2** (anexo §5.5; ISSN 2017 dá 1,4–2,0, Iraki 1,6–2,2). A tela mostra "≈ X g/kg".
6. **Aviso de estimativa** (texto do anexo §5.6): "Estimativa baseada em médias (fórmula Mifflin-St Jeor). Seu corpo pode gastar mais ou menos. O app ajusta pela sua tendência de peso. Não é orientação médica." Observação: "o app ajusta pela tendência" só pode ficar se esse ajuste existir; hoje ele não está no escopo. Proposta: tirar essa frase até existir (P10).
7. **Casos de teste** (aritmética da fórmula; o fator e o objetivo entram depois do OK):
   - homem, 70 kg, 175 cm, 30 anos: 700 + 1.093,75 − 150 + 5 = **1.648,75 kcal** de TMB;
   - mulher, 60 kg, 165 cm, 25 anos: 600 + 1.031,25 − 125 − 161 = **1.345,25 kcal**;
   - proteína 66,5 kg × 1,8 = 119,7 → **120 g**; limites 1,4 e 2,2 aceitos, 1,3 e 2,3 recusados;
   - "prefiro não informar" → sem meta calculada.

### 10.3 Onde os dados ficam
- Tabela **`perfil_saude`** (3.6), 1 linha por pessoa, PK = `user_id`, `ON DELETE CASCADE`, RLS `users_own_data` com REVOKE/GRANT da 007. Peso atual: último `registros_peso`.
- Por que não em `profiles`: `profiles` é lido em toda tela (`useAuth`/`profileKey`), entra no cache do navegador e no "Baixar meus dados". Separar deixa sexo, idade e metas de saúde só onde são usados e facilita exportar e apagar só isso. Custo: uma tabela a mais. Alternativa (P16): colunas novas em `profiles`.
- **PII mínima:** sem data de nascimento (só ano), sem nome nem e-mail na tabela, sem campo livre de saúde, sem medidas além do peso. `consentimento_saude_em` registra o aceite.
- `profiles.peso_atual/altura/meta_peso/meta_calorias/objetivo` **não são apagados nem alterados**. Só são lidos para preencher o formulário de quem já tem conta.

### 10.4 Onde e como o cálculo roda
- Função pura em `packages/shared/src/utils/metas-saude.ts` (`calcularTmb`, `calcularMetas`), sem rede e sem banco, com testes unitários dos casos acima.
- Roda **no navegador**, no onboarding (mostra a meta antes de salvar) e quando o peso ou as respostas mudam. Grava pelo client da sessão (RLS). Nada vai para servidor de IA. Nenhum log com os valores.
- `formula_versao` (ex.: `mifflin1990-fao2004-v1`) guarda qual regra gerou o número, para trocar o fator depois sem confundir.

### 10.5 Meta editada à mão (o cálculo não sobrescreve)
- Ao recalcular, o app **sempre** atualiza `meta_kcal_calculada` e `meta_proteina_calculada_g`.
- Só copia para `meta_kcal`/`meta_proteina_*` quando a origem é `'calculada'`.
- Se a pessoa edita, a origem vira `'manual'` e o recálculo nunca mais mexe na meta vigente. A tela mostra "definida por você" e, ao lado, "calculada: X kcal" com o botão "usar a calculada" (volta a origem para `'calculada'`).
- Cada mudança da meta vigente grava uma linha em `metas_saude_historico`.
- **Estevam:** o BRIEF fixa 2.950 kcal e 120–140 g. Entram como **`'manual'`** (são metas dele). Idade e sexo dele não estão no BRIEF: a calculada só aparece se ele responder.
- Teste: origem manual + mudança de peso → meta vigente igual, calculada muda.

### 10.6 Contas que já existem
- Elas já têm `onboarding_feito = true` (modo Finanças) e não voltam para `/onboarding` (regra do `AGENTS.md`, `onboarding-loop.spec.ts`). Nada muda nesse fluxo.
- O onboarding de saúde é **próprio do módulo**: na primeira visita a `/saude` sem `perfil_saude`, aparece "Complete seu perfil de saúde", com peso/altura/meta já preenchidos de `profiles` e do último `registros_peso`. "Agora não" deixa usar o módulo sem metas calculadas.
- Conta nova: o mesmo passo de saúde no fim do onboarding atual, **com "Pular"** e com o mesmo `comTempoLimite` (regra do "Pular" nunca preso).
- Nenhum dado atual é apagado ou alterado.

### 10.7 Impacto no limite de 500 MB
`perfil_saude`: 1 linha por pessoa (~0,5 KB com índice) → 3 contas ≈ **1,5 KB**. `metas_saude_historico`: poucas linhas por ano (≈ 12 por pessoa no pior caso) → **< 20 KB/ano**. Impacto: desprezível (< 0,01% de 500 MB).

---

## 11. LGPD

- Peso, alimentação, suplementos, treino, sexo e idade da fórmula são dado pessoal; os de saúde são **dado sensível**. Proposta: consentimento explícito e específico no passo de saúde ("Uso seus dados de saúde só para calcular e mostrar suas metas neste app"), gravado em `consentimento_saude_em`. Sem aceite, não grava `perfil_saude`.
- **Sem dado de saúde em log:** logs só com motivo e ids (padrão `logFallback` da IA). Teste nos moldes de `ia-chat.test.ts`: varre os logs da rota/serviço novo e falha se aparecer peso, kcal, carga ou nome de alimento/suplemento.
- **IA:** nada do módulo vai para `/api/ia/chat`/Gemini nesta entrega (recomendação por IA é fora de escopo). Conferir na F2 que `ContextoUsuario` do agente não passa a levar dados de saúde no modo Finanças (P17).
- **Exclusão:** todas as tabelas novas com `ON DELETE CASCADE` a partir de `profiles`; "Excluir conta" apaga tudo. Exclusão de cada registro pelo app (BRIEF §3.10), com `ConfirmarExclusao`.
- **Exportar:** hoje "Baixar meus dados" exporta Finanças. Proposta: incluir os dados de saúde num arquivo separado, só do dono (mesmas regras da rota atual). Pergunta P18.
- **Página `privacidade`: precisa mudar.** Hoje cita só "treinos". Incluir: quais dados de saúde são guardados, para quê (metas e acompanhamento), que não vão para IA nem terceiros, que notificação não leva dado de saúde, como excluir, e a seção de fontes (TACO etc.). Data de atualização nova.
- Push: texto genérico (seção 9).

---

## 12. Fases F2–F4

### F2 — treino e notificação de treino (008)
**Arquivos:** `packages/database/migrations/008_saude_treino(.sql|_down.sql)`, `packages/database/tests/008_saude_treino.sql`, `scripts/verify.sh` (linha do teste novo); `packages/shared/src/types/treino.ts`, `constants/modelo-saude.ts`, `utils/repeticoes.ts`; `packages/api/src/repositories/exercicio.repository.ts` e `sessao.repository.ts` (mapeadores C3/C4), `treino.repository.ts`, `preferencias-agente.repository.ts`, `notificacoes-saude-enviadas.repository.ts` (novo); `services/treino.service.ts`, `lembretes-saude.service.ts` (novo); `validators/treino.validator.ts`; `apps/web/lib/app-mode.ts`, `lib/navegacao.ts`, `lib/agente-modo.ts`, `app/(dashboard)/treinos/page.tsx`, `components/modules/ExercicioCard.tsx`, `AddExercicioModal.tsx`, `app/api/cron/lembretes-saude/route.ts`, `configuracoes` (toggles); `e2e/mock-supabase/server.mjs` (tabelas novas); `AGENTS.md` (regras C6 e novas).
**Testes (BRIEF §4):** RLS duas contas (4.3); faixa de repetições (8–12, fixo, sem repetição, CHECK min ≤ max); mapeadores C3/C4 (teste que falha sem a correção); modelo aplicado 2× = 1 vez; notificação 2× = 1 envio, só tipo ligado; E2E mock: treino do dia, registrar carga, histórico por exercício; `modo-runtime`/`abas` ajustados para o módulo visível no modo Finanças.
**Riscos:** C3/C4 já quebrados em produção; mudar o modo Finanças mexe em BottomNav de 5 abas fixas (o módulo vai no Drawer? decisão do designer); cron (seção 9).

### F3 — alimentação TACO, suplementos, onboarding e notificações (009 + seed TACO)
**Arquivos:** migration 009 + down + teste; `seeds/taco_4ed.sql`, `scripts/taco/converter.mjs` + teste; `packages/shared` (`types/dieta.ts` com nutriente `number | null`, `utils/nutricao.ts`, `utils/creatina.ts`, `utils/metas-saude.ts`, `constants/saude.ts`); `packages/api` (`dieta.repository/service`, `suplementos.*`, `perfil-saude.*`, `alimentos-taco.repository.ts`); `apps/web/app/(dashboard)/dieta/page.tsx`, componentes de busca TACO/selo/suplemento, onboarding de saúde (`/saude`), `app/onboarding/StepPerfil.tsx` (C5), `app/privacidade/page.tsx`.
**Testes:** NA/Tr/*/vazio = null e total parcial; creatina sem dobra (Profit pela refeição + avulsa = soma única; Profit vazio → aviso); metas calculadas pelos casos 10.2; edição manual preservada; RLS das tabelas novas; logs sem dado de saúde.
**Riscos:** Excel da TACO não obtido; fator de atividade/superávit pendentes (P4/P5); `ItemRefeicao.calorias` hoje obrigatório (tipo muda para aceitar null, cuidar das telas antigas).

### F4 — peso, metas, compras e agenda (010)
**Arquivos:** migration 010 + down + teste; `packages/shared/utils/peso.ts` (médias 7/30/90, semanal, meta realista), `utils/metas-dia.ts`; `packages/api` (`compromisso.*`, `compras.*`, `metas-saude-historico.*`); `apps/web/app/(dashboard)/saude/` (painel com recharts), `agenda/page.tsx`, `compras/page.tsx`.
**Testes:** médias batem com dados de teste; meta realista (66,5 → 75 em 1 e 3 meses = não; ~26 semanas no teto = sim); dias com 100% somam certo e usam a meta vigente na data; agenda 3× = sem duplicar; lista gerada 2× = uma; cópia da semana anterior; total só com preços preenchidos.
**Riscos:** agenda gerada x editada pela pessoa (P15); volume de notificações.

**Fim da F4:** auditoria de segurança §28 e portão dual §11.1 (`POLITICA-OPERACIONAL.md`, não lido nesta tarefa).

---

## 13. Cortes propostos (nada foi cortado) e perguntas

### 13.1 Cortes propostos (só proposta; tudo segue no escopo até o OK do Estevam)
1. **`receitas_favoritas`:** "duplicar refeição" já cobre boa parte. Economiza uma tabela e uma tela.
2. **`metas_saude_historico`:** sem ela, "dias de meta cumprida" usa a meta de hoje para o passado. Mais simples, menos exato.
3. **Descanso real por série:** só o descanso planejado (já existe).
4. **Composição completa do suplemento:** guardar só creatina e kcal/proteína do rótulo.
5. **Push de refeição** (6 por dia): manter só na agenda; push só de treino e suplemento. Resolve o problema do cron e reduz a tabela de envio (o maior item da conta de tamanho).
6. **`alimentos_usuario`:** usar só item manual dentro da refeição, sem cadastro reaproveitável.
7. **Pergunta de experiência de treino:** usar sempre a faixa iniciante/intermediário.

### 13.2 Perguntas para o Estevam
- **P1.** Uma migration por fase (008/009/010, três backups e três OKs) ou uma 008 só?
- **P2.** O painel do Supabase mostra backup automático baixável neste plano? (Muda só a segurança extra; o dump manual da seção 7 vale de qualquer jeito.)
- **P3.** Qual o limite de cron do plano Vercel atual? Aceita GitHub Actions a cada 15–30 min para os lembretes (opção a)?
- **P4.** Fator de atividade: FAO/WHO/UNU 2004 com 1,40 / 1,70 / 2,00 (borda de baixo de cada faixa)? Ou outro valor/conjunto do anexo?
- **P5.** Superávit para "ganhar": +10% (iniciante/intermediário) e +5% (avançado), borda de baixo de Iraki? Ou outro ponto da faixa?
- **P6.** Pode perguntar a experiência de treino no onboarding?
- **P7.** "Perder peso": deixar só com meta manual até o Research trazer fonte, ou tirar a opção?
- **P8.** O arquivo original da TACO pode ficar no repo (com `FONTE.md` e sha256) ou só o seed gerado?
- **P9.** Guardar quais nutrientes eram "Tr" (traços), para a tela dizer "traços" em vez de "sem valor"? O valor continua nulo.
- **P10.** Tirar "O app ajusta pela sua tendência de peso" do aviso até esse ajuste existir?
- **P11.** Corrigir também os buracos B3 (hábitos e medicamentos) agora, ou deixar para depois?
- **P12.** Tirar a conta antiga de calorias do `StepPerfil` (C5) e usar a nova?
- **P13.** Refeições: mapear os 6 horários nos 6 `tipo` atuais com nome próprio (3.2), ou afrouxar o CHECK de `tipo`?
- **P14.** Preço na lista de compras é do item inteiro ou por unidade?
- **P15.** Compromisso gerado que a pessoa apagou: o app recria no dia seguinte (sim) e no mesmo dia (proposta: não)? E o down da 010 deve apagar os compromissos gerados?
- **P16.** `perfil_saude` separado (recomendado) ou colunas novas em `profiles`?
- **P17.** O chat/IA continua sem acesso a dados de saúde (recomendado)?
- **P18.** "Baixar meus dados" passa a incluir os dados de saúde?
- **P19.** Idade e sexo do Estevam: ele quer responder o onboarding para ver a meta calculada ao lado dos 2.950 kcal manuais?
- **P20.** Conta que já tem treinos: "adicionar o modelo" desativado ou não oferecer nada?
- **P21.** Terceira conta: aprova o fluxo da 3.8 (cadastro normal → onboarding de saúde → botão do modelo já marcado)?
- **P22.** Antes da F2, autoriza uma consulta só leitura no catálogo (`information_schema.columns` de `exercicios`/`series_realizadas` e `pg_policies`) para confirmar C3, C4 e os nomes das políticas?

**PENDENTES fechados nesta F1:** ritmo de ganho (em %, Iraki 2019); TACO (fonte e regra de nulo). **PENDENTES abertos:** arquivo da TACO (Etapa 0), P4, P5, P7, nomes das colunas da TACO, dose da creatina e composição do Profit (vazias até o rótulo), idade/sexo do Estevam.

---
**Parar aqui.** Nada de código antes do OK do Estevam a este plano, nas palavras dele.

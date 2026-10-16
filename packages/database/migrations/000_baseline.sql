-- ============================================================================
-- MeuDia — Migration 000: Baseline IDEMPOTENTE
-- ============================================================================
-- Data: 2026-10-15
-- Objetivo: recriar, de forma segura para reexecução, o estado descrito por
--   schema.sql/001 (SQL inline equivalente) + 002 + 003 + 004.
--   - Tabelas/índices: CREATE ... IF NOT EXISTS
--   - Policies/trigger: DO blocks que checam pg_policies/pg_trigger antes de criar
--   - Funções: CREATE OR REPLACE
--   - Nada é dropado, renomeado ou alterado se já existir.
--
-- NÃO APLICADO EM NENHUM BANCO. Validar primeiro em banco local/descartável
-- (ticket BE-00 em docs/financas/TICKETS.md).
--
-- Depende de Supabase: auth.users, auth.uid(), schema "extensions".
-- ============================================================================
--
-- GAPS ENCONTRADOS
-- ----------------------------------------------------------------------------
-- GAP-01  [RESOLVIDO] 001_initial_schema.sql usava `\i ../schema.sql`
--         (meta-comando do psql, não roda no SQL Editor/CLI). Agora o SQL está
--         inline no 001. Este arquivo também inclui todas as tabelas inline.
--
-- GAP-02  [RESOLVIDO] Nomes de tabela divergentes entre schema.sql, 004 e código.
--         Mapa CANÔNICO (aplicado em schema.sql, 001, 004, seeds, queries e código):
--
--         canônico               | variantes descartadas
--         -----------------------+-------------------------------------------
--         registros_agua (banco) | registro_agua
--         registros_habito       | registro_habitos
--         registro_medicamentos  | registros_medicamento
--         itens_compras          | itens_compra
--         scores_diarios         | scores
--         conquistas             | badges
--
--         Sem RENAME: só CREATE TABLE IF NOT EXISTS com os nomes canônicos.
--         Pendente: conferir no banco se as colunas de registros_agua batem
--         com a definição abaixo (CREATE IF NOT EXISTS não altera tabela viva).
--
-- GAP-03  schema.sql repete as tabelas do agente (002), mas sem índices, sem
--         ENABLE RLS e sem policies -> rodar só o schema.sql deixa essas
--         tabelas sem RLS. Aqui vale a versão do 002 (com RLS).
--
-- GAP-04  003 (notas): FK para auth.users (as demais apontam para profiles),
--         default extensions.uuid_generate_v4() (as demais usam
--         gen_random_uuid()), coluna updated_at sem trigger de atualização,
--         policies por comando com nomes próprios (não users_own_data).
--
-- GAP-05  004 cria policies "Users can insert own <tabela>" (FOR INSERT), que
--         são redundantes com users_own_data FOR ALL (USING vale como
--         WITH CHECK). [RESOLVIDO] 004 agora usa os nomes canônicos. Aqui cada
--         policy só é criada se a tabela (e a coluna) existirem.
--
-- GAP-06  [RESOLVIDO] Sem tabelas alternativas: RLS e users_own_data são
--         aplicados a todas as tabelas canônicas.
--
-- GAP-07  handle_new_user(): SECURITY DEFINER sem `SET search_path`
--         (o advisor do Supabase acusa). Mantido igual ao schema.sql. Atenção:
--         CREATE OR REPLACE sobrescreve o corpo da função se ela já existir no
--         banco com outra definição.
--
-- GAP-08  Policies que já existem com o mesmo nome NÃO são alteradas, mesmo que
--         a definição no banco seja outra. Comparar com pg_policies depois.
--
-- GAP-09  003 e 004 não têm arquivo _down. Este baseline também não tem
--         (intencional: ele não destrói nada).
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;

-- ══════════════════════════════════════════════════════════════════════════════
-- PERFIL
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.profiles (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome            TEXT NOT NULL,
  email           TEXT NOT NULL,
  avatar_url      TEXT,
  peso_atual      DECIMAL(5,2),
  altura          DECIMAL(5,2),
  meta_peso       DECIMAL(5,2),
  meta_calorias   INTEGER DEFAULT 2200,
  meta_agua       INTEGER DEFAULT 8,
  objetivo        TEXT CHECK (objetivo IN ('saude_geral','emagrecer','ganhar_massa','condicionamento')),
  onboarding_feito BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════════════════════════
-- TREINOS
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.treinos (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  nome        TEXT NOT NULL,
  dia_semana  INTEGER NOT NULL CHECK (dia_semana BETWEEN 0 AND 6),
  tipo        TEXT CHECK (tipo IN ('musculacao','cardio','funcional','descanso')),
  observacao  TEXT,
  ordem       INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.exercicios (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  treino_id       UUID NOT NULL REFERENCES public.treinos(id) ON DELETE CASCADE,
  nome            TEXT NOT NULL,
  series          INTEGER NOT NULL DEFAULT 3,
  repeticoes      TEXT NOT NULL DEFAULT '10-12',
  carga           DECIMAL(6,2),
  tempo_descanso  INTEGER DEFAULT 60,
  observacao      TEXT,
  ordem           INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.sessoes_treino (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  treino_id       UUID REFERENCES public.treinos(id),
  data            DATE NOT NULL DEFAULT CURRENT_DATE,
  duracao_minutos INTEGER,
  concluido       BOOLEAN DEFAULT FALSE,
  observacao      TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.series_realizadas (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sessao_id    UUID NOT NULL REFERENCES public.sessoes_treino(id) ON DELETE CASCADE,
  exercicio_id UUID NOT NULL REFERENCES public.exercicios(id),
  numero_serie INTEGER NOT NULL,
  carga_usada  DECIMAL(6,2),
  reps_feitas  INTEGER,
  concluido    BOOLEAN DEFAULT FALSE
);

-- ══════════════════════════════════════════════════════════════════════════════
-- HÁBITOS
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.habitos (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  nome        TEXT NOT NULL,
  icone       TEXT NOT NULL DEFAULT '✅',
  frequencia  TEXT CHECK (frequencia IN ('diario','semanal')) DEFAULT 'diario',
  dias_semana INTEGER[] DEFAULT '{0,1,2,3,4,5,6}',
  meta        INTEGER DEFAULT 1,
  ordem       INTEGER DEFAULT 0,
  ativo       BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.registros_habito (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  habito_id  UUID NOT NULL REFERENCES public.habitos(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  data       DATE NOT NULL DEFAULT CURRENT_DATE,
  concluido  BOOLEAN DEFAULT FALSE,
  valor      INTEGER DEFAULT 1,
  UNIQUE(habito_id, data)
);

-- ══════════════════════════════════════════════════════════════════════════════
-- FINANÇAS
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.transacoes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tipo        TEXT CHECK (tipo IN ('receita','despesa')) NOT NULL,
  categoria   TEXT NOT NULL,
  descricao   TEXT NOT NULL,
  valor       DECIMAL(10,2) NOT NULL,
  data        DATE NOT NULL DEFAULT CURRENT_DATE,
  banco       TEXT,
  automatico  BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.assinaturas (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  nome             TEXT NOT NULL,
  valor            DECIMAL(10,2) NOT NULL,
  dia_vencimento   INTEGER NOT NULL CHECK (dia_vencimento BETWEEN 1 AND 31),
  icone            TEXT DEFAULT '💳',
  cor              TEXT DEFAULT '#7c6aff',
  ativo            BOOLEAN DEFAULT TRUE,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════════════════════════
-- AGENDA
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.compromissos (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  titulo      TEXT NOT NULL,
  descricao   TEXT,
  data_inicio TIMESTAMPTZ NOT NULL,
  data_fim    TIMESTAMPTZ,
  local       TEXT,
  tipo        TEXT DEFAULT 'geral',
  prioridade  TEXT CHECK (prioridade IN ('baixa','media','alta','urgente')) DEFAULT 'media',
  concluido   BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════════════════════════
-- SAÚDE / DIETA
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.registros_peso (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  peso        DECIMAL(5,2) NOT NULL,
  data        DATE NOT NULL DEFAULT CURRENT_DATE,
  observacao  TEXT,
  UNIQUE(user_id, data)
);

CREATE TABLE IF NOT EXISTS public.refeicoes (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tipo             TEXT CHECK (tipo IN ('cafe','lanche_manha','almoco','lanche_tarde','jantar','ceia')) NOT NULL,
  data             DATE NOT NULL DEFAULT CURRENT_DATE,
  items            JSONB NOT NULL DEFAULT '[]',
  total_calorias   INTEGER DEFAULT 0,
  total_proteina   DECIMAL(6,2) DEFAULT 0,
  total_carbo      DECIMAL(6,2) DEFAULT 0,
  total_gordura    DECIMAL(6,2) DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.registros_agua (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  data          DATE NOT NULL DEFAULT CURRENT_DATE,
  copos_bebidos INTEGER DEFAULT 0,
  meta_copos    INTEGER DEFAULT 8,
  UNIQUE(user_id, data)
);

-- ══════════════════════════════════════════════════════════════════════════════
-- MEDICAMENTOS
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.medicamentos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  nome            TEXT NOT NULL,
  dosagem         TEXT NOT NULL,
  frequencia      TEXT NOT NULL,
  horarios        TIME[] NOT NULL,
  estoque_atual   INTEGER DEFAULT 0,
  estoque_minimo  INTEGER DEFAULT 5,
  ativo           BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.registro_medicamentos (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  medicamento_id UUID NOT NULL REFERENCES public.medicamentos(id) ON DELETE CASCADE,
  user_id        UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  data_hora      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  tomado         BOOLEAN DEFAULT FALSE
);

-- ══════════════════════════════════════════════════════════════════════════════
-- COMPRAS
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.listas_compras (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  nome       TEXT NOT NULL DEFAULT 'Lista de Compras',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.itens_compras (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lista_id        UUID NOT NULL REFERENCES public.listas_compras(id) ON DELETE CASCADE,
  nome            TEXT NOT NULL,
  quantidade      DECIMAL(8,2) DEFAULT 1,
  unidade         TEXT DEFAULT 'un',
  categoria       TEXT,
  comprado        BOOLEAN DEFAULT FALSE,
  preco_estimado  DECIMAL(10,2)
);

-- ══════════════════════════════════════════════════════════════════════════════
-- VEÍCULO
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.veiculos (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  modelo     TEXT NOT NULL,
  placa      TEXT,
  ano        INTEGER,
  km_atual   INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.manutencoes (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  veiculo_id          UUID NOT NULL REFERENCES public.veiculos(id) ON DELETE CASCADE,
  tipo                TEXT NOT NULL,
  data                DATE NOT NULL,
  km_na_revisao       INTEGER,
  custo               DECIMAL(10,2),
  proxima_revisao_km  INTEGER,
  observacao          TEXT
);

-- ══════════════════════════════════════════════════════════════════════════════
-- GAMIFICAÇÃO
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.scores_diarios (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  data                DATE NOT NULL DEFAULT CURRENT_DATE,
  score               INTEGER DEFAULT 0 CHECK (score BETWEEN 0 AND 100),
  pts_treino          INTEGER DEFAULT 0,
  pts_habitos         INTEGER DEFAULT 0,
  pts_agua            INTEGER DEFAULT 0,
  pts_calorias        INTEGER DEFAULT 0,
  pts_medicamentos    INTEGER DEFAULT 0,
  UNIQUE(user_id, data)
);

CREATE TABLE IF NOT EXISTS public.conquistas (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tipo           TEXT NOT NULL,
  titulo         TEXT NOT NULL,
  descricao      TEXT,
  icone          TEXT DEFAULT '🏆',
  conquistado_em TIMESTAMPTZ DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════════════════════════
-- AGENTE IA (002)
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.notificacoes_agente (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tipo        TEXT CHECK (tipo IN ('alerta','aviso','sucesso','info')) NOT NULL,
  titulo      TEXT NOT NULL,
  mensagem    TEXT NOT NULL,
  modulo      TEXT NOT NULL,
  lida        BOOLEAN DEFAULT FALSE,
  dispensada  BOOLEAN DEFAULT FALSE,
  acoes       JSONB DEFAULT '[]',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.chat_agente (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role        TEXT CHECK (role IN ('user','agent')) NOT NULL,
  conteudo    TEXT NOT NULL,
  intencao    TEXT,
  acoes       JSONB DEFAULT '[]',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.acoes_agente (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tipo        TEXT NOT NULL,
  payload     JSONB NOT NULL,
  status      TEXT CHECK (status IN ('pendente','executada','falhou')) DEFAULT 'pendente',
  resultado   JSONB,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.preferencias_agente (
  user_id               UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  notif_faltou_treino   BOOLEAN DEFAULT TRUE,
  notif_habito_pendente BOOLEAN DEFAULT TRUE,
  horario_verificacao   TIME DEFAULT '20:00',
  timer_descanso_auto   BOOLEAN DEFAULT TRUE,
  sugestao_carga_auto   BOOLEAN DEFAULT TRUE,
  chat_ativo            BOOLEAN DEFAULT TRUE,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════════════════════════
-- NOTAS (003)
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.notas (
  id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL DEFAULT '',
  conteudo TEXT NOT NULL DEFAULT '',
  tags TEXT[] DEFAULT '{}',
  cor TEXT DEFAULT 'default',
  fixada BOOLEAN DEFAULT false,
  checklist JSONB DEFAULT '[]',
  lembrete TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ══════════════════════════════════════════════════════════════════════════════
-- ÍNDICES
-- ══════════════════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_treinos_user          ON public.treinos(user_id);
CREATE INDEX IF NOT EXISTS idx_exercicios_treino     ON public.exercicios(treino_id);
CREATE INDEX IF NOT EXISTS idx_sessoes_user_data     ON public.sessoes_treino(user_id, data);
CREATE INDEX IF NOT EXISTS idx_habitos_user          ON public.habitos(user_id);
CREATE INDEX IF NOT EXISTS idx_reg_hab_user_data     ON public.registros_habito(user_id, data);
CREATE INDEX IF NOT EXISTS idx_transacoes_user_data  ON public.transacoes(user_id, data);
CREATE INDEX IF NOT EXISTS idx_refeicoes_user_data   ON public.refeicoes(user_id, data);
CREATE INDEX IF NOT EXISTS idx_compromissos_user     ON public.compromissos(user_id, data_inicio);
CREATE INDEX IF NOT EXISTS idx_scores_user_data      ON public.scores_diarios(user_id, data);
CREATE INDEX IF NOT EXISTS idx_series_sessao         ON public.series_realizadas(sessao_id);
CREATE INDEX IF NOT EXISTS idx_reg_med_user          ON public.registro_medicamentos(user_id, data_hora);
CREATE INDEX IF NOT EXISTS idx_medicamentos_user     ON public.medicamentos(user_id);
CREATE INDEX IF NOT EXISTS idx_veiculos_user         ON public.veiculos(user_id);
CREATE INDEX IF NOT EXISTS idx_listas_compras_user   ON public.listas_compras(user_id);
CREATE INDEX IF NOT EXISTS idx_itens_lista           ON public.itens_compras(lista_id);
CREATE INDEX IF NOT EXISTS idx_assinaturas_user      ON public.assinaturas(user_id);
CREATE INDEX IF NOT EXISTS idx_conquistas_user       ON public.conquistas(user_id);
CREATE INDEX IF NOT EXISTS idx_registros_peso_user   ON public.registros_peso(user_id, data);
CREATE INDEX IF NOT EXISTS idx_registros_agua_user   ON public.registros_agua(user_id, data);

-- 002
CREATE INDEX IF NOT EXISTS idx_notif_user_lida       ON public.notificacoes_agente(user_id, lida);
CREATE INDEX IF NOT EXISTS idx_notif_user_created    ON public.notificacoes_agente(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_chat_user_created     ON public.chat_agente(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_acoes_user_status     ON public.acoes_agente(user_id, status);

-- 003
CREATE INDEX IF NOT EXISTS idx_notas_user_id         ON public.notas(user_id);
CREATE INDEX IF NOT EXISTS idx_notas_fixada          ON public.notas(user_id, fixada);

-- ══════════════════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ══════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'profiles', 'treinos', 'exercicios', 'sessoes_treino', 'series_realizadas',
    'habitos', 'registros_habito', 'transacoes', 'assinaturas', 'compromissos',
    'registros_peso', 'refeicoes', 'registros_agua', 'medicamentos',
    'registro_medicamentos', 'listas_compras', 'itens_compras', 'veiculos',
    'manutencoes', 'scores_diarios', 'conquistas',
    'notificacoes_agente', 'chat_agente', 'acoes_agente', 'preferencias_agente',
    'notas'
  ] LOOP
    IF to_regclass(format('public.%I', t)) IS NULL THEN
      RAISE NOTICE '[baseline] public.% ausente — ENABLE RLS pulado', t;
    ELSE
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    END IF;
  END LOOP;
END $$;

-- ══════════════════════════════════════════════════════════════════════════════
-- RLS POLICIES
-- ══════════════════════════════════════════════════════════════════════════════

-- profiles: users_own_profile (schema.sql)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'users_own_profile'
  ) THEN
    CREATE POLICY "users_own_profile" ON public.profiles
      FOR ALL USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
  END IF;
END $$;

-- users_own_data em tabelas com user_id direto (schema.sql + 002)
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'treinos', 'sessoes_treino', 'habitos', 'registros_habito', 'transacoes',
    'assinaturas', 'compromissos', 'registros_peso', 'refeicoes', 'registros_agua',
    'medicamentos', 'registro_medicamentos', 'listas_compras', 'veiculos',
    'scores_diarios', 'conquistas',
    'notificacoes_agente', 'chat_agente', 'acoes_agente', 'preferencias_agente'
  ] LOOP
    IF to_regclass(format('public.%I', t)) IS NULL THEN
      RAISE NOTICE '[baseline] public.% ausente — policy users_own_data pulada', t;
    ELSIF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = t AND policyname = 'users_own_data'
    ) THEN
      EXECUTE format(
        'CREATE POLICY "users_own_data" ON public.%I FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)',
        t
      );
    END IF;
  END LOOP;
END $$;

-- Tabelas filhas (acesso via tabela pai) — schema.sql
DO $$
DECLARE
  p TEXT[];
BEGIN
  FOREACH p SLICE 1 IN ARRAY ARRAY[
    ['exercicios', 'users_own_exercicios',
     'EXISTS (SELECT 1 FROM public.treinos WHERE treinos.id = exercicios.treino_id AND treinos.user_id = auth.uid())'],
    ['series_realizadas', 'users_own_series',
     'EXISTS (SELECT 1 FROM public.sessoes_treino WHERE sessoes_treino.id = series_realizadas.sessao_id AND sessoes_treino.user_id = auth.uid())'],
    ['itens_compras', 'users_own_itens_compras',
     'EXISTS (SELECT 1 FROM public.listas_compras WHERE listas_compras.id = itens_compras.lista_id AND listas_compras.user_id = auth.uid())'],
    ['manutencoes', 'users_own_manutencoes',
     'EXISTS (SELECT 1 FROM public.veiculos WHERE veiculos.id = manutencoes.veiculo_id AND veiculos.user_id = auth.uid())']
  ] LOOP
    IF to_regclass(format('public.%I', p[1])) IS NULL THEN
      RAISE NOTICE '[baseline] public.% ausente — policy % pulada', p[1], p[2];
    ELSIF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = p[1] AND policyname = p[2]
    ) THEN
      EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL USING (%s) WITH CHECK (%s)', p[2], p[1], p[3], p[3]);
    END IF;
  END LOOP;
END $$;

-- notas (003)
DO $$
DECLARE
  p TEXT[];
BEGIN
  FOREACH p SLICE 1 IN ARRAY ARRAY[
    ['Users can view own notas',   'FOR SELECT USING (user_id = auth.uid())'],
    ['Users can insert own notas', 'FOR INSERT WITH CHECK (user_id = auth.uid())'],
    ['Users can update own notas', 'FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())'],
    ['Users can delete own notas', 'FOR DELETE USING (user_id = auth.uid())']
  ] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'notas' AND policyname = p[1]
    ) THEN
      EXECUTE format('CREATE POLICY %I ON public.notas %s', p[1], p[2]);
    END IF;
  END LOOP;
END $$;

-- 004: policies de INSERT com WITH CHECK (GAP-05). Cada uma só é criada se
-- tabela e coluna existirem.
DO $$
DECLARE
  t TEXT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'Users can insert own profiles'
  ) THEN
    CREATE POLICY "Users can insert own profiles" ON public.profiles
      FOR INSERT WITH CHECK (id = auth.uid());
  END IF;

  FOREACH t IN ARRAY ARRAY[
    'treinos', 'sessoes_treino', 'habitos', 'registros_habito', 'compromissos',
    'transacoes', 'refeicoes', 'registros_agua', 'registros_peso', 'medicamentos',
    'registro_medicamentos', 'assinaturas', 'listas_compras', 'veiculos',
    'scores_diarios', 'conquistas'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = t AND column_name = 'user_id'
    ) THEN
      RAISE NOTICE '[baseline][004] public.%(user_id) ausente — policy de INSERT pulada', t;
    ELSIF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = t AND policyname = 'Users can insert own ' || t
    ) THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR INSERT WITH CHECK (user_id = auth.uid())',
        'Users can insert own ' || t, t
      );
    END IF;
  END LOOP;
END $$;

DO $$
DECLARE
  p TEXT[];
BEGIN
  FOREACH p SLICE 1 IN ARRAY ARRAY[
    ['exercicios',        'Users can insert own exercicios',
     'treino_id IN (SELECT id FROM public.treinos WHERE user_id = auth.uid())'],
    ['series_realizadas', 'Users can insert own series',
     'sessao_id IN (SELECT id FROM public.sessoes_treino WHERE user_id = auth.uid())'],
    ['itens_compras',     'Users can insert own itens_compras',
     'lista_id IN (SELECT id FROM public.listas_compras WHERE user_id = auth.uid())'],
    ['manutencoes',       'Users can insert own manutencoes',
     'veiculo_id IN (SELECT id FROM public.veiculos WHERE user_id = auth.uid())']
  ] LOOP
    IF to_regclass(format('public.%I', p[1])) IS NULL THEN
      RAISE NOTICE '[baseline][004] public.% ausente — policy % pulada', p[1], p[2];
    ELSIF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = p[1] AND policyname = p[2]
    ) THEN
      EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT WITH CHECK (%s)', p[2], p[1], p[3]);
    END IF;
  END LOOP;
END $$;

-- ══════════════════════════════════════════════════════════════════════════════
-- TRIGGER: criar profile ao registrar usuário (GAP-07)
-- ══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, nome, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email, '@', 1)),
    NEW.email
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'on_auth_user_created' AND tgrelid = 'auth.users'::regclass
  ) THEN
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
  END IF;
END $$;

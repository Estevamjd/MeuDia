-- ============================================================================
-- Migration 001: Schema inicial do MeuDia
-- Data: 2026-03-30
-- Descrição: Cria todas as tabelas, índices, RLS e triggers
-- ============================================================================
-- Para aplicar: Copiar e executar no Supabase SQL Editor
-- Para reverter: Executar 001_initial_schema_down.sql
-- ============================================================================
-- SQL inline equivalente a ../schema.sql (antes carregado via `\i`, meta-comando
-- do psql que não roda no SQL Editor/CLI). Manter os dois arquivos em sincronia.
-- IDEMPOTENTE: roda depois de 000_baseline.sql e pode ser reexecutada
-- (IF NOT EXISTS, policies/trigger via DO block, CREATE OR REPLACE).
-- ============================================================================

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
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  nome        TEXT NOT NULL,
  dia_semana  INTEGER NOT NULL CHECK (dia_semana BETWEEN 0 AND 6),
  tipo        TEXT CHECK (tipo IN ('musculacao','cardio','funcional','descanso')),
  observacao  TEXT,
  ordem       INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.exercicios (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  treino_id       UUID NOT NULL REFERENCES treinos(id) ON DELETE CASCADE,
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
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  treino_id       UUID REFERENCES treinos(id),
  data            DATE NOT NULL DEFAULT CURRENT_DATE,
  duracao_minutos INTEGER,
  concluido       BOOLEAN DEFAULT FALSE,
  observacao      TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.series_realizadas (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sessao_id    UUID NOT NULL REFERENCES sessoes_treino(id) ON DELETE CASCADE,
  exercicio_id UUID NOT NULL REFERENCES exercicios(id),
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
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
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
  habito_id  UUID NOT NULL REFERENCES habitos(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
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
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
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
  user_id          UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
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
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
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
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  peso        DECIMAL(5,2) NOT NULL,
  data        DATE NOT NULL DEFAULT CURRENT_DATE,
  observacao  TEXT,
  UNIQUE(user_id, data)
);

CREATE TABLE IF NOT EXISTS public.refeicoes (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
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
  user_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  data          DATE NOT NULL DEFAULT CURRENT_DATE,
  quantidade_ml INTEGER NOT NULL DEFAULT 0,
  meta_ml       INTEGER NOT NULL DEFAULT 2500,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, data)
);

-- ══════════════════════════════════════════════════════════════════════════════
-- MEDICAMENTOS
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.medicamentos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
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
  medicamento_id UUID NOT NULL REFERENCES medicamentos(id) ON DELETE CASCADE,
  user_id        UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  data_hora      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  tomado         BOOLEAN DEFAULT FALSE
);

-- ══════════════════════════════════════════════════════════════════════════════
-- COMPRAS
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.listas_compras (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  nome       TEXT NOT NULL DEFAULT 'Lista de Compras',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.itens_compras (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lista_id        UUID NOT NULL REFERENCES listas_compras(id) ON DELETE CASCADE,
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
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  modelo     TEXT NOT NULL,
  placa      TEXT,
  ano        INTEGER,
  km_atual   INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.manutencoes (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  veiculo_id          UUID NOT NULL REFERENCES veiculos(id) ON DELETE CASCADE,
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
  user_id             UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
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
  user_id        UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tipo           TEXT NOT NULL,
  titulo         TEXT NOT NULL,
  descricao      TEXT,
  icone          TEXT DEFAULT '🏆',
  conquistado_em TIMESTAMPTZ DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════════════════════════
-- ÍNDICES
-- ══════════════════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_treinos_user          ON treinos(user_id);
CREATE INDEX IF NOT EXISTS idx_exercicios_treino     ON exercicios(treino_id);
CREATE INDEX IF NOT EXISTS idx_sessoes_user_data     ON sessoes_treino(user_id, data);
CREATE INDEX IF NOT EXISTS idx_habitos_user          ON habitos(user_id);
CREATE INDEX IF NOT EXISTS idx_reg_hab_user_data     ON registros_habito(user_id, data);
CREATE INDEX IF NOT EXISTS idx_transacoes_user_data  ON transacoes(user_id, data);
CREATE INDEX IF NOT EXISTS idx_refeicoes_user_data   ON refeicoes(user_id, data);
CREATE INDEX IF NOT EXISTS idx_compromissos_user     ON compromissos(user_id, data_inicio);
CREATE INDEX IF NOT EXISTS idx_scores_user_data      ON scores_diarios(user_id, data);
CREATE INDEX IF NOT EXISTS idx_series_sessao         ON series_realizadas(sessao_id);
CREATE INDEX IF NOT EXISTS idx_reg_med_user          ON registro_medicamentos(user_id, data_hora);
CREATE INDEX IF NOT EXISTS idx_medicamentos_user     ON medicamentos(user_id);
CREATE INDEX IF NOT EXISTS idx_veiculos_user         ON veiculos(user_id);
CREATE INDEX IF NOT EXISTS idx_listas_compras_user   ON listas_compras(user_id);
CREATE INDEX IF NOT EXISTS idx_itens_lista           ON itens_compras(lista_id);
CREATE INDEX IF NOT EXISTS idx_assinaturas_user      ON assinaturas(user_id);
CREATE INDEX IF NOT EXISTS idx_conquistas_user       ON conquistas(user_id);
CREATE INDEX IF NOT EXISTS idx_registros_peso_user   ON registros_peso(user_id, data);
CREATE INDEX IF NOT EXISTS idx_registros_agua_user   ON registros_agua(user_id, data);

-- ══════════════════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE profiles               ENABLE ROW LEVEL SECURITY;
ALTER TABLE treinos                ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercicios             ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessoes_treino         ENABLE ROW LEVEL SECURITY;
ALTER TABLE series_realizadas      ENABLE ROW LEVEL SECURITY;
ALTER TABLE habitos                ENABLE ROW LEVEL SECURITY;
ALTER TABLE registros_habito       ENABLE ROW LEVEL SECURITY;
ALTER TABLE transacoes             ENABLE ROW LEVEL SECURITY;
ALTER TABLE assinaturas            ENABLE ROW LEVEL SECURITY;
ALTER TABLE compromissos           ENABLE ROW LEVEL SECURITY;
ALTER TABLE registros_peso         ENABLE ROW LEVEL SECURITY;
ALTER TABLE refeicoes              ENABLE ROW LEVEL SECURITY;
ALTER TABLE registros_agua         ENABLE ROW LEVEL SECURITY;
ALTER TABLE medicamentos           ENABLE ROW LEVEL SECURITY;
ALTER TABLE registro_medicamentos  ENABLE ROW LEVEL SECURITY;
ALTER TABLE listas_compras         ENABLE ROW LEVEL SECURITY;
ALTER TABLE itens_compras          ENABLE ROW LEVEL SECURITY;
ALTER TABLE veiculos               ENABLE ROW LEVEL SECURITY;
ALTER TABLE manutencoes            ENABLE ROW LEVEL SECURITY;
ALTER TABLE scores_diarios         ENABLE ROW LEVEL SECURITY;
ALTER TABLE conquistas             ENABLE ROW LEVEL SECURITY;

-- ══════════════════════════════════════════════════════════════════════════════
-- RLS POLICIES
-- ══════════════════════════════════════════════════════════════════════════════

-- Profiles: usuário acessa apenas seu próprio perfil
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'users_own_profile'
  ) THEN
    CREATE POLICY "users_own_profile" ON profiles
      FOR ALL USING (auth.uid() = id);
  END IF;
END $$;

-- Tabelas com user_id direto
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'treinos', 'sessoes_treino', 'habitos', 'registros_habito', 'transacoes',
    'assinaturas', 'compromissos', 'registros_peso', 'refeicoes', 'registros_agua',
    'medicamentos', 'registro_medicamentos', 'listas_compras', 'veiculos',
    'scores_diarios', 'conquistas'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = t AND policyname = 'users_own_data'
    ) THEN
      EXECUTE format('CREATE POLICY "users_own_data" ON public.%I FOR ALL USING (auth.uid() = user_id)', t);
    END IF;
  END LOOP;
END $$;

-- Tabelas filhas (sem user_id direto — acessam via JOIN com tabela pai):
-- exercícios via treino, séries via sessão, itens via lista, manutenções via veículo
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
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = p[1] AND policyname = p[2]
    ) THEN
      EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL USING (%s)', p[2], p[1], p[3]);
    END IF;
  END LOOP;
END $$;

-- ══════════════════════════════════════════════════════════════════════════════
-- AGENTE IA
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.notificacoes_agente (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
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
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role        TEXT CHECK (role IN ('user','agent')) NOT NULL,
  conteudo    TEXT NOT NULL,
  intencao    TEXT,
  acoes       JSONB DEFAULT '[]',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.acoes_agente (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tipo        TEXT NOT NULL,
  payload     JSONB NOT NULL,
  status      TEXT CHECK (status IN ('pendente','executada','falhou')) DEFAULT 'pendente',
  resultado   JSONB,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.preferencias_agente (
  user_id               UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  notif_faltou_treino   BOOLEAN DEFAULT TRUE,
  notif_habito_pendente BOOLEAN DEFAULT TRUE,
  horario_verificacao   TIME DEFAULT '20:00',
  timer_descanso_auto   BOOLEAN DEFAULT TRUE,
  sugestao_carga_auto   BOOLEAN DEFAULT TRUE,
  chat_ativo            BOOLEAN DEFAULT TRUE,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════════════════════════
-- TRIGGER: Criar profile automaticamente ao registrar usuário
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

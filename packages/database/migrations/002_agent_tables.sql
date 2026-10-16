-- ============================================================================
-- MeuDia — Migration 002: Tabelas do Agente IA
-- ============================================================================
-- Data: 2026-03-31
-- ============================================================================

-- ══════════════════════════════════════════════════════════════════════════════
-- NOTIFICAÇÕES DO AGENTE
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

-- ══════════════════════════════════════════════════════════════════════════════
-- HISTÓRICO DE CHAT COM O AGENTE
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.chat_agente (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role        TEXT CHECK (role IN ('user','agent')) NOT NULL,
  conteudo    TEXT NOT NULL,
  intencao    TEXT,
  acoes       JSONB DEFAULT '[]',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════════════════════════
-- AÇÕES EXECUTADAS PELO AGENTE
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.acoes_agente (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tipo        TEXT NOT NULL,
  payload     JSONB NOT NULL,
  status      TEXT CHECK (status IN ('pendente','executada','falhou')) DEFAULT 'pendente',
  resultado   JSONB,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════════════════════════
-- PREFERÊNCIAS DO AGENTE POR USUÁRIO
-- ══════════════════════════════════════════════════════════════════════════════

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
-- ÍNDICES
-- ══════════════════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_notif_user_lida    ON notificacoes_agente(user_id, lida);
CREATE INDEX IF NOT EXISTS idx_notif_user_created ON notificacoes_agente(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_chat_user_created  ON chat_agente(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_acoes_user_status  ON acoes_agente(user_id, status);

-- ══════════════════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE notificacoes_agente  ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_agente          ENABLE ROW LEVEL SECURITY;
ALTER TABLE acoes_agente         ENABLE ROW LEVEL SECURITY;
ALTER TABLE preferencias_agente  ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'notificacoes_agente', 'chat_agente', 'acoes_agente', 'preferencias_agente'
  ] LOOP
    IF NOT EXISTS (
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

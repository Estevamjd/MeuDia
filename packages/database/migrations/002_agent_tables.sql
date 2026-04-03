-- ============================================================================
-- MeuDia — Migration 002: Tabelas do Agente IA
-- ============================================================================
-- Data: 2026-03-31
-- ============================================================================

-- ══════════════════════════════════════════════════════════════════════════════
-- NOTIFICAÇÕES DO AGENTE
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE notificacoes_agente (
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

CREATE TABLE chat_agente (
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

CREATE TABLE acoes_agente (
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

CREATE TABLE preferencias_agente (
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

CREATE INDEX idx_notif_user_lida    ON notificacoes_agente(user_id, lida);
CREATE INDEX idx_notif_user_created ON notificacoes_agente(user_id, created_at);
CREATE INDEX idx_chat_user_created  ON chat_agente(user_id, created_at);
CREATE INDEX idx_acoes_user_status  ON acoes_agente(user_id, status);

-- ══════════════════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE notificacoes_agente  ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_agente          ENABLE ROW LEVEL SECURITY;
ALTER TABLE acoes_agente         ENABLE ROW LEVEL SECURITY;
ALTER TABLE preferencias_agente  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_data" ON notificacoes_agente
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_own_data" ON chat_agente
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_own_data" ON acoes_agente
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_own_data" ON preferencias_agente
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

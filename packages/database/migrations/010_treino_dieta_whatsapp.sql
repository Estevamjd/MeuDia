-- 010: Treino e Dieta "rápidos" (Fase 2) + ponte do WhatsApp. Só aditiva e idempotente.
-- Tabelas mínimas (texto curto, sem mídia) para caber de sobra no plano grátis do Supabase:
--   registros_treino   "treinei peito 40min"           (app ou WhatsApp)
--   registros_refeicao "almocei arroz, feijão, frango" (app ou WhatsApp)
-- profiles.whatsapp liga o número (só dígitos, com DDI) à conta.
-- public.whatsapp_registrar(): única porta de escrita do webhook. SECURITY DEFINER, exige o segredo
-- (o hash fica em private.integracoes, fora da API) e o número cadastrado no perfil. Assim o servidor
-- do MeuDia grava sem precisar da service role.

-- ── Perfil: número do WhatsApp ────────────────────────────────────────────────
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS whatsapp TEXT;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
    WHERE conrelid = 'public.profiles'::pg_catalog.regclass AND conname = 'profiles_whatsapp_check') THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_whatsapp_check CHECK (whatsapp ~ '^[0-9]{10,15}$');
  END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS uq_profiles_whatsapp ON public.profiles (whatsapp) WHERE whatsapp IS NOT NULL;

-- ── Treino ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.registros_treino (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data         DATE NOT NULL DEFAULT CURRENT_DATE,
  descricao    TEXT NOT NULL CHECK (char_length(descricao) BETWEEN 1 AND 120),
  duracao_min  SMALLINT CHECK (duracao_min BETWEEN 1 AND 600),
  origem       TEXT NOT NULL DEFAULT 'app' CHECK (origem IN ('app', 'whatsapp')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_registros_treino_user_data ON public.registros_treino (user_id, data DESC);

-- ── Dieta ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.registros_refeicao (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data         DATE NOT NULL DEFAULT CURRENT_DATE,
  tipo         TEXT NOT NULL CHECK (tipo IN ('cafe', 'almoco', 'lanche', 'jantar', 'ceia')),
  descricao    TEXT NOT NULL CHECK (char_length(descricao) BETWEEN 1 AND 200),
  origem       TEXT NOT NULL DEFAULT 'app' CHECK (origem IN ('app', 'whatsapp')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_registros_refeicao_user_data ON public.registros_refeicao (user_id, data DESC);

-- RLS: cada um só vê e mexe no que é seu.
ALTER TABLE public.registros_treino ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registros_refeicao ENABLE ROW LEVEL SECURITY;
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['registros_treino', 'registros_refeicao'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_policies WHERE schemaname = 'public' AND tablename = t AND policyname = 'users_own_data') THEN
      EXECUTE format('CREATE POLICY users_own_data ON public.%I FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)', t);
    END IF;
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon, authenticated', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
  END LOOP;
END $$;

-- ── Ponte do WhatsApp ─────────────────────────────────────────────────────────
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;

-- Hash (sha256, hex) do segredo do webhook. O valor real é gravado fora do git (docs/whatsapp.md).
CREATE TABLE IF NOT EXISTS private.integracoes (
  nome        TEXT PRIMARY KEY,
  segredo_sha256 TEXT NOT NULL CHECK (segredo_sha256 ~ '^[0-9a-f]{64}$'),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Mensagens já processadas (o WAHA reenvia em caso de falha): evita lançamento duplicado. Limpa após 7 dias.
CREATE TABLE IF NOT EXISTS private.whatsapp_mensagens (
  id          TEXT PRIMARY KEY CHECK (char_length(id) <= 200),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
REVOKE ALL ON ALL TABLES IN SCHEMA private FROM PUBLIC, anon, authenticated;

-- p_tipo: 'gasto' | 'entrada' | 'treino' | 'refeicao' | 'ping' (só confere segredo e número).
-- p_dados: gasto/entrada {valor, categoria, descricao, data?}; treino {descricao, duracao_min?, data?};
--          refeicao {tipo, descricao, data?}. Retorna {ok, nome?, erro?, duplicada?}.
CREATE OR REPLACE FUNCTION public.whatsapp_registrar(p_segredo TEXT, p_telefone TEXT, p_mensagem_id TEXT, p_tipo TEXT, p_dados JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_hash TEXT;
  v_user UUID;
  v_nome TEXT;
  v_data DATE;
  v_valor NUMERIC;
  v_carteira UUID;
  v_desc TEXT;
  v_min INTEGER;
  v_alt TEXT;
BEGIN
  SELECT segredo_sha256 INTO v_hash FROM private.integracoes WHERE nome = 'whatsapp';
  IF v_hash IS NULL OR p_segredo IS NULL
     OR v_hash <> pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p_segredo, 'UTF8')), 'hex') THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'nao_autorizado');
  END IF;

  -- Celular BR: o WhatsApp às vezes manda sem o 9 (55 11 8xxx-xxxx). Aceita as duas formas.
  v_alt := CASE
    WHEN p_telefone ~ '^55[0-9]{2}9[0-9]{8}$' THEN pg_catalog.left(p_telefone, 4) || pg_catalog.substr(p_telefone, 6)
    WHEN p_telefone ~ '^55[0-9]{2}[6-9][0-9]{7}$' THEN pg_catalog.left(p_telefone, 4) || '9' || pg_catalog.substr(p_telefone, 5)
    ELSE p_telefone END;
  SELECT id, nome INTO v_user, v_nome FROM public.profiles
   WHERE whatsapp IN (p_telefone, v_alt) ORDER BY (whatsapp = p_telefone) DESC LIMIT 1;
  IF v_user IS NULL THEN RETURN jsonb_build_object('ok', false, 'erro', 'numero_sem_conta'); END IF;
  IF p_tipo = 'ping' THEN RETURN jsonb_build_object('ok', true, 'nome', v_nome); END IF;

  IF p_mensagem_id IS NOT NULL THEN
    DELETE FROM private.whatsapp_mensagens WHERE created_at < NOW() - INTERVAL '7 days';
    INSERT INTO private.whatsapp_mensagens (id) VALUES (p_mensagem_id) ON CONFLICT (id) DO NOTHING;
    IF NOT FOUND THEN RETURN jsonb_build_object('ok', true, 'nome', v_nome, 'duplicada', true); END IF;
  END IF;

  v_data := COALESCE(NULLIF(p_dados->>'data', '')::DATE, (NOW() AT TIME ZONE 'America/Sao_Paulo')::DATE);
  IF v_data < (NOW() AT TIME ZONE 'America/Sao_Paulo')::DATE - 60 OR v_data > (NOW() AT TIME ZONE 'America/Sao_Paulo')::DATE + 1 THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'data_invalida');
  END IF;
  v_desc := pg_catalog.left(pg_catalog.btrim(COALESCE(p_dados->>'descricao', '')), 200);

  IF p_tipo IN ('gasto', 'entrada') THEN
    v_valor := (p_dados->>'valor')::NUMERIC;
    IF v_valor IS NULL OR v_valor <= 0 OR v_valor > 1000000 THEN RETURN jsonb_build_object('ok', false, 'erro', 'valor_invalido'); END IF;
    -- Mesma regra do app: o último banco usado, senão o primeiro ativo.
    SELECT t.carteira_id INTO v_carteira FROM public.transacoes t JOIN public.carteiras c ON c.id = t.carteira_id
      WHERE t.user_id = v_user AND NOT c.arquivada ORDER BY t.created_at DESC LIMIT 1;
    IF v_carteira IS NULL THEN
      SELECT id INTO v_carteira FROM public.carteiras WHERE user_id = v_user AND NOT arquivada ORDER BY ordem, created_at LIMIT 1;
    END IF;
    INSERT INTO public.transacoes (user_id, tipo, categoria, descricao, valor, data, carteira_id, origem)
    VALUES (v_user, CASE WHEN p_tipo = 'gasto' THEN 'despesa' ELSE 'receita' END,
            pg_catalog.left(COALESCE(NULLIF(p_dados->>'categoria', ''), CASE WHEN p_tipo = 'gasto' THEN 'Outros' ELSE 'Extra' END), 40),
            COALESCE(NULLIF(v_desc, ''), pg_catalog.left(COALESCE(NULLIF(p_dados->>'categoria', ''), 'Outros'), 40)), pg_catalog.round(v_valor, 2), v_data, v_carteira, 'whatsapp');
  ELSIF p_tipo = 'treino' THEN
    IF v_desc = '' THEN RETURN jsonb_build_object('ok', false, 'erro', 'descricao_vazia'); END IF;
    v_min := NULLIF(p_dados->>'duracao_min', '')::INTEGER;
    IF v_min IS NOT NULL AND (v_min < 1 OR v_min > 600) THEN v_min := NULL; END IF;
    INSERT INTO public.registros_treino (user_id, data, descricao, duracao_min, origem)
    VALUES (v_user, v_data, pg_catalog.left(v_desc, 120), v_min, 'whatsapp');
  ELSIF p_tipo = 'refeicao' THEN
    IF v_desc = '' OR COALESCE(p_dados->>'tipo', '') NOT IN ('cafe', 'almoco', 'lanche', 'jantar', 'ceia') THEN
      RETURN jsonb_build_object('ok', false, 'erro', 'refeicao_invalida');
    END IF;
    INSERT INTO public.registros_refeicao (user_id, data, tipo, descricao, origem)
    VALUES (v_user, v_data, p_dados->>'tipo', v_desc, 'whatsapp');
  ELSE
    RETURN jsonb_build_object('ok', false, 'erro', 'tipo_invalido');
  END IF;
  RETURN jsonb_build_object('ok', true, 'nome', v_nome);
END $$;

REVOKE ALL ON FUNCTION public.whatsapp_registrar(TEXT, TEXT, TEXT, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.whatsapp_registrar(TEXT, TEXT, TEXT, TEXT, JSONB) TO anon;
COMMENT ON FUNCTION public.whatsapp_registrar(TEXT, TEXT, TEXT, TEXT, JSONB) IS
  'Webhook do WhatsApp (servidor do MeuDia). Exige o segredo de private.integracoes e o número em profiles.whatsapp.';

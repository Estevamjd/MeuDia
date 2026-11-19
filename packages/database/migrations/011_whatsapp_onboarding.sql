-- 011: Onboarding do WhatsApp (contato → conta) + respostas proativas. Só aditiva e idempotente.
-- whatsapp_contatos: um registro por número que escreveu (etapa da conversa, preferências e limite diário).
--   Antes de existir conta, só o servidor (via RPC com segredo) mexe; depois, o dono lê o seu.
-- whatsapp_contato()     servidor: conta a mensagem do dia, diz se o número já tem conta e em que etapa está.
-- whatsapp_onboarding()  servidor: grava as respostas (nome, renda, objetivo, metas, estilo) e gera o link.
-- whatsapp_vincular()    app (logado): o link de uso único liga o número à conta e aproveita as respostas.
-- whatsapp_registrar()   (substitui a da 010) devolve "extras" para a resposta proativa.
-- Sem service role: a posse do número é provada pelo link que só chegou naquele WhatsApp.

-- ── Ajudantes internos (fora da API) ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.whatsapp_segredo_ok(p_segredo TEXT) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT p_segredo IS NOT NULL AND EXISTS (
    SELECT 1 FROM private.integracoes
     WHERE nome = 'whatsapp'
       AND segredo_sha256 = pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p_segredo, 'UTF8')), 'hex'));
$$;

-- Celular BR: o WhatsApp às vezes manda sem o 9 (55 11 8xxx-xxxx). Devolve a outra forma.
CREATE OR REPLACE FUNCTION private.whatsapp_variante(p_telefone TEXT) RETURNS TEXT
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT CASE
    WHEN p_telefone ~ '^55[0-9]{2}9[0-9]{8}$' THEN pg_catalog.left(p_telefone, 4) || pg_catalog.substr(p_telefone, 6)
    WHEN p_telefone ~ '^55[0-9]{2}[6-9][0-9]{7}$' THEN pg_catalog.left(p_telefone, 4) || '9' || pg_catalog.substr(p_telefone, 5)
    ELSE p_telefone END;
$$;
REVOKE ALL ON FUNCTION private.whatsapp_segredo_ok(TEXT), private.whatsapp_variante(TEXT) FROM PUBLIC, anon, authenticated;

-- ── Contatos do WhatsApp ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.whatsapp_contatos (
  telefone        TEXT PRIMARY KEY CHECK (telefone ~ '^[0-9]{10,15}$'),
  user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  etapa           TEXT NOT NULL DEFAULT 'inicio'
                  CHECK (etapa IN ('inicio', 'nome', 'renda', 'objetivo', 'metas', 'estilo', 'link', 'concluido')),
  tentativas      SMALLINT NOT NULL DEFAULT 0 CHECK (tentativas BETWEEN 0 AND 10),
  nome            TEXT CHECK (char_length(nome) BETWEEN 1 AND 60),
  renda           NUMERIC(10,2) CHECK (renda > 0 AND renda < 10000000),
  objetivo        TEXT CHECK (char_length(objetivo) BETWEEN 1 AND 160),
  metas           TEXT[] NOT NULL DEFAULT '{}' CHECK (metas <@ ARRAY['dinheiro', 'treino', 'dieta']::TEXT[]),
  estilo_tamanho  TEXT NOT NULL DEFAULT 'curto' CHECK (estilo_tamanho IN ('curto', 'detalhado')),
  estilo_emoji    BOOLEAN NOT NULL DEFAULT TRUE,
  token_sha256    TEXT CHECK (token_sha256 ~ '^[0-9a-f]{64}$'),
  token_expira    TIMESTAMPTZ,
  msgs_dia        DATE,
  msgs_hoje       INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_whatsapp_contatos_user ON public.whatsapp_contatos (user_id) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_whatsapp_contatos_token ON public.whatsapp_contatos (token_sha256) WHERE token_sha256 IS NOT NULL;
ALTER TABLE public.whatsapp_contatos ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_policies WHERE schemaname = 'public' AND tablename = 'whatsapp_contatos' AND policyname = 'dono_le') THEN
    CREATE POLICY dono_le ON public.whatsapp_contatos FOR SELECT TO authenticated USING (auth.uid() = user_id);
  END IF;
END $$;
REVOKE ALL ON public.whatsapp_contatos FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.whatsapp_contatos TO authenticated;

-- ── Servidor: estado do contato + limite diário ──────────────────────────────
-- Retorna {ok, vinculado, etapa, tentativas, nome, objetivo, metas, estilo_tamanho, estilo_emoji, msgs_hoje, limite_excedido}.
CREATE OR REPLACE FUNCTION public.whatsapp_contato(p_segredo TEXT, p_telefone TEXT, p_limite INTEGER)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_hoje DATE := (NOW() AT TIME ZONE 'America/Sao_Paulo')::DATE;
  v_user UUID;
  v_nome TEXT;
  c public.whatsapp_contatos;
BEGIN
  IF NOT private.whatsapp_segredo_ok(p_segredo) THEN RETURN jsonb_build_object('ok', false, 'erro', 'nao_autorizado'); END IF;
  IF p_telefone IS NULL OR p_telefone !~ '^[0-9]{10,15}$' THEN RETURN jsonb_build_object('ok', false, 'erro', 'telefone_invalido'); END IF;

  SELECT id, nome INTO v_user, v_nome FROM public.profiles
   WHERE whatsapp IN (p_telefone, private.whatsapp_variante(p_telefone)) ORDER BY (whatsapp = p_telefone) DESC LIMIT 1;

  INSERT INTO public.whatsapp_contatos (telefone) VALUES (p_telefone) ON CONFLICT (telefone) DO NOTHING;
  UPDATE public.whatsapp_contatos SET
    msgs_hoje = CASE WHEN msgs_dia IS DISTINCT FROM v_hoje THEN 1 ELSE msgs_hoje + 1 END,
    msgs_dia = v_hoje,
    -- Conta ligada (pelo link ou por Configurações → Seu WhatsApp) encerra o onboarding; desligada, recomeça.
    user_id = CASE WHEN v_user IS NOT NULL THEN v_user WHEN etapa = 'concluido' THEN NULL ELSE user_id END,
    etapa = CASE WHEN v_user IS NOT NULL THEN 'concluido' WHEN etapa = 'concluido' THEN 'inicio' ELSE etapa END,
    updated_at = NOW()
  WHERE telefone = p_telefone
  RETURNING * INTO c;

  RETURN jsonb_build_object(
    'ok', true, 'vinculado', v_user IS NOT NULL, 'etapa', c.etapa, 'tentativas', c.tentativas,
    'nome', COALESCE(NULLIF(v_nome, ''), c.nome), 'objetivo', c.objetivo, 'metas', pg_catalog.to_jsonb(c.metas),
    'estilo_tamanho', c.estilo_tamanho, 'estilo_emoji', c.estilo_emoji,
    'msgs_hoje', c.msgs_hoje, 'limite_excedido', c.msgs_hoje > GREATEST(COALESCE(p_limite, 30), 1));
END $$;

-- ── Servidor: respostas do onboarding (+ link de uso único) ──────────────────
-- p_dados aceita: etapa (menos 'concluido'), tentativas, nome, renda, objetivo, metas, estilo_tamanho, estilo_emoji.
-- p_gerar_token: devolve {token} (o banco guarda só o sha256; vale 7 dias).
CREATE OR REPLACE FUNCTION public.whatsapp_onboarding(p_segredo TEXT, p_telefone TEXT, p_dados JSONB, p_gerar_token BOOLEAN DEFAULT FALSE)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_token TEXT;
  v_etapa TEXT;
BEGIN
  IF NOT private.whatsapp_segredo_ok(p_segredo) THEN RETURN jsonb_build_object('ok', false, 'erro', 'nao_autorizado'); END IF;
  SELECT etapa INTO v_etapa FROM public.whatsapp_contatos WHERE telefone = p_telefone FOR UPDATE;
  IF v_etapa IS NULL THEN RETURN jsonb_build_object('ok', false, 'erro', 'contato_inexistente'); END IF;
  IF v_etapa = 'concluido' OR p_dados->>'etapa' = 'concluido' THEN RETURN jsonb_build_object('ok', false, 'erro', 'ja_vinculado'); END IF;
  p_dados := COALESCE(p_dados, '{}'::jsonb);
  IF p_gerar_token THEN
    v_token := pg_catalog.replace(pg_catalog.gen_random_uuid()::TEXT, '-', '') || pg_catalog.replace(pg_catalog.gen_random_uuid()::TEXT, '-', '');
  END IF;
  UPDATE public.whatsapp_contatos SET
    etapa          = CASE WHEN p_dados ? 'etapa' THEN p_dados->>'etapa' ELSE etapa END,
    tentativas     = CASE WHEN p_dados ? 'tentativas' THEN (p_dados->>'tentativas')::SMALLINT ELSE tentativas END,
    nome           = CASE WHEN p_dados ? 'nome' THEN NULLIF(pg_catalog.left(pg_catalog.btrim(p_dados->>'nome'), 60), '') ELSE nome END,
    renda          = CASE WHEN p_dados ? 'renda' THEN (p_dados->>'renda')::NUMERIC ELSE renda END,
    objetivo       = CASE WHEN p_dados ? 'objetivo' THEN NULLIF(pg_catalog.left(pg_catalog.btrim(p_dados->>'objetivo'), 160), '') ELSE objetivo END,
    metas          = CASE WHEN p_dados ? 'metas' THEN ARRAY(SELECT DISTINCT pg_catalog.jsonb_array_elements_text(p_dados->'metas')) ELSE metas END,
    estilo_tamanho = CASE WHEN p_dados ? 'estilo_tamanho' THEN p_dados->>'estilo_tamanho' ELSE estilo_tamanho END,
    estilo_emoji   = CASE WHEN p_dados ? 'estilo_emoji' THEN (p_dados->>'estilo_emoji')::BOOLEAN ELSE estilo_emoji END,
    token_sha256   = CASE WHEN p_gerar_token THEN pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(v_token, 'UTF8')), 'hex') ELSE token_sha256 END,
    token_expira   = CASE WHEN p_gerar_token THEN NOW() + INTERVAL '7 days' ELSE token_expira END,
    updated_at     = NOW()
  WHERE telefone = p_telefone;
  RETURN jsonb_build_object('ok', true) || CASE WHEN v_token IS NULL THEN '{}'::jsonb ELSE jsonb_build_object('token', v_token) END;
EXCEPTION WHEN check_violation OR invalid_text_representation OR numeric_value_out_of_range THEN
  RETURN jsonb_build_object('ok', false, 'erro', 'dados_invalidos');
END $$;

-- ── App (logado): o link liga o número à conta ───────────────────────────────
-- Retorna {ok, telefone} ou {ok:false, erro: token_invalido | numero_em_uso}.
CREATE OR REPLACE FUNCTION public.whatsapp_vincular(p_token TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user UUID := auth.uid();
  c public.whatsapp_contatos;
BEGIN
  IF v_user IS NULL THEN RETURN jsonb_build_object('ok', false, 'erro', 'nao_autenticado'); END IF;
  IF p_token IS NULL OR p_token !~ '^[0-9a-f]{64}$' THEN RETURN jsonb_build_object('ok', false, 'erro', 'token_invalido'); END IF;
  SELECT * INTO c FROM public.whatsapp_contatos
   WHERE token_sha256 = pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p_token, 'UTF8')), 'hex')
     AND token_expira > NOW()
   FOR UPDATE;
  IF c.telefone IS NULL THEN RETURN jsonb_build_object('ok', false, 'erro', 'token_invalido'); END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id <> v_user
              AND whatsapp IN (c.telefone, private.whatsapp_variante(c.telefone))) THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'numero_em_uso');
  END IF;

  UPDATE public.profiles SET whatsapp = c.telefone, nome = COALESCE(NULLIF(nome, ''), c.nome) WHERE id = v_user;
  -- Aproveita a renda contada no WhatsApp se a conta ainda não tem nenhuma.
  IF c.renda IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.rendas WHERE user_id = v_user AND ativo) THEN
    INSERT INTO public.rendas (user_id, descricao, valor) VALUES (v_user, 'Renda mensal', c.renda);
  END IF;
  UPDATE public.whatsapp_contatos
     SET user_id = v_user, etapa = 'concluido', tentativas = 0, token_sha256 = NULL, token_expira = NULL, updated_at = NOW()
   WHERE telefone = c.telefone;
  RETURN jsonb_build_object('ok', true, 'telefone', c.telefone);
END $$;

REVOKE ALL ON FUNCTION public.whatsapp_contato(TEXT, TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.whatsapp_onboarding(TEXT, TEXT, JSONB, BOOLEAN) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.whatsapp_vincular(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.whatsapp_contato(TEXT, TEXT, INTEGER) TO anon;
GRANT EXECUTE ON FUNCTION public.whatsapp_onboarding(TEXT, TEXT, JSONB, BOOLEAN) TO anon;
GRANT EXECUTE ON FUNCTION public.whatsapp_vincular(TEXT) TO authenticated;

-- ── whatsapp_registrar com "extras" (orçamento restante, conta próxima, treinos da semana) ──
CREATE OR REPLACE FUNCTION public.whatsapp_registrar(p_segredo TEXT, p_telefone TEXT, p_mensagem_id TEXT, p_tipo TEXT, p_dados JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user UUID;
  v_nome TEXT;
  v_data DATE;
  v_valor NUMERIC;
  v_carteira UUID;
  v_desc TEXT;
  v_min INTEGER;
  v_alt TEXT;
  v_cat TEXT;
  v_plan NUMERIC;
  v_gasto NUMERIC;
  v_hoje DATE := (NOW() AT TIME ZONE 'America/Sao_Paulo')::DATE;
  v_conta RECORD;
  v_extras JSONB := '{}'::jsonb;
BEGIN
  IF NOT private.whatsapp_segredo_ok(p_segredo) THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'nao_autorizado');
  END IF;

  v_alt := private.whatsapp_variante(p_telefone);
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
    v_cat := pg_catalog.left(COALESCE(NULLIF(p_dados->>'categoria', ''), CASE WHEN p_tipo = 'gasto' THEN 'Outros' ELSE 'Extra' END), 40);
    INSERT INTO public.transacoes (user_id, tipo, categoria, descricao, valor, data, carteira_id, origem)
    VALUES (v_user, CASE WHEN p_tipo = 'gasto' THEN 'despesa' ELSE 'receita' END,
            v_cat, COALESCE(NULLIF(v_desc, ''), v_cat), pg_catalog.round(v_valor, 2), v_data, v_carteira, 'whatsapp');
    -- "Faz antes de pedir": quanto resta do orçamento da categoria e a próxima conta (até 3 dias).
    IF p_tipo = 'gasto' THEN
      SELECT o.valor_planejado INTO v_plan FROM public.orcamento_categorias o WHERE o.user_id = v_user AND o.categoria = v_cat;
      IF v_plan IS NOT NULL THEN
        SELECT COALESCE(SUM(t.valor), 0) INTO v_gasto FROM public.transacoes t
         WHERE t.user_id = v_user AND t.tipo = 'despesa' AND t.categoria = v_cat AND NOT t.ajuste
           AND t.data >= pg_catalog.date_trunc('month', v_data)::DATE
           AND t.data < (pg_catalog.date_trunc('month', v_data) + INTERVAL '1 month')::DATE;
        v_extras := v_extras || jsonb_build_object('categoria', v_cat, 'planejado', v_plan, 'gasto_mes', v_gasto);
      END IF;
    END IF;
    SELECT c.descricao, c.valor, c.dia_vencimento INTO v_conta FROM public.contas_pagar c
     WHERE c.user_id = v_user AND c.ativo AND c.recorrencia = 'mensal'
       AND c.dia_vencimento BETWEEN EXTRACT(DAY FROM v_hoje)::INTEGER AND EXTRACT(DAY FROM v_hoje)::INTEGER + 3
       AND NOT EXISTS (SELECT 1 FROM public.pagamentos_conta p WHERE p.conta_id = c.id AND p.competencia = pg_catalog.to_char(v_hoje, 'YYYY-MM'))
     ORDER BY c.dia_vencimento LIMIT 1;
    IF FOUND THEN
      v_extras := v_extras || jsonb_build_object('conta_descricao', v_conta.descricao, 'conta_valor', v_conta.valor, 'conta_dia', v_conta.dia_vencimento);
    END IF;
  ELSIF p_tipo = 'treino' THEN
    IF v_desc = '' THEN RETURN jsonb_build_object('ok', false, 'erro', 'descricao_vazia'); END IF;
    v_min := NULLIF(p_dados->>'duracao_min', '')::INTEGER;
    IF v_min IS NOT NULL AND (v_min < 1 OR v_min > 600) THEN v_min := NULL; END IF;
    INSERT INTO public.registros_treino (user_id, data, descricao, duracao_min, origem)
    VALUES (v_user, v_data, pg_catalog.left(v_desc, 120), v_min, 'whatsapp');
    v_extras := jsonb_build_object('treinos_semana', (SELECT COUNT(DISTINCT r.data) FROM public.registros_treino r
      WHERE r.user_id = v_user AND r.data >= pg_catalog.date_trunc('week', v_hoje)::DATE AND r.data <= v_hoje));
  ELSIF p_tipo = 'refeicao' THEN
    IF v_desc = '' OR COALESCE(p_dados->>'tipo', '') NOT IN ('cafe', 'almoco', 'lanche', 'jantar', 'ceia') THEN
      RETURN jsonb_build_object('ok', false, 'erro', 'refeicao_invalida');
    END IF;
    INSERT INTO public.registros_refeicao (user_id, data, tipo, descricao, origem)
    VALUES (v_user, v_data, p_dados->>'tipo', v_desc, 'whatsapp');
    v_extras := jsonb_build_object('refeicoes_dia', (SELECT COUNT(*) FROM public.registros_refeicao r WHERE r.user_id = v_user AND r.data = v_data));
  ELSE
    RETURN jsonb_build_object('ok', false, 'erro', 'tipo_invalido');
  END IF;
  RETURN jsonb_build_object('ok', true, 'nome', v_nome, 'extras', v_extras);
END $$;

REVOKE ALL ON FUNCTION public.whatsapp_registrar(TEXT, TEXT, TEXT, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.whatsapp_registrar(TEXT, TEXT, TEXT, TEXT, JSONB) TO anon;

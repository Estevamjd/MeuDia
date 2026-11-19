-- Desfaz a 011: volta o whatsapp_registrar da 010 e apaga os contatos do WhatsApp.
DROP FUNCTION IF EXISTS public.whatsapp_vincular(TEXT);
DROP FUNCTION IF EXISTS public.whatsapp_onboarding(TEXT, TEXT, JSONB, BOOLEAN);
DROP FUNCTION IF EXISTS public.whatsapp_contato(TEXT, TEXT, INTEGER);
DROP TABLE IF EXISTS public.whatsapp_contatos;
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
DROP FUNCTION IF EXISTS private.whatsapp_variante(TEXT);
DROP FUNCTION IF EXISTS private.whatsapp_segredo_ok(TEXT);

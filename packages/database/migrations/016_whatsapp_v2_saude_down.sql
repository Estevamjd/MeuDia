-- Remove SOMENTE objetos da 016. Dados novos destas tabelas exigem backup antes do down.
DROP FUNCTION IF EXISTS public.whatsapp_desfazer(TEXT,TEXT,TEXT);
DROP FUNCTION IF EXISTS public.whatsapp_manutencao_diaria(TEXT);
DROP FUNCTION IF EXISTS public.ia_consumir_cota(INTEGER);
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
  RETURN jsonb_build_object('ok', true, 'nome', v_nome, 'extras', v_extras || private.whatsapp_contexto(v_user, p_tipo, v_data));
END $$;
REVOKE ALL ON FUNCTION public.whatsapp_registrar(TEXT,TEXT,TEXT,TEXT,JSONB) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.whatsapp_registrar(TEXT,TEXT,TEXT,TEXT,JSONB) TO anon;
DROP TABLE IF EXISTS private.whatsapp_acoes;
DROP TABLE IF EXISTS private.whatsapp_manutencoes;
DROP TABLE IF EXISTS public.ia_uso_diario;
DROP TABLE IF EXISTS public.perfil_saude;
DROP FUNCTION IF EXISTS private.normalizar_texto(TEXT);
DROP INDEX IF EXISTS private.idx_whatsapp_mensagens_created_at;
DROP INDEX IF EXISTS private.idx_whatsapp_envios_created_at;

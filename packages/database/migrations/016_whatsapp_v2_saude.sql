-- 016: aditiva e idempotente. Não modifica dados existentes ao aplicar.
-- Restauração exata da whatsapp_registrar 012 no down.
-- ── 1. Índices de limpeza + normalizador sem extensão ────────────────────────
CREATE INDEX IF NOT EXISTS idx_whatsapp_mensagens_created_at
  ON private.whatsapp_mensagens (created_at);
CREATE INDEX IF NOT EXISTS idx_whatsapp_envios_created_at
  ON private.whatsapp_envios (created_at);

CREATE OR REPLACE FUNCTION private.normalizar_texto(p_texto TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT pg_catalog.btrim(
    pg_catalog.regexp_replace(
      pg_catalog.translate(
        pg_catalog.lower(COALESCE(p_texto, '')),
        'áàâãäéèêëíìîïóòôõöúùûüç',
        'aaaaaeeeeiiiiooooouuuuc'
      ),
      '[^a-z0-9]+', ' ', 'g'
    )
  );
$$;
REVOKE ALL ON FUNCTION private.normalizar_texto(TEXT) FROM PUBLIC, anon, authenticated;

-- ── 2. Log de ações recentes do WhatsApp (base do comando "desfazer") ────────
CREATE TABLE IF NOT EXISTS private.whatsapp_acoes (
  id          BIGSERIAL PRIMARY KEY,
  telefone    TEXT NOT NULL,
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tipo        TEXT NOT NULL CHECK (tipo IN ('transacao', 'pagamento_conta', 'treino', 'refeicao')),
  registro_id UUID NOT NULL,
  conta_id    UUID,
  competencia TEXT CHECK (competencia IS NULL OR competencia ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  descricao   TEXT NOT NULL,
  valor       NUMERIC(12,2),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
  desfeito_em TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_whatsapp_acoes_user_recente
  ON private.whatsapp_acoes (user_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_whatsapp_acoes_created_at
  ON private.whatsapp_acoes (created_at);
REVOKE ALL ON private.whatsapp_acoes FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE private.whatsapp_acoes_id_seq FROM PUBLIC, anon, authenticated;

-- ── 3. Cota diária de IA (sem DELETE para authenticated) ─────────────────────
CREATE TABLE IF NOT EXISTS public.ia_uso_diario (
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  dia        DATE NOT NULL,
  quantidade INTEGER NOT NULL DEFAULT 0 CHECK (quantidade >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
  PRIMARY KEY (user_id, dia)
);
CREATE INDEX IF NOT EXISTS idx_ia_uso_diario_dia ON public.ia_uso_diario (dia);
ALTER TABLE public.ia_uso_diario ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_policies
    WHERE schemaname = 'public' AND tablename = 'ia_uso_diario' AND policyname = 'ia_uso_dono_select') THEN
    CREATE POLICY ia_uso_dono_select ON public.ia_uso_diario
      FOR SELECT TO authenticated USING (auth.uid() = user_id);
  END IF;
END $$;
REVOKE ALL ON public.ia_uso_diario FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.ia_uso_diario TO authenticated;

-- Consome 1 unidade de cota no dia (BRT) de forma atômica. Limpar chat não zera esta tabela.
CREATE OR REPLACE FUNCTION public.ia_consumir_cota(p_limite INTEGER DEFAULT 50)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user   UUID := auth.uid();
  v_hoje   DATE := (pg_catalog.now() AT TIME ZONE 'America/Sao_Paulo')::DATE;
  v_limite INTEGER := GREATEST(COALESCE(p_limite, 50), 1);
  v_usado  INTEGER;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.ia_uso_diario (user_id, dia, quantidade, updated_at)
    VALUES (v_user, v_hoje, 1, pg_catalog.now())
    ON CONFLICT (user_id, dia) DO UPDATE
      SET quantidade = public.ia_uso_diario.quantidade + 1,
          updated_at = pg_catalog.now()
      WHERE public.ia_uso_diario.quantidade < v_limite
    RETURNING quantidade INTO v_usado;
  IF v_usado IS NULL THEN
    SELECT quantidade INTO v_usado FROM public.ia_uso_diario WHERE user_id = v_user AND dia = v_hoje;
    RETURN pg_catalog.jsonb_build_object('permitido', false, 'usado', COALESCE(v_usado, v_limite), 'limite', v_limite);
  END IF;
  RETURN pg_catalog.jsonb_build_object('permitido', true, 'usado', v_usado, 'limite', v_limite);
END;
$$;
REVOKE ALL ON FUNCTION public.ia_consumir_cota(INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ia_consumir_cota(INTEGER) TO authenticated;

-- Contrato compartilhado com o cliente: uma linha por pessoa, JSONs sem perda de precisão.
CREATE TABLE IF NOT EXISTS public.perfil_saude (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  estado TEXT NOT NULL CHECK (estado IN ('respondido','adiado')),
  respostas JSONB CHECK (pg_column_size(respostas) <= 16384) CHECK (respostas IS NULL OR pg_catalog.jsonb_typeof(respostas) = 'object'),
  metas JSONB CHECK (pg_column_size(metas) <= 16384) CHECK (metas IS NULL OR pg_catalog.jsonb_typeof(metas) = 'object'),
  prazo_meta DATE,
  ritmo_pct NUMERIC(6,4) NOT NULL,
  formula_versao TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now()
);
ALTER TABLE public.perfil_saude ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_policies WHERE schemaname='public' AND tablename='perfil_saude' AND policyname='users_own_data') THEN
    CREATE POLICY users_own_data ON public.perfil_saude FOR ALL TO authenticated
      USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_trigger WHERE tgrelid='public.perfil_saude'::pg_catalog.regclass AND tgname='trg_perfil_saude_updated_at') THEN
    CREATE TRIGGER trg_perfil_saude_updated_at BEFORE UPDATE ON public.perfil_saude
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;
REVOKE ALL ON public.perfil_saude FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.perfil_saude TO authenticated;

CREATE TABLE IF NOT EXISTS private.whatsapp_manutencoes (dia DATE PRIMARY KEY);
REVOKE ALL ON private.whatsapp_manutencoes FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.whatsapp_manutencao_diaria(p_segredo TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_dia DATE := (pg_catalog.now() AT TIME ZONE 'America/Sao_Paulo')::DATE;
  v_msgs INTEGER;
  v_acoes INTEGER;
  v_env   INTEGER;
  v_ia    INTEGER;
BEGIN
  IF NOT private.whatsapp_segredo_ok(p_segredo) THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'nao_autorizado');
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(160016);
  INSERT INTO private.whatsapp_manutencoes(dia) VALUES (v_dia) ON CONFLICT DO NOTHING;
  IF NOT FOUND THEN RETURN pg_catalog.jsonb_build_object('ok', true, 'repetida', true); END IF;
  DELETE FROM private.whatsapp_manutencoes WHERE dia < v_dia - 30;
  DELETE FROM private.whatsapp_mensagens WHERE created_at < pg_catalog.now() - INTERVAL '7 days';
  GET DIAGNOSTICS v_msgs = ROW_COUNT;
  DELETE FROM private.whatsapp_acoes WHERE created_at < pg_catalog.now() - INTERVAL '30 days';
  GET DIAGNOSTICS v_acoes = ROW_COUNT;
  DELETE FROM private.whatsapp_envios WHERE created_at < pg_catalog.now() - INTERVAL '60 days';
  GET DIAGNOSTICS v_env = ROW_COUNT;
  DELETE FROM public.ia_uso_diario WHERE dia < ((pg_catalog.now() AT TIME ZONE 'America/Sao_Paulo')::DATE - 90);
  GET DIAGNOSTICS v_ia = ROW_COUNT;
  RETURN pg_catalog.jsonb_build_object('ok', true, 'mensagens', v_msgs, 'acoes', v_acoes, 'envios', v_env, 'ia_uso', v_ia);
END;
$$;
REVOKE ALL ON FUNCTION public.whatsapp_manutencao_diaria(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.whatsapp_manutencao_diaria(TEXT) TO anon;

CREATE OR REPLACE FUNCTION public.whatsapp_registrar(p_segredo TEXT, p_telefone TEXT, p_mensagem_id TEXT, p_tipo TEXT, p_dados JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_reg_id UUID;
  v_alvo public.contas_pagar;
  v_ids UUID[];
  v_comp TEXT;
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

  -- Serializa registros e desfazer do mesmo dono, incluindo números alternativos.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user::TEXT, 16));
  IF p_mensagem_id IS NOT NULL THEN
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
    -- Só concilia competência corrente e nome exato normalizado; tolerância de 1% (mínimo R$ 0,01).
    -- Nunca desempata candidatos: duas contas elegíveis significam gasto simples.
    v_comp := pg_catalog.to_char(v_hoje, 'YYYY-MM');
    IF p_tipo = 'gasto' AND pg_catalog.to_char(v_data,'YYYY-MM') = v_comp THEN
      SELECT pg_catalog.array_agg(c.id) INTO v_ids FROM public.contas_pagar c
      WHERE c.user_id=v_user AND c.ativo
        AND private.normalizar_texto(c.descricao) = private.normalizar_texto(
          pg_catalog.regexp_replace(v_desc, '^(paguei|pago|pagar)\s+', '', 'i'))
        AND (COALESCE(p_dados->>'pagar','false') = 'true'
          OR pg_catalog.abs(c.valor-v_valor) <= GREATEST(0.01,c.valor*0.01))
        AND ((c.recorrencia='mensal' AND v_comp >= pg_catalog.to_char(c.created_at AT TIME ZONE 'America/Sao_Paulo','YYYY-MM'))
          OR (c.recorrencia='anual' AND c.mes_vencimento=EXTRACT(MONTH FROM v_hoje)::INT
            AND v_comp >= pg_catalog.to_char(c.created_at AT TIME ZONE 'America/Sao_Paulo','YYYY-MM'))
          OR (c.recorrencia='unica' AND pg_catalog.to_char(c.data_vencimento,'YYYY-MM')=v_comp))
        AND NOT EXISTS(SELECT 1 FROM public.pagamentos_conta pc WHERE pc.conta_id=c.id AND pc.competencia=v_comp);
      IF pg_catalog.cardinality(v_ids)=1 THEN
        SELECT * INTO v_alvo FROM public.contas_pagar WHERE id=v_ids[1] AND user_id=v_user FOR UPDATE;
        -- App pode ter pago enquanto aguardávamos o lock da conta.
        IF NOT v_alvo.ativo OR EXISTS(SELECT 1 FROM public.pagamentos_conta WHERE conta_id=v_alvo.id AND competencia=v_comp) THEN
          v_alvo := NULL;
        END IF;
      END IF;
    END IF;
    IF v_valor IS NULL AND p_tipo='gasto' AND COALESCE(p_dados->>'pagar','false')='true' THEN
      IF v_alvo.id IS NULL THEN RETURN pg_catalog.jsonb_build_object('ok',false,'erro','conta_nao_identificada'); END IF;
      v_valor := v_alvo.valor;
    END IF;
    IF v_valor IS NULL OR v_valor <= 0 OR v_valor > 1000000 THEN RETURN jsonb_build_object('ok', false, 'erro', 'valor_invalido'); END IF;
    -- Mesma regra do app: o último banco usado, senão o primeiro ativo.
    SELECT t.carteira_id INTO v_carteira FROM public.transacoes t JOIN public.carteiras c ON c.id = t.carteira_id
      WHERE t.user_id = v_user AND NOT c.arquivada ORDER BY t.created_at DESC LIMIT 1;
    IF v_carteira IS NULL THEN
      SELECT id INTO v_carteira FROM public.carteiras WHERE user_id = v_user AND NOT arquivada ORDER BY ordem, created_at LIMIT 1;
    END IF;
    v_cat := pg_catalog.left(COALESCE(NULLIF(p_dados->>'categoria', ''), CASE WHEN p_tipo = 'gasto' THEN 'Outros' ELSE 'Extra' END), 40);
    IF v_alvo.id IS NOT NULL THEN
      v_cat := v_alvo.categoria;
      v_desc := v_alvo.descricao;
    END IF;
    INSERT INTO public.transacoes (user_id, tipo, categoria, descricao, valor, data, carteira_id, origem, automatico)
    VALUES (v_user, CASE WHEN p_tipo = 'gasto' THEN 'despesa' ELSE 'receita' END,
            v_cat, COALESCE(NULLIF(v_desc, ''), v_cat), pg_catalog.round(v_valor, 2), v_data, v_carteira, 'whatsapp', v_alvo.id IS NOT NULL) RETURNING id INTO v_reg_id;
    INSERT INTO private.whatsapp_acoes(telefone,user_id,tipo,registro_id,descricao,valor)
      VALUES(p_telefone,v_user,'transacao',v_reg_id,COALESCE(NULLIF(v_desc,''),v_cat),pg_catalog.round(v_valor,2));
    IF v_alvo.id IS NOT NULL THEN
      INSERT INTO public.pagamentos_conta(conta_id,user_id,competencia,pago_em,transacao_id)
        VALUES(v_alvo.id,v_user,v_comp,v_data,v_reg_id);
      UPDATE private.whatsapp_acoes SET tipo='pagamento_conta',conta_id=v_alvo.id,competencia=v_comp
        WHERE registro_id=v_reg_id AND user_id=v_user;
      v_extras := v_extras || pg_catalog.jsonb_build_object('conta_paga',v_alvo.descricao);
    END IF;
    v_extras := v_extras || pg_catalog.jsonb_build_object('valor_registrado',pg_catalog.round(v_valor,2));
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
    VALUES (v_user, v_data, pg_catalog.left(v_desc, 120), v_min, 'whatsapp') RETURNING id INTO v_reg_id;
    INSERT INTO private.whatsapp_acoes(telefone,user_id,tipo,registro_id,descricao) VALUES(p_telefone,v_user,'treino',v_reg_id,pg_catalog.left(v_desc,120));
    v_extras := jsonb_build_object('treinos_semana', (SELECT COUNT(DISTINCT r.data) FROM public.registros_treino r
      WHERE r.user_id = v_user AND r.data >= pg_catalog.date_trunc('week', v_hoje)::DATE AND r.data <= v_hoje));
  ELSIF p_tipo = 'refeicao' THEN
    IF v_desc = '' OR COALESCE(p_dados->>'tipo', '') NOT IN ('cafe', 'almoco', 'lanche', 'jantar', 'ceia') THEN
      RETURN jsonb_build_object('ok', false, 'erro', 'refeicao_invalida');
    END IF;
    INSERT INTO public.registros_refeicao (user_id, data, tipo, descricao, origem)
    VALUES (v_user, v_data, p_dados->>'tipo', v_desc, 'whatsapp') RETURNING id INTO v_reg_id;
    INSERT INTO private.whatsapp_acoes(telefone,user_id,tipo,registro_id,descricao) VALUES(p_telefone,v_user,'refeicao',v_reg_id,v_desc);
    v_extras := jsonb_build_object('refeicoes_dia', (SELECT COUNT(*) FROM public.registros_refeicao r WHERE r.user_id = v_user AND r.data = v_data));
  ELSE
    RETURN jsonb_build_object('ok', false, 'erro', 'tipo_invalido');
  END IF;
  RETURN jsonb_build_object('ok', true, 'nome', v_nome, 'extras', v_extras || private.whatsapp_contexto(v_user, p_tipo, v_data));
END $$;

CREATE OR REPLACE FUNCTION public.whatsapp_desfazer(p_segredo TEXT, p_telefone TEXT, p_mensagem_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user UUID;
  v_nome TEXT;
  v_acao private.whatsapp_acoes;
  v_removidos INTEGER := 0;
  v_pag  public.pagamentos_conta;
BEGIN
  IF NOT private.whatsapp_segredo_ok(p_segredo) THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'nao_autorizado');
  END IF;

  SELECT id, nome INTO v_user, v_nome FROM public.profiles
   WHERE whatsapp IN (p_telefone, private.whatsapp_variante(p_telefone))
   ORDER BY (whatsapp = p_telefone) DESC LIMIT 1;
  IF v_user IS NULL THEN RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'numero_sem_conta'); END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user::TEXT,16));
  IF p_mensagem_id IS NOT NULL THEN
    INSERT INTO private.whatsapp_mensagens (id) VALUES (p_mensagem_id) ON CONFLICT (id) DO NOTHING;
    IF NOT FOUND THEN RETURN pg_catalog.jsonb_build_object('ok', true, 'nome', v_nome, 'duplicada', true); END IF;
  END IF;

  SELECT * INTO v_acao FROM private.whatsapp_acoes
   WHERE user_id = v_user
     AND created_at >= pg_catalog.now() - INTERVAL '30 minutes'
   ORDER BY created_at DESC, id DESC
   LIMIT 1
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN pg_catalog.jsonb_build_object('ok', true, 'desfeito', false);
  END IF;

  IF v_acao.desfeito_em IS NOT NULL THEN
    RETURN pg_catalog.jsonb_build_object('ok', true, 'desfeito', false, 'ja_desfeito', true);
  END IF;

  IF v_acao.tipo = 'pagamento_conta' THEN
    -- Mesma ordem de locks e DELETEs da desfazer_pagamento (005), 100% compatível com os triggers da 006.
    PERFORM 1 FROM public.contas_pagar WHERE id = v_acao.conta_id AND user_id = v_user FOR UPDATE;
    SELECT * INTO v_pag FROM public.pagamentos_conta
     WHERE conta_id = v_acao.conta_id AND competencia = v_acao.competencia AND user_id = v_user FOR UPDATE;
    IF FOUND AND v_pag.transacao_id = v_acao.registro_id THEN
      DELETE FROM public.transacoes WHERE id = v_acao.registro_id AND user_id = v_user AND origem='whatsapp';
      GET DIAGNOSTICS v_removidos = ROW_COUNT;
      IF v_removidos > 0 THEN
        DELETE FROM public.pagamentos_conta WHERE id = v_pag.id AND user_id = v_user;
      END IF;
    END IF;
  ELSIF v_acao.tipo = 'transacao' THEN
    DELETE FROM public.transacoes WHERE id = v_acao.registro_id AND user_id = v_user AND origem='whatsapp';
    GET DIAGNOSTICS v_removidos = ROW_COUNT;
  ELSIF v_acao.tipo = 'treino' THEN
    DELETE FROM public.registros_treino WHERE id = v_acao.registro_id AND user_id = v_user AND origem='whatsapp';
    GET DIAGNOSTICS v_removidos = ROW_COUNT;
  ELSIF v_acao.tipo = 'refeicao' THEN
    DELETE FROM public.registros_refeicao WHERE id = v_acao.registro_id AND user_id = v_user AND origem='whatsapp';
    GET DIAGNOSTICS v_removidos = ROW_COUNT;
  END IF;

  UPDATE private.whatsapp_acoes SET desfeito_em = pg_catalog.now() WHERE id = v_acao.id;

  RETURN pg_catalog.jsonb_build_object(
    'ok', true,
    'desfeito', v_removidos > 0,
    'ja_apagado', v_removidos = 0,
    'nome', v_nome,
    'tipo', v_acao.tipo,
    'descricao', v_acao.descricao,
    'valor', v_acao.valor
  );
END $$;

REVOKE ALL ON FUNCTION public.whatsapp_registrar(TEXT, TEXT, TEXT, TEXT, JSONB), public.whatsapp_desfazer(TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.whatsapp_registrar(TEXT, TEXT, TEXT, TEXT, JSONB), public.whatsapp_desfazer(TEXT, TEXT, TEXT) TO anon;

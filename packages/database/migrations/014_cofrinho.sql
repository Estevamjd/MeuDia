-- 014: Cofrinho = dinheiro já guardado, separado do saldo dos bancos.
-- Depende de 000_baseline.sql + 005_financas.sql + 006_carteiras.sql; PostgreSQL 15+.
-- Apenas ADITIVA e idempotente: nenhuma tabela/coluna existente é removida ou reescrita; nenhum lançamento muda.
--
-- Regra: gasto não mexe no Cofrinho. Ele só muda por ação explícita: "Guardar", "Tirar", "Corrigir" e o
-- "guardar a sobra" do fechamento do mês. Saldo = soma de cofrinho_movimentos (histórico só cresce: sem UPDATE/DELETE).
-- Ponto de partida ("inicial"): o Cofrinho de antes desta migração = soma dos bancos ativos "no total" até hoje
-- (mesma conta de saldoHoje/corrigir_saldo da 006), congelado uma vez por usuário. Valor do usuário nunca muda aqui.

CREATE TABLE IF NOT EXISTS public.cofrinho_movimentos (
  id              UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tipo            TEXT NOT NULL CHECK (tipo IN ('inicial','guardar','tirar','corrigir','sobra')),
  valor           DECIMAL(12,2) NOT NULL,          -- com sinal: + entra no Cofrinho, − sai
  competencia     TEXT CHECK (competencia ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),  -- só no "sobra" (mês fechado)
  chave           UUID,                            -- idempotência do toque (mesma chave = mesmo movimento)
  valor_informado DECIMAL(12,2),                   -- "Corrigir": valor que a pessoa digitou
  created_at      TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
  CONSTRAINT cofrinho_mov_sinal CHECK (
    (tipo IN ('guardar','sobra') AND valor > 0) OR (tipo = 'tirar' AND valor < 0) OR tipo IN ('inicial','corrigir')),
  CONSTRAINT cofrinho_mov_competencia CHECK ((tipo = 'sobra') = (competencia IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS idx_cofrinho_mov_user ON public.cofrinho_movimentos(user_id, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS uq_cofrinho_mov_inicial ON public.cofrinho_movimentos(user_id) WHERE tipo = 'inicial';
CREATE UNIQUE INDEX IF NOT EXISTS uq_cofrinho_mov_sobra ON public.cofrinho_movimentos(user_id, competencia) WHERE tipo = 'sobra';
CREATE UNIQUE INDEX IF NOT EXISTS uq_cofrinho_mov_chave ON public.cofrinho_movimentos(user_id, chave) WHERE chave IS NOT NULL;

-- Resposta à pergunta "Sobrou R$ X em <mês>. Quer guardar no Cofrinho?": uma vez por mês.
CREATE TABLE IF NOT EXISTS public.cofrinho_fechamentos (
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  competencia TEXT NOT NULL CHECK (competencia ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  decisao     TEXT NOT NULL CHECK (decisao IN ('guardou','agora_nao')),
  valor       DECIMAL(12,2),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
  PRIMARY KEY (user_id, competencia),
  CONSTRAINT cofrinho_fech_valor CHECK ((decisao = 'guardou') = (valor IS NOT NULL AND valor > 0))
);

ALTER TABLE public.cofrinho_movimentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cofrinho_fechamentos ENABLE ROW LEVEL SECURITY;
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['cofrinho_movimentos','cofrinho_fechamentos'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_policies WHERE schemaname = 'public' AND tablename = t AND policyname = 'cofrinho_dono_select') THEN
      EXECUTE pg_catalog.format('CREATE POLICY cofrinho_dono_select ON public.%I FOR SELECT USING (auth.uid() = user_id)', t);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_policies WHERE schemaname = 'public' AND tablename = t AND policyname = 'cofrinho_dono_insert') THEN
      EXECUTE pg_catalog.format('CREATE POLICY cofrinho_dono_insert ON public.%I FOR INSERT WITH CHECK (auth.uid() = user_id)', t);
    END IF;
  END LOOP;
END $$;

-- Soma dos bancos ativos "no total" até p_hoje (R2/R3 da 006, igual a saldoHoje em packages/shared/src/utils/saldo.ts).
-- SECURITY INVOKER: no app, a RLS só deixa ver os bancos do próprio usuário.
CREATE OR REPLACE FUNCTION public.cofrinho_total_bancos(p_user UUID, p_hoje DATE)
RETURNS NUMERIC
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = ''
AS $$
  SELECT coalesce(pg_catalog.sum(
      c.saldo_inicial
      + coalesce((SELECT pg_catalog.sum(CASE WHEN t.tipo = 'receita' THEN t.valor ELSE -t.valor END)
          FROM public.transacoes t
          WHERE t.user_id = c.user_id AND t.carteira_id = c.id AND t.data <= p_hoje
            AND (t.data > (c.saldo_inicial_em AT TIME ZONE 'America/Sao_Paulo')::date
                 OR (t.data = (c.saldo_inicial_em AT TIME ZONE 'America/Sao_Paulo')::date AND t.created_at > c.saldo_inicial_em))), 0)
      + coalesce((SELECT pg_catalog.sum(CASE WHEN tr.destino_id = c.id THEN tr.valor ELSE -tr.valor END)
          FROM public.transferencias tr
          WHERE tr.user_id = c.user_id AND (tr.origem_id = c.id OR tr.destino_id = c.id) AND tr.data <= p_hoje
            AND (tr.data > (c.saldo_inicial_em AT TIME ZONE 'America/Sao_Paulo')::date
                 OR (tr.data = (c.saldo_inicial_em AT TIME ZONE 'America/Sao_Paulo')::date AND tr.created_at > c.saldo_inicial_em))), 0)
    ), 0)::NUMERIC(12,2)
  FROM public.carteiras c
  WHERE c.user_id = p_user AND NOT c.arquivada AND c.incluir_no_total
$$;

-- Garante o ponto de partida do usuário logado (idempotente). Chamada sob o lock do usuário pelas RPCs abaixo.
CREATE OR REPLACE FUNCTION public.cofrinho_garantir_inicial()
RETURNS VOID
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE
  v_user UUID := auth.uid();
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.cofrinho_movimentos (user_id, tipo, valor)
    VALUES (v_user, 'inicial', public.cofrinho_total_bancos(v_user, (pg_catalog.now() AT TIME ZONE 'America/Sao_Paulo')::date))
    ON CONFLICT (user_id) WHERE tipo = 'inicial' DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.cofrinho_saldo_atual()
RETURNS NUMERIC
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = ''
AS $$
  SELECT coalesce(pg_catalog.sum(valor), 0)::NUMERIC(12,2) FROM public.cofrinho_movimentos WHERE user_id = auth.uid()
$$;

-- Primeiro acesso depois da migração (usuário novo): congela o ponto de partida se já houver banco.
CREATE OR REPLACE FUNCTION public.cofrinho_iniciar()
RETURNS NUMERIC
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING ERRCODE = '42501';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('cofrinho:' || auth.uid()::text, 0));
  IF EXISTS (SELECT 1 FROM public.carteiras WHERE user_id = auth.uid()) THEN
    PERFORM public.cofrinho_garantir_inicial();
  END IF;
  RETURN public.cofrinho_saldo_atual();
END;
$$;

-- "Guardar no Cofrinho" (+) e "Tirar do Cofrinho" (−). p_valor sempre positivo; tirar não pode passar do saldo.
CREATE OR REPLACE FUNCTION public.cofrinho_mover(p_tipo TEXT, p_valor NUMERIC, p_chave UUID)
RETURNS SETOF public.cofrinho_movimentos
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_mov public.cofrinho_movimentos;
  v_sinal NUMERIC;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING ERRCODE = '42501';
  END IF;
  IF p_tipo NOT IN ('guardar','tirar') THEN
    RAISE EXCEPTION 'Tipo inválido' USING ERRCODE = '22023';
  END IF;
  IF p_chave IS NULL THEN
    RAISE EXCEPTION 'Chave de idempotência obrigatória' USING ERRCODE = '22023';
  END IF;
  IF p_valor IS NULL OR p_valor <= 0 OR p_valor <> pg_catalog.round(p_valor, 2) OR p_valor > 99999999.99 THEN
    RAISE EXCEPTION 'Valor inválido' USING ERRCODE = '22023', HINT = 'Exige valor positivo com no máximo 2 casas.';
  END IF;
  v_sinal := CASE WHEN p_tipo = 'guardar' THEN p_valor ELSE -p_valor END;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('cofrinho:' || v_user::text, 0));
  SELECT * INTO v_mov FROM public.cofrinho_movimentos WHERE user_id = v_user AND chave = p_chave;
  IF FOUND THEN
    IF v_mov.tipo IS DISTINCT FROM p_tipo OR v_mov.valor IS DISTINCT FROM v_sinal THEN
      RAISE EXCEPTION 'Chave já usada com outro valor' USING ERRCODE = '22023';
    END IF;
    RETURN NEXT v_mov;
    RETURN;
  END IF;
  PERFORM public.cofrinho_garantir_inicial();
  IF p_tipo = 'tirar' AND p_valor > public.cofrinho_saldo_atual() THEN
    RAISE EXCEPTION 'Saldo do Cofrinho insuficiente' USING ERRCODE = '22023', HINT = 'cofrinho_insuficiente';
  END IF;
  INSERT INTO public.cofrinho_movimentos (user_id, tipo, valor, chave)
    VALUES (v_user, p_tipo, v_sinal, p_chave) RETURNING * INTO v_mov;
  RETURN NEXT v_mov;
END;
$$;

-- "Corrigir": lança a diferença para o Cofrinho ficar igual ao valor informado (≥ 0). Sem diferença, nada.
CREATE OR REPLACE FUNCTION public.cofrinho_corrigir(p_valor_real NUMERIC, p_chave UUID)
RETURNS SETOF public.cofrinho_movimentos
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_mov public.cofrinho_movimentos;
  v_dif NUMERIC;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING ERRCODE = '42501';
  END IF;
  IF p_chave IS NULL THEN
    RAISE EXCEPTION 'Chave de idempotência obrigatória' USING ERRCODE = '22023';
  END IF;
  IF p_valor_real IS NULL OR p_valor_real < 0 OR p_valor_real <> pg_catalog.round(p_valor_real, 2) OR p_valor_real > 99999999.99 THEN
    RAISE EXCEPTION 'Valor inválido' USING ERRCODE = '22023', HINT = 'Exige valor de 0 a 99.999.999,99 com no máximo 2 casas.';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('cofrinho:' || v_user::text, 0));
  SELECT * INTO v_mov FROM public.cofrinho_movimentos WHERE user_id = v_user AND chave = p_chave;
  IF FOUND THEN
    IF v_mov.tipo <> 'corrigir' OR v_mov.valor_informado IS DISTINCT FROM p_valor_real THEN
      RAISE EXCEPTION 'Chave já usada com outro valor' USING ERRCODE = '22023';
    END IF;
    RETURN NEXT v_mov;
    RETURN;
  END IF;
  PERFORM public.cofrinho_garantir_inicial();
  v_dif := p_valor_real - public.cofrinho_saldo_atual();
  IF v_dif = 0 THEN
    RETURN;
  END IF;
  INSERT INTO public.cofrinho_movimentos (user_id, tipo, valor, chave, valor_informado)
    VALUES (v_user, 'corrigir', v_dif, p_chave, p_valor_real) RETURNING * INTO v_mov;
  RETURN NEXT v_mov;
END;
$$;

-- Fechamento do mês: grava a resposta uma vez só por competência (mês atual ou o anterior).
-- p_guardar = TRUE soma p_valor ao Cofrinho; repetir a chamada não soma de novo (devolve a decisão já gravada).
CREATE OR REPLACE FUNCTION public.cofrinho_fechar_mes(p_competencia TEXT, p_guardar BOOLEAN, p_valor NUMERIC)
RETURNS public.cofrinho_fechamentos
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_hoje DATE := (pg_catalog.now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_atual TEXT := pg_catalog.to_char(v_hoje, 'YYYY-MM');
  v_anterior TEXT := pg_catalog.to_char(v_hoje - INTERVAL '1 month', 'YYYY-MM');
  v_fech public.cofrinho_fechamentos;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING ERRCODE = '42501';
  END IF;
  IF p_competencia IS NULL OR p_competencia NOT IN (v_atual, v_anterior) THEN
    RAISE EXCEPTION 'Competência inválida' USING ERRCODE = '22023', HINT = 'Só o mês atual ou o anterior.';
  END IF;
  IF p_guardar IS NULL OR (p_guardar AND (p_valor IS NULL OR p_valor <= 0 OR p_valor <> pg_catalog.round(p_valor, 2) OR p_valor > 99999999.99)) THEN
    RAISE EXCEPTION 'Valor inválido' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('cofrinho:' || v_user::text, 0));
  SELECT * INTO v_fech FROM public.cofrinho_fechamentos WHERE user_id = v_user AND competencia = p_competencia;
  IF FOUND THEN
    RETURN v_fech;
  END IF;
  IF p_guardar THEN
    PERFORM public.cofrinho_garantir_inicial();
    INSERT INTO public.cofrinho_movimentos (user_id, tipo, valor, competencia)
      VALUES (v_user, 'sobra', p_valor, p_competencia);
  END IF;
  INSERT INTO public.cofrinho_fechamentos (user_id, competencia, decisao, valor)
    VALUES (v_user, p_competencia, CASE WHEN p_guardar THEN 'guardou' ELSE 'agora_nao' END, CASE WHEN p_guardar THEN p_valor END)
    RETURNING * INTO v_fech;
  RETURN v_fech;
END;
$$;

-- Ponto de partida de quem já tem banco: o Cofrinho exibido hoje (soma dos bancos até hoje), uma vez só.
INSERT INTO public.cofrinho_movimentos (user_id, tipo, valor)
  SELECT u.user_id, 'inicial', public.cofrinho_total_bancos(u.user_id, (pg_catalog.now() AT TIME ZONE 'America/Sao_Paulo')::date)
  FROM (SELECT DISTINCT user_id FROM public.carteiras) u
  ON CONFLICT (user_id) WHERE tipo = 'inicial' DO NOTHING;

-- Histórico imutável: authenticated só lê e insere (as RPCs inserem como o próprio usuário; a RLS barra outro user_id).
REVOKE ALL ON public.cofrinho_movimentos, public.cofrinho_fechamentos FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.cofrinho_movimentos, public.cofrinho_fechamentos TO authenticated;
REVOKE EXECUTE ON FUNCTION public.cofrinho_total_bancos(UUID, DATE) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.cofrinho_garantir_inicial() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.cofrinho_saldo_atual() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.cofrinho_iniciar() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.cofrinho_mover(TEXT, NUMERIC, UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.cofrinho_corrigir(NUMERIC, UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.cofrinho_fechar_mes(TEXT, BOOLEAN, NUMERIC) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cofrinho_total_bancos(UUID, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cofrinho_garantir_inicial() TO authenticated;
GRANT EXECUTE ON FUNCTION public.cofrinho_saldo_atual() TO authenticated;
GRANT EXECUTE ON FUNCTION public.cofrinho_iniciar() TO authenticated;
GRANT EXECUTE ON FUNCTION public.cofrinho_mover(TEXT, NUMERIC, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cofrinho_corrigir(NUMERIC, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cofrinho_fechar_mes(TEXT, BOOLEAN, NUMERIC) TO authenticated;

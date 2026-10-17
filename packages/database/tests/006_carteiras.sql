-- Roteiro para banco local DESCARTÁVEL como superusuário (ver tests/supabase_stub.sql); nunca no Supabase.
-- DDL, grants e fixtures são revertidos ao final. Requer PostgreSQL 15+.
\set ON_ERROR_STOP on
BEGIN;
\ir ../migrations/000_baseline.sql
\ir ../migrations/005_financas.sql
\ir ../migrations/006_carteiras.sql
\ir ../migrations/006_carteiras.sql

-- IDs: usuários A=...a1, B=...b1; carteiras A=...a2/a3/a4(arquivada), B=...b2; rendas A=...a5/a6(inativa), B=...b5;
-- contas A=...a7, B=...b7; transação legada de A=...a8.
INSERT INTO auth.users (id, email) VALUES
  ('c0060000-0000-4000-8000-0000000000a1', 'c006-a@example.invalid'),
  ('c0060000-0000-4000-8000-0000000000b1', 'c006-b@example.invalid');
INSERT INTO public.carteiras (id, user_id, nome, saldo_inicial, saldo_inicial_em, arquivada) VALUES
  ('c0060000-0000-4000-8000-0000000000a2', 'c0060000-0000-4000-8000-0000000000a1', 'Nubank', 650, '2026-10-17 15:00:00+00', FALSE),
  ('c0060000-0000-4000-8000-0000000000a3', 'c0060000-0000-4000-8000-0000000000a1', 'Caixa', 50, '2026-10-17 15:00:00+00', FALSE),
  ('c0060000-0000-4000-8000-0000000000a4', 'c0060000-0000-4000-8000-0000000000a1', 'Antiga', 0, '2026-10-17 15:00:00+00', TRUE),
  ('c0060000-0000-4000-8000-0000000000b2', 'c0060000-0000-4000-8000-0000000000b1', 'Banco B', 10, '2026-10-17 15:00:00+00', FALSE);
INSERT INTO public.rendas (id, user_id, descricao, valor, dia_recebimento, ativo, carteira_id) VALUES
  ('c0060000-0000-4000-8000-0000000000a5', 'c0060000-0000-4000-8000-0000000000a1', 'Salário A', 900, 5, TRUE, 'c0060000-0000-4000-8000-0000000000a2'),
  ('c0060000-0000-4000-8000-0000000000a6', 'c0060000-0000-4000-8000-0000000000a1', 'Inativa A', 100, 10, FALSE, NULL),
  ('c0060000-0000-4000-8000-0000000000b5', 'c0060000-0000-4000-8000-0000000000b1', 'Salário B', 500, 5, TRUE, NULL);
INSERT INTO public.contas_pagar (id, user_id, descricao, categoria, valor, recorrencia, dia_vencimento, created_at) VALUES
  ('c0060000-0000-4000-8000-0000000000a7', 'c0060000-0000-4000-8000-0000000000a1', 'Luz', 'Luz', 120, 'mensal', 20, '2026-10-01 03:00:00+00'),
  ('c0060000-0000-4000-8000-0000000000b7', 'c0060000-0000-4000-8000-0000000000b1', 'Conta B', 'Contas', 70, 'mensal', 20, '2026-10-01 03:00:00+00');
-- Lançamento legado (antes da 006): sem carteira e sem ajuste explícito.
INSERT INTO public.transacoes (id, user_id, tipo, categoria, descricao, valor, data) VALUES
  ('c0060000-0000-4000-8000-0000000000a8', 'c0060000-0000-4000-8000-0000000000a1', 'despesa', 'Mercado', 'Legado', 30, '2026-10-02');

CREATE FUNCTION pg_temp.expect_error(statement TEXT, expected_state TEXT) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER AS $$
BEGIN
  BEGIN
    EXECUTE statement;
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = expected_state THEN RETURN; END IF;
    RAISE;
  END;
  RAISE EXCEPTION 'Operação deveria falhar com %: %', expected_state, statement;
END $$;

-- Estrutura: colunas novas nulas/default, legado intacto, RLS ligada, funções INVOKER + search_path vazio + grants.
DO $$
DECLARE f pg_catalog.regprocedure;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.transacoes WHERE id = 'c0060000-0000-4000-8000-0000000000a8' AND carteira_id IS NULL AND ajuste = FALSE)
    OR EXISTS (SELECT 1 FROM public.rendas WHERE id = 'c0060000-0000-4000-8000-0000000000b5' AND carteira_id IS NOT NULL) THEN
    RAISE EXCEPTION 'Defaults das colunas novas incorretos';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname IN ('carteiras', 'transferencias', 'recebimentos_renda') AND NOT c.relrowsecurity)
    OR (SELECT count(*) FROM pg_catalog.pg_policies WHERE schemaname = 'public'
      AND tablename IN ('carteiras', 'transferencias', 'recebimentos_renda') AND policyname = 'users_own_data') <> 3 THEN
    RAISE EXCEPTION 'RLS/policies das tabelas novas ausentes';
  END IF;
  IF pg_catalog.to_regprocedure('public.pagar_conta(uuid,text,date,text)') IS NULL THEN
    RAISE EXCEPTION 'pagar_conta da 005 deveria continuar existindo';
  END IF;
  FOREACH f IN ARRAY ARRAY['public.receber_renda(uuid,text,date,uuid)'::pg_catalog.regprocedure,
                          'public.desfazer_recebimento(uuid,text)'::pg_catalog.regprocedure,
                          'public.pagar_conta_v2(uuid,text,date,text,uuid)'::pg_catalog.regprocedure] LOOP
    IF pg_catalog.has_function_privilege('anon', f, 'EXECUTE')
      OR NOT pg_catalog.has_function_privilege('authenticated', f, 'EXECUTE')
      OR EXISTS (SELECT 1 FROM pg_catalog.pg_proc p,
        LATERAL pg_catalog.aclexplode(p.proacl) a WHERE p.oid = f AND a.grantee = 0 AND a.privilege_type = 'EXECUTE')
      OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_proc WHERE oid = f AND NOT prosecdef AND proconfig @> ARRAY['search_path=""']) THEN
      RAISE EXCEPTION 'Permissões/search_path/SECURITY INVOKER incorretos: %', f;
    END IF;
  END LOOP;
END $$;

-- CHECKs de carteira e transferência.
SELECT pg_temp.expect_error($q$INSERT INTO public.carteiras (user_id, nome, tipo)
  VALUES ('c0060000-0000-4000-8000-0000000000a1', 'X', 'cartao')$q$, '23514');
SELECT pg_temp.expect_error($q$INSERT INTO public.carteiras (user_id, nome)
  VALUES ('c0060000-0000-4000-8000-0000000000a1', '   ')$q$, '23514');
SELECT pg_temp.expect_error($q$INSERT INTO public.transferencias (user_id, origem_id, destino_id, valor, data)
  VALUES ('c0060000-0000-4000-8000-0000000000a1', 'c0060000-0000-4000-8000-0000000000a2', 'c0060000-0000-4000-8000-0000000000a2', 10, '2026-10-17')$q$, '23514');
SELECT pg_temp.expect_error($q$INSERT INTO public.transferencias (user_id, origem_id, destino_id, valor, data)
  VALUES ('c0060000-0000-4000-8000-0000000000a1', 'c0060000-0000-4000-8000-0000000000a2', 'c0060000-0000-4000-8000-0000000000a3', 0, '2026-10-17')$q$, '23514');

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.carteiras, public.transferencias, public.recebimentos_renda,
  public.transacoes, public.rendas, public.contas_pagar, public.pagamentos_conta TO authenticated;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'c0060000-0000-4000-8000-0000000000a1', true);

DO $$
DECLARE
  ua CONSTANT UUID := 'c0060000-0000-4000-8000-0000000000a1';
  ub CONSTANT UUID := 'c0060000-0000-4000-8000-0000000000b1';
  nubank CONSTANT UUID := 'c0060000-0000-4000-8000-0000000000a2';
  caixa CONSTANT UUID := 'c0060000-0000-4000-8000-0000000000a3';
  arquivada CONSTANT UUID := 'c0060000-0000-4000-8000-0000000000a4';
  cart_b CONSTANT UUID := 'c0060000-0000-4000-8000-0000000000b2';
  renda_a CONSTANT UUID := 'c0060000-0000-4000-8000-0000000000a5';
  renda_inativa CONSTANT UUID := 'c0060000-0000-4000-8000-0000000000a6';
  renda_b CONSTANT UUID := 'c0060000-0000-4000-8000-0000000000b5';
  conta_a CONSTANT UUID := 'c0060000-0000-4000-8000-0000000000a7';
  conta_b CONSTANT UUID := 'c0060000-0000-4000-8000-0000000000b7';
  c public.carteiras;
  r public.recebimentos_renda;
  r2 public.recebimentos_renda;
  p public.pagamentos_conta;
  t public.transacoes;
  comp TEXT;
BEGIN
  -- RLS: B invisível; A não consegue usar nem referenciar a carteira/renda/conta de B.
  IF EXISTS (SELECT 1 FROM public.carteiras WHERE id = cart_b)
    OR EXISTS (SELECT 1 FROM public.rendas WHERE id = renda_b)
    OR (SELECT count(*) FROM public.carteiras) <> 3 THEN
    RAISE EXCEPTION 'RLS expôs carteira/renda de B';
  END IF;
  PERFORM pg_temp.expect_error(pg_catalog.format('UPDATE public.carteiras SET user_id = %L WHERE id = %L', ub, nubank), '42501');
  PERFORM pg_temp.expect_error(pg_catalog.format($q$INSERT INTO public.carteiras (user_id, nome) VALUES (%L, 'Invasora')$q$, ub), '42501');
  PERFORM pg_temp.expect_error(pg_catalog.format($q$INSERT INTO public.transacoes (user_id, tipo, categoria, descricao, valor, carteira_id)
    VALUES (auth.uid(), 'despesa', 'Outros', 'FK carteira B', 1, %L)$q$, cart_b), '23503');
  PERFORM pg_temp.expect_error(pg_catalog.format($q$INSERT INTO public.transferencias (user_id, origem_id, destino_id, valor, data)
    VALUES (auth.uid(), %L, %L, 5, '2026-10-17')$q$, nubank, cart_b), '23503');
  PERFORM pg_temp.expect_error(pg_catalog.format($q$INSERT INTO public.rendas (user_id, descricao, valor, carteira_id)
    VALUES (auth.uid(), 'FK renda', 5, %L)$q$, cart_b), '23503');
  PERFORM pg_temp.expect_error(pg_catalog.format($q$INSERT INTO public.recebimentos_renda (renda_id, user_id, competencia, recebido_em)
    VALUES (%L, auth.uid(), '2026-10', '2026-10-05')$q$, renda_b), '23503');
  PERFORM pg_temp.expect_error(pg_catalog.format('SELECT public.receber_renda(%L, %L)', renda_b, '2026-10'), 'P0002');
  PERFORM pg_temp.expect_error(pg_catalog.format('SELECT public.desfazer_recebimento(%L, %L)', renda_b, '2026-10'), 'P0002');
  PERFORM pg_temp.expect_error(pg_catalog.format('SELECT public.receber_renda(%L, %L, NULL, %L)', renda_a, '2026-10', cart_b), 'P0002');
  PERFORM pg_temp.expect_error(pg_catalog.format('SELECT public.pagar_conta_v2(%L, %L, NULL, NULL, %L)', conta_a, '2026-10', cart_b), 'P0002');
  PERFORM pg_temp.expect_error(pg_catalog.format('SELECT public.pagar_conta_v2(%L, %L)', conta_b, '2026-10'), 'P0002');

  -- Validações de receber_renda.
  FOREACH comp IN ARRAY ARRAY['2026-13', '2026-00', '2026-1', '2026-10-01', '', NULL] LOOP
    PERFORM pg_temp.expect_error(pg_catalog.format('SELECT public.receber_renda(%L, %L)', renda_a, comp), '22023');
    PERFORM pg_temp.expect_error(pg_catalog.format('SELECT public.desfazer_recebimento(%L, %L)', renda_a, comp), '22023');
  END LOOP;
  PERFORM pg_temp.expect_error(pg_catalog.format('SELECT public.receber_renda(%L, %L)', renda_inativa, '2026-10'), '22023');
  PERFORM pg_temp.expect_error(pg_catalog.format('SELECT public.receber_renda(%L, %L, NULL, %L)', renda_a, '2026-10', arquivada), 'P0002');
  PERFORM pg_temp.expect_error(pg_catalog.format('SELECT public.desfazer_recebimento(%L, %L)', renda_a, '2026-10'), '22023');

  -- Recebi: receita "Salário" na carteira escolhida + recebimento; idempotência por competência.
  SELECT * INTO r FROM public.receber_renda(renda_a, '2026-10', '2026-10-17', caixa);
  SELECT * INTO STRICT t FROM public.transacoes WHERE id = r.transacao_id;
  IF r.competencia <> '2026-10' OR r.recebido_em <> DATE '2026-10-17' OR r.user_id <> ua
    OR t.tipo <> 'receita' OR t.categoria <> 'Salário' OR t.valor <> 900 OR t.data <> DATE '2026-10-17'
    OR t.carteira_id IS DISTINCT FROM caixa OR t.ajuste OR t.banco IS DISTINCT FROM 'Caixa' OR NOT t.automatico THEN
    RAISE EXCEPTION 'Recebimento/transação divergente';
  END IF;
  PERFORM pg_temp.expect_error(pg_catalog.format('SELECT public.receber_renda(%L, %L)', renda_a, '2026-10'), 'P0003');
  PERFORM pg_temp.expect_error(pg_catalog.format($q$INSERT INTO public.recebimentos_renda (renda_id, user_id, competencia, recebido_em)
    VALUES (%L, auth.uid(), '2026-10', '2026-10-05')$q$, renda_a), '23505');
  IF (SELECT count(*) FROM public.transacoes WHERE categoria = 'Salário') <> 1 THEN
    RAISE EXCEPTION 'Recebi duplicado criou outra receita';
  END IF;
  -- Sem carteira explícita usa a padrão da renda (Nubank) e a data de hoje em SP.
  SELECT * INTO r2 FROM public.receber_renda(renda_a, '2026-11');
  SELECT * INTO STRICT t FROM public.transacoes WHERE id = r2.transacao_id;
  IF t.carteira_id IS DISTINCT FROM nubank OR r2.recebido_em IS DISTINCT FROM (now() AT TIME ZONE 'America/Sao_Paulo')::date THEN
    RAISE EXCEPTION 'Carteira padrão da renda/data SP falhou';
  END IF;

  -- Desfazer remove recebimento e receita só da competência indicada.
  PERFORM public.desfazer_recebimento(renda_a, '2026-10');
  IF EXISTS (SELECT 1 FROM public.recebimentos_renda WHERE id = r.id)
    OR EXISTS (SELECT 1 FROM public.transacoes WHERE id = r.transacao_id)
    OR NOT EXISTS (SELECT 1 FROM public.recebimentos_renda WHERE id = r2.id)
    OR NOT EXISTS (SELECT 1 FROM public.transacoes WHERE id = r2.transacao_id) THEN
    RAISE EXCEPTION 'Desfazer recebimento afetou competência errada';
  END IF;
  PERFORM pg_temp.expect_error(pg_catalog.format('SELECT public.desfazer_recebimento(%L, %L)', renda_a, '2026-10'), '22023');
  -- Apagar a receita à mão: o recebimento fica, sem transação e com o mesmo dono.
  DELETE FROM public.transacoes WHERE id = r2.transacao_id;
  IF NOT EXISTS (SELECT 1 FROM public.recebimentos_renda WHERE id = r2.id AND transacao_id IS NULL AND user_id = ua) THEN
    RAISE EXCEPTION 'SET NULL da transação alterou proprietário do recebimento';
  END IF;
  PERFORM public.desfazer_recebimento(renda_a, '2026-11');

  -- Paguei com carteira (v2) e a pagar_conta antiga continua sem ambiguidade.
  SELECT * INTO p FROM public.pagar_conta_v2(conta_a, '2026-10', '2026-10-17', NULL, nubank);
  SELECT * INTO STRICT t FROM public.transacoes WHERE id = p.transacao_id;
  IF t.carteira_id IS DISTINCT FROM nubank OR t.banco IS DISTINCT FROM 'Nubank' OR t.tipo <> 'despesa' OR t.valor <> 120 OR t.ajuste THEN
    RAISE EXCEPTION 'pagar_conta_v2 não vinculou a carteira';
  END IF;
  PERFORM pg_temp.expect_error(pg_catalog.format('SELECT public.pagar_conta_v2(%L, %L, NULL, NULL, %L)', conta_a, '2026-10', caixa), 'P0003');
  PERFORM pg_temp.expect_error(pg_catalog.format('SELECT public.pagar_conta_v2(%L, %L, NULL, NULL, %L)', conta_a, '2026-11', arquivada), 'P0002');
  PERFORM public.desfazer_pagamento(conta_a, '2026-10');
  SELECT * INTO p FROM public.pagar_conta(conta_a, '2026-10');
  SELECT * INTO STRICT t FROM public.transacoes WHERE id = p.transacao_id;
  IF t.carteira_id IS NOT NULL THEN RAISE EXCEPTION 'pagar_conta antiga deveria manter carteira NULL'; END IF;
  PERFORM public.desfazer_pagamento(conta_a, '2026-10');
  SELECT * INTO p FROM public.pagar_conta_v2(conta_a, '2026-10');
  SELECT * INTO STRICT t FROM public.transacoes WHERE id = p.transacao_id;
  IF t.carteira_id IS NOT NULL OR t.banco IS NOT NULL THEN RAISE EXCEPTION 'pagar_conta_v2 sem carteira divergiu da antiga'; END IF;
  PERFORM public.desfazer_pagamento(conta_a, '2026-10');

  -- Transferência e ajuste do próprio usuário; trigger updated_at.
  INSERT INTO public.transferencias (user_id, origem_id, destino_id, valor, data) VALUES (ua, caixa, nubank, 50, '2026-10-17');
  INSERT INTO public.transacoes (user_id, tipo, categoria, descricao, valor, data, carteira_id, ajuste)
    VALUES (ua, 'receita', 'Ajuste de saldo', 'Correção', 3.5, '2026-10-17', nubank, TRUE);
  UPDATE public.carteiras SET updated_at = '2000-01-01' WHERE id = nubank RETURNING * INTO c;
  IF c.updated_at IS DISTINCT FROM now() THEN RAISE EXCEPTION 'Trigger updated_at de carteiras falhou'; END IF;
  -- Carteira com transferência não pode ser apagada (arquivar é o caminho).
  PERFORM pg_temp.expect_error(pg_catalog.format('DELETE FROM public.carteiras WHERE id = %L', caixa), '23503');
END $$;

SELECT set_config('request.jwt.claim.sub', 'c0060000-0000-4000-8000-0000000000b1', true);
DO $$
BEGIN
  IF (SELECT count(*) FROM public.carteiras) <> 1
    OR EXISTS (SELECT 1 FROM public.transferencias)
    OR EXISTS (SELECT 1 FROM public.recebimentos_renda)
    OR EXISTS (SELECT 1 FROM public.transacoes) THEN
    RAISE EXCEPTION 'Isolamento de B falhou';
  END IF;
  -- B também não consegue apontar para a carteira de A.
  PERFORM pg_temp.expect_error($q$SELECT public.receber_renda('c0060000-0000-4000-8000-0000000000b5', '2026-10', NULL, 'c0060000-0000-4000-8000-0000000000a2')$q$, 'P0002');
  UPDATE public.carteiras SET nome = 'Hack' WHERE id = 'c0060000-0000-4000-8000-0000000000a2';
  DELETE FROM public.carteiras WHERE id = 'c0060000-0000-4000-8000-0000000000a3';
END $$;
RESET ROLE;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.carteiras WHERE id = 'c0060000-0000-4000-8000-0000000000a2' AND nome = 'Nubank')
    OR NOT EXISTS (SELECT 1 FROM public.carteiras WHERE id = 'c0060000-0000-4000-8000-0000000000a3') THEN
    RAISE EXCEPTION 'B alterou carteiras de A';
  END IF;
END $$;

-- Carteira sem transferências apagada direto no banco: lançamentos ficam com carteira NULL e o mesmo dono.
INSERT INTO public.carteiras (id, user_id, nome) VALUES
  ('c0060000-0000-4000-8000-0000000000a9', 'c0060000-0000-4000-8000-0000000000a1', 'Temporária');
INSERT INTO public.transacoes (id, user_id, tipo, categoria, descricao, valor, carteira_id) VALUES
  ('c0060000-0000-4000-8000-0000000000aa', 'c0060000-0000-4000-8000-0000000000a1', 'despesa', 'Outros', 'Na temporária', 1, 'c0060000-0000-4000-8000-0000000000a9');
DELETE FROM public.carteiras WHERE id = 'c0060000-0000-4000-8000-0000000000a9';
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.transacoes WHERE id = 'c0060000-0000-4000-8000-0000000000aa'
    AND carteira_id IS NULL AND user_id = 'c0060000-0000-4000-8000-0000000000a1') THEN
    RAISE EXCEPTION 'SET NULL da carteira alterou proprietário';
  END IF;
END $$;

-- Excluir a conta (auth.users → profiles CASCADE) remove carteiras e transferências sem esbarrar nas FKs.
DELETE FROM auth.users WHERE id = 'c0060000-0000-4000-8000-0000000000a1';
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.carteiras WHERE user_id = 'c0060000-0000-4000-8000-0000000000a1')
    OR EXISTS (SELECT 1 FROM public.transferencias WHERE user_id = 'c0060000-0000-4000-8000-0000000000a1') THEN
    RAISE EXCEPTION 'CASCADE de profiles não limpou carteiras/transferências';
  END IF;
END $$;

-- Down repetível e novo up 2x; 000/005 preservados.
\ir ../migrations/006_carteiras_down.sql
\ir ../migrations/006_carteiras_down.sql
DO $$
BEGIN
  IF pg_catalog.to_regclass('public.carteiras') IS NOT NULL
    OR pg_catalog.to_regclass('public.transferencias') IS NOT NULL
    OR pg_catalog.to_regclass('public.recebimentos_renda') IS NOT NULL
    OR pg_catalog.to_regprocedure('public.pagar_conta_v2(uuid,text,date,text,uuid)') IS NOT NULL
    OR EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public'
      AND ((table_name = 'transacoes' AND column_name IN ('carteira_id', 'ajuste')) OR (table_name = 'rendas' AND column_name = 'carteira_id')))
    OR pg_catalog.to_regprocedure('public.pagar_conta(uuid,text,date,text)') IS NULL
    OR pg_catalog.to_regprocedure('public.set_updated_at()') IS NULL
    OR pg_catalog.to_regclass('public.pagamentos_conta') IS NULL
    OR NOT EXISTS (SELECT 1 FROM public.rendas WHERE id = 'c0060000-0000-4000-8000-0000000000b5') THEN
    RAISE EXCEPTION 'Down removeu demais ou de menos';
  END IF;
END $$;
\ir ../migrations/006_carteiras.sql
\ir ../migrations/006_carteiras.sql
DO $$
BEGIN
  IF pg_catalog.to_regprocedure('public.receber_renda(uuid,text,date,uuid)') IS NULL
    OR EXISTS (SELECT 1 FROM public.carteiras) THEN
    RAISE EXCEPTION 'Up após down falhou';
  END IF;
END $$;
ROLLBACK;

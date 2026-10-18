-- Roteiro para banco local DESCARTÁVEL como superusuário (ver tests/supabase_stub.sql); nunca no Supabase.
-- 000 + 005 + 006 + 007 (2x, idempotência), regras de exclusão, metas, downs 007 (2x) e 006, e up de novo.
-- DDL, grants e fixtures são revertidos ao final. Requer PostgreSQL 15+.
\set ON_ERROR_STOP on
BEGIN;
\ir ../migrations/000_baseline.sql
\ir ../migrations/005_financas.sql
-- Como no Supabase: tabelas novas nascem com ALL para anon/authenticated (default privileges). A 007 tem de revogar.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated;
\ir ../migrations/006_carteiras.sql
\ir ../migrations/007_excluir_metas.sql
\ir ../migrations/007_excluir_metas.sql

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

-- IDs: usuários A=...a1, B=...b1; carteiras A: Nubank=a2, Caixa=a3, Itaú=a4; B=b2; renda A=a5; conta A=a7; meta B=b9.
INSERT INTO auth.users (id, email) VALUES
  ('c0070000-0000-4000-8000-0000000000a1', 'c007-a@example.invalid'),
  ('c0070000-0000-4000-8000-0000000000b1', 'c007-b@example.invalid');
INSERT INTO public.carteiras (id, user_id, nome, saldo_inicial, saldo_inicial_em) VALUES
  ('c0070000-0000-4000-8000-0000000000a2', 'c0070000-0000-4000-8000-0000000000a1', 'Nubank', 100, now() - interval '10 days'),
  ('c0070000-0000-4000-8000-0000000000a3', 'c0070000-0000-4000-8000-0000000000a1', 'Caixa', 50, now() - interval '10 days'),
  ('c0070000-0000-4000-8000-0000000000a4', 'c0070000-0000-4000-8000-0000000000a1', 'Itaú', 0, now() - interval '10 days'),
  ('c0070000-0000-4000-8000-0000000000b2', 'c0070000-0000-4000-8000-0000000000b1', 'Banco B', 10, now() - interval '10 days');
INSERT INTO public.rendas (id, user_id, descricao, valor, dia_recebimento, carteira_id) VALUES
  ('c0070000-0000-4000-8000-0000000000a5', 'c0070000-0000-4000-8000-0000000000a1', 'Salário', 900, 5, 'c0070000-0000-4000-8000-0000000000a2');
INSERT INTO public.contas_pagar (id, user_id, descricao, categoria, valor, recorrencia, dia_vencimento, created_at) VALUES
  ('c0070000-0000-4000-8000-0000000000a7', 'c0070000-0000-4000-8000-0000000000a1', 'Luz', 'Luz', 120, 'mensal', 20, now() - interval '400 days');
INSERT INTO public.metas (id, user_id, nome, valor_alvo) VALUES
  ('c0070000-0000-4000-8000-0000000000b9', 'c0070000-0000-4000-8000-0000000000b1', 'Meta de B', 100);

-- Estrutura: metas com RLS/policy/trigger; transferências aceitam um lado NULL (nunca os dois); FKs SET NULL.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_class WHERE oid = 'public.metas'::pg_catalog.regclass AND relrowsecurity)
    OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_policies WHERE schemaname = 'public' AND tablename = 'metas'
      AND policyname = 'users_own_data' AND cmd = 'ALL')
    OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_trigger WHERE tgname = 'trg_metas_updated_at' AND tgrelid = 'public.metas'::pg_catalog.regclass) THEN
    RAISE EXCEPTION 'metas sem RLS/policy/trigger';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'transferencias'
      AND column_name IN ('origem_id', 'destino_id') AND is_nullable = 'NO') THEN
    RAISE EXCEPTION 'origem_id/destino_id deveriam aceitar NULL';
  END IF;
  IF (SELECT count(*) FROM pg_catalog.pg_constraint WHERE conrelid = 'public.transferencias'::pg_catalog.regclass
      AND contype = 'f' AND confrelid = 'public.carteiras'::pg_catalog.regclass AND confdeltype = 'n') <> 2
    OR EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.transferencias'::pg_catalog.regclass
      AND contype = 'f' AND confrelid = 'public.carteiras'::pg_catalog.regclass AND confdeltype <> 'n') THEN
    RAISE EXCEPTION 'FKs de transferências para carteiras deveriam ser só as duas ON DELETE SET NULL';
  END IF;
  -- DELETE coberto por policy de usuário (FOR ALL ou FOR DELETE) em todas as tabelas que o app apaga.
  IF EXISTS (SELECT t FROM unnest(ARRAY['transacoes', 'rendas', 'transferencias', 'carteiras', 'metas']) t
    WHERE NOT EXISTS (SELECT 1 FROM pg_catalog.pg_policies p WHERE p.schemaname = 'public' AND p.tablename = t
      AND p.cmd IN ('ALL', 'DELETE') AND p.qual = '(auth.uid() = user_id)')) THEN
    RAISE EXCEPTION 'Tabela sem policy de DELETE por usuário';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_proc WHERE oid = 'public.guardar_na_meta(uuid,numeric)'::pg_catalog.regprocedure
      AND NOT prosecdef AND proconfig @> ARRAY['search_path=""'])
    OR pg_catalog.has_function_privilege('anon', 'public.guardar_na_meta(uuid,numeric)', 'EXECUTE')
    OR NOT pg_catalog.has_function_privilege('authenticated', 'public.guardar_na_meta(uuid,numeric)', 'EXECUTE') THEN
    RAISE EXCEPTION 'guardar_na_meta: INVOKER/search_path/grants incorretos';
  END IF;
END $$;

-- Grants: authenticated com DELETE em carteiras e o necessário em metas; nunca TRUNCATE/REFERENCES/TRIGGER; anon nada.
DO $$
DECLARE
  t TEXT;
  p TEXT;
  esperado BOOLEAN;
BEGIN
  FOREACH t IN ARRAY ARRAY['carteiras', 'transferencias', 'recebimentos_renda', 'metas'] LOOP
    FOREACH p IN ARRAY ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'] LOOP
      IF pg_catalog.has_table_privilege('anon', 'public.' || t, p) THEN
        RAISE EXCEPTION 'anon não deveria ter % em %', p, t;
      END IF;
      esperado := p IN ('SELECT', 'INSERT', 'UPDATE', 'DELETE');
      IF pg_catalog.has_table_privilege('authenticated', 'public.' || t, p) IS DISTINCT FROM esperado THEN
        RAISE EXCEPTION 'Grant de authenticated incorreto: % em % (esperado %)', p, t, esperado;
      END IF;
    END LOOP;
  END LOOP;
END $$;

-- CHECKs de metas e da transferência sem os dois lados.
SELECT pg_temp.expect_error($q$INSERT INTO public.metas (user_id, nome, valor_alvo) VALUES ('c0070000-0000-4000-8000-0000000000a1', '  ', 10)$q$, '23514');
SELECT pg_temp.expect_error($q$INSERT INTO public.metas (user_id, nome, valor_alvo) VALUES ('c0070000-0000-4000-8000-0000000000a1', repeat('x', 81), 10)$q$, '23514');
SELECT pg_temp.expect_error($q$INSERT INTO public.metas (user_id, nome, valor_alvo) VALUES ('c0070000-0000-4000-8000-0000000000a1', 'X', 0)$q$, '23514');
SELECT pg_temp.expect_error($q$INSERT INTO public.metas (user_id, nome, valor_alvo, valor_guardado) VALUES ('c0070000-0000-4000-8000-0000000000a1', 'X', 10, -1)$q$, '23514');
SELECT pg_temp.expect_error($q$INSERT INTO public.metas (user_id, nome, valor_alvo, icone) VALUES ('c0070000-0000-4000-8000-0000000000a1', 'X', 10, '<script>')$q$, '23514');
SELECT pg_temp.expect_error($q$INSERT INTO public.transferencias (user_id, origem_id, destino_id, valor, data)
  VALUES ('c0070000-0000-4000-8000-0000000000a1', NULL, NULL, 10, CURRENT_DATE)$q$, '23514');

-- Estado do Supabase anterior à 006 (tabelas do baseline/005), como em tests/006_carteiras.sql.
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transacoes, public.rendas, public.contas_pagar, public.pagamentos_conta TO authenticated;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'c0070000-0000-4000-8000-0000000000a1', true);

DO $$
DECLARE
  ua CONSTANT UUID := 'c0070000-0000-4000-8000-0000000000a1';
  ub CONSTANT UUID := 'c0070000-0000-4000-8000-0000000000b1';
  nubank CONSTANT UUID := 'c0070000-0000-4000-8000-0000000000a2';
  caixa CONSTANT UUID := 'c0070000-0000-4000-8000-0000000000a3';
  itau CONSTANT UUID := 'c0070000-0000-4000-8000-0000000000a4';
  cart_b CONSTANT UUID := 'c0070000-0000-4000-8000-0000000000b2';
  renda CONSTANT UUID := 'c0070000-0000-4000-8000-0000000000a5';
  conta CONSTANT UUID := 'c0070000-0000-4000-8000-0000000000a7';
  meta_b CONSTANT UUID := 'c0070000-0000-4000-8000-0000000000b9';
  hoje CONSTANT DATE := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  comp CONSTANT TEXT := pg_catalog.to_char((now() AT TIME ZONE 'America/Sao_Paulo')::date, 'YYYY-MM');
  tr_ab UUID;
  tr_ac UUID;
  t_gasto UUID;
  t_ajuste UUID;
  p public.pagamentos_conta;
  r public.recebimentos_renda;
  m public.metas;
  n INTEGER;
BEGIN
  -- Transferências Nubank → Caixa 30 e Nubank → Itaú 20; Gastei 5 na Caixa; ajuste +7 na Caixa.
  INSERT INTO public.transferencias (user_id, origem_id, destino_id, valor, data) VALUES (ua, nubank, caixa, 30, hoje) RETURNING id INTO tr_ab;
  INSERT INTO public.transferencias (user_id, origem_id, destino_id, valor, data) VALUES (ua, nubank, itau, 20, hoje) RETURNING id INTO tr_ac;
  INSERT INTO public.transacoes (user_id, tipo, categoria, descricao, valor, data, carteira_id, banco)
    VALUES (ua, 'despesa', 'Comida', 'Gastei', 5, hoje, caixa, 'Caixa') RETURNING id INTO t_gasto;
  INSERT INTO public.transacoes (user_id, tipo, categoria, descricao, valor, data, carteira_id, ajuste)
    VALUES (ua, 'receita', 'Ajuste de saldo', 'Correção', 7, hoje, caixa, TRUE) RETURNING id INTO t_ajuste;
  -- Caixa = 50 + 30 − 5 + 7 = 82 (corrigir_saldo com o valor certo não cria nada).
  IF EXISTS (SELECT 1 FROM public.corrigir_saldo(caixa, 82, gen_random_uuid())) THEN
    RAISE EXCEPTION 'Saldo da Caixa antes da exclusão deveria ser 82';
  END IF;

  -- Paguei e Recebi no Nubank: lançamentos vinculados.
  p := public.pagar_conta_v2(conta, comp, hoje, NULL, nubank);
  r := public.receber_renda(renda, comp, hoje, nubank);

  -- DELETE direto do lançamento vinculado continua bloqueado (55000 no COMMIT; aqui forçado com IMMEDIATE).
  BEGIN
    DELETE FROM public.transacoes WHERE id = p.transacao_id;
    SET CONSTRAINTS ALL IMMEDIATE;
    RAISE EXCEPTION 'DELETE direto de lançamento vinculado deveria falhar';
  EXCEPTION WHEN SQLSTATE '55000' THEN NULL;
  END;
  SET CONSTRAINTS ALL DEFERRED;

  -- Excluir ajuste (permitido): o saldo volta ao anterior (82 − 7 = 75).
  DELETE FROM public.transacoes WHERE id = t_ajuste;
  IF EXISTS (SELECT 1 FROM public.corrigir_saldo(caixa, 75, gen_random_uuid())) THEN
    RAISE EXCEPTION 'Excluir ajuste deveria voltar a Caixa para 75';
  END IF;

  -- Excluir o Nubank (com transferências e lançamentos vinculados a Recebi/Paguei).
  DELETE FROM public.carteiras WHERE id = nubank;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'authenticated deveria conseguir apagar a própria carteira'; END IF;
  SET CONSTRAINTS ALL IMMEDIATE;  -- nenhum vínculo órfão (trg_vinculo_orfao não dispara)
  SET CONSTRAINTS ALL DEFERRED;
  -- Os demais bancos não mudam: Caixa 75, Itaú 20.
  IF EXISTS (SELECT 1 FROM public.corrigir_saldo(caixa, 75, gen_random_uuid()))
    OR EXISTS (SELECT 1 FROM public.corrigir_saldo(itau, 20, gen_random_uuid())) THEN
    RAISE EXCEPTION 'Excluir o Nubank mudou o saldo de outro banco';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.transferencias WHERE id = tr_ab AND origem_id IS NULL AND destino_id = caixa)
    OR NOT EXISTS (SELECT 1 FROM public.transferencias WHERE id = tr_ac AND origem_id IS NULL AND destino_id = itau) THEN
    RAISE EXCEPTION 'Transferências do banco excluído deveriam ficar com origem NULL';
  END IF;
  -- Lançamentos vinculados ficam "Sem banco" e o vínculo continua íntegro; a renda perde a carteira padrão.
  IF (SELECT count(*) FROM public.transacoes WHERE id IN (p.transacao_id, r.transacao_id) AND carteira_id IS NULL AND banco IS NULL AND user_id = ua) <> 2
    OR NOT EXISTS (SELECT 1 FROM public.pagamentos_conta WHERE id = p.id AND transacao_id = p.transacao_id)
    OR NOT EXISTS (SELECT 1 FROM public.recebimentos_renda WHERE id = r.id AND transacao_id = r.transacao_id)
    OR NOT EXISTS (SELECT 1 FROM public.rendas WHERE id = renda AND carteira_id IS NULL) THEN
    RAISE EXCEPTION 'SET NULL da carteira deixou vínculo inconsistente';
  END IF;

  -- Excluir lançamento vinculado = desfazer_* (apaga lançamento e vínculo; a conta volta a ficar a pagar).
  PERFORM public.desfazer_pagamento(conta, comp);
  IF EXISTS (SELECT 1 FROM public.transacoes WHERE id = p.transacao_id)
    OR EXISTS (SELECT 1 FROM public.pagamentos_conta WHERE conta_id = conta AND competencia = comp) THEN
    RAISE EXCEPTION 'desfazer_pagamento deveria apagar lançamento e pagamento';
  END IF;

  -- Excluir renda: o recebimento cai em cascata; a receita fica como receita comum (agora apagável direto).
  DELETE FROM public.rendas WHERE id = renda;
  SET CONSTRAINTS ALL IMMEDIATE;
  SET CONSTRAINTS ALL DEFERRED;
  IF EXISTS (SELECT 1 FROM public.recebimentos_renda WHERE renda_id = renda)
    OR NOT EXISTS (SELECT 1 FROM public.transacoes WHERE id = r.transacao_id) THEN
    RAISE EXCEPTION 'Excluir renda: recebimento deveria cair e a receita ficar';
  END IF;
  DELETE FROM public.transacoes WHERE id = r.transacao_id;
  SET CONSTRAINTS ALL IMMEDIATE;
  SET CONSTRAINTS ALL DEFERRED;

  -- Excluir transferência: os dois lados voltam (Itaú 20 → 0).
  DELETE FROM public.transferencias WHERE id = tr_ac;
  IF EXISTS (SELECT 1 FROM public.corrigir_saldo(itau, 0, gen_random_uuid())) THEN
    RAISE EXCEPTION 'Excluir transferência deveria voltar o Itaú a 0';
  END IF;

  -- Excluir o outro lado de uma transferência já sem origem: a transferência some (nunca fica sem os dois lados).
  DELETE FROM public.carteiras WHERE id = caixa;
  IF EXISTS (SELECT 1 FROM public.transferencias WHERE id = tr_ab)
    OR NOT EXISTS (SELECT 1 FROM public.transacoes WHERE id = t_gasto AND carteira_id IS NULL AND banco IS NULL) THEN
    RAISE EXCEPTION 'Transferência sem os dois bancos deveria sumir; lançamento fica sem banco';
  END IF;

  -- RLS: A não vê nem apaga carteira/meta de B.
  DELETE FROM public.carteiras WHERE id = cart_b;
  DELETE FROM public.metas WHERE id = meta_b;
  IF EXISTS (SELECT 1 FROM public.metas WHERE id = meta_b) THEN RAISE EXCEPTION 'RLS expôs meta de B'; END IF;
  PERFORM pg_temp.expect_error(pg_catalog.format($q$INSERT INTO public.metas (user_id, nome, valor_alvo) VALUES (%L, 'Invasora', 10)$q$, ub), '42501');
  PERFORM pg_temp.expect_error(pg_catalog.format($q$SELECT public.guardar_na_meta(%L, 10)$q$, meta_b), 'P0002');

  -- Metas: criar, Guardei (soma atômica), corrigir, excluir.
  INSERT INTO public.metas (user_id, nome, icone, valor_alvo, data_limite) VALUES (ua, 'Videogame', 'gamepad', 3000, '2027-01-31') RETURNING * INTO m;
  IF m.valor_guardado <> 0 OR m.criado_em IS NULL OR m.updated_at IS NULL THEN RAISE EXCEPTION 'Defaults de metas incorretos'; END IF;
  m := public.guardar_na_meta(m.id, 500);
  m := public.guardar_na_meta(m.id, 0.5);
  IF m.valor_guardado <> 500.5 THEN RAISE EXCEPTION 'Guardei deveria somar: %', m.valor_guardado; END IF;
  PERFORM pg_temp.expect_error(pg_catalog.format('SELECT public.guardar_na_meta(%L, 0)', m.id), '22023');
  PERFORM pg_temp.expect_error(pg_catalog.format('SELECT public.guardar_na_meta(%L, -1)', m.id), '22023');
  PERFORM pg_temp.expect_error(pg_catalog.format('SELECT public.guardar_na_meta(%L, 1.001)', m.id), '22023');
  UPDATE public.metas SET valor_guardado = 450 WHERE id = m.id;
  IF (SELECT valor_guardado FROM public.metas WHERE id = m.id) <> 450 THEN RAISE EXCEPTION 'Corrigir guardado falhou'; END IF;
  DELETE FROM public.metas WHERE id = m.id;
  IF EXISTS (SELECT 1 FROM public.metas WHERE id = m.id) THEN RAISE EXCEPTION 'Excluir meta falhou'; END IF;

  -- Última carteira excluída: o usuário volta a "sem banco".
  DELETE FROM public.carteiras WHERE id = itau;
  IF EXISTS (SELECT 1 FROM public.carteiras) THEN RAISE EXCEPTION 'A deveria ficar sem carteiras'; END IF;
END $$;

RESET ROLE;
-- B continua com carteira e meta; anon não lê metas.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.carteiras WHERE id = 'c0070000-0000-4000-8000-0000000000b2')
    OR NOT EXISTS (SELECT 1 FROM public.metas WHERE id = 'c0070000-0000-4000-8000-0000000000b9') THEN
    RAISE EXCEPTION 'A apagou dados de B';
  END IF;
END $$;
SET LOCAL ROLE anon;
SELECT pg_temp.expect_error('SELECT 1 FROM public.metas', '42501');
SELECT pg_temp.expect_error($q$DELETE FROM public.carteiras WHERE id = 'c0070000-0000-4000-8000-0000000000b2'$q$, '42501');
RESET ROLE;

-- Excluir a conta (CASCADE de profiles) com transferência de um lado só e meta: tudo some sem esbarrar em CHECK/FK.
INSERT INTO public.carteiras (id, user_id, nome) VALUES
  ('c0070000-0000-4000-8000-0000000000b3', 'c0070000-0000-4000-8000-0000000000b1', 'B2');
INSERT INTO public.transferencias (user_id, origem_id, destino_id, valor, data) VALUES
  ('c0070000-0000-4000-8000-0000000000b1', 'c0070000-0000-4000-8000-0000000000b2', 'c0070000-0000-4000-8000-0000000000b3', 1, CURRENT_DATE),
  ('c0070000-0000-4000-8000-0000000000b1', NULL, 'c0070000-0000-4000-8000-0000000000b3', 2, CURRENT_DATE);
DELETE FROM auth.users WHERE id = 'c0070000-0000-4000-8000-0000000000b1';
SET CONSTRAINTS ALL IMMEDIATE;
SET CONSTRAINTS ALL DEFERRED;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.carteiras) OR EXISTS (SELECT 1 FROM public.transferencias) OR EXISTS (SELECT 1 FROM public.metas) THEN
    RAISE EXCEPTION 'CASCADE de profiles não limpou carteiras/transferências/metas';
  END IF;
END $$;

-- Down da 007 (2x): transferência com um lado só some (o down exige backup), NOT NULL e FKs NO ACTION de volta,
-- DELETE de carteiras revogado, metas e guardar_na_meta removidas. Depois o down da 006 ainda funciona.
INSERT INTO auth.users (id, email) VALUES ('c0070000-0000-4000-8000-0000000000c1', 'c007-c@example.invalid');
INSERT INTO public.carteiras (id, user_id, nome) VALUES
  ('c0070000-0000-4000-8000-0000000000c2', 'c0070000-0000-4000-8000-0000000000c1', 'C1'),
  ('c0070000-0000-4000-8000-0000000000c3', 'c0070000-0000-4000-8000-0000000000c1', 'C2');
INSERT INTO public.transferencias (id, user_id, origem_id, destino_id, valor, data) VALUES
  ('c0070000-0000-4000-8000-0000000000c4', 'c0070000-0000-4000-8000-0000000000c1', 'c0070000-0000-4000-8000-0000000000c2', 'c0070000-0000-4000-8000-0000000000c3', 1, CURRENT_DATE),
  ('c0070000-0000-4000-8000-0000000000c5', 'c0070000-0000-4000-8000-0000000000c1', NULL, 'c0070000-0000-4000-8000-0000000000c3', 2, CURRENT_DATE);
\ir ../migrations/007_excluir_metas_down.sql
\ir ../migrations/007_excluir_metas_down.sql
DO $$
BEGIN
  IF pg_catalog.to_regclass('public.metas') IS NOT NULL
    OR pg_catalog.to_regprocedure('public.guardar_na_meta(uuid,numeric)') IS NOT NULL
    OR pg_catalog.to_regprocedure('public.preparar_exclusao_carteira()') IS NOT NULL
    OR pg_catalog.has_table_privilege('authenticated', 'public.carteiras', 'DELETE')
    OR EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'transferencias'
      AND column_name IN ('origem_id', 'destino_id') AND is_nullable = 'YES')
    OR EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.transferencias'::pg_catalog.regclass
      AND contype = 'f' AND confrelid = 'public.carteiras'::pg_catalog.regclass AND confdeltype <> 'a')
    OR (SELECT count(*) FROM pg_catalog.pg_constraint WHERE conrelid = 'public.transferencias'::pg_catalog.regclass
      AND contype = 'f' AND confrelid = 'public.carteiras'::pg_catalog.regclass) <> 2
    OR NOT EXISTS (SELECT 1 FROM public.transferencias WHERE id = 'c0070000-0000-4000-8000-0000000000c4')
    OR EXISTS (SELECT 1 FROM public.transferencias WHERE id = 'c0070000-0000-4000-8000-0000000000c5')
    OR pg_catalog.to_regprocedure('public.corrigir_saldo(uuid,numeric,uuid)') IS NULL THEN
    RAISE EXCEPTION 'Down da 007 removeu demais ou de menos';
  END IF;
END $$;
-- Com a 006 de volta ao original, carteira com transferência não se apaga (NO ACTION).
SELECT pg_temp.expect_error($q$DELETE FROM public.carteiras WHERE id = 'c0070000-0000-4000-8000-0000000000c2'$q$, '23503');
\ir ../migrations/006_carteiras_down.sql
\ir ../migrations/006_carteiras.sql
\ir ../migrations/007_excluir_metas.sql
\ir ../migrations/007_excluir_metas.sql
DO $$
BEGIN
  IF pg_catalog.to_regclass('public.metas') IS NULL
    OR NOT pg_catalog.has_table_privilege('authenticated', 'public.carteiras', 'DELETE') THEN
    RAISE EXCEPTION 'Up após down falhou';
  END IF;
END $$;
ROLLBACK;

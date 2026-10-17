-- Roteiro para banco local DESCARTÁVEL como superusuário (ver tests/supabase_stub.sql); nunca no Supabase.
-- DDL, grants e fixtures são revertidos ao final. Requer PostgreSQL 15+.
\set ON_ERROR_STOP on
BEGIN;
\ir ../migrations/000_baseline.sql
\ir ../migrations/005_financas.sql
-- Como no Supabase: tabelas novas nascem com ALL para anon/authenticated (default privileges). A 006 tem de revogar.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated;
\ir ../migrations/006_carteiras.sql
\ir ../migrations/006_carteiras.sql

-- IDs: usuários A=...a1, B=...b1; carteiras A=...a2/a3/a4(arquivada)/ab(âncora há 10 dias), B=...b2; rendas A=...a5/a6(inativa), B=...b5;
-- contas A=...a7, B=...b7; transação legada de A=...a8.
INSERT INTO auth.users (id, email) VALUES
  ('c0060000-0000-4000-8000-0000000000a1', 'c006-a@example.invalid'),
  ('c0060000-0000-4000-8000-0000000000b1', 'c006-b@example.invalid');
INSERT INTO public.carteiras (id, user_id, nome, saldo_inicial, saldo_inicial_em, arquivada) VALUES
  ('c0060000-0000-4000-8000-0000000000a2', 'c0060000-0000-4000-8000-0000000000a1', 'Nubank', 650, '2026-10-17 15:00:00+00', FALSE),
  ('c0060000-0000-4000-8000-0000000000a3', 'c0060000-0000-4000-8000-0000000000a1', 'Caixa', 50, '2026-10-17 15:00:00+00', FALSE),
  ('c0060000-0000-4000-8000-0000000000a4', 'c0060000-0000-4000-8000-0000000000a1', 'Antiga', 0, '2026-10-17 15:00:00+00', TRUE),
  ('c0060000-0000-4000-8000-0000000000b2', 'c0060000-0000-4000-8000-0000000000b1', 'Banco B', 10, '2026-10-17 15:00:00+00', FALSE),
  ('c0060000-0000-4000-8000-0000000000ab', 'c0060000-0000-4000-8000-0000000000a1', 'Corrigível', 100, now() - interval '10 days', FALSE);
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
                          'public.pagar_conta_v2(uuid,text,date,text,uuid)'::pg_catalog.regprocedure,
                          'public.corrigir_saldo(uuid,numeric,uuid)'::pg_catalog.regprocedure] LOOP
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

-- Grants das tabelas novas vêm da própria 006 (nada de grant reparador aqui), mesmo com os default privileges do
-- Supabase: authenticated só com o necessário (RLS filtra), sem DELETE em carteiras (só arquivar), sem TRUNCATE,
-- REFERENCES e TRIGGER; anon sem nada.
DO $$
DECLARE
  t TEXT;
  p TEXT;
  esperado BOOLEAN;
BEGIN
  FOREACH t IN ARRAY ARRAY['carteiras', 'transferencias', 'recebimentos_renda'] LOOP
    FOREACH p IN ARRAY ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'] LOOP
      IF pg_catalog.has_table_privilege('anon', 'public.' || t, p) THEN
        RAISE EXCEPTION 'anon não deveria ter % em %', p, t;
      END IF;
      esperado := p IN ('SELECT', 'INSERT', 'UPDATE') OR (p = 'DELETE' AND t <> 'carteiras');
      IF pg_catalog.has_table_privilege('authenticated', 'public.' || t, p) IS DISTINCT FROM esperado THEN
        RAISE EXCEPTION 'Grant de authenticated incorreto: % em % (esperado %)', p, t, esperado;
      END IF;
    END LOOP;
  END LOOP;
END $$;
-- Só o estado do Supabase anterior à 006 (tabelas do baseline/005, mesmo grant do tests/005_financas.sql).
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transacoes, public.rendas, public.contas_pagar, public.pagamentos_conta TO authenticated;
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
  corrigivel CONSTANT UUID := 'c0060000-0000-4000-8000-0000000000ab';
  hoje CONSTANT DATE := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  k1 CONSTANT UUID := 'c0060000-0000-4000-8000-0000000000e1';
  k2 CONSTANT UUID := 'c0060000-0000-4000-8000-0000000000e2';
  k3 CONSTANT UUID := 'c0060000-0000-4000-8000-0000000000e3';
  aj public.transacoes;
  aj2 public.transacoes;
  c public.carteiras;
  r public.recebimentos_renda;
  r2 public.recebimentos_renda;
  r3 public.recebimentos_renda;
  p public.pagamentos_conta;
  t public.transacoes;
  comp TEXT;
BEGIN
  -- RLS: B invisível; A não consegue usar nem referenciar a carteira/renda/conta de B.
  IF EXISTS (SELECT 1 FROM public.carteiras WHERE id = cart_b)
    OR EXISTS (SELECT 1 FROM public.rendas WHERE id = renda_b)
    OR (SELECT count(*) FROM public.carteiras) <> 4 THEN
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

  -- Carteira padrão arquivada e nenhuma escolhida: usa a primeira carteira ativa (ordem, criação, id), não trava o Recebi.
  UPDATE public.rendas SET carteira_id = arquivada WHERE id = renda_a;
  SELECT * INTO r3 FROM public.receber_renda(renda_a, '2026-12');
  SELECT * INTO STRICT t FROM public.transacoes WHERE id = r3.transacao_id;
  IF t.carteira_id IS DISTINCT FROM nubank OR t.banco IS DISTINCT FROM 'Nubank' THEN
    RAISE EXCEPTION 'Recebi com carteira padrão arquivada deveria usar a primeira ativa: %', t.carteira_id;
  END IF;
  PERFORM public.desfazer_recebimento(renda_a, '2026-12');
  UPDATE public.rendas SET carteira_id = nubank WHERE id = renda_a;

  -- Desfazer remove recebimento e receita só da competência indicada.
  PERFORM public.desfazer_recebimento(renda_a, '2026-10');
  IF EXISTS (SELECT 1 FROM public.recebimentos_renda WHERE id = r.id)
    OR EXISTS (SELECT 1 FROM public.transacoes WHERE id = r.transacao_id)
    OR NOT EXISTS (SELECT 1 FROM public.recebimentos_renda WHERE id = r2.id)
    OR NOT EXISTS (SELECT 1 FROM public.transacoes WHERE id = r2.transacao_id) THEN
    RAISE EXCEPTION 'Desfazer recebimento afetou competência errada';
  END IF;
  PERFORM pg_temp.expect_error(pg_catalog.format('SELECT public.desfazer_recebimento(%L, %L)', renda_a, '2026-10'), '22023');
  -- Receita do Recebi não se edita nem se apaga direto (PostgREST): UPDATE falha na hora; DELETE deixaria o
  -- recebimento órfão e falha no COMMIT (trigger adiado; SET CONSTRAINTS ALL IMMEDIATE antecipa a checagem).
  PERFORM pg_temp.expect_error(pg_catalog.format('UPDATE public.transacoes SET valor = 1 WHERE id = %L', r2.transacao_id), '55000');
  PERFORM pg_temp.expect_error(pg_catalog.format('UPDATE public.transacoes SET carteira_id = %L WHERE id = %L', caixa, r2.transacao_id), '55000');
  PERFORM pg_temp.expect_error(pg_catalog.format(
    'DELETE FROM public.transacoes WHERE id = %L; SET CONSTRAINTS ALL IMMEDIATE', r2.transacao_id), '55000');
  SET CONSTRAINTS ALL DEFERRED;
  PERFORM pg_temp.expect_error(pg_catalog.format(
    'UPDATE public.recebimentos_renda SET transacao_id = NULL WHERE id = %L; SET CONSTRAINTS ALL IMMEDIATE', r2.id), '55000');
  SET CONSTRAINTS ALL DEFERRED;
  IF NOT EXISTS (SELECT 1 FROM public.recebimentos_renda WHERE id = r2.id AND transacao_id = r2.transacao_id)
    OR NOT EXISTS (SELECT 1 FROM public.transacoes WHERE id = r2.transacao_id AND valor = 900) THEN
    RAISE EXCEPTION 'Bloqueio do vínculo deixou recebimento/receita alterados';
  END IF;
  -- Desfazer é o caminho: passa inclusive pela checagem do COMMIT.
  PERFORM public.desfazer_recebimento(renda_a, '2026-11');
  SET CONSTRAINTS ALL IMMEDIATE;
  SET CONSTRAINTS ALL DEFERRED;
  IF EXISTS (SELECT 1 FROM public.transacoes WHERE id = r2.transacao_id) THEN
    RAISE EXCEPTION 'Desfazer recebimento não apagou a receita';
  END IF;

  -- Paguei com carteira (v2) e a pagar_conta antiga continua sem ambiguidade.
  SELECT * INTO p FROM public.pagar_conta_v2(conta_a, '2026-10', '2026-10-17', NULL, nubank);
  SELECT * INTO STRICT t FROM public.transacoes WHERE id = p.transacao_id;
  IF t.carteira_id IS DISTINCT FROM nubank OR t.banco IS DISTINCT FROM 'Nubank' OR t.tipo <> 'despesa' OR t.valor <> 120 OR t.ajuste THEN
    RAISE EXCEPTION 'pagar_conta_v2 não vinculou a carteira';
  END IF;
  PERFORM pg_temp.expect_error(pg_catalog.format('SELECT public.pagar_conta_v2(%L, %L, NULL, NULL, %L)', conta_a, '2026-10', caixa), 'P0003');
  -- Despesa do Paguei também é protegida; a desfazer_pagamento da 005 (apaga a transação antes do pagamento) segue ok.
  PERFORM pg_temp.expect_error(pg_catalog.format('UPDATE public.transacoes SET data = %L WHERE id = %L', '2026-10-01', p.transacao_id), '55000');
  PERFORM pg_temp.expect_error(pg_catalog.format(
    'DELETE FROM public.transacoes WHERE id = %L; SET CONSTRAINTS ALL IMMEDIATE', p.transacao_id), '55000');
  SET CONSTRAINTS ALL DEFERRED;
  PERFORM pg_temp.expect_error(pg_catalog.format(
    'UPDATE public.pagamentos_conta SET transacao_id = NULL WHERE id = %L; SET CONSTRAINTS ALL IMMEDIATE', p.id), '55000');
  SET CONSTRAINTS ALL DEFERRED;
  PERFORM pg_temp.expect_error(pg_catalog.format('SELECT public.pagar_conta_v2(%L, %L, NULL, NULL, %L)', conta_a, '2026-11', arquivada), 'P0002');
  PERFORM public.desfazer_pagamento(conta_a, '2026-10');
  SET CONSTRAINTS ALL IMMEDIATE;
  SET CONSTRAINTS ALL DEFERRED;
  IF EXISTS (SELECT 1 FROM public.pagamentos_conta WHERE conta_id = conta_a) THEN
    RAISE EXCEPTION 'desfazer_pagamento da 005 não removeu o pagamento';
  END IF;
  SELECT * INTO p FROM public.pagar_conta(conta_a, '2026-10');
  SELECT * INTO STRICT t FROM public.transacoes WHERE id = p.transacao_id;
  IF t.carteira_id IS NOT NULL THEN RAISE EXCEPTION 'pagar_conta antiga deveria manter carteira NULL'; END IF;
  PERFORM public.desfazer_pagamento(conta_a, '2026-10');
  SELECT * INTO p FROM public.pagar_conta_v2(conta_a, '2026-10');
  SELECT * INTO STRICT t FROM public.transacoes WHERE id = p.transacao_id;
  IF t.carteira_id IS NOT NULL OR t.banco IS NOT NULL THEN RAISE EXCEPTION 'pagar_conta_v2 sem carteira divergiu da antiga'; END IF;
  PERFORM public.desfazer_pagamento(conta_a, '2026-10');

  -- Lançamento sem vínculo segue editável e apagável.
  INSERT INTO public.transacoes (user_id, tipo, categoria, descricao, valor, data, carteira_id)
    VALUES (ua, 'despesa', 'Outros', 'Livre', 7, '2026-10-17', nubank) RETURNING * INTO t;
  UPDATE public.transacoes SET valor = 8 WHERE id = t.id;
  DELETE FROM public.transacoes WHERE id = t.id;
  SET CONSTRAINTS ALL IMMEDIATE;
  SET CONSTRAINTS ALL DEFERRED;

  -- Transferência e ajuste do próprio usuário; trigger updated_at.
  INSERT INTO public.transferencias (user_id, origem_id, destino_id, valor, data) VALUES (ua, caixa, nubank, 50, '2026-10-17');
  INSERT INTO public.transacoes (user_id, tipo, categoria, descricao, valor, data, carteira_id, ajuste)
    VALUES (ua, 'receita', 'Ajuste de saldo', 'Correção', 3.5, '2026-10-17', nubank, TRUE);
  UPDATE public.carteiras SET updated_at = '2000-01-01' WHERE id = nubank RETURNING * INTO c;
  IF c.updated_at IS DISTINCT FROM now() THEN RAISE EXCEPTION 'Trigger updated_at de carteiras falhou'; END IF;

  -- Corrigir saldo (R9) atômico e idempotente. Saldo da Corrigível: 100 − 30 + 5 + 10 (transferência) = 85;
  -- o lançamento futuro e o anterior à âncora não contam (mesma fórmula de saldoCarteira).
  INSERT INTO public.transacoes (user_id, tipo, categoria, descricao, valor, data, carteira_id) VALUES
    (ua, 'despesa', 'Mercado', 'Antes da âncora', 999, hoje - 20, corrigivel),
    (ua, 'despesa', 'Mercado', 'Mercado', 30, hoje - 2, corrigivel),
    (ua, 'receita', 'Entrada extra', 'Pix', 5, hoje - 1, corrigivel),
    (ua, 'despesa', 'Mercado', 'Futuro', 1000, hoje + 5, corrigivel);
  INSERT INTO public.transferencias (user_id, origem_id, destino_id, valor, data) VALUES (ua, caixa, corrigivel, 10, hoje - 1);
  SELECT * INTO STRICT aj FROM public.corrigir_saldo(corrigivel, 80, k1);
  IF aj.tipo <> 'despesa' OR aj.valor <> 5 OR NOT aj.ajuste OR aj.categoria <> 'Ajuste de saldo' OR aj.data <> hoje
    OR aj.carteira_id IS DISTINCT FROM corrigivel OR aj.chave_ajuste IS DISTINCT FROM k1 OR aj.user_id <> ua THEN
    RAISE EXCEPTION 'corrigir_saldo calculou/gravou o ajuste errado: % %', aj.tipo, aj.valor;
  END IF;
  -- Repetir a mesma chave (resposta perdida) devolve o mesmo ajuste, sem duplicar.
  SELECT * INTO STRICT aj2 FROM public.corrigir_saldo(corrigivel, 80, k1);
  IF aj2.id <> aj.id OR (SELECT count(*) FROM public.transacoes WHERE carteira_id = corrigivel AND ajuste) <> 1 THEN
    RAISE EXCEPTION 'corrigir_saldo não é idempotente pela chave';
  END IF;
  -- Outra aba com o mesmo valor (chave nova): o saldo já é 80, nada a ajustar.
  IF EXISTS (SELECT 1 FROM public.corrigir_saldo(corrigivel, 80, k2)) THEN
    RAISE EXCEPTION 'Segunda correção para o mesmo valor deveria ser vazia';
  END IF;
  SELECT * INTO STRICT aj2 FROM public.corrigir_saldo(corrigivel, 100.5, k3);
  IF aj2.tipo <> 'receita' OR aj2.valor <> 20.5 THEN RAISE EXCEPTION 'Ajuste positivo errado'; END IF;
  PERFORM pg_temp.expect_error(pg_catalog.format('SELECT * FROM public.corrigir_saldo(%L, 1, %L)', caixa, k1), '22023');
  -- Contrato da chave: repetir com o MESMO valor devolve o ajuste; com valor diferente é erro (22023), nunca silêncio.
  PERFORM pg_temp.expect_error(pg_catalog.format('SELECT * FROM public.corrigir_saldo(%L, 81, %L)', corrigivel, k1), '22023');
  SELECT * INTO STRICT aj2 FROM public.corrigir_saldo(corrigivel, 80, k1);
  IF aj2.id <> aj.id THEN RAISE EXCEPTION 'Repetição com o mesmo valor deveria devolver o ajuste original'; END IF;
  -- Diferença acima de transacoes.valor DECIMAL(10,2) é 22023 (não estouro 22003 → 500).
  PERFORM pg_temp.expect_error(pg_catalog.format('SELECT * FROM public.corrigir_saldo(%L, 100000100.5, %L)', corrigivel, gen_random_uuid()), '22023');
  PERFORM pg_temp.expect_error(pg_catalog.format('SELECT * FROM public.corrigir_saldo(%L, -99999900, %L)', corrigivel, gen_random_uuid()), '22023');
  PERFORM pg_temp.expect_error(pg_catalog.format('SELECT * FROM public.corrigir_saldo(%L, 1.234, %L)', corrigivel, gen_random_uuid()), '22023');
  PERFORM pg_temp.expect_error(pg_catalog.format('SELECT * FROM public.corrigir_saldo(%L, 1, NULL)', corrigivel), '22023');
  PERFORM pg_temp.expect_error(pg_catalog.format('SELECT * FROM public.corrigir_saldo(%L, 1, %L)', arquivada, gen_random_uuid()), 'P0002');
  PERFORM pg_temp.expect_error(pg_catalog.format('SELECT * FROM public.corrigir_saldo(%L, 1, %L)', cart_b, gen_random_uuid()), 'P0002');
  PERFORM pg_temp.expect_error(pg_catalog.format($q$INSERT INTO public.transacoes (user_id, tipo, categoria, descricao, valor, chave_ajuste)
    VALUES (auth.uid(), 'despesa', 'Outros', 'chave repetida', 1, %L)$q$, k1), '23505');

  -- Carteira não se apaga pelo app (sem grant de DELETE): arquivar é o caminho.
  PERFORM pg_temp.expect_error(pg_catalog.format('DELETE FROM public.carteiras WHERE id = %L', nubank), '42501');
  PERFORM pg_temp.expect_error('TRUNCATE public.carteiras', '42501');

  -- Vínculos vivos para o CASCADE da exclusão de conta (mais abaixo) atravessar os triggers de proteção.
  PERFORM public.receber_renda(renda_a, '2027-01');
  PERFORM public.pagar_conta_v2(conta_a, '2026-11', NULL, NULL, nubank);
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
  PERFORM pg_temp.expect_error($q$DELETE FROM public.carteiras WHERE id = 'c0060000-0000-4000-8000-0000000000a3'$q$, '42501');
  -- Carteira padrão arquivada e nenhuma ativa: Recebi grava sem carteira (NULL) em vez de travar.
  UPDATE public.rendas SET carteira_id = 'c0060000-0000-4000-8000-0000000000b2' WHERE id = 'c0060000-0000-4000-8000-0000000000b5';
  UPDATE public.carteiras SET arquivada = TRUE WHERE id = 'c0060000-0000-4000-8000-0000000000b2';
  IF EXISTS (SELECT 1 FROM public.transacoes t JOIN public.receber_renda('c0060000-0000-4000-8000-0000000000b5', '2026-10') r
    ON t.id = r.transacao_id WHERE t.carteira_id IS NOT NULL) THEN
    RAISE EXCEPTION 'Recebi sem carteira ativa deveria gravar carteira NULL';
  END IF;
END $$;
RESET ROLE;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.carteiras WHERE id = 'c0060000-0000-4000-8000-0000000000a2' AND nome = 'Nubank')
    OR NOT EXISTS (SELECT 1 FROM public.carteiras WHERE id = 'c0060000-0000-4000-8000-0000000000a3') THEN
    RAISE EXCEPTION 'B alterou carteiras de A';
  END IF;
END $$;

-- Carteira sem transferências apagada direto no banco (dono/CASCADE): lançamentos ficam com carteira NULL e o mesmo
-- dono, inclusive o vinculado a um Paguei (o SET NULL em cascata não esbarra na proteção do vínculo).
INSERT INTO public.carteiras (id, user_id, nome) VALUES
  ('c0060000-0000-4000-8000-0000000000a9', 'c0060000-0000-4000-8000-0000000000a1', 'Temporária');
INSERT INTO public.transacoes (id, user_id, tipo, categoria, descricao, valor, carteira_id) VALUES
  ('c0060000-0000-4000-8000-0000000000aa', 'c0060000-0000-4000-8000-0000000000a1', 'despesa', 'Outros', 'Na temporária', 1, 'c0060000-0000-4000-8000-0000000000a9');
INSERT INTO public.pagamentos_conta (conta_id, user_id, competencia, pago_em, transacao_id) VALUES
  ('c0060000-0000-4000-8000-0000000000a7', 'c0060000-0000-4000-8000-0000000000a1', '2026-12', '2026-12-01', 'c0060000-0000-4000-8000-0000000000aa');
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
SET CONSTRAINTS ALL IMMEDIATE;
SET CONSTRAINTS ALL DEFERRED;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.carteiras WHERE user_id = 'c0060000-0000-4000-8000-0000000000a1')
    OR EXISTS (SELECT 1 FROM public.transferencias WHERE user_id = 'c0060000-0000-4000-8000-0000000000a1') THEN
    RAISE EXCEPTION 'CASCADE de profiles não limpou carteiras/transferências';
  END IF;
END $$;

-- Down repetível e novo up 2x; 000/005 preservados. Ajustes de saldo somem (senão viram receita/despesa comum).
INSERT INTO public.transacoes (id, user_id, tipo, categoria, descricao, valor, data, ajuste) VALUES
  ('c0060000-0000-4000-8000-0000000000f1', 'c0060000-0000-4000-8000-0000000000b1', 'receita', 'Ajuste de saldo', 'Correção', 5, '2026-10-17', TRUE),
  ('c0060000-0000-4000-8000-0000000000f2', 'c0060000-0000-4000-8000-0000000000b1', 'despesa', 'Mercado', 'Comum', 5, '2026-10-17', FALSE);
\ir ../migrations/006_carteiras_down.sql
\ir ../migrations/006_carteiras_down.sql
DO $$
BEGIN
  IF pg_catalog.to_regclass('public.carteiras') IS NOT NULL
    OR pg_catalog.to_regclass('public.transferencias') IS NOT NULL
    OR pg_catalog.to_regclass('public.recebimentos_renda') IS NOT NULL
    OR pg_catalog.to_regprocedure('public.pagar_conta_v2(uuid,text,date,text,uuid)') IS NOT NULL
    OR pg_catalog.to_regprocedure('public.corrigir_saldo(uuid,numeric,uuid)') IS NOT NULL
    OR EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public'
      AND ((table_name = 'transacoes' AND column_name IN ('carteira_id', 'ajuste', 'chave_ajuste')) OR (table_name = 'rendas' AND column_name = 'carteira_id')))
    OR pg_catalog.to_regprocedure('public.pagar_conta(uuid,text,date,text)') IS NULL
    OR pg_catalog.to_regprocedure('public.set_updated_at()') IS NULL
    OR pg_catalog.to_regclass('public.pagamentos_conta') IS NULL
    OR NOT EXISTS (SELECT 1 FROM public.rendas WHERE id = 'c0060000-0000-4000-8000-0000000000b5')
    OR EXISTS (SELECT 1 FROM public.transacoes WHERE id = 'c0060000-0000-4000-8000-0000000000f1')
    OR NOT EXISTS (SELECT 1 FROM public.transacoes WHERE id = 'c0060000-0000-4000-8000-0000000000f2')
    OR EXISTS (SELECT 1 FROM pg_catalog.pg_trigger WHERE tgname LIKE 'trg_vinculo%')
    OR pg_catalog.to_regprocedure('public.proteger_transacao_vinculada()') IS NOT NULL THEN
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

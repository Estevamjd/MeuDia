-- Roteiro para banco local DESCARTÁVEL como superusuário (ver tests/supabase_stub.sql); nunca no Supabase.
\set ON_ERROR_STOP on
BEGIN;
\ir ../migrations/000_baseline.sql
\ir ../migrations/005_financas.sql
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated;
\ir ../migrations/006_carteiras.sql

-- A: 2 bancos no total + 1 fora do total + 1 arquivado; B: 1 banco; C: sem banco.
INSERT INTO auth.users (id, email) VALUES
  ('c0140000-0000-4000-8000-0000000000a1', 'c014-a@example.invalid'),
  ('c0140000-0000-4000-8000-0000000000b1', 'c014-b@example.invalid'),
  ('c0140000-0000-4000-8000-0000000000c1', 'c014-c@example.invalid');
INSERT INTO public.carteiras (id, user_id, nome, saldo_inicial, saldo_inicial_em, incluir_no_total, arquivada) VALUES
  ('c0140000-0000-4000-8000-0000000000a2', 'c0140000-0000-4000-8000-0000000000a1', 'Banco 1', 240, '2026-10-18 05:00:00+00', TRUE, FALSE),
  ('c0140000-0000-4000-8000-0000000000a3', 'c0140000-0000-4000-8000-0000000000a1', 'Banco 2', 50, '2026-10-18 05:00:00+00', TRUE, FALSE),
  ('c0140000-0000-4000-8000-0000000000a4', 'c0140000-0000-4000-8000-0000000000a1', 'Fora', 1000, '2026-10-18 05:00:00+00', FALSE, FALSE),
  ('c0140000-0000-4000-8000-0000000000a5', 'c0140000-0000-4000-8000-0000000000a1', 'Arquivado', 500, '2026-10-18 05:00:00+00', TRUE, TRUE),
  ('c0140000-0000-4000-8000-0000000000b2', 'c0140000-0000-4000-8000-0000000000b1', 'Banco B', 10, '2026-10-18 05:00:00+00', TRUE, FALSE);
-- Âncora: 18/10 02:00 em SP. Antes da âncora (não conta), mesmo dia antes/depois, ajustes, sem banco, futuro.
INSERT INTO public.transacoes (user_id, tipo, categoria, descricao, valor, data, carteira_id, ajuste, created_at) VALUES
  ('c0140000-0000-4000-8000-0000000000a1', 'despesa', 'Contas', 'antes', 100, '2026-10-16', 'c0140000-0000-4000-8000-0000000000a2', FALSE, '2026-10-17 00:08:00+00'),
  ('c0140000-0000-4000-8000-0000000000a1', 'despesa', 'Contas', 'mesmo dia, antes da âncora', 7, '2026-10-18', 'c0140000-0000-4000-8000-0000000000a2', FALSE, '2026-10-18 04:30:00+00'),
  ('c0140000-0000-4000-8000-0000000000a1', 'despesa', 'Contas', 'mesmo dia, depois', 5, '2026-10-18', 'c0140000-0000-4000-8000-0000000000a2', FALSE, '2026-10-18 06:00:00+00'),
  ('c0140000-0000-4000-8000-0000000000a1', 'despesa', 'Ajuste de saldo', 'aj', 20.10, '2026-10-25', 'c0140000-0000-4000-8000-0000000000a2', TRUE, '2026-10-25 19:28:38+00'),
  ('c0140000-0000-4000-8000-0000000000a1', 'receita', 'Ajuste de saldo', 'aj', 11.87, '2026-10-31', 'c0140000-0000-4000-8000-0000000000a2', TRUE, '2026-10-31 03:14:58+00'),
  ('c0140000-0000-4000-8000-0000000000a1', 'despesa', 'Curso', 'sem banco', 270, '2026-10-31', NULL, FALSE, '2026-10-31 03:13:49+00'),
  ('c0140000-0000-4000-8000-0000000000a1', 'despesa', 'Contas', 'no banco 2', 20, '2026-11-05', 'c0140000-0000-4000-8000-0000000000a3', FALSE, '2026-11-05 17:59:32+00'),
  ('c0140000-0000-4000-8000-0000000000a1', 'despesa', 'Contas', 'fora do total', 300, '2026-11-05', 'c0140000-0000-4000-8000-0000000000a4', FALSE, '2026-11-05 17:59:32+00'),
  ('c0140000-0000-4000-8000-0000000000a1', 'despesa', 'Contas', 'futuro', 999, (now() AT TIME ZONE 'America/Sao_Paulo')::date + 3, 'c0140000-0000-4000-8000-0000000000a2', FALSE, now());
INSERT INTO public.transferencias (user_id, origem_id, destino_id, valor, data, created_at) VALUES
  ('c0140000-0000-4000-8000-0000000000a1', 'c0140000-0000-4000-8000-0000000000a2', 'c0140000-0000-4000-8000-0000000000a3', 30, '2026-11-01', '2026-11-01 12:00:00+00'),
  ('c0140000-0000-4000-8000-0000000000a1', 'c0140000-0000-4000-8000-0000000000a4', 'c0140000-0000-4000-8000-0000000000a2', 40, '2026-11-02', '2026-11-02 12:00:00+00');

-- Esperado (A): Banco 1 = 240 − 5 − 20,10 + 11,87 − 30 + 40 = 236,77; Banco 2 = 50 + 30 − 20 = 60. Total = 296,77. B = 10.
\ir ../migrations/014_cofrinho.sql
\ir ../migrations/014_cofrinho.sql

DO $$
DECLARE r RECORD;
BEGIN
  SELECT
    (SELECT valor FROM public.cofrinho_movimentos WHERE user_id = 'c0140000-0000-4000-8000-0000000000a1' AND tipo = 'inicial') AS a,
    (SELECT valor FROM public.cofrinho_movimentos WHERE user_id = 'c0140000-0000-4000-8000-0000000000b1' AND tipo = 'inicial') AS b,
    (SELECT count(*) FROM public.cofrinho_movimentos WHERE user_id = 'c0140000-0000-4000-8000-0000000000c1') AS c,
    (SELECT count(*) FROM public.cofrinho_movimentos) AS total
  INTO r;
  IF r.a IS DISTINCT FROM 296.77 OR r.b IS DISTINCT FROM 10.00 OR r.c <> 0 OR r.total <> 2 THEN
    RAISE EXCEPTION 'Ponto de partida errado: %', r;
  END IF;
  -- Nenhum dado antigo muda.
  IF (SELECT count(*) FROM public.transacoes) <> 9 OR (SELECT sum(saldo_inicial) FROM public.carteiras) <> 1800 THEN
    RAISE EXCEPTION 'Migração mexeu em dados antigos';
  END IF;
  -- Grants: só SELECT/INSERT; RLS ligada.
  IF pg_catalog.has_table_privilege('authenticated', 'public.cofrinho_movimentos', 'UPDATE')
    OR pg_catalog.has_table_privilege('authenticated', 'public.cofrinho_movimentos', 'DELETE')
    OR pg_catalog.has_table_privilege('anon', 'public.cofrinho_movimentos', 'SELECT')
    OR NOT pg_catalog.has_table_privilege('authenticated', 'public.cofrinho_fechamentos', 'INSERT')
    OR pg_catalog.has_function_privilege('anon', 'public.cofrinho_mover(text, numeric, uuid)', 'EXECUTE')
    OR NOT (SELECT relrowsecurity FROM pg_catalog.pg_class WHERE oid = 'public.cofrinho_movimentos'::regclass) THEN
    RAISE EXCEPTION 'Grants/RLS da 014 incorretos';
  END IF;
END $$;

CREATE FUNCTION pg_temp.erro(stmt TEXT, estado TEXT) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE stmt;
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = estado THEN RETURN; END IF;
    RAISE EXCEPTION 'Esperava % em [%], veio %: %', estado, stmt, SQLSTATE, SQLERRM;
  END;
  RAISE EXCEPTION 'Esperava erro % em [%]', estado, stmt;
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.erro(TEXT, TEXT) TO authenticated;

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transacoes TO authenticated;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'c0140000-0000-4000-8000-0000000000a1', true);

DO $$
DECLARE m public.cofrinho_movimentos;
BEGIN
  -- Gasto novo no banco NÃO muda o Cofrinho.
  INSERT INTO public.transacoes (user_id, tipo, categoria, descricao, valor, data, carteira_id)
    VALUES (auth.uid(), 'despesa', 'Mercado', 'gasto', 50, (now() AT TIME ZONE 'America/Sao_Paulo')::date, 'c0140000-0000-4000-8000-0000000000a2');
  IF public.cofrinho_saldo_atual() <> 296.77 THEN RAISE EXCEPTION 'Gasto mexeu no Cofrinho'; END IF;
  IF public.cofrinho_iniciar() <> 296.77 THEN RAISE EXCEPTION 'iniciar mudou o ponto de partida'; END IF;

  SELECT * INTO m FROM public.cofrinho_mover('guardar', 100, 'c0140000-0000-4000-8000-00000000f001');
  IF m.valor <> 100 OR public.cofrinho_saldo_atual() <> 396.77 THEN RAISE EXCEPTION 'guardar: %', m; END IF;
  -- Mesma chave: idempotente.
  PERFORM public.cofrinho_mover('guardar', 100, 'c0140000-0000-4000-8000-00000000f001');
  IF public.cofrinho_saldo_atual() <> 396.77 THEN RAISE EXCEPTION 'guardar repetido somou de novo'; END IF;
  PERFORM pg_temp.erro($q$SELECT public.cofrinho_mover('guardar', 99, 'c0140000-0000-4000-8000-00000000f001')$q$, '22023');
  PERFORM pg_temp.erro($q$SELECT public.cofrinho_mover('tirar', 400, 'c0140000-0000-4000-8000-00000000f002')$q$, '22023');
  PERFORM pg_temp.erro($q$SELECT public.cofrinho_mover('guardar', 0, 'c0140000-0000-4000-8000-00000000f003')$q$, '22023');
  PERFORM pg_temp.erro($q$SELECT public.cofrinho_mover('guardar', 1.234, 'c0140000-0000-4000-8000-00000000f003')$q$, '22023');
  PERFORM pg_temp.erro($q$SELECT public.cofrinho_mover('sobra', 10, 'c0140000-0000-4000-8000-00000000f003')$q$, '22023');
  PERFORM pg_temp.erro($q$SELECT public.cofrinho_mover('guardar', 10, NULL)$q$, '22023');
  SELECT * INTO m FROM public.cofrinho_mover('tirar', 96.77, 'c0140000-0000-4000-8000-00000000f004');
  IF m.valor <> -96.77 OR public.cofrinho_saldo_atual() <> 300 THEN RAISE EXCEPTION 'tirar: %', m; END IF;

  -- Corrigir para 150: lança −150; corrigir para o mesmo valor não lança nada.
  SELECT * INTO m FROM public.cofrinho_corrigir(150, 'c0140000-0000-4000-8000-00000000f005');
  IF m.valor <> -150 OR m.valor_informado <> 150 OR public.cofrinho_saldo_atual() <> 150 THEN RAISE EXCEPTION 'corrigir: %', m; END IF;
  IF (SELECT count(*) FROM public.cofrinho_corrigir(150, 'c0140000-0000-4000-8000-00000000f006')) <> 0 THEN RAISE EXCEPTION 'corrigir sem diferença lançou'; END IF;
  PERFORM pg_temp.erro($q$SELECT public.cofrinho_corrigir(-1, 'c0140000-0000-4000-8000-00000000f007')$q$, '22023');
  PERFORM pg_temp.erro($q$SELECT public.cofrinho_corrigir(10, 'c0140000-0000-4000-8000-00000000f005')$q$, '22023');

  -- Fechamento: uma vez por mês; só mês atual/anterior.
  PERFORM public.cofrinho_fechar_mes(to_char((now() AT TIME ZONE 'America/Sao_Paulo')::date - interval '1 month', 'YYYY-MM'), TRUE, 99);
  IF public.cofrinho_saldo_atual() <> 249 THEN RAISE EXCEPTION 'sobra não entrou'; END IF;
  PERFORM public.cofrinho_fechar_mes(to_char((now() AT TIME ZONE 'America/Sao_Paulo')::date - interval '1 month', 'YYYY-MM'), TRUE, 99);
  PERFORM public.cofrinho_fechar_mes(to_char((now() AT TIME ZONE 'America/Sao_Paulo')::date - interval '1 month', 'YYYY-MM'), FALSE, NULL);
  IF public.cofrinho_saldo_atual() <> 249 THEN RAISE EXCEPTION 'fechamento repetido somou'; END IF;
  IF (SELECT count(*) FROM public.cofrinho_fechamentos) <> 1 THEN RAISE EXCEPTION 'fechamento duplicado'; END IF;
  PERFORM public.cofrinho_fechar_mes(to_char((now() AT TIME ZONE 'America/Sao_Paulo')::date, 'YYYY-MM'), FALSE, NULL);
  IF (SELECT decisao FROM public.cofrinho_fechamentos WHERE competencia = to_char((now() AT TIME ZONE 'America/Sao_Paulo')::date, 'YYYY-MM')) <> 'agora_nao'
    OR public.cofrinho_saldo_atual() <> 249 THEN RAISE EXCEPTION 'agora não'; END IF;
  PERFORM pg_temp.erro($q$SELECT public.cofrinho_fechar_mes('2020-01', FALSE, NULL)$q$, '22023');
  PERFORM pg_temp.erro($q$SELECT public.cofrinho_fechar_mes(to_char((now() AT TIME ZONE 'America/Sao_Paulo')::date + interval '1 month', 'YYYY-MM'), FALSE, NULL)$q$, '22023');

  -- Sem UPDATE/DELETE no histórico.
  PERFORM pg_temp.erro($q$UPDATE public.cofrinho_movimentos SET valor = 1$q$, '42501');
  PERFORM pg_temp.erro($q$DELETE FROM public.cofrinho_movimentos$q$, '42501');
END $$;

-- B não vê nem grava no Cofrinho de A.
SELECT set_config('request.jwt.claim.sub', 'c0140000-0000-4000-8000-0000000000b1', true);
DO $$
BEGIN
  IF (SELECT count(*) FROM public.cofrinho_movimentos) <> 1 OR public.cofrinho_saldo_atual() <> 10 THEN RAISE EXCEPTION 'B vê dados de A'; END IF;
  PERFORM pg_temp.erro($q$INSERT INTO public.cofrinho_movimentos (user_id, tipo, valor) VALUES ('c0140000-0000-4000-8000-0000000000a1', 'guardar', 1000)$q$, '42501');
  IF public.cofrinho_total_bancos('c0140000-0000-4000-8000-0000000000a1', '2030-01-01') <> 0 THEN RAISE EXCEPTION 'B soma bancos de A'; END IF;
END $$;

-- C (sem banco): iniciar não cria ponto de partida; guardar cria inicial 0 + guardado.
SELECT set_config('request.jwt.claim.sub', 'c0140000-0000-4000-8000-0000000000c1', true);
DO $$
BEGIN
  IF public.cofrinho_iniciar() <> 0 OR (SELECT count(*) FROM public.cofrinho_movimentos) <> 0 THEN RAISE EXCEPTION 'C iniciou sem banco'; END IF;
  PERFORM public.cofrinho_mover('guardar', 25.5, 'c0140000-0000-4000-8000-00000000f101');
  IF public.cofrinho_saldo_atual() <> 25.5 OR (SELECT valor FROM public.cofrinho_movimentos WHERE tipo = 'inicial') <> 0 THEN RAISE EXCEPTION 'C guardar'; END IF;
END $$;

-- Anônimo: nada.
SELECT set_config('request.jwt.claim.sub', '', true);
DO $$ BEGIN PERFORM pg_temp.erro($q$SELECT public.cofrinho_iniciar()$q$, '42501'); END $$;
RESET ROLE;

-- Down + up de novo.
\ir ../migrations/014_cofrinho_down.sql
DO $$ BEGIN IF to_regclass('public.cofrinho_movimentos') IS NOT NULL THEN RAISE EXCEPTION 'down falhou'; END IF; END $$;
\ir ../migrations/014_cofrinho.sql
DO $$ BEGIN IF (SELECT count(*) FROM public.cofrinho_movimentos WHERE tipo = 'inicial') <> 2 THEN RAISE EXCEPTION 'up após down falhou'; END IF; END $$;
ROLLBACK;

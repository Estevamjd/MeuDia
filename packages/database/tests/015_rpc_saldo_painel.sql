-- Roteiro para banco local DESCARTÁVEL como superusuário (ver tests/supabase_stub.sql); nunca no Supabase.
\set ON_ERROR_STOP on
BEGIN;
\ir ../migrations/000_baseline.sql
\ir ../migrations/005_financas.sql
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated;
\ir ../migrations/006_carteiras.sql
\ir ../migrations/007_excluir_metas.sql

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
  ('c0140000-0000-4000-8000-0000000000a1', 'despesa', 'Contas', 'futuro', 999, '2027-01-01', 'c0140000-0000-4000-8000-0000000000a2', FALSE, now());
INSERT INTO public.transferencias (user_id, origem_id, destino_id, valor, data, created_at) VALUES
  ('c0140000-0000-4000-8000-0000000000a1', 'c0140000-0000-4000-8000-0000000000a2', 'c0140000-0000-4000-8000-0000000000a3', 30, '2026-11-01', '2026-11-01 12:00:00+00'),
  ('c0140000-0000-4000-8000-0000000000a1', 'c0140000-0000-4000-8000-0000000000a4', 'c0140000-0000-4000-8000-0000000000a2', 40, '2026-11-02', '2026-11-02 12:00:00+00');


-- Sub-millisecond differences are equal to Date.parse, and must not count.
INSERT INTO public.transacoes(user_id,tipo,categoria,descricao,valor,data,carteira_id,created_at)
VALUES ('c0140000-0000-4000-8000-0000000000a1','receita','Outros','ms',999,'2026-10-18',
'c0140000-0000-4000-8000-0000000000a2','2026-10-18 05:00:00.000999+00');
INSERT INTO public.transferencias(user_id,origem_id,destino_id,valor,data,created_at) VALUES
('c0140000-0000-4000-8000-0000000000a1',NULL,'c0140000-0000-4000-8000-0000000000a2',3,'2026-11-03','2026-11-03 12:00+00'),
('c0140000-0000-4000-8000-0000000000a1','c0140000-0000-4000-8000-0000000000a2',NULL,2,'2026-11-03','2026-11-03 12:00+00'),
('c0140000-0000-4000-8000-0000000000a1',NULL,'c0140000-0000-4000-8000-0000000000a2',999,'2026-10-18','2026-10-18 05:00:00.000999+00'),
('c0140000-0000-4000-8000-0000000000a1',NULL,'c0140000-0000-4000-8000-0000000000a2',999,'2027-01-01','2027-01-01 12:00+00');
\ir ../migrations/014_cofrinho.sql
-- Default privileges do Supabase: função nova em public nasce com EXECUTE para anon/authenticated (além de PUBLIC).
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated;
\ir ../migrations/015_rpc_saldo_painel.sql
\ir ../migrations/015_rpc_saldo_painel.sql
DO $$
DECLARE f TEXT;
BEGIN
  FOREACH f IN ARRAY ARRAY['public.saldos_carteiras_em(date)', 'public.resumo_painel_saldo(date)'] LOOP
    IF pg_catalog.has_function_privilege('anon', f, 'EXECUTE')
      OR NOT pg_catalog.has_function_privilege('authenticated', f, 'EXECUTE') THEN
      RAISE EXCEPTION 'grants de %: anon não executa, authenticated executa', f;
    END IF;
    IF NOT (SELECT p.prosecdef = FALSE AND p.provolatile = 's' AND 'search_path=""' = ANY (p.proconfig)
      FROM pg_catalog.pg_proc p WHERE p.oid = f::regprocedure) THEN
      RAISE EXCEPTION '%: SECURITY INVOKER, STABLE e search_path vazio', f;
    END IF;
  END LOOP;
END $$;
CREATE FUNCTION pg_temp.erro(stmt TEXT) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN EXECUTE stmt; EXCEPTION WHEN insufficient_privilege THEN RETURN; END;
  RAISE EXCEPTION 'Esperava 42501';
END $$;
GRANT USAGE ON SCHEMA public TO authenticated, anon;
GRANT SELECT ON public.transacoes TO authenticated;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','c0140000-0000-4000-8000-0000000000a1',true);
DO $$
DECLARE j jsonb; valores numeric[];
BEGIN
  SELECT array_agg(saldo ORDER BY carteira_id) INTO valores FROM public.saldos_carteiras_em('2026-11-20');
  IF valores IS DISTINCT FROM ARRAY[237.77,60,660,500]::numeric[] THEN RAISE EXCEPTION 'saldos A: %',valores; END IF;
  SELECT public.resumo_painel_saldo('2026-11-20') INTO j;
  IF jsonb_array_length(j->'carteiras') <> 4 THEN RAISE EXCEPTION 'RLS A: %',j; END IF;
  IF j->>'ultima_carteira_id' <> 'c0140000-0000-4000-8000-0000000000a2' THEN RAISE EXCEPTION 'ultima deve incluir futuro: %',j; END IF;
  IF (SELECT (c->>'saldo_fim_mes_anterior')::numeric FROM jsonb_array_elements(j->'carteiras') c WHERE c->>'nome'='Banco 1') <> 226.77 THEN RAISE EXCEPTION 'fechamento: %',j; END IF;
  IF (SELECT saldo FROM public.saldos_carteiras_em('2026-10-17') WHERE carteira_id='c0140000-0000-4000-8000-0000000000a2') <> 240 THEN RAISE EXCEPTION 'antes ancora'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub','c0140000-0000-4000-8000-0000000000b1',true);
DO $$ BEGIN
  IF (SELECT count(*) FROM public.saldos_carteiras_em('2026-11-20')) <> 1 OR
    (SELECT saldo FROM public.saldos_carteiras_em('2026-11-20')) <> 10 OR
    jsonb_array_length(public.resumo_painel_saldo('2026-11-20')->'carteiras') <> 1 THEN RAISE EXCEPTION 'RLS B'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub','',true);
SELECT pg_temp.erro($q$SELECT public.saldos_carteiras_em('2026-11-20')$q$);
SELECT pg_temp.erro($q$SELECT public.resumo_painel_saldo('2026-11-20')$q$);
RESET ROLE;
SET LOCAL ROLE anon;
SELECT pg_temp.erro($q$SELECT public.saldos_carteiras_em('2026-11-20')$q$);
SELECT pg_temp.erro($q$SELECT public.resumo_painel_saldo('2026-11-20')$q$);
RESET ROLE;
\ir ../migrations/015_rpc_saldo_painel_down.sql
\ir ../migrations/015_rpc_saldo_painel_down.sql
DO $$ BEGIN
 IF to_regprocedure('public.resumo_painel_saldo(date)') IS NOT NULL OR to_regprocedure('public.saldos_carteiras_em(date)') IS NOT NULL THEN RAISE EXCEPTION 'down'; END IF;
 IF (SELECT count(*) FROM public.carteiras) <> 5 THEN RAISE EXCEPTION 'down alterou dados'; END IF;
END $$;
\ir ../migrations/015_rpc_saldo_painel.sql
ROLLBACK;

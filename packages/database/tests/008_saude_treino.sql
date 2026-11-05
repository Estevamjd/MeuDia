-- Roteiro para banco local DESCARTÁVEL como superusuário (ver tests/supabase_stub.sql); nunca no Supabase.
-- 000 + 005 + 006 + 007 + 008 (2x, idempotência), CHECKs e índices da 008, RLS com duas contas (A e B) nas tabelas do
-- treino, buracos B1/B2 fechados, downs 008 (2x) e up de novo. DDL, grants e fixtures são revertidos ao final.
-- Requer PostgreSQL 15+.
\set ON_ERROR_STOP on
BEGIN;
\ir ../migrations/000_baseline.sql
\ir ../migrations/005_financas.sql
-- Como no Supabase: tabelas novas nascem com ALL para anon/authenticated (default privileges). A 008 tem de revogar.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated;
\ir ../migrations/006_carteiras.sql
\ir ../migrations/007_excluir_metas.sql
\ir ../migrations/008_saude_treino.sql
\ir ../migrations/008_saude_treino.sql

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

-- Estrutura: colunas novas, CHECKs, índices únicos parciais, policies RESTRICTIVE, tabela nova com RLS só SELECT.
DO $$
BEGIN
  IF (SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public' AND (table_name, column_name) IN (
      ('exercicios', 'repeticoes_min'), ('exercicios', 'repeticoes_max'), ('exercicios', 'modelo_origem'),
      ('treinos', 'horario'), ('treinos', 'modelo_origem'), ('series_realizadas', 'observacao'),
      ('preferencias_agente', 'notif_treino'), ('preferencias_agente', 'notif_refeicao'),
      ('preferencias_agente', 'notif_suplemento'), ('preferencias_agente', 'agenda_saude'))) <> 10 THEN
    RAISE EXCEPTION '008: faltam colunas novas';
  END IF;
  -- Colunas antigas intactas (C3/C4: o código se adapta, o banco não renomeia).
  IF (SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public' AND (table_name, column_name, data_type) IN (
      ('exercicios', 'repeticoes', 'integer'), ('exercicios', 'descanso_segundos', 'integer'),
      ('series_realizadas', 'serie_numero', 'integer'), ('series_realizadas', 'carga', 'numeric'),
      ('series_realizadas', 'repeticoes', 'integer'), ('series_realizadas', 'concluida', 'boolean'))) <> 6 THEN
    RAISE EXCEPTION '008: coluna antiga mudou de nome ou tipo';
  END IF;
  IF (SELECT count(*) FROM pg_catalog.pg_policies WHERE schemaname = 'public' AND permissive = 'RESTRICTIVE'
      AND policyname IN ('saude_sessao_treino_do_dono_ins', 'saude_sessao_treino_do_dono_upd',
                         'saude_serie_exercicio_do_dono_ins', 'saude_serie_exercicio_do_dono_upd')) <> 4 THEN
    RAISE EXCEPTION '008: policies RESTRICTIVE B1/B2 ausentes ou duplicadas';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_class WHERE oid = 'public.notificacoes_saude_enviadas'::pg_catalog.regclass AND relrowsecurity)
    OR (SELECT count(*) FROM pg_catalog.pg_policies WHERE schemaname = 'public' AND tablename = 'notificacoes_saude_enviadas') <> 1
    OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_policies WHERE schemaname = 'public' AND tablename = 'notificacoes_saude_enviadas'
      AND policyname = 'users_own_data' AND cmd = 'SELECT') THEN
    RAISE EXCEPTION '008: notificacoes_saude_enviadas sem RLS ou com policy além do SELECT';
  END IF;
  IF pg_catalog.to_regclass('public.uq_treinos_modelo') IS NULL OR pg_catalog.to_regclass('public.uq_exercicios_modelo') IS NULL
    OR pg_catalog.to_regclass('public.uq_notificacoes_saude_enviadas') IS NULL THEN
    RAISE EXCEPTION '008: índices únicos ausentes';
  END IF;
END $$;

-- Grants da tabela nova: authenticated só SELECT; anon nada.
DO $$
DECLARE
  p TEXT;
BEGIN
  FOREACH p IN ARRAY ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'] LOOP
    IF pg_catalog.has_table_privilege('anon', 'public.notificacoes_saude_enviadas', p) THEN
      RAISE EXCEPTION 'anon não deveria ter % em notificacoes_saude_enviadas', p;
    END IF;
    IF pg_catalog.has_table_privilege('authenticated', 'public.notificacoes_saude_enviadas', p) IS DISTINCT FROM (p = 'SELECT') THEN
      RAISE EXCEPTION 'Grant de authenticated incorreto: % em notificacoes_saude_enviadas', p;
    END IF;
  END LOOP;
END $$;

-- IDs: A=...a1 (treino a2, exercício a3, sessão a4, série a5), B=...b1 (treino b2, exercícios b3 faixa e b6 prancha,
-- sessão b4, série b5, notificação b7); notificação de A = a7.
INSERT INTO auth.users (id, email) VALUES
  ('c0080000-0000-4000-8000-0000000000a1', 'c008-a@example.invalid'),
  ('c0080000-0000-4000-8000-0000000000b1', 'c008-b@example.invalid');
INSERT INTO public.treinos (id, user_id, nome, dia_semana, tipo) VALUES
  ('c0080000-0000-4000-8000-0000000000a2', 'c0080000-0000-4000-8000-0000000000a1', 'Treino A', 1, 'musculacao'),
  ('c0080000-0000-4000-8000-0000000000b2', 'c0080000-0000-4000-8000-0000000000b1', 'Superior A', 1, 'musculacao');
INSERT INTO public.exercicios (id, treino_id, nome, series, repeticoes, repeticoes_min, repeticoes_max) VALUES
  ('c0080000-0000-4000-8000-0000000000a3', 'c0080000-0000-4000-8000-0000000000a2', 'Remada', 3, 10, 10, 10),
  ('c0080000-0000-4000-8000-0000000000b3', 'c0080000-0000-4000-8000-0000000000b2', 'Supino reto', 3, 8, 8, 12),
  ('c0080000-0000-4000-8000-0000000000b6', 'c0080000-0000-4000-8000-0000000000b2', 'Prancha', 3, NULL, NULL, NULL);
INSERT INTO public.sessoes_treino (id, user_id, treino_id) VALUES
  ('c0080000-0000-4000-8000-0000000000a4', 'c0080000-0000-4000-8000-0000000000a1', 'c0080000-0000-4000-8000-0000000000a2'),
  ('c0080000-0000-4000-8000-0000000000b4', 'c0080000-0000-4000-8000-0000000000b1', 'c0080000-0000-4000-8000-0000000000b2');
INSERT INTO public.series_realizadas (id, sessao_id, exercicio_id, serie_numero, carga, repeticoes, concluida) VALUES
  ('c0080000-0000-4000-8000-0000000000a5', 'c0080000-0000-4000-8000-0000000000a4', 'c0080000-0000-4000-8000-0000000000a3', 1, 50, 10, true),
  ('c0080000-0000-4000-8000-0000000000b5', 'c0080000-0000-4000-8000-0000000000b4', 'c0080000-0000-4000-8000-0000000000b3', 1, 60, 10, true);
INSERT INTO public.preferencias_agente (user_id, notif_treino) VALUES ('c0080000-0000-4000-8000-0000000000b1', true);
INSERT INTO public.notificacoes_saude_enviadas (id, user_id, tipo, origem_id, data) VALUES
  ('c0080000-0000-4000-8000-0000000000a7', 'c0080000-0000-4000-8000-0000000000a1', 'treino', 'c0080000-0000-4000-8000-0000000000a2', DATE '2026-11-02'),
  ('c0080000-0000-4000-8000-0000000000b7', 'c0080000-0000-4000-8000-0000000000b1', 'treino', 'c0080000-0000-4000-8000-0000000000b2', DATE '2026-11-02');
CREATE TEMP TABLE snapshot_b AS
  SELECT 'treinos' AS t, pg_catalog.to_jsonb(x) - 'created_at' AS v FROM public.treinos x WHERE user_id = 'c0080000-0000-4000-8000-0000000000b1'
  UNION ALL SELECT 'exercicios', pg_catalog.to_jsonb(x) FROM public.exercicios x WHERE treino_id = 'c0080000-0000-4000-8000-0000000000b2'
  UNION ALL SELECT 'sessoes', pg_catalog.to_jsonb(x) FROM public.sessoes_treino x WHERE user_id = 'c0080000-0000-4000-8000-0000000000b1'
  UNION ALL SELECT 'series', pg_catalog.to_jsonb(x) FROM public.series_realizadas x WHERE sessao_id = 'c0080000-0000-4000-8000-0000000000b4'
  UNION ALL SELECT 'prefs', pg_catalog.to_jsonb(x) FROM public.preferencias_agente x WHERE user_id = 'c0080000-0000-4000-8000-0000000000b1'
  UNION ALL SELECT 'notif', pg_catalog.to_jsonb(x) FROM public.notificacoes_saude_enviadas x WHERE user_id = 'c0080000-0000-4000-8000-0000000000b1';
GRANT SELECT ON snapshot_b TO authenticated;

-- CHECKs: faixa (min ≥ 1, max ≥ min), agenda_saude e tipo/canal da notificação.
SELECT pg_temp.expect_error($q$INSERT INTO public.exercicios (treino_id, nome, repeticoes_min) VALUES ('c0080000-0000-4000-8000-0000000000a2', 'X', 0)$q$, '23514');
SELECT pg_temp.expect_error($q$INSERT INTO public.exercicios (treino_id, nome, repeticoes_min, repeticoes_max) VALUES ('c0080000-0000-4000-8000-0000000000a2', 'X', 12, 8)$q$, '23514');
SELECT pg_temp.expect_error($q$INSERT INTO public.exercicios (treino_id, nome, repeticoes_max) VALUES ('c0080000-0000-4000-8000-0000000000a2', 'X', 0)$q$, '23514');
SELECT pg_temp.expect_error($q$UPDATE public.preferencias_agente SET agenda_saude = 'google' WHERE user_id = 'c0080000-0000-4000-8000-0000000000b1'$q$, '23514');
SELECT pg_temp.expect_error($q$INSERT INTO public.notificacoes_saude_enviadas (user_id, tipo, origem_id, data) VALUES ('c0080000-0000-4000-8000-0000000000a1', 'futebol', 'c0080000-0000-4000-8000-0000000000a2', CURRENT_DATE)$q$, '23514');
SELECT pg_temp.expect_error($q$INSERT INTO public.notificacoes_saude_enviadas (user_id, tipo, origem_id, data, canal) VALUES ('c0080000-0000-4000-8000-0000000000a1', 'treino', 'c0080000-0000-4000-8000-0000000000a2', CURRENT_DATE, 'email')$q$, '23514');

-- Idempotência: modelo aplicado 2x = 1 treino/exercício; lembrete do mesmo dia 2x = 1 linha.
INSERT INTO public.treinos (user_id, nome, dia_semana, modelo_origem) VALUES ('c0080000-0000-4000-8000-0000000000a1', 'Superior A', 2, 'modelo-estevam-v1');
INSERT INTO public.treinos (user_id, nome, dia_semana, modelo_origem) VALUES ('c0080000-0000-4000-8000-0000000000a1', 'Superior A', 2, 'modelo-estevam-v1')
  ON CONFLICT (user_id, modelo_origem, dia_semana) WHERE modelo_origem IS NOT NULL DO NOTHING;
SELECT pg_temp.expect_error($q$INSERT INTO public.treinos (user_id, nome, dia_semana, modelo_origem) VALUES ('c0080000-0000-4000-8000-0000000000a1', 'Outro', 2, 'modelo-estevam-v1')$q$, '23505');
INSERT INTO public.exercicios (treino_id, nome, ordem, modelo_origem) VALUES ('c0080000-0000-4000-8000-0000000000a2', 'Supino', 0, 'modelo-estevam-v1');
SELECT pg_temp.expect_error($q$INSERT INTO public.exercicios (treino_id, nome, ordem, modelo_origem) VALUES ('c0080000-0000-4000-8000-0000000000a2', 'Supino', 0, 'modelo-estevam-v1')$q$, '23505');
INSERT INTO public.notificacoes_saude_enviadas (user_id, tipo, origem_id, data) VALUES
  ('c0080000-0000-4000-8000-0000000000a1', 'treino', 'c0080000-0000-4000-8000-0000000000a2', DATE '2026-11-02')
  ON CONFLICT DO NOTHING;
DO $$
BEGIN
  IF (SELECT count(*) FROM public.treinos WHERE modelo_origem = 'modelo-estevam-v1') <> 1
    OR (SELECT count(*) FROM public.notificacoes_saude_enviadas WHERE user_id = 'c0080000-0000-4000-8000-0000000000a1') <> 1 THEN
    RAISE EXCEPTION '008: índice único parcial não impediu duplicata';
  END IF;
  -- Sem modelo_origem (treinos comuns): fora do índice, pode repetir dia.
  INSERT INTO public.treinos (user_id, nome, dia_semana) VALUES ('c0080000-0000-4000-8000-0000000000a1', 'Extra', 2), ('c0080000-0000-4000-8000-0000000000a1', 'Extra 2', 2);
END $$;

-- Estado do Supabase anterior à 008 (tabelas do baseline): authenticated com CRUD via grants.
GRANT USAGE ON SCHEMA public TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.treinos, public.exercicios, public.sessoes_treino, public.series_realizadas,
  public.preferencias_agente TO authenticated;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'c0080000-0000-4000-8000-0000000000a1', true);

DO $$
DECLARE
  ub CONSTANT UUID := 'c0080000-0000-4000-8000-0000000000b1';
  n INTEGER;
  t TEXT;
BEGIN
  -- A não vê nada de B.
  IF EXISTS (SELECT 1 FROM public.treinos WHERE user_id = ub)
    OR EXISTS (SELECT 1 FROM public.exercicios WHERE treino_id = 'c0080000-0000-4000-8000-0000000000b2')
    OR EXISTS (SELECT 1 FROM public.sessoes_treino WHERE user_id = ub)
    OR EXISTS (SELECT 1 FROM public.series_realizadas WHERE sessao_id = 'c0080000-0000-4000-8000-0000000000b4')
    OR EXISTS (SELECT 1 FROM public.preferencias_agente WHERE user_id = ub)
    OR EXISTS (SELECT 1 FROM public.notificacoes_saude_enviadas WHERE user_id = ub) THEN
    RAISE EXCEPTION 'A leu dados de B';
  END IF;
  IF (SELECT count(*) FROM public.notificacoes_saude_enviadas) <> 1 THEN
    RAISE EXCEPTION 'A deveria ler só a própria notificação';
  END IF;

  -- UPDATE/DELETE em linhas de B afetam 0.
  FOREACH t IN ARRAY ARRAY['treinos', 'exercicios', 'sessoes_treino', 'series_realizadas'] LOOP
    EXECUTE pg_catalog.format('UPDATE public.%I SET id = id WHERE id = ANY ($1)', t) USING ARRAY[
      'c0080000-0000-4000-8000-0000000000b2', 'c0080000-0000-4000-8000-0000000000b3', 'c0080000-0000-4000-8000-0000000000b4',
      'c0080000-0000-4000-8000-0000000000b5', 'c0080000-0000-4000-8000-0000000000b6']::UUID[];
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n <> 0 THEN RAISE EXCEPTION 'A alterou % de B', t; END IF;
    EXECUTE pg_catalog.format('DELETE FROM public.%I WHERE id = ANY ($1)', t) USING ARRAY[
      'c0080000-0000-4000-8000-0000000000b2', 'c0080000-0000-4000-8000-0000000000b3', 'c0080000-0000-4000-8000-0000000000b4',
      'c0080000-0000-4000-8000-0000000000b5', 'c0080000-0000-4000-8000-0000000000b6']::UUID[];
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n <> 0 THEN RAISE EXCEPTION 'A apagou % de B', t; END IF;
  END LOOP;
  UPDATE public.preferencias_agente SET notif_treino = false WHERE user_id = ub;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'A alterou preferências de B'; END IF;

  -- Controle positivo: A grava o próprio treino, exercício com faixa, sessão, série e lembrete.
  INSERT INTO public.sessoes_treino (user_id, treino_id) VALUES ('c0080000-0000-4000-8000-0000000000a1', 'c0080000-0000-4000-8000-0000000000a2');
  INSERT INTO public.series_realizadas (sessao_id, exercicio_id, serie_numero, carga, repeticoes, concluida, observacao)
    VALUES ('c0080000-0000-4000-8000-0000000000a4', 'c0080000-0000-4000-8000-0000000000a3', 2, 52.5, 9, true, 'pegada aberta');
  INSERT INTO public.exercicios (treino_id, nome, series, repeticoes_min, repeticoes_max)
    VALUES ('c0080000-0000-4000-8000-0000000000a2', 'Prancha', 3, NULL, NULL);
  INSERT INTO public.preferencias_agente (user_id) VALUES ('c0080000-0000-4000-8000-0000000000a1');
  IF (SELECT notif_treino OR notif_refeicao OR notif_suplemento OR agenda_saude <> 'nao' FROM public.preferencias_agente
      WHERE user_id = 'c0080000-0000-4000-8000-0000000000a1') THEN
    RAISE EXCEPTION 'Lembretes de saúde deveriam nascer desligados';
  END IF;
  UPDATE public.preferencias_agente SET notif_treino = true WHERE user_id = 'c0080000-0000-4000-8000-0000000000a1';
END $$;

-- Escrita com user_id de B: barrada pela policy.
SELECT pg_temp.expect_error($q$INSERT INTO public.treinos (user_id, nome, dia_semana) VALUES ('c0080000-0000-4000-8000-0000000000b1', 'X', 1)$q$, '42501');
SELECT pg_temp.expect_error($q$INSERT INTO public.sessoes_treino (user_id, treino_id) VALUES ('c0080000-0000-4000-8000-0000000000b1', 'c0080000-0000-4000-8000-0000000000b2')$q$, '42501');
SELECT pg_temp.expect_error($q$INSERT INTO public.exercicios (treino_id, nome) VALUES ('c0080000-0000-4000-8000-0000000000b2', 'X')$q$, '42501');
SELECT pg_temp.expect_error($q$INSERT INTO public.preferencias_agente (user_id, notif_treino) VALUES ('c0080000-0000-4000-8000-0000000000b1', false)$q$, '42501');
-- Lembretes enviados: só o cron (service role) grava.
SELECT pg_temp.expect_error($q$INSERT INTO public.notificacoes_saude_enviadas (user_id, tipo, origem_id, data) VALUES ('c0080000-0000-4000-8000-0000000000a1', 'treino', 'c0080000-0000-4000-8000-0000000000a2', CURRENT_DATE)$q$, '42501');
SELECT pg_temp.expect_error($q$DELETE FROM public.notificacoes_saude_enviadas WHERE id = 'c0080000-0000-4000-8000-0000000000a7'$q$, '42501');
-- B1: sessão de A apontando para treino de B (antes da 008 passava, e o CASCADE de B apagava a sessão de A).
SELECT pg_temp.expect_error($q$INSERT INTO public.sessoes_treino (user_id, treino_id) VALUES ('c0080000-0000-4000-8000-0000000000a1', 'c0080000-0000-4000-8000-0000000000b2')$q$, '42501');
SELECT pg_temp.expect_error($q$UPDATE public.sessoes_treino SET treino_id = 'c0080000-0000-4000-8000-0000000000b2' WHERE id = 'c0080000-0000-4000-8000-0000000000a4'$q$, '42501');
-- B2: série de A com exercício de B.
SELECT pg_temp.expect_error($q$INSERT INTO public.series_realizadas (sessao_id, exercicio_id, serie_numero) VALUES ('c0080000-0000-4000-8000-0000000000a4', 'c0080000-0000-4000-8000-0000000000b3', 9)$q$, '42501');
SELECT pg_temp.expect_error($q$UPDATE public.series_realizadas SET exercicio_id = 'c0080000-0000-4000-8000-0000000000b3' WHERE id = 'c0080000-0000-4000-8000-0000000000a5'$q$, '42501');

-- anon não lê nada.
SET LOCAL ROLE anon;
SELECT pg_temp.expect_error('SELECT 1 FROM public.notificacoes_saude_enviadas', '42501');
RESET ROLE;

-- B segue com tudo igual (comparado com o snapshot do início).
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'c0080000-0000-4000-8000-0000000000b1', true);
DO $$
BEGIN
  IF EXISTS (
    (SELECT t, v FROM snapshot_b)
    EXCEPT
    (SELECT 'treinos', pg_catalog.to_jsonb(x) - 'created_at' FROM public.treinos x
     UNION ALL SELECT 'exercicios', pg_catalog.to_jsonb(x) FROM public.exercicios x
     UNION ALL SELECT 'sessoes', pg_catalog.to_jsonb(x) FROM public.sessoes_treino x
     UNION ALL SELECT 'series', pg_catalog.to_jsonb(x) FROM public.series_realizadas x
     UNION ALL SELECT 'prefs', pg_catalog.to_jsonb(x) FROM public.preferencias_agente x
     UNION ALL SELECT 'notif', pg_catalog.to_jsonb(x) FROM public.notificacoes_saude_enviadas x)
  ) OR (SELECT count(*) FROM public.treinos) <> 1 THEN
    RAISE EXCEPTION 'Dados de B mudaram ou A vazou para B';
  END IF;
END $$;
RESET ROLE;

-- Down da 008 (2x): colunas, índices, policies e a tabela nova somem; linhas e colunas antigas ficam.
\ir ../migrations/008_saude_treino_down.sql
\ir ../migrations/008_saude_treino_down.sql
DO $$
BEGIN
  IF pg_catalog.to_regclass('public.notificacoes_saude_enviadas') IS NOT NULL
    OR EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND (table_name, column_name) IN (
      ('exercicios', 'repeticoes_min'), ('exercicios', 'repeticoes_max'), ('exercicios', 'modelo_origem'),
      ('treinos', 'horario'), ('treinos', 'modelo_origem'), ('series_realizadas', 'observacao'),
      ('preferencias_agente', 'notif_treino'), ('preferencias_agente', 'notif_refeicao'),
      ('preferencias_agente', 'notif_suplemento'), ('preferencias_agente', 'agenda_saude')))
    OR EXISTS (SELECT 1 FROM pg_catalog.pg_policies WHERE schemaname = 'public' AND policyname LIKE 'saude\_%')
    OR pg_catalog.to_regclass('public.uq_treinos_modelo') IS NOT NULL THEN
    RAISE EXCEPTION 'Down da 008 deixou objetos para trás';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.series_realizadas WHERE id = 'c0080000-0000-4000-8000-0000000000b5' AND carga = 60 AND repeticoes = 10)
    OR NOT EXISTS (SELECT 1 FROM public.exercicios WHERE id = 'c0080000-0000-4000-8000-0000000000b3' AND repeticoes = 8)
    OR NOT EXISTS (SELECT 1 FROM public.preferencias_agente WHERE user_id = 'c0080000-0000-4000-8000-0000000000b1') THEN
    RAISE EXCEPTION 'Down da 008 apagou dado que existia antes dela';
  END IF;
END $$;
-- Sem a 008 o buraco B1 volta (prova de que a policy RESTRICTIVE é o que fecha).
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'c0080000-0000-4000-8000-0000000000a1', true);
INSERT INTO public.sessoes_treino (id, user_id, treino_id) VALUES
  ('c0080000-0000-4000-8000-0000000000a9', 'c0080000-0000-4000-8000-0000000000a1', 'c0080000-0000-4000-8000-0000000000b2');
RESET ROLE;
DELETE FROM public.sessoes_treino WHERE id = 'c0080000-0000-4000-8000-0000000000a9';

\ir ../migrations/008_saude_treino.sql
\ir ../migrations/008_saude_treino.sql
DO $$
BEGIN
  IF pg_catalog.to_regclass('public.notificacoes_saude_enviadas') IS NULL
    OR (SELECT notif_treino FROM public.preferencias_agente WHERE user_id = 'c0080000-0000-4000-8000-0000000000b1') IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'Up após down falhou (ou notif_treino não voltou com o DEFAULT false)';
  END IF;
END $$;
ROLLBACK;

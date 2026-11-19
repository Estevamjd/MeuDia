-- Roteiro para banco local DESCARTÁVEL; nunca no Supabase. Produção ainda não tem a 008 (treinos.horario):
-- os candidatos precisam funcionar sem a coluna (hora do plano = null).
\set ON_ERROR_STOP on
BEGIN;
\ir ../migrations/000_baseline.sql
\ir ../migrations/005_financas.sql
\ir ../migrations/006_carteiras.sql
\ir ../migrations/009_origem_lancamento.sql
\ir ../migrations/010_treino_dieta_whatsapp.sql
\ir ../migrations/011_whatsapp_onboarding.sql
\ir ../migrations/012_whatsapp_amigo.sql
\ir ../migrations/013_whatsapp_lembretes.sql
DO $$ DECLARE u UUID := '00000000-0000-0000-0000-000000013b01'; r JSONB; BEGIN
  INSERT INTO auth.users (id) VALUES (u); INSERT INTO public.profiles (id) VALUES (u) ON CONFLICT DO NOTHING;
  UPDATE public.profiles SET whatsapp = '5511944443333' WHERE id = u;
  INSERT INTO private.integracoes (nome, segredo_sha256) VALUES ('whatsapp', encode(sha256(convert_to('s', 'UTF8')), 'hex'));
  PERFORM public.whatsapp_contato('s', '5511944443333', 30);
  INSERT INTO public.treinos (user_id, nome, dia_semana) VALUES (u, 'Perna', EXTRACT(DOW FROM (NOW() AT TIME ZONE 'America/Sao_Paulo')::DATE)::INT);
  r := public.whatsapp_lembretes_candidatos('s', NULL);
  IF r->'candidatos'->0->'treino_hoje'->>'nome' <> 'Perna' OR r->'candidatos'->0->'treino_hoje'->'hora' <> 'null'::jsonb THEN
    RAISE EXCEPTION '013 sem 008: %', r;
  END IF;
END $$;
ROLLBACK;

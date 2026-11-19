-- Roteiro para banco local DESCARTÁVEL como superusuário (ver tests/supabase_stub.sql); nunca no Supabase.
-- 000 + 005 + 006 + 009 (2x, idempotência), default 'app', CHECK, down (2x) e up de novo. Tudo revertido ao final.
\set ON_ERROR_STOP on
BEGIN;
\ir ../migrations/000_baseline.sql
\ir ../migrations/005_financas.sql
\ir ../migrations/006_carteiras.sql
\ir ../migrations/009_origem_lancamento.sql
\ir ../migrations/009_origem_lancamento.sql

DO $$
DECLARE
  u UUID := '00000000-0000-0000-0000-0000000009a1';
  v TEXT;
BEGIN
  INSERT INTO auth.users (id) VALUES (u);
  INSERT INTO public.transacoes (user_id, tipo, categoria, descricao, valor) VALUES (u, 'despesa', 'Mercado', 'teste', 1)
    RETURNING origem INTO v;
  IF v IS DISTINCT FROM 'app' THEN RAISE EXCEPTION '009: default deveria ser app, veio %', v; END IF;
  INSERT INTO public.transacoes (user_id, tipo, categoria, descricao, valor, origem) VALUES (u, 'despesa', 'Mercado', 'zap', 1, 'whatsapp');
  BEGIN
    INSERT INTO public.transacoes (user_id, tipo, categoria, descricao, valor, origem) VALUES (u, 'despesa', 'Mercado', 'x', 1, 'sms');
    RAISE EXCEPTION '009: CHECK deveria barrar origem sms';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
END $$;

\ir ../migrations/009_origem_lancamento_down.sql
\ir ../migrations/009_origem_lancamento_down.sql
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'transacoes' AND column_name = 'origem') THEN
    RAISE EXCEPTION '009 down: origem deveria sumir';
  END IF;
END $$;
\ir ../migrations/009_origem_lancamento.sql
ROLLBACK;

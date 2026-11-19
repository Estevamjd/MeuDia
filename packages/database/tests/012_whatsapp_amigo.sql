-- Roteiro para banco local DESCARTÁVEL como superusuário (ver tests/supabase_stub.sql); nunca no Supabase.
\set ON_ERROR_STOP on
BEGIN;
\ir ../migrations/000_baseline.sql
\ir ../migrations/005_financas.sql
\ir ../migrations/006_carteiras.sql
\ir ../migrations/009_origem_lancamento.sql
\ir ../migrations/010_treino_dieta_whatsapp.sql
\ir ../migrations/011_whatsapp_onboarding.sql
\ir ../migrations/012_whatsapp_amigo.sql
\ir ../migrations/012_whatsapp_amigo.sql

DO $$
DECLARE
  u UUID := '00000000-0000-0000-0000-000000012a01';
  r JSONB;
  hoje DATE := (NOW() AT TIME ZONE 'America/Sao_Paulo')::DATE;
  i INTEGER;
BEGIN
  INSERT INTO auth.users (id) VALUES (u);
  INSERT INTO public.profiles (id) VALUES (u) ON CONFLICT (id) DO NOTHING;
  INSERT INTO private.integracoes (nome, segredo_sha256)
    VALUES ('whatsapp', encode(sha256(convert_to('segredo-teste', 'UTF8')), 'hex'));
  INSERT INTO public.carteiras (user_id, nome, tipo) VALUES (u, 'Nubank', 'banco');

  -- Sem conta não guarda fato.
  PERFORM public.whatsapp_contato('segredo-teste', '5511966665555', 30);
  r := public.whatsapp_lembrar('segredo-teste', '5511966665555', 'não gosto de academia de manhã');
  IF r->>'erro' <> 'numero_sem_conta' THEN RAISE EXCEPTION '012: guardou fato sem conta: %', r; END IF;
  r := public.whatsapp_lembrar('errado', '5511966665555', 'x x x');
  IF r->>'erro' <> 'nao_autorizado' THEN RAISE EXCEPTION '012: segredo errado: %', r; END IF;

  UPDATE public.profiles SET whatsapp = '5511966665555' WHERE id = u;
  r := public.whatsapp_contato('segredo-teste', '5511966665555', 30);
  IF NOT (r->>'vinculado')::boolean OR r->'fatos' <> '[]'::jsonb THEN RAISE EXCEPTION '012: contato sem fatos: %', r; END IF;

  -- Guarda, não repete (sem diferenciar maiúscula), limita a 10 mantendo os mais novos, valida tamanho.
  r := public.whatsapp_lembrar('segredo-teste', '5511966665555', '  não gosto de   academia de manhã ');
  r := public.whatsapp_lembrar('segredo-teste', '5511966665555', 'Não gosto de academia de manhã');
  IF (r->>'total')::int <> 1 THEN RAISE EXCEPTION '012: fato repetido: %', r; END IF;
  FOR i IN 1..11 LOOP PERFORM public.whatsapp_lembrar('segredo-teste', '5511966665555', 'fato ' || i); END LOOP;
  r := public.whatsapp_contato('segredo-teste', '5511966665555', 30);
  IF jsonb_array_length(r->'fatos') <> 10 OR r->'fatos'->>0 <> 'fato 2' OR r->'fatos'->>9 <> 'fato 11' THEN RAISE EXCEPTION '012: limite de fatos: %', r->'fatos'; END IF;
  r := public.whatsapp_lembrar('segredo-teste', '5511966665555', 'ab');
  IF r->>'erro' <> 'fato_invalido' THEN RAISE EXCEPTION '012: fato curto: %', r; END IF;
  r := public.whatsapp_lembrar('segredo-teste', '5511966665555', NULL);
  IF (r->>'total')::int <> 0 THEN RAISE EXCEPTION '012: esquecer: %', r; END IF;

  -- Contexto: recentes (até 5, mais novo primeiro) e dias sem treino.
  INSERT INTO public.registros_treino (user_id, data, descricao) VALUES (u, hoje - 9, 'Pernas');
  r := public.whatsapp_registrar('segredo-teste', '5511966665555', 'm1', 'treino', jsonb_build_object('descricao', 'Peito'));
  IF (r->'extras'->>'dias_sem_treino')::int <> 9 OR (r->'extras'->>'treinos_semana')::int < 1 THEN RAISE EXCEPTION '012: dias_sem_treino: %', r; END IF;
  IF r->'extras'->'recentes'->0->>'descricao' <> 'Peito' THEN RAISE EXCEPTION '012: recentes treino: %', r; END IF;
  r := public.whatsapp_registrar('segredo-teste', '5511966665555', 'm2', 'refeicao', jsonb_build_object('tipo', 'lanche', 'descricao', 'Hambúrguer'));
  r := public.whatsapp_registrar('segredo-teste', '5511966665555', 'm3', 'gasto', jsonb_build_object('valor', 35, 'descricao', 'Hambúrguer', 'categoria', 'Comida'));
  IF r->'extras' ? 'dias_sem_treino' THEN RAISE EXCEPTION '012: dias_sem_treino fora do treino: %', r; END IF;
  IF jsonb_array_length(r->'extras'->'recentes') <> 3 OR r->'extras'->'recentes'->0->>'tipo' <> 'gasto'
     OR (r->'extras'->'recentes'->0->>'valor')::numeric <> 35 THEN RAISE EXCEPTION '012: recentes: %', r->'extras'->'recentes'; END IF;
  FOR i IN 4..9 LOOP PERFORM public.whatsapp_registrar('segredo-teste', '5511966665555', 'm' || i, 'gasto', jsonb_build_object('valor', i)); END LOOP;
  r := public.whatsapp_registrar('segredo-teste', '5511966665555', 'm10', 'treino', jsonb_build_object('descricao', 'Costas'));
  IF jsonb_array_length(r->'extras'->'recentes') <> 5 OR (r->'extras'->>'dias_sem_treino')::int <> 9 THEN RAISE EXCEPTION '012: recentes limite/dias: %', r->'extras'; END IF;
END $$;

-- anon não chama o ajudante interno nem lê fatos direto.
SET LOCAL ROLE anon;
DO $$
BEGIN
  PERFORM private.whatsapp_contexto('00000000-0000-0000-0000-000000012a01', 'treino', CURRENT_DATE);
  RAISE EXCEPTION '012: anon chamou whatsapp_contexto';
EXCEPTION WHEN insufficient_privilege THEN NULL;
END $$;
RESET ROLE;

\ir ../migrations/012_whatsapp_amigo_down.sql
\ir ../migrations/012_whatsapp_amigo_down.sql
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'whatsapp_contatos' AND column_name = 'fatos') THEN RAISE EXCEPTION '012: down não tirou fatos'; END IF;
  IF public.whatsapp_contato('segredo-teste', '5511966665555', 30) ? 'fatos' THEN RAISE EXCEPTION '012: down não voltou whatsapp_contato'; END IF;
END $$;
\ir ../migrations/012_whatsapp_amigo.sql
ROLLBACK;

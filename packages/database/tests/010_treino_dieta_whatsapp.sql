-- Roteiro para banco local DESCARTÁVEL como superusuário (ver tests/supabase_stub.sql); nunca no Supabase.
\set ON_ERROR_STOP on
BEGIN;
\ir ../migrations/000_baseline.sql
\ir ../migrations/005_financas.sql
\ir ../migrations/006_carteiras.sql
\ir ../migrations/009_origem_lancamento.sql
\ir ../migrations/010_treino_dieta_whatsapp.sql
\ir ../migrations/010_treino_dieta_whatsapp.sql

DO $$
DECLARE
  u UUID := '00000000-0000-0000-0000-000000010a01';
  outro UUID := '00000000-0000-0000-0000-000000010a02';
  r JSONB;
  n INTEGER;
BEGIN
  INSERT INTO auth.users (id) VALUES (u), (outro);
  INSERT INTO public.profiles (id) VALUES (u), (outro) ON CONFLICT (id) DO NOTHING; -- o gatilho de auth.users pode já ter criado
  UPDATE public.profiles SET nome = 'Bia', whatsapp = '5511988887777' WHERE id = u;
  INSERT INTO public.carteiras (user_id, nome, tipo) VALUES (u, 'Nubank', 'banco');
  INSERT INTO private.integracoes (nome, segredo_sha256)
    VALUES ('whatsapp', encode(sha256(convert_to('segredo-teste', 'UTF8')), 'hex'));

  r := public.whatsapp_registrar('errado', '5511988887777', 'm0', 'gasto', '{"valor": 10}');
  IF r->>'erro' IS DISTINCT FROM 'nao_autorizado' THEN RAISE EXCEPTION '010: segredo errado passou: %', r; END IF;
  r := public.whatsapp_registrar('segredo-teste', '5599999999999', 'm0', 'gasto', '{"valor": 10}');
  IF r->>'erro' IS DISTINCT FROM 'numero_sem_conta' THEN RAISE EXCEPTION '010: número sem conta passou: %', r; END IF;

  r := public.whatsapp_registrar('segredo-teste', '5511988887777', 'm1', 'gasto', '{"valor": 30, "categoria": "Mercado", "descricao": "mercado"}');
  IF NOT (r->>'ok')::BOOLEAN OR r->>'nome' <> 'Bia' THEN RAISE EXCEPTION '010: gasto falhou: %', r; END IF;
  r := public.whatsapp_registrar('segredo-teste', '5511988887777', 'm1', 'gasto', '{"valor": 30}');
  IF NOT (r->>'duplicada')::BOOLEAN THEN RAISE EXCEPTION '010: mensagem repetida deveria ser ignorada: %', r; END IF;
  SELECT count(*) INTO n FROM public.transacoes WHERE user_id = u AND origem = 'whatsapp' AND carteira_id IS NOT NULL AND tipo = 'despesa';
  IF n <> 1 THEN RAISE EXCEPTION '010: esperava 1 gasto pelo WhatsApp no banco, veio %', n; END IF;

  -- Sem o 9 do celular (formato antigo que o WhatsApp ainda manda) acha a mesma conta.
  r := public.whatsapp_registrar('segredo-teste', '551188887777', 'm1b', 'ping', '{}');
  IF (r->>'ok')::boolean IS NOT TRUE OR r->>'nome' <> 'Bia' THEN RAISE EXCEPTION '010: variante sem 9 falhou: %', r; END IF;
  r := public.whatsapp_registrar('segredo-teste', '5511988887777', 'm2', 'treino', '{"descricao": "peito", "duracao_min": 40}');
  IF NOT (r->>'ok')::BOOLEAN THEN RAISE EXCEPTION '010: treino falhou: %', r; END IF;
  r := public.whatsapp_registrar('segredo-teste', '5511988887777', 'm3', 'refeicao', '{"tipo": "almoco", "descricao": "arroz, feijão, frango"}');
  IF NOT (r->>'ok')::BOOLEAN THEN RAISE EXCEPTION '010: refeição falhou: %', r; END IF;
  r := public.whatsapp_registrar('segredo-teste', '5511988887777', 'm4', 'refeicao', '{"tipo": "brunch", "descricao": "x"}');
  IF (r->>'ok')::BOOLEAN THEN RAISE EXCEPTION '010: tipo de refeição inválido passou'; END IF;
  r := public.whatsapp_registrar('segredo-teste', '5511988887777', 'm5', 'gasto', '{"valor": -5}');
  IF r->>'erro' IS DISTINCT FROM 'valor_invalido' THEN RAISE EXCEPTION '010: valor negativo passou: %', r; END IF;

  SELECT count(*) INTO n FROM public.registros_treino WHERE user_id = u AND origem = 'whatsapp' AND duracao_min = 40;
  IF n <> 1 THEN RAISE EXCEPTION '010: treino não gravado'; END IF;
  BEGIN
    UPDATE public.profiles SET whatsapp = '12ab' WHERE id = outro;
    RAISE EXCEPTION '010: CHECK do whatsapp deveria barrar';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
END $$;

-- RLS: Caio não vê os registros da Bia; anon não lê as tabelas.
SET LOCAL ROLE authenticated;
DO $$ BEGIN PERFORM set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000010a02', true); END $$;
DO $$
BEGIN
  IF (SELECT count(*) FROM public.registros_treino) <> 0 OR (SELECT count(*) FROM public.registros_refeicao) <> 0 THEN
    RAISE EXCEPTION '010: RLS vazou registros de outro usuário';
  END IF;
END $$;
RESET ROLE;
SET LOCAL ROLE anon;
DO $$
BEGIN
  PERFORM 1 FROM public.registros_treino;
  RAISE EXCEPTION '010: anon não deveria ler registros_treino';
EXCEPTION WHEN insufficient_privilege THEN NULL;
END $$;
DO $$
BEGIN
  PERFORM 1 FROM private.integracoes;
  RAISE EXCEPTION '010: anon não deveria ler private.integracoes';
EXCEPTION WHEN insufficient_privilege THEN NULL;
END $$;
RESET ROLE;

\ir ../migrations/010_treino_dieta_whatsapp_down.sql
\ir ../migrations/010_treino_dieta_whatsapp_down.sql
\ir ../migrations/010_treino_dieta_whatsapp.sql
ROLLBACK;

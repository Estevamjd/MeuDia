-- Roteiro para banco local DESCARTÁVEL como superusuário (ver tests/supabase_stub.sql); nunca no Supabase.
\set ON_ERROR_STOP on
BEGIN;
\ir ../migrations/000_baseline.sql
\ir ../migrations/005_financas.sql
\ir ../migrations/006_carteiras.sql
\ir ../migrations/009_origem_lancamento.sql
\ir ../migrations/010_treino_dieta_whatsapp.sql
\ir ../migrations/011_whatsapp_onboarding.sql
\ir ../migrations/011_whatsapp_onboarding.sql

DO $$
DECLARE
  u UUID := '00000000-0000-0000-0000-000000011a01';
  outro UUID := '00000000-0000-0000-0000-000000011a02';
  r JSONB;
  tok TEXT;
  n INTEGER;
BEGIN
  INSERT INTO auth.users (id) VALUES (u), (outro);
  INSERT INTO public.profiles (id) VALUES (u), (outro) ON CONFLICT (id) DO NOTHING;
  UPDATE public.profiles SET nome = '' WHERE id = u;
  INSERT INTO private.integracoes (nome, segredo_sha256)
    VALUES ('whatsapp', encode(sha256(convert_to('segredo-teste', 'UTF8')), 'hex'));

  -- Segredo errado não cria contato.
  r := public.whatsapp_contato('errado', '5511977776666', 30);
  IF r->>'erro' <> 'nao_autorizado' OR EXISTS (SELECT 1 FROM public.whatsapp_contatos) THEN RAISE EXCEPTION '011: segredo errado passou: %', r; END IF;

  -- Número novo: etapa inicio, não vinculado, contador 1.
  r := public.whatsapp_contato('segredo-teste', '5511977776666', 2);
  IF r->>'etapa' <> 'inicio' OR (r->>'vinculado')::boolean OR (r->>'msgs_hoje')::int <> 1 THEN RAISE EXCEPTION '011: contato novo: %', r; END IF;
  r := public.whatsapp_contato('segredo-teste', '5511977776666', 2);
  r := public.whatsapp_contato('segredo-teste', '5511977776666', 2);
  IF NOT (r->>'limite_excedido')::boolean THEN RAISE EXCEPTION '011: limite diário não barrou: %', r; END IF;
  -- Dia novo zera o contador.
  UPDATE public.whatsapp_contatos SET msgs_dia = msgs_dia - 1;
  r := public.whatsapp_contato('segredo-teste', '5511977776666', 2);
  IF (r->>'msgs_hoje')::int <> 1 THEN RAISE EXCEPTION '011: contador não zerou: %', r; END IF;

  -- Respostas do onboarding.
  r := public.whatsapp_onboarding('segredo-teste', '5511977776666', '{"etapa":"estilo","nome":"Lia","renda":3500,"objetivo":"guardar para viajar","metas":["dinheiro","treino","treino"],"estilo_tamanho":"detalhado","estilo_emoji":false}', false);
  IF NOT (r->>'ok')::boolean THEN RAISE EXCEPTION '011: onboarding falhou: %', r; END IF;
  r := public.whatsapp_onboarding('segredo-teste', '5511977776666', '{"metas":["dinheiro","viagem"]}', false);
  IF r->>'erro' <> 'dados_invalidos' THEN RAISE EXCEPTION '011: meta inválida passou: %', r; END IF;
  r := public.whatsapp_onboarding('segredo-teste', '5511977776666', '{"etapa":"concluido"}', false);
  IF r->>'erro' <> 'ja_vinculado' THEN RAISE EXCEPTION '011: etapa concluido pelo servidor passou: %', r; END IF;
  r := public.whatsapp_onboarding('segredo-teste', '5511977776666', '{"etapa":"link"}', true);
  tok := r->>'token';
  IF tok !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION '011: token não gerado: %', r; END IF;
  IF (SELECT token_sha256 FROM public.whatsapp_contatos) = tok THEN RAISE EXCEPTION '011: token guardado em claro'; END IF;
  PERFORM set_config('teste.token', tok, true);
  SELECT array_length(metas, 1) INTO n FROM public.whatsapp_contatos;
  IF n <> 2 THEN RAISE EXCEPTION '011: metas duplicadas'; END IF;
END $$;

-- Anon não lê a tabela nem chama o vincular.
SET LOCAL ROLE anon;
DO $$
BEGIN
  PERFORM 1 FROM public.whatsapp_contatos;
  RAISE EXCEPTION '011: anon leu whatsapp_contatos';
EXCEPTION WHEN insufficient_privilege THEN NULL;
END $$;
DO $$
BEGIN
  PERFORM public.whatsapp_vincular('x');
  RAISE EXCEPTION '011: anon chamou whatsapp_vincular';
EXCEPTION WHEN insufficient_privilege THEN NULL;
END $$;
RESET ROLE;

-- Logado: token errado falha; certo liga número, nome e renda; token não serve duas vezes.
SET LOCAL ROLE authenticated;
DO $$ BEGIN PERFORM set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000011a01', true); END $$;
DO $$
DECLARE r JSONB;
BEGIN
  r := public.whatsapp_vincular(repeat('a', 64));
  IF r->>'erro' <> 'token_invalido' THEN RAISE EXCEPTION '011: token errado passou: %', r; END IF;
  r := public.whatsapp_vincular(current_setting('teste.token'));
  IF NOT (r->>'ok')::boolean THEN RAISE EXCEPTION '011: vincular falhou: %', r; END IF;
  r := public.whatsapp_vincular(current_setting('teste.token'));
  IF r->>'erro' <> 'token_invalido' THEN RAISE EXCEPTION '011: token reutilizado: %', r; END IF;
  -- O dono lê o próprio contato (RLS).
  IF (SELECT count(*) FROM public.whatsapp_contatos) <> 1 THEN RAISE EXCEPTION '011: dono não lê o contato'; END IF;
END $$;
RESET ROLE;

DO $$
DECLARE
  u UUID := '00000000-0000-0000-0000-000000011a01';
  r JSONB;
  v_carteira UUID;
BEGIN
  IF (SELECT whatsapp FROM public.profiles WHERE id = u) <> '5511977776666' THEN RAISE EXCEPTION '011: número não ligado'; END IF;
  IF (SELECT nome FROM public.profiles WHERE id = u) <> 'Lia' THEN RAISE EXCEPTION '011: nome não aproveitado'; END IF;
  IF (SELECT valor FROM public.rendas WHERE user_id = u) <> 3500 THEN RAISE EXCEPTION '011: renda não aproveitada'; END IF;

  -- Agora o contato aparece como vinculado/concluído.
  r := public.whatsapp_contato('segredo-teste', '5511977776666', 30);
  IF NOT (r->>'vinculado')::boolean OR r->>'etapa' <> 'concluido' OR r->>'nome' <> 'Lia' THEN RAISE EXCEPTION '011: vínculo não refletiu: %', r; END IF;
  r := public.whatsapp_onboarding('segredo-teste', '5511977776666', '{"nome":"X"}', false);
  IF r->>'erro' <> 'ja_vinculado' THEN RAISE EXCEPTION '011: onboarding depois do vínculo: %', r; END IF;

  -- Extras: orçamento restante e conta que vence em até 3 dias.
  INSERT INTO public.carteiras (user_id, nome, tipo) VALUES (u, 'Nubank', 'banco') RETURNING id INTO v_carteira;
  INSERT INTO public.orcamento_categorias (user_id, categoria, valor_planejado) VALUES (u, 'Mercado', 500);
  INSERT INTO public.contas_pagar (user_id, descricao, categoria, valor, recorrencia, dia_vencimento)
    VALUES (u, 'Luz', 'Luz', 120, 'mensal', EXTRACT(DAY FROM (NOW() AT TIME ZONE 'America/Sao_Paulo'))::int);
  r := public.whatsapp_registrar('segredo-teste', '5511977776666', 'x1', 'gasto', '{"valor": 80, "categoria": "Mercado"}');
  IF (r->'extras'->>'planejado')::numeric <> 500 OR (r->'extras'->>'gasto_mes')::numeric <> 80 OR r->'extras'->>'conta_descricao' <> 'Luz' THEN
    RAISE EXCEPTION '011: extras do gasto: %', r;
  END IF;
  r := public.whatsapp_registrar('segredo-teste', '5511977776666', 'x2', 'treino', '{"descricao": "peito"}');
  IF (r->'extras'->>'treinos_semana')::int <> 1 THEN RAISE EXCEPTION '011: extras do treino: %', r; END IF;

  -- Tirar o número em Configurações desliga: o contato volta ao início.
  UPDATE public.profiles SET whatsapp = NULL WHERE id = u;
  r := public.whatsapp_contato('segredo-teste', '5511977776666', 30);
  IF (r->>'vinculado')::boolean OR r->>'etapa' <> 'inicio' THEN RAISE EXCEPTION '011: desligar não reiniciou: %', r; END IF;

  -- Excluir a conta apaga o contato (LGPD).
  UPDATE public.whatsapp_contatos SET user_id = u;
  DELETE FROM auth.users WHERE id = u;
  IF EXISTS (SELECT 1 FROM public.whatsapp_contatos) THEN RAISE EXCEPTION '011: contato sobreviveu à exclusão da conta'; END IF;
END $$;

\ir ../migrations/011_whatsapp_onboarding_down.sql
\ir ../migrations/011_whatsapp_onboarding_down.sql
\ir ../migrations/011_whatsapp_onboarding.sql
ROLLBACK;

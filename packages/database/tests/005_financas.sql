-- Roteiro para o executor em banco local DESCARTÁVEL como postgres; não executado pelo agente.
-- DDL, grants e fixtures são revertidos ao final. Requer PostgreSQL 15+.
\set ON_ERROR_STOP on
BEGIN;
\ir ../migrations/000_baseline.sql
\ir ../migrations/005_financas.sql
\ir ../migrations/005_financas.sql

-- IDs curtos abaixo: A=...001, B=...002; contas A=...003, B=...004.
INSERT INTO auth.users (id, email) VALUES
  ('be020000-0000-4000-8000-000000000001', 'be02-a@example.invalid'),
  ('be020000-0000-4000-8000-000000000002', 'be02-b@example.invalid');
INSERT INTO public.contas_pagar (id, user_id, descricao, valor, recorrencia, dia_vencimento, created_at) VALUES
  ('be020000-0000-4000-8000-000000000003', 'be020000-0000-4000-8000-000000000001', 'Teste A', 42.50, 'mensal', 20, '2026-10-01 03:00:00+00'),
  ('be020000-0000-4000-8000-000000000004', 'be020000-0000-4000-8000-000000000002', 'Teste B', 75, 'mensal', 21, '2026-10-01 03:00:00+00');
INSERT INTO public.assinaturas (id, user_id, nome, valor, dia_vencimento) VALUES
  ('be020000-0000-4000-8000-000000000005', 'be020000-0000-4000-8000-000000000002', 'Assinatura B', 10, 20),
  ('be020000-0000-4000-8000-000000000007', 'be020000-0000-4000-8000-000000000001', 'Assinatura A', 10, 20);
INSERT INTO public.transacoes (id, user_id, tipo, categoria, descricao, valor) VALUES
  ('be020000-0000-4000-8000-000000000006', 'be020000-0000-4000-8000-000000000002', 'despesa', 'Teste', 'Transação B', 10);
INSERT INTO public.pagamentos_conta (conta_id, user_id, competencia, pago_em)
  VALUES ('be020000-0000-4000-8000-000000000004', 'be020000-0000-4000-8000-000000000002', '2026-10', '2026-10-15');

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

-- O mesmo endpoint pode pertencer a usuários distintos, mas não duplicar no mesmo usuário.
INSERT INTO public.push_subscriptions (user_id, endpoint, p256dh, auth) VALUES
  ('be020000-0000-4000-8000-000000000001', 'https://example.invalid/push', 'fixture', 'fixture'),
  ('be020000-0000-4000-8000-000000000002', 'https://example.invalid/push', 'fixture', 'fixture');
SELECT pg_temp.expect_error($q$INSERT INTO public.push_subscriptions (user_id, endpoint, p256dh, auth)
  VALUES ('be020000-0000-4000-8000-000000000001', 'https://example.invalid/push', 'fixture', 'fixture')$q$, '23505');

DO $$
DECLARE f pg_catalog.regprocedure;
BEGIN
  FOREACH f IN ARRAY ARRAY['public.pagar_conta(uuid,text,date,text)'::pg_catalog.regprocedure,
                          'public.desfazer_pagamento(uuid,text)'::pg_catalog.regprocedure] LOOP
    IF pg_catalog.has_function_privilege('anon', f, 'EXECUTE')
      OR NOT pg_catalog.has_function_privilege('authenticated', f, 'EXECUTE')
      OR EXISTS (SELECT 1 FROM pg_catalog.pg_proc p,
        LATERAL pg_catalog.aclexplode(p.proacl) a WHERE p.oid = f AND a.grantee = 0 AND a.privilege_type = 'EXECUTE')
      OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_proc WHERE oid = f AND NOT prosecdef AND proconfig @> ARRAY['search_path=""']) THEN
      RAISE EXCEPTION 'Permissões/search_path/SECURITY INVOKER incorretos: %', f;
    END IF;
  END LOOP;
END $$;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contas_pagar, public.pagamentos_conta, public.transacoes, public.lembretes_enviados TO authenticated;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'be020000-0000-4000-8000-000000000001', true);

DO $$
DECLARE
  a CONSTANT UUID := 'be020000-0000-4000-8000-000000000003';
  b CONSTANT UUID := 'be020000-0000-4000-8000-000000000004';
  c public.contas_pagar;
  p public.pagamentos_conta;
  p2 public.pagamentos_conta;
  t public.transacoes;
  comp TEXT;
BEGIN
  IF EXISTS (SELECT 1 FROM public.contas_pagar WHERE id = b)
    OR EXISTS (SELECT 1 FROM public.pagamentos_conta WHERE conta_id = b) THEN
    RAISE EXCEPTION 'RLS expôs conta/pagamento de B';
  END IF;
  PERFORM pg_temp.expect_error(pg_catalog.format('SELECT public.pagar_conta(%L, %L)', b, '2026-10'), 'P0002');
  PERFORM pg_temp.expect_error(pg_catalog.format('SELECT public.desfazer_pagamento(%L, %L)', b, '2026-10'), 'P0002');
  PERFORM pg_temp.expect_error(pg_catalog.format('UPDATE public.contas_pagar SET user_id = %L WHERE id = %L', 'be020000-0000-4000-8000-000000000002', a), '42501');
  PERFORM pg_temp.expect_error($q$INSERT INTO public.contas_pagar (user_id, descricao, valor, recorrencia, dia_vencimento, assinatura_id)
    VALUES (auth.uid(), 'FK assinatura B', 10, 'mensal', 20, 'be020000-0000-4000-8000-000000000005')$q$, '23503');
  PERFORM pg_temp.expect_error(pg_catalog.format($q$INSERT INTO public.pagamentos_conta (conta_id, user_id, competencia, pago_em)
    VALUES (%L, auth.uid(), '2026-09', '2026-09-15')$q$, b), '23503');
  PERFORM pg_temp.expect_error(pg_catalog.format($q$INSERT INTO public.pagamentos_conta (conta_id, user_id, competencia, pago_em, transacao_id)
    VALUES (%L, auth.uid(), '2026-10', '2026-10-15', 'be020000-0000-4000-8000-000000000006')$q$, a), '23503');
  PERFORM pg_temp.expect_error(pg_catalog.format('SELECT public.desfazer_pagamento(%L, %L)', a, '2026-10'), '22023');
  FOREACH comp IN ARRAY ARRAY['2026-13', '2026-00', '2026-1', '2026-10-01', '', NULL] LOOP
    PERFORM pg_temp.expect_error(pg_catalog.format('SELECT public.pagar_conta(%L, %L)', a, comp), '22023');
    PERFORM pg_temp.expect_error(pg_catalog.format('SELECT public.desfazer_pagamento(%L, %L)', a, comp), '22023');
    PERFORM pg_temp.expect_error(pg_catalog.format($q$INSERT INTO public.pagamentos_conta (conta_id, user_id, competencia, pago_em)
      VALUES (%L, auth.uid(), %L, '2026-10-15')$q$, a, comp), CASE WHEN comp IS NULL THEN '23502' ELSE '23514' END);
  END LOOP;
  PERFORM pg_temp.expect_error(pg_catalog.format('SELECT public.pagar_conta(%L, %L)', a, '2026-09'), '22023');
  PERFORM pg_temp.expect_error(pg_catalog.format('UPDATE public.contas_pagar SET recorrencia = %L WHERE id = %L', 'unica', a), '23514');
  UPDATE public.contas_pagar SET updated_at = '2000-01-01' WHERE id = a RETURNING * INTO c;
  IF c.updated_at IS DISTINCT FROM now() THEN RAISE EXCEPTION 'Trigger updated_at falhou'; END IF;

  SELECT * INTO p FROM public.pagar_conta(a, '2026-10', '2026-10-15', 'Banco teste');
  SELECT * INTO STRICT t FROM public.transacoes WHERE id = p.transacao_id;
  IF p.competencia <> '2026-10' OR p.pago_em <> DATE '2026-10-15'
    OR t.tipo <> 'despesa' OR t.automatico IS DISTINCT FROM TRUE
    OR t.user_id <> c.user_id OR t.categoria <> c.categoria OR t.descricao <> c.descricao
    OR t.valor <> c.valor OR t.data <> p.pago_em OR t.banco IS DISTINCT FROM 'Banco teste'
    OR EXISTS (SELECT 1 FROM public.pagamentos_conta WHERE conta_id = a AND competencia = '2026-11') THEN
    RAISE EXCEPTION 'Pagamento/transação divergente ou afetou novembro';
  END IF;
  PERFORM pg_temp.expect_error(pg_catalog.format('SELECT public.pagar_conta(%L, %L)', a, '2026-10'), 'P0003');
  PERFORM pg_temp.expect_error(pg_catalog.format($q$INSERT INTO public.pagamentos_conta (conta_id, user_id, competencia, pago_em)
    VALUES (%L, auth.uid(), '2026-10', '2026-10-15')$q$, a), '23505');
  SELECT * INTO p2 FROM public.pagar_conta(a, '2026-11', NULL);
  IF p2.pago_em IS DISTINCT FROM (now() AT TIME ZONE 'America/Sao_Paulo')::date
    OR (SELECT count(*) FROM public.pagamentos_conta WHERE conta_id = a) <> 2
    OR (SELECT count(*) FROM public.transacoes) <> 2 THEN
    RAISE EXCEPTION 'Duas competências/data SP/atomicidade falhou';
  END IF;
  PERFORM public.desfazer_pagamento(a, '2026-10');
  IF EXISTS (SELECT 1 FROM public.pagamentos_conta WHERE id = p.id)
    OR EXISTS (SELECT 1 FROM public.transacoes WHERE id = p.transacao_id)
    OR NOT EXISTS (SELECT 1 FROM public.pagamentos_conta WHERE id = p2.id)
    OR NOT EXISTS (SELECT 1 FROM public.transacoes WHERE id = p2.transacao_id) THEN
    RAISE EXCEPTION 'Desfazer afetou competência errada';
  END IF;
  DELETE FROM public.transacoes WHERE id = p2.transacao_id;
  IF NOT EXISTS (SELECT 1 FROM public.pagamentos_conta WHERE id = p2.id AND transacao_id IS NULL AND user_id = auth.uid()) THEN
    RAISE EXCEPTION 'SET NULL da transação alterou proprietário';
  END IF;
  PERFORM public.desfazer_pagamento(a, '2026-11');
  IF EXISTS (SELECT 1 FROM public.pagamentos_conta) OR EXISTS (SELECT 1 FROM public.transacoes) THEN
    RAISE EXCEPTION 'Desfazer deixou pagamento/transação órfã';
  END IF;
  PERFORM pg_temp.expect_error(pg_catalog.format('SELECT public.desfazer_pagamento(%L, %L)', a, '2026-11'), '22023');
  UPDATE public.contas_pagar SET recorrencia = 'anual', mes_vencimento = 10 WHERE id = a;
  PERFORM pg_temp.expect_error(pg_catalog.format('SELECT public.pagar_conta(%L, %L)', a, '2026-11'), '22023');
  PERFORM public.pagar_conta(a, '2026-10');
  PERFORM public.desfazer_pagamento(a, '2026-10');
  UPDATE public.contas_pagar SET recorrencia = 'unica', dia_vencimento = NULL, mes_vencimento = NULL, data_vencimento = '2026-12-20' WHERE id = a;
  PERFORM pg_temp.expect_error(pg_catalog.format('SELECT public.pagar_conta(%L, %L)', a, '2026-11'), '22023');
  PERFORM public.pagar_conta(a, '2026-12');
  PERFORM public.desfazer_pagamento(a, '2026-12');
  UPDATE public.contas_pagar SET ativo = FALSE WHERE id = a;
  PERFORM pg_temp.expect_error(pg_catalog.format('SELECT public.pagar_conta(%L, %L)', a, '2026-12'), '22023');
END $$;

SELECT set_config('request.jwt.claim.sub', 'be020000-0000-4000-8000-000000000002', true);
DO $$
BEGIN
  IF (SELECT count(*) FROM public.contas_pagar) <> 1
    OR (SELECT count(*) FROM public.pagamentos_conta) <> 1
    OR (SELECT count(*) FROM public.transacoes) <> 1 THEN
    RAISE EXCEPTION 'Isolamento de B falhou';
  END IF;
END $$;
RESET ROLE;
UPDATE public.contas_pagar SET assinatura_id = 'be020000-0000-4000-8000-000000000007'
  WHERE id = 'be020000-0000-4000-8000-000000000003';
DELETE FROM public.assinaturas WHERE id = 'be020000-0000-4000-8000-000000000007';
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.contas_pagar WHERE id = 'be020000-0000-4000-8000-000000000003'
    AND assinatura_id IS NULL AND user_id = 'be020000-0000-4000-8000-000000000001') THEN
    RAISE EXCEPTION 'SET NULL da assinatura alterou proprietário';
  END IF;
END $$;
INSERT INTO public.lembretes_enviados (user_id, conta_id, competencia, etapa) VALUES
  ('be020000-0000-4000-8000-000000000001', 'be020000-0000-4000-8000-000000000003', '2026-10', 'D-2'),
  ('be020000-0000-4000-8000-000000000001', 'be020000-0000-4000-8000-000000000003', '2026-11', 'D-2');
SELECT pg_temp.expect_error($q$INSERT INTO public.lembretes_enviados (user_id, conta_id, competencia, etapa)
  VALUES ('be020000-0000-4000-8000-000000000001', 'be020000-0000-4000-8000-000000000003', '2026-10', 'D-2')$q$, '23505');
SELECT pg_temp.expect_error($q$INSERT INTO public.lembretes_enviados (user_id, conta_id, competencia, etapa)
  VALUES ('be020000-0000-4000-8000-000000000001', 'be020000-0000-4000-8000-000000000003', '2026-13', 'D0')$q$, '23514');
SELECT pg_temp.expect_error($q$INSERT INTO public.lembretes_enviados (user_id, conta_id, competencia, etapa)
  VALUES ('be020000-0000-4000-8000-000000000001', 'be020000-0000-4000-8000-000000000004', '2026-10', 'D0')$q$, '23503');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'be020000-0000-4000-8000-000000000001', true);
DO $$
BEGIN
  IF (SELECT count(*) FROM public.lembretes_enviados) <> 2 THEN RAISE EXCEPTION 'SELECT de lembretes falhou'; END IF;
END $$;
SELECT pg_temp.expect_error($q$INSERT INTO public.lembretes_enviados (user_id, conta_id, competencia, etapa)
  VALUES (auth.uid(), 'be020000-0000-4000-8000-000000000003', '2026-12', 'D0')$q$, '42501');
UPDATE public.lembretes_enviados SET etapa = 'D0';
DELETE FROM public.lembretes_enviados;
RESET ROLE;
DO $$
BEGIN
  IF (SELECT count(*) FROM public.lembretes_enviados) <> 2
    OR EXISTS (SELECT 1 FROM public.lembretes_enviados WHERE etapa <> 'D-2') THEN
    RAISE EXCEPTION 'Usuário alterou lembretes';
  END IF;
END $$;
-- Down repetível e novo up 2x; baseline/set_updated_at preservados.
\ir ../migrations/005_financas_down.sql
\ir ../migrations/005_financas_down.sql
\ir ../migrations/005_financas.sql
\ir ../migrations/005_financas.sql
DO $$
BEGIN
  IF (SELECT count(*) FROM public.transacoes WHERE id = 'be020000-0000-4000-8000-000000000006') <> 1
    OR pg_catalog.to_regprocedure('public.set_updated_at()') IS NULL
    OR EXISTS (SELECT 1 FROM public.pagamentos_conta) THEN
    RAISE EXCEPTION 'Down/up não preservou baseline ou recriou tabelas';
  END IF;
END $$;
ROLLBACK;

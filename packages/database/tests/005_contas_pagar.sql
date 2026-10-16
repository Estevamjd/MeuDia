-- Roteiro psql para Supabase LOCAL DESCARTÁVEL, como postgres.
-- Executar somente no banco local descartável autorizado; \ir resolve pelo arquivo.
-- Tudo, inclusive DDL/grants/fixtures, é revertido no fim.
\set ON_ERROR_STOP on
BEGIN;
\ir ../migrations/000_baseline.sql
\ir ../migrations/005_contas_pagar.sql
\ir ../migrations/005_contas_pagar.sql

INSERT INTO auth.users (id, email) VALUES
  ('be020000-0000-4000-8000-000000000001', 'be02-a@example.invalid'),
  ('be020000-0000-4000-8000-000000000002', 'be02-b@example.invalid');
INSERT INTO public.contas_pagar (id, user_id, descricao, valor, competencia, vencimento) VALUES
  ('be020000-0000-4000-8000-000000000003', 'be020000-0000-4000-8000-000000000001', 'Teste A', 42.50, '2026-10-01', '2026-10-20'),
  ('be020000-0000-4000-8000-000000000004', 'be020000-0000-4000-8000-000000000002', 'Teste B', 75, '2026-10-01', '2026-10-21');

INSERT INTO public.assinaturas (id, user_id, nome, valor, dia_vencimento) VALUES
  ('be020000-0000-4000-8000-000000000005', 'be020000-0000-4000-8000-000000000002', 'Assinatura B', 10, 20),
  ('be020000-0000-4000-8000-000000000007', 'be020000-0000-4000-8000-000000000001', 'Assinatura A', 10, 20);
INSERT INTO public.transacoes (id, user_id, tipo, categoria, descricao, valor) VALUES
  ('be020000-0000-4000-8000-000000000006', 'be020000-0000-4000-8000-000000000002', 'despesa', 'Teste', 'Transação B', 10);

-- PUBLIC/anon sem EXECUTE; authenticated com EXECUTE; search_path vazio.
DO $$
DECLARE f pg_catalog.regprocedure;
BEGIN
  FOREACH f IN ARRAY ARRAY['public.pagar_conta(uuid,date,text)'::pg_catalog.regprocedure,
                          'public.desfazer_pagamento(uuid)'::pg_catalog.regprocedure] LOOP
    IF pg_catalog.has_function_privilege('anon', f, 'EXECUTE')
      OR NOT pg_catalog.has_function_privilege('authenticated', f, 'EXECUTE')
      OR EXISTS (SELECT 1 FROM pg_catalog.pg_proc p,
        LATERAL pg_catalog.aclexplode(p.proacl) a WHERE p.oid = f AND a.grantee = 0 AND a.privilege_type = 'EXECUTE')
      OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_proc WHERE oid = f AND proconfig @> ARRAY['search_path=""']) THEN
      RAISE EXCEPTION 'Permissões/search_path incorretos: %', f;
    END IF;
  END LOOP;
END $$;

-- Permissões só para isolar o teste de RLS dos defaults do projeto local.
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contas_pagar, public.transacoes TO authenticated;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'be020000-0000-4000-8000-000000000001', true);

DO $$
DECLARE
  c public.contas_pagar;
  t public.transacoes;
  transacao UUID;
BEGIN
  IF EXISTS (SELECT 1 FROM public.contas_pagar WHERE id = 'be020000-0000-4000-8000-000000000004') THEN
    RAISE EXCEPTION 'RLS expôs conta de B';
  END IF;
  BEGIN
    PERFORM public.pagar_conta('be020000-0000-4000-8000-000000000004');
    RAISE EXCEPTION 'Pagamento de B permitido';
  EXCEPTION WHEN no_data_found THEN NULL;
  END;
  BEGIN
    PERFORM public.desfazer_pagamento('be020000-0000-4000-8000-000000000004');
    RAISE EXCEPTION 'Desfazer conta de B permitido';
  EXCEPTION WHEN no_data_found THEN NULL;
  END;
  BEGIN
    UPDATE public.contas_pagar SET user_id = 'be020000-0000-4000-8000-000000000002'
      WHERE id = 'be020000-0000-4000-8000-000000000003';
    RAISE EXCEPTION 'WITH CHECK permitiu trocar proprietário';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    UPDATE public.contas_pagar SET status = 'paga'
      WHERE id = 'be020000-0000-4000-8000-000000000003';
    RAISE EXCEPTION 'CHECK permitiu paga sem pago_em';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  -- RLS aceita o dono A; as FKs devem recusar cada referência a B.
  BEGIN
    INSERT INTO public.contas_pagar (user_id, descricao, valor, competencia, vencimento, assinatura_id)
      VALUES (auth.uid(), 'FK assinatura B', 10, '2026-10-01', '2026-10-20', 'be020000-0000-4000-8000-000000000005');
    RAISE EXCEPTION 'FK permitiu assinatura de B';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO public.contas_pagar (user_id, descricao, valor, competencia, vencimento, transacao_id)
      VALUES (auth.uid(), 'FK transação B', 10, '2026-10-01', '2026-10-20', 'be020000-0000-4000-8000-000000000006');
    RAISE EXCEPTION 'FK permitiu transação de B';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;
  BEGIN
    PERFORM public.desfazer_pagamento('be020000-0000-4000-8000-000000000003');
    RAISE EXCEPTION 'Desfazer pendente permitido';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  BEGIN
    UPDATE public.contas_pagar SET competencia = '2026-10-02'
      WHERE id = 'be020000-0000-4000-8000-000000000003';
    RAISE EXCEPTION 'Competência inválida permitida';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  -- O trigger deve substituir uma data antiga mesmo em UPDATE direto.
  UPDATE public.contas_pagar SET updated_at = '2000-01-01'
    WHERE id = 'be020000-0000-4000-8000-000000000003' RETURNING * INTO c;
  IF c.updated_at IS DISTINCT FROM NOW() THEN
    RAISE EXCEPTION 'Trigger updated_at falhou';
  END IF;

  SELECT * INTO c FROM public.pagar_conta('be020000-0000-4000-8000-000000000003', '2026-10-15', 'Banco teste');
  transacao := c.transacao_id;
  SELECT * INTO STRICT t FROM public.transacoes WHERE id = transacao;
  IF c.status <> 'paga' OR c.pago_em IS DISTINCT FROM DATE '2026-10-15'
    OR t.tipo <> 'despesa' OR t.automatico IS DISTINCT FROM TRUE
    OR t.user_id <> c.user_id OR t.categoria <> c.categoria
    OR t.descricao <> c.descricao OR t.valor <> c.valor
    OR t.data IS DISTINCT FROM c.pago_em OR t.banco IS DISTINCT FROM 'Banco teste' THEN
    RAISE EXCEPTION 'Pagamento/transação divergente';
  END IF;
  BEGIN
    PERFORM public.pagar_conta(c.id);
    RAISE EXCEPTION 'Pagamento duplicado permitido' USING ERRCODE = '23514';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  IF (SELECT count(*) FROM public.transacoes WHERE user_id = c.user_id) <> 1 THEN
    RAISE EXCEPTION 'Pagamento duplicado deixou transação órfã';
  END IF;

  SELECT * INTO c FROM public.desfazer_pagamento(c.id);
  IF c.status <> 'pendente' OR c.pago_em IS NOT NULL OR c.transacao_id IS NOT NULL
    OR EXISTS (SELECT 1 FROM public.transacoes WHERE id = transacao) THEN
    RAISE EXCEPTION 'Desfazer não restaurou o estado inicial';
  END IF;

  -- Também funciona quando a transação já foi removida (FK SET NULL).
  SELECT * INTO c FROM public.pagar_conta(c.id, NULL);
  IF c.pago_em IS DISTINCT FROM (pg_catalog.now() AT TIME ZONE 'America/Sao_Paulo')::date THEN
    RAISE EXCEPTION 'NULL não usou a data em SP';
  END IF;
  DELETE FROM public.transacoes WHERE id = c.transacao_id;
  SELECT * INTO c FROM public.desfazer_pagamento(c.id);
  IF c.status <> 'pendente' OR c.transacao_id IS NOT NULL OR c.pago_em IS NOT NULL THEN
    RAISE EXCEPTION 'Desfazer sem transação falhou';
  END IF;
  UPDATE public.contas_pagar SET status = 'cancelada' WHERE id = c.id;
  BEGIN
    PERFORM public.pagar_conta(c.id);
    RAISE EXCEPTION 'Pagamento de cancelada permitido' USING ERRCODE = '23514';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
END $$;

-- B vê apenas sua conta, ainda pendente; nada de A ficou órfão.
SELECT set_config('request.jwt.claim.sub', 'be020000-0000-4000-8000-000000000002', true);
DO $$
BEGIN
  IF (SELECT count(*) FROM public.contas_pagar) <> 1
    OR NOT EXISTS (SELECT 1 FROM public.contas_pagar
      WHERE id = 'be020000-0000-4000-8000-000000000004' AND status = 'pendente')
    OR (SELECT count(*) FROM public.transacoes) <> 1 THEN
    RAISE EXCEPTION 'Isolamento de B falhou';
  END IF;
END $$;
RESET ROLE;

-- Exclusão da assinatura preserva proprietário e ocorrência.
UPDATE public.contas_pagar SET assinatura_id = 'be020000-0000-4000-8000-000000000007'
  WHERE id = 'be020000-0000-4000-8000-000000000003';
DELETE FROM public.assinaturas WHERE id = 'be020000-0000-4000-8000-000000000007';
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.contas_pagar
    WHERE id = 'be020000-0000-4000-8000-000000000003'
      AND assinatura_id IS NULL AND user_id = 'be020000-0000-4000-8000-000000000001') THEN
    RAISE EXCEPTION 'SET NULL da assinatura alterou proprietário';
  END IF;
END $$;
INSERT INTO public.lembretes_enviados (user_id, conta_id, competencia, etapa)
  VALUES ('be020000-0000-4000-8000-000000000001', 'be020000-0000-4000-8000-000000000003', '2026-10-01', 'D-2');
DO $$
BEGIN
  BEGIN
    INSERT INTO public.lembretes_enviados (user_id, conta_id, competencia, etapa)
      VALUES ('be020000-0000-4000-8000-000000000001', 'be020000-0000-4000-8000-000000000003', '2026-10-01', 'D-2');
    RAISE EXCEPTION 'Lembrete duplicado permitido';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO public.assinaturas (user_id, nome, valor, dia_vencimento, recorrencia)
      VALUES ('be020000-0000-4000-8000-000000000001', 'Anual inválida', 10, 20, 'anual');
    RAISE EXCEPTION 'Assinatura anual sem mês permitida';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
END $$;

-- Down pode ser repetido; up funciona novamente depois dele.
\ir ../migrations/005_contas_pagar_down.sql
\ir ../migrations/005_contas_pagar_down.sql
\ir ../migrations/005_contas_pagar.sql
ROLLBACK;

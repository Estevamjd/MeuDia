-- Somente PostgreSQL local descartável. Fixtures fictícias, ROLLBACK ao final.
\set ON_ERROR_STOP on
BEGIN;
\ir ../migrations/000_baseline.sql
\ir ../migrations/005_financas.sql
\ir ../migrations/006_carteiras.sql
\ir ../migrations/007_excluir_metas.sql
\ir ../migrations/008_saude_treino.sql
\ir ../migrations/009_origem_lancamento.sql
\ir ../migrations/010_treino_dieta_whatsapp.sql
\ir ../migrations/011_whatsapp_onboarding.sql
\ir ../migrations/012_whatsapp_amigo.sql
\ir ../migrations/013_whatsapp_lembretes.sql
\ir ../migrations/014_cofrinho.sql
\ir ../migrations/015_rpc_saldo_painel.sql
\ir ../migrations/016_whatsapp_v2_saude.sql
\ir ../migrations/017_parcelamento.sql

CREATE TEMP TABLE anterior AS SELECT pg_get_functiondef('public.whatsapp_registrar(text,text,text,text,jsonb)'::regprocedure) AS def, (SELECT proowner FROM pg_proc WHERE oid='public.whatsapp_registrar(text,text,text,text,jsonb)'::regprocedure) AS owner;
CREATE FUNCTION pg_temp.assert(ok BOOLEAN, nome TEXT) RETURNS void LANGUAGE plpgsql AS $$ BEGIN
 IF ok IS DISTINCT FROM TRUE THEN RAISE EXCEPTION '018: %',nome; END IF;
END $$;
INSERT INTO auth.users(id) VALUES ('00000000-0000-4000-8000-000000018a01');
UPDATE public.profiles SET whatsapp='5511955554444' WHERE id='00000000-0000-4000-8000-000000018a01';
INSERT INTO private.integracoes(nome,segredo_sha256) VALUES('whatsapp',encode(sha256(convert_to('teste-018','UTF8')),'hex'));
INSERT INTO public.contas_pagar(user_id,descricao,categoria,valor,recorrencia,dia_vencimento)
 VALUES('00000000-0000-4000-8000-000000018a01','Luz','Moradia',120,'mensal',8);
CREATE FUNCTION pg_temp.cenarios() RETURNS void LANGUAGE plpgsql AS $$ DECLARE
 r JSONB; v NUMERIC; u UUID := '00000000-0000-4000-8000-000000018a01';
BEGIN
 FOREACH v IN ARRAY ARRAY[5,118,120,119.50,NULL]::numeric[] LOOP
   r:=public.whatsapp_registrar('teste-018','5511955554444',NULL,'gasto',jsonb_build_object('descricao','luz','categoria','Outros','valor',v,'pagar',true));
   PERFORM pg_temp.assert(r->>'ok'='true','registro');
   IF v IN (5,118) THEN
     PERFORM pg_temp.assert(r->'extras'->'conta_divergente'=jsonb_build_object('descricao','Luz','valor',120),'divergente');
     PERFORM pg_temp.assert(NOT EXISTS(SELECT 1 FROM public.pagamentos_conta WHERE user_id=u),'conta pendente');
     PERFORM pg_temp.assert(EXISTS(SELECT 1 FROM public.transacoes WHERE user_id=u AND valor=v AND descricao='luz' AND categoria='Outros' AND NOT automatico),'gasto simples');
     PERFORM pg_temp.assert(EXISTS(SELECT 1 FROM private.whatsapp_acoes WHERE user_id=u AND tipo='transacao' AND valor=v AND desfeito_em IS NULL),'acao transacao');
   ELSE
     PERFORM pg_temp.assert(r->'extras'->>'conta_paga'='Luz' AND (r->'extras'->>'valor_registrado')::numeric=coalesce(v,120),'pagamento');
     PERFORM pg_temp.assert((SELECT count(*) FROM public.pagamentos_conta WHERE user_id=u)=1,'uma marca paga');
   END IF;
   -- now() é constante na transação; evita empates de UUID no teste de último registro.
   UPDATE private.whatsapp_acoes SET created_at=now()-interval '1 minute' WHERE desfeito_em IS NOT NULL;
   r:=public.whatsapp_desfazer('teste-018','5511955554444',NULL);
   PERFORM pg_temp.assert(r->>'desfeito'='true','desfazer');
   PERFORM pg_temp.assert(NOT EXISTS(SELECT 1 FROM public.transacoes WHERE user_id=u) AND NOT EXISTS(SELECT 1 FROM public.pagamentos_conta WHERE user_id=u),'desfez somente registro e eventual vinculo');
 END LOOP;
 r:=public.whatsapp_registrar('teste-018','5511955554444',NULL,'gasto','{"descricao":"luz","valor":120,"pagar":false}');
 PERFORM pg_temp.assert(r->>'ok'='true' AND r->'extras'->>'conta_paga'='Luz','sem pagar concilia');
 r:=public.whatsapp_registrar('teste-018','5511955554444',NULL,'gasto','{"descricao":"luz","valor":5,"pagar":true}');
 PERFORM pg_temp.assert(r->>'ok'='true' AND NOT(r->'extras' ? 'conta_paga') AND NOT(r->'extras' ? 'conta_divergente'),'ja paga simples');
 PERFORM set_config('request.jwt.claim.sub',u::text,true);
 PERFORM public.desfazer_pagamento(conta_id,competencia) FROM public.pagamentos_conta WHERE user_id=u;
 r:=public.whatsapp_registrar('teste-018','5511955554444',NULL,'gasto','{"descricao":"luz","valor":5,"pagar":false}');
 PERFORM pg_temp.assert(r->>'ok'='true' AND NOT(r->'extras' ? 'conta_paga') AND NOT(r->'extras' ? 'conta_divergente'),'sem pagar pequeno');
 r:=public.whatsapp_registrar('teste-018','5511955554444',NULL,'entrada','{"descricao":"luz","valor":120,"pagar":false}');
 PERFORM pg_temp.assert(r->>'ok'='true' AND NOT(r->'extras' ? 'conta_paga') AND NOT(r->'extras' ? 'conta_divergente'),'entrada');
 PERFORM set_config('request.jwt.claim.sub',u::text,true);
 PERFORM public.desfazer_pagamento(conta_id,competencia) FROM public.pagamentos_conta WHERE user_id=u;
 UPDATE public.contas_pagar SET valor=1000 WHERE user_id=u;
 r:=public.whatsapp_registrar('teste-018','5511955554444',NULL,'gasto','{"descricao":"luz","valor":990,"pagar":true}');
 PERFORM pg_temp.assert(r->'extras' ? 'conta_paga','limite 990');
 PERFORM set_config('request.jwt.claim.sub',u::text,true);
 PERFORM public.desfazer_pagamento(conta_id,competencia) FROM public.pagamentos_conta WHERE user_id=u;
 r:=public.whatsapp_registrar('teste-018','5511955554444',NULL,'gasto','{"descricao":"luz","valor":989.99,"pagar":true}');
 PERFORM pg_temp.assert(r->'extras' ? 'conta_divergente','limite 989.99');
 PERFORM set_config('request.jwt.claim.sub',u::text,true);
 PERFORM public.desfazer_pagamento(conta_id,competencia) FROM public.pagamentos_conta WHERE user_id=u;
 UPDATE public.contas_pagar SET recorrencia='anual',valor=120,mes_vencimento=extract(month from now() AT TIME ZONE 'America/Sao_Paulo') WHERE user_id=u;
 r:=public.whatsapp_registrar('teste-018','5511955554444',NULL,'gasto','{"descricao":"luz","valor":120,"pagar":true}');
 PERFORM pg_temp.assert(r->'extras'->>'conta_paga'='Luz','anual');
 PERFORM public.desfazer_pagamento(conta_id,competencia) FROM public.pagamentos_conta WHERE user_id=u;
 UPDATE public.contas_pagar SET recorrencia='unica',valor=120,dia_vencimento=NULL,mes_vencimento=NULL,data_vencimento=(now() AT TIME ZONE 'America/Sao_Paulo')::date WHERE user_id=u;
 r:=public.whatsapp_registrar('teste-018','5511955554444',NULL,'gasto','{"descricao":"luz","valor":120,"pagar":true}');
 PERFORM pg_temp.assert(r->'extras'->>'conta_paga'='Luz','unica');
 PERFORM public.desfazer_pagamento(conta_id,competencia) FROM public.pagamentos_conta WHERE user_id=u;
 UPDATE public.contas_pagar SET recorrencia='mensal',dia_vencimento=8,mes_vencimento=NULL,data_vencimento=NULL WHERE user_id=u;
 DELETE FROM public.transacoes WHERE user_id=u AND NOT automatico;
 INSERT INTO public.contas_pagar(user_id,descricao,valor,recorrencia,dia_vencimento) VALUES(u,'Luz',120,'mensal',9);
 r:=public.whatsapp_registrar('teste-018','5511955554444','ambiguo','gasto','{"descricao":"Luz","valor":5,"pagar":true}');
 PERFORM pg_temp.assert(NOT(r->'extras' ? 'conta_divergente') AND NOT(r->'extras' ? 'conta_paga'),'ambiguo gasto simples');
 r:=public.whatsapp_registrar('teste-018','5511955554444','ambiguo','gasto','{"descricao":"Luz","valor":5,"pagar":true}');
 PERFORM pg_temp.assert(r->>'duplicada'='true' AND (SELECT count(*) FROM public.transacoes WHERE user_id=u)=1,'retry idempotente');
END $$;

-- Prova negativa com subtransação: os efeitos são revertidos pela exceção.
DO $$ BEGIN
 BEGIN
  PERFORM pg_temp.cenarios();
  RAISE EXCEPTION '018: controle negativo nao falhou';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM <> '018: divergente' THEN RAISE; END IF;
  RAISE NOTICE '018: sem 018 falha em divergente como esperado';
 END;
END $$;
CREATE FUNCTION pg_temp.seguranca() RETURNS void LANGUAGE plpgsql AS $$ BEGIN
 PERFORM pg_temp.assert((SELECT prosecdef AND proconfig=ARRAY['search_path=""'] AND proowner=(SELECT owner FROM anterior) FROM pg_proc WHERE oid='public.whatsapp_registrar(text,text,text,text,jsonb)'::regprocedure),'seguranca owner');
 PERFORM pg_temp.assert(has_function_privilege('anon','public.whatsapp_registrar(text,text,text,text,jsonb)','EXECUTE'),'anon execute');
 PERFORM pg_temp.assert(NOT has_function_privilege('authenticated','public.whatsapp_registrar(text,text,text,text,jsonb)','EXECUTE'),'authenticated sem execute');
END $$;
\ir ../migrations/018_whatsapp_paguei_tolerancia.sql
SELECT pg_temp.seguranca();
\ir ../migrations/018_whatsapp_paguei_tolerancia.sql
SELECT pg_temp.seguranca();
SAVEPOINT cenarios;
SELECT pg_temp.cenarios();
ROLLBACK TO cenarios;
\ir ../migrations/018_whatsapp_paguei_tolerancia_down.sql
SELECT pg_temp.assert((SELECT def FROM anterior)=pg_get_functiondef('public.whatsapp_registrar(text,text,text,text,jsonb)'::regprocedure),'down exato 016');
\ir ../migrations/018_whatsapp_paguei_tolerancia.sql
SELECT pg_temp.seguranca();
SELECT pg_temp.cenarios();
ROLLBACK;

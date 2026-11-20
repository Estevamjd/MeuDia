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
CREATE TEMP TABLE anterior AS SELECT pg_get_functiondef('public.whatsapp_registrar(text,text,text,text,jsonb)'::regprocedure) AS def;
INSERT INTO auth.users(id) VALUES ('00000000-0000-4000-8000-000000016a01'),('00000000-0000-4000-8000-000000016b01');
UPDATE public.profiles SET whatsapp='5511955554444' WHERE id='00000000-0000-4000-8000-000000016a01';
INSERT INTO public.transacoes(user_id,tipo,categoria,descricao,valor,data) VALUES
('00000000-0000-4000-8000-000000016a01','despesa','Outros','app antes',7,CURRENT_DATE);
CREATE TEMP TABLE dados_antes AS SELECT * FROM public.transacoes;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated;
\ir ../migrations/016_whatsapp_v2_saude.sql
\ir ../migrations/016_whatsapp_v2_saude.sql
CREATE FUNCTION pg_temp.assert(ok BOOLEAN, nome TEXT) RETURNS void LANGUAGE plpgsql AS $$ BEGIN
 IF ok IS DISTINCT FROM TRUE THEN RAISE EXCEPTION '016: %',nome; END IF;
END $$;
CREATE FUNCTION pg_temp.negado(stmt TEXT) RETURNS void LANGUAGE plpgsql AS $$ BEGIN
 BEGIN EXECUTE stmt; EXCEPTION WHEN insufficient_privilege THEN RETURN; END;
 RAISE EXCEPTION '016: esperava 42501: %',stmt;
END $$;
SELECT pg_temp.assert(NOT EXISTS((SELECT * FROM dados_antes) EXCEPT (SELECT * FROM public.transacoes)),'up preservou dados');
INSERT INTO private.integracoes(nome,segredo_sha256) VALUES('whatsapp',encode(sha256(convert_to('teste-016','UTF8')),'hex'));
INSERT INTO public.perfil_saude(user_id,estado,respostas,metas,ritmo_pct,formula_versao) VALUES
('00000000-0000-4000-8000-000000016a01','respondido','{"idade":28}','{"kcal":2000}',0.375,'v1'),
('00000000-0000-4000-8000-000000016b01','adiado',NULL,NULL,0.375,'v1');
INSERT INTO public.ia_uso_diario VALUES('00000000-0000-4000-8000-000000016b01',CURRENT_DATE,1,now());
DO $$ DECLARE coluna TEXT; grande JSONB; BEGIN
 SELECT jsonb_object_agg(i::text, md5(i::text)) INTO grande FROM generate_series(1,1000) i;
 FOREACH coluna IN ARRAY ARRAY['respostas','metas'] LOOP
   BEGIN
     EXECUTE format('UPDATE public.perfil_saude SET %I=$1 WHERE user_id=$2',coluna)
       USING grande,'00000000-0000-4000-8000-000000016a01'::uuid;
     RAISE EXCEPTION '016: JSON acima de 16 KiB aceito em %',coluna;
   EXCEPTION WHEN check_violation THEN NULL;
   END;
 END LOOP;
END $$;
GRANT USAGE ON SCHEMA public TO authenticated,anon;
GRANT SELECT,INSERT,DELETE ON public.chat_agente TO authenticated;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000016a01',true);
SELECT pg_temp.assert((SELECT count(*) FROM public.perfil_saude)=1,'perfil RLS');
SELECT pg_temp.assert((SELECT count(*) FROM public.ia_uso_diario)=0,'cota RLS');
SELECT pg_temp.negado($q$INSERT INTO public.ia_uso_diario(user_id,dia) VALUES(auth.uid(),CURRENT_DATE)$q$);
SELECT pg_temp.negado($q$UPDATE public.ia_uso_diario SET quantidade=0$q$);
SELECT pg_temp.negado($q$DELETE FROM public.ia_uso_diario$q$);
SELECT pg_temp.assert(public.ia_consumir_cota(2)->>'usado'='1','primeiro consumo');
INSERT INTO public.chat_agente(user_id,role,conteudo) VALUES(auth.uid(),'user','teste');
DELETE FROM public.chat_agente WHERE user_id=auth.uid();
SELECT pg_temp.assert(public.ia_consumir_cota(2)->>'usado'='2','limparChat nao zera');
SELECT pg_temp.assert(public.ia_consumir_cota(2)->>'permitido'='false','limite');
SELECT set_config('request.jwt.claim.sub','',true);
SELECT pg_temp.negado($q$SELECT public.ia_consumir_cota(2)$q$);
RESET ROLE;
SET LOCAL ROLE anon;
SELECT pg_temp.negado($q$SELECT public.ia_consumir_cota(2)$q$);
SELECT pg_temp.negado($q$SELECT * FROM public.perfil_saude$q$);
RESET ROLE;
-- Falha na limpeza reverte também o marcador, permitindo retry no mesmo dia.
CREATE FUNCTION pg_temp.falhar_limpeza() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 RAISE EXCEPTION 'falha simulada' USING ERRCODE='P0001';
END $$;
INSERT INTO private.whatsapp_mensagens(id,created_at) VALUES('falha-limpeza',now()-interval '8 days');
CREATE TRIGGER falha_limpeza BEFORE DELETE ON private.whatsapp_mensagens
 FOR EACH ROW EXECUTE FUNCTION pg_temp.falhar_limpeza();
DO $$ BEGIN
 BEGIN
  PERFORM public.whatsapp_manutencao_diaria('teste-016');
  RAISE EXCEPTION 'limpeza deveria falhar' USING ERRCODE='P0002';
 EXCEPTION WHEN SQLSTATE 'P0001' THEN NULL;
 END;
 PERFORM pg_temp.assert(NOT EXISTS(SELECT 1 FROM private.whatsapp_manutencoes),'falha reverte marcador');
END $$;
DROP TRIGGER falha_limpeza ON private.whatsapp_mensagens;
DO $$ DECLARE
 u UUID := '00000000-0000-4000-8000-000000016a01';
 b UUID := '00000000-0000-4000-8000-000000016b01';
 tel TEXT := '5511955554444'; r JSONB; n INT; alvo UUID; despesa UUID; total NUMERIC;
BEGIN
 r:=public.whatsapp_desfazer('ruim',tel,'nao');
 PERFORM pg_temp.assert(r->>'erro'='nao_autorizado','segredo');
 r:=public.whatsapp_registrar('teste-016',tel,'g1','gasto','{"descricao":"Mercado","valor":45.90}');
 r:=public.whatsapp_registrar('teste-016',tel,'g2','gasto','{"descricao":"Padaria","valor":10}');
 INSERT INTO public.transacoes(user_id,tipo,categoria,descricao,valor,data,origem) VALUES(u,'despesa','Outros','app depois',9,CURRENT_DATE,'app');
 r:=public.whatsapp_registrar('teste-016',tel,'g2','gasto','{"descricao":"Padaria","valor":10}');
 PERFORM pg_temp.assert(r->>'duplicada'='true' AND (SELECT count(*) FROM public.transacoes WHERE descricao='Padaria')=1,'retry registrar');
 r:=public.whatsapp_desfazer('teste-016',tel,'undo1');
 PERFORM pg_temp.assert(r->>'descricao'='Padaria' AND r->>'desfeito'='true','ultimo WA');
 r:=public.whatsapp_desfazer('teste-016',tel,'undo1');
 PERFORM pg_temp.assert(r->>'duplicada'='true','retry undo');
 PERFORM pg_temp.assert(EXISTS(SELECT 1 FROM public.transacoes WHERE descricao='Mercado'),'retry preservou anterior');
 PERFORM pg_temp.assert((SELECT count(*) FROM public.transacoes WHERE descricao LIKE 'app %')=2,'app intocado');
 r:=public.whatsapp_desfazer('teste-016',tel,'undo-distinto');
 PERFORM pg_temp.assert(r->>'ok'='true' AND r->>'desfeito'='false' AND r->>'ja_desfeito'='true'
   AND EXISTS(SELECT 1 FROM public.transacoes WHERE descricao='Mercado'),'segundo undo nao encadeia');
 UPDATE private.whatsapp_acoes SET created_at=now()-interval '31 minutes' WHERE user_id=u;
 r:=public.whatsapp_desfazer('teste-016',tel,'undo2');
 PERFORM pg_temp.assert(r->>'desfeito'='false','janela 30min');
 -- Log de outro dono, mesmo telefone, nunca e escolhido.
 INSERT INTO private.whatsapp_acoes(telefone,user_id,tipo,registro_id,descricao) VALUES(tel,b,'transacao',gen_random_uuid(),'outro dono');
 r:=public.whatsapp_desfazer('teste-016',tel,'undo3');
 PERFORM pg_temp.assert(r->>'desfeito'='false','dono do log');
 INSERT INTO public.contas_pagar(user_id,descricao,categoria,valor,recorrencia,dia_vencimento) VALUES(u,'Água','Moradia',80,'mensal',5) RETURNING id INTO alvo;
 SELECT coalesce(sum(valor),0) INTO total FROM public.transacoes WHERE user_id=u AND tipo='despesa';
 r:=public.whatsapp_registrar('teste-016',tel,'agua','gasto','{"descricao":"agua","valor":80}');
 PERFORM pg_temp.assert(r->'extras'->>'conta_paga'='Água','match sem acento');
 PERFORM pg_temp.assert((SELECT sum(valor) FROM public.transacoes WHERE user_id=u AND tipo='despesa')=total+80,'uma unica despesa');
 PERFORM pg_temp.assert((SELECT count(*) FROM public.pagamentos_conta WHERE conta_id=alvo)=1,'marcou paga');
 SELECT transacao_id INTO despesa FROM public.pagamentos_conta WHERE conta_id=alvo;
 PERFORM pg_temp.assert((SELECT categoria='Moradia' AND descricao='Água' AND automatico FROM public.transacoes WHERE id=despesa),'conciliacao igual pagar_conta');
 r:=public.whatsapp_desfazer('teste-016',tel,'undoagua');
 PERFORM pg_temp.assert(r->>'desfeito'='true','undo pagamento');
 PERFORM pg_temp.assert(NOT EXISTS(SELECT 1 FROM public.transacoes WHERE id=despesa) AND NOT EXISTS(SELECT 1 FROM public.pagamentos_conta WHERE conta_id=alvo),'undo despesa e marca');
 INSERT INTO public.contas_pagar(user_id,descricao,valor,recorrencia,dia_vencimento) VALUES(u,'Agua',80,'mensal',6);
 r:=public.whatsapp_registrar('teste-016',tel,'ambigua','gasto','{"descricao":"água","valor":80}');
 PERFORM pg_temp.assert(NOT(r->'extras' ? 'conta_paga') AND NOT EXISTS(SELECT 1 FROM public.pagamentos_conta WHERE user_id=u),'ambiguo nao concilia');
 INSERT INTO public.contas_pagar(user_id,descricao,valor,recorrencia,dia_vencimento) VALUES(u,'Internet',100,'mensal',7);
 r:=public.whatsapp_registrar('teste-016',tel,'tolerancia','gasto','{"descricao":"Internet","valor":200}');
 PERFORM pg_temp.assert(NOT(r->'extras' ? 'conta_paga'),'valor fora tolerancia');
 r:=public.whatsapp_registrar('teste-016',tel,'explicito','gasto','{"descricao":"Internet","valor":200,"pagar":true}');
 PERFORM pg_temp.assert(r->'extras'->>'conta_paga'='Internet','paguei explicito');
 INSERT INTO public.contas_pagar(user_id,descricao,valor,recorrencia,dia_vencimento) VALUES(u,'Luz',120,'mensal',8);
 r:=public.whatsapp_registrar('teste-016',tel,'semvalor','gasto','{"descricao":"luz","valor":null,"pagar":true}');
 PERFORM pg_temp.assert(r->'extras'->>'conta_paga'='Luz' AND (r->'extras'->>'valor_registrado')::numeric=120,'paguei luz sem valor');
 r:=public.whatsapp_desfazer('teste-016',tel,'undosemvalor');
 -- Um novo pagamento feito no app nunca e apagado por um log WA antigo da mesma conta.
 r:=public.whatsapp_registrar('teste-016',tel,'luzantiga','gasto','{"descricao":"luz","valor":120}');
 PERFORM set_config('request.jwt.claim.sub',u::TEXT,true);
 PERFORM public.desfazer_pagamento((SELECT id FROM public.contas_pagar WHERE user_id=u AND descricao='Luz'),to_char(now() AT TIME ZONE 'America/Sao_Paulo','YYYY-MM'));
 INSERT INTO public.transacoes(user_id,tipo,categoria,descricao,valor,data,origem)
   VALUES(u,'despesa','Contas','Luz app',120,CURRENT_DATE,'app') RETURNING id INTO despesa;
 INSERT INTO public.pagamentos_conta(conta_id,user_id,competencia,pago_em,transacao_id)
   SELECT id,u,to_char(now() AT TIME ZONE 'America/Sao_Paulo','YYYY-MM'),CURRENT_DATE,despesa FROM public.contas_pagar WHERE user_id=u AND descricao='Luz';
 r:=public.whatsapp_desfazer('teste-016',tel,'undoluzantiga');
 PERFORM pg_temp.assert(r->>'desfeito'='false' AND r->>'ja_apagado'='true' AND EXISTS(SELECT 1 FROM public.transacoes WHERE id=despesa)
   AND EXISTS(SELECT 1 FROM public.pagamentos_conta WHERE transacao_id=despesa),'undo nunca toca pagamento substituto app');
 SELECT count(*) INTO n FROM public.transacoes WHERE user_id=u;
 r:=public.whatsapp_registrar('teste-016',tel,'semvalorambiguo','gasto','{"descricao":"agua","valor":null,"pagar":true}');
 PERFORM pg_temp.assert(r->>'erro'='conta_nao_identificada' AND (SELECT count(*) FROM public.transacoes WHERE user_id=u)=n,'sem valor ambiguo nao cria nada');
 r:=public.whatsapp_registrar('teste-016',tel,'semvalornaoexiste','gasto','{"descricao":"nao existe","valor":null,"pagar":true}');
 PERFORM pg_temp.assert(r->>'erro'='conta_nao_identificada','sem valor sem conta');
 r:=public.whatsapp_registrar('teste-016',tel,'treino','treino','{"descricao":"Perna"}');
 r:=public.whatsapp_desfazer('teste-016',tel,'undotreino');
 PERFORM pg_temp.assert(r->>'descricao'='Perna' AND NOT EXISTS(SELECT 1 FROM public.registros_treino WHERE user_id=u),'undo treino');
 r:=public.whatsapp_registrar('teste-016',tel,'refeicao','refeicao','{"descricao":"Arroz","tipo":"almoco"}');
 r:=public.whatsapp_desfazer('teste-016',tel,'undorefeicao');
 PERFORM pg_temp.assert(r->>'descricao'='Arroz' AND NOT EXISTS(SELECT 1 FROM public.registros_refeicao WHERE user_id=u),'undo refeicao');
 INSERT INTO private.whatsapp_mensagens(id,created_at) VALUES('velha',now()-interval '8 days');
 INSERT INTO private.whatsapp_acoes(telefone,user_id,tipo,registro_id,descricao,created_at) VALUES(tel,u,'transacao',gen_random_uuid(),'velha',now()-interval '31 days');
 r:=public.whatsapp_registrar('teste-016',tel,'hotpath','gasto','{"descricao":"Teste","valor":1}');
 PERFORM pg_temp.assert(EXISTS(SELECT 1 FROM private.whatsapp_mensagens WHERE id='velha'),'sem limpeza hotpath');
 r:=public.whatsapp_manutencao_diaria('ruim');
 PERFORM pg_temp.assert(EXISTS(SELECT 1 FROM private.whatsapp_mensagens WHERE id='velha'),'limpeza autentica');
 r:=public.whatsapp_manutencao_diaria('teste-016');
 PERFORM pg_temp.assert(NOT EXISTS(SELECT 1 FROM private.whatsapp_mensagens WHERE id='velha') AND NOT EXISTS(SELECT 1 FROM private.whatsapp_acoes WHERE descricao='velha'),'limpeza');
 r:=public.whatsapp_manutencao_diaria('teste-016');
 PERFORM pg_temp.assert(r->>'repetida'='true','limpeza diaria idempotente');
END $$;
-- Down/up só remove objetos novos e restaura exatamente a função 012.
CREATE TEMP TABLE antes_down AS SELECT * FROM public.transacoes;
\ir ../migrations/016_whatsapp_v2_saude_down.sql
\ir ../migrations/016_whatsapp_v2_saude_down.sql
SELECT pg_temp.assert(to_regclass('public.perfil_saude') IS NULL AND to_regclass('public.ia_uso_diario') IS NULL AND to_regclass('private.whatsapp_acoes') IS NULL AND to_regclass('private.whatsapp_manutencoes') IS NULL,'down remove objetos novos');
SELECT pg_temp.assert((SELECT def FROM anterior)=pg_get_functiondef('public.whatsapp_registrar(text,text,text,text,jsonb)'::regprocedure),'restauracao exata 012');
SELECT pg_temp.assert(NOT EXISTS((SELECT * FROM antes_down) EXCEPT (SELECT * FROM public.transacoes)),'down preservou dados');
\ir ../migrations/016_whatsapp_v2_saude.sql
SELECT pg_temp.assert(NOT EXISTS((SELECT * FROM antes_down) EXCEPT (SELECT * FROM public.transacoes)),'round trip preservou dados');
DO $$ DECLARE u UUID := '00000000-0000-4000-8000-000000016b01'; BEGIN
 INSERT INTO public.perfil_saude(user_id,estado,ritmo_pct,formula_versao) VALUES(u,'adiado',0.375,'v1');
 INSERT INTO public.ia_uso_diario(user_id,dia) VALUES(u,CURRENT_DATE);
 INSERT INTO private.whatsapp_acoes(telefone,user_id,tipo,registro_id,descricao) VALUES('5511900000000',u,'transacao',gen_random_uuid(),'cascade');
 DELETE FROM auth.users WHERE id=u;
 PERFORM pg_temp.assert(NOT EXISTS(SELECT 1 FROM public.perfil_saude WHERE user_id=u)
   AND NOT EXISTS(SELECT 1 FROM public.ia_uso_diario WHERE user_id=u)
   AND NOT EXISTS(SELECT 1 FROM private.whatsapp_acoes WHERE user_id=u),'Auth hard delete cascatas');
END $$;
ROLLBACK;

-- SOMENTE PostgreSQL local descartável, fixtures fictícias, ROLLBACK ao final.
\set ON_ERROR_STOP on
BEGIN;
\ir ../migrations/000_baseline.sql
\ir ../migrations/005_financas.sql
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated;
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
INSERT INTO auth.users(id) VALUES
 ('00000000-0000-4000-8000-000000017a01'), ('00000000-0000-4000-8000-000000017b01');
INSERT INTO public.transacoes(user_id,tipo,categoria,descricao,valor,data) VALUES
 ('00000000-0000-4000-8000-000000017a01','despesa','Outros','Legado',7,'2026-10-01');
CREATE TEMP TABLE antes AS SELECT * FROM public.transacoes;
\ir ../migrations/017_parcelamento.sql
\ir ../migrations/017_parcelamento.sql
CREATE FUNCTION pg_temp.assert(ok BOOLEAN, nome TEXT) RETURNS void LANGUAGE plpgsql AS $$ BEGIN
 IF ok IS DISTINCT FROM TRUE THEN RAISE EXCEPTION '017: %',nome; END IF;
END $$;
CREATE FUNCTION pg_temp.erro(stmt TEXT, codigo TEXT) RETURNS void LANGUAGE plpgsql AS $$
DECLARE recebido TEXT;
BEGIN
 BEGIN EXECUTE stmt;
 EXCEPTION WHEN OTHERS THEN
   GET STACKED DIAGNOSTICS recebido = RETURNED_SQLSTATE;
   IF recebido = codigo THEN RETURN; END IF;
   RAISE EXCEPTION '017: esperava %, recebeu %',codigo,recebido;
 END;
 RAISE EXCEPTION '017: esperava erro %',codigo;
END $$;
SELECT pg_temp.assert(current_setting('lock_timeout')='5s','timeout limitado a 5s');
SELECT pg_temp.assert((SELECT convalidated FROM pg_catalog.pg_constraint WHERE conrelid='public.transacoes'::regclass AND conname='transacoes_parcela_check'),'CHECK validado');
SELECT pg_temp.assert((SELECT count(*) FROM pg_catalog.pg_constraint WHERE conrelid='public.transacoes'::regclass AND conname='transacoes_parcela_check')=1,'CHECK único após up 2x');
SELECT pg_temp.assert((SELECT count(*) FROM pg_catalog.pg_indexes WHERE schemaname='public' AND indexname='uq_transacoes_parcela')=1,'índice único após up 2x');
SELECT pg_temp.assert(NOT EXISTS(SELECT FROM public.transacoes WHERE parcela_grupo IS NOT NULL OR parcela_num IS NOT NULL OR parcela_total IS NOT NULL),'legado com NULLs');
-- Matriz cobre cada combinação parcialmente nula (exceto tudo NULL, válido) e limites.
DO $$
DECLARE g UUID; n SMALLINT; t SMALLINT; mask INT;
BEGIN
 FOR mask IN 1..6 LOOP
   g := CASE WHEN (mask & 1) <> 0 THEN '00000000-0000-4000-8000-000000017a03'::uuid END;
   n := CASE WHEN (mask & 2) <> 0 THEN 1 END;
   t := CASE WHEN (mask & 4) <> 0 THEN 3 END;
   PERFORM pg_temp.erro(pg_catalog.format(
    'INSERT INTO public.transacoes(user_id,tipo,categoria,descricao,valor,parcela_grupo,parcela_num,parcela_total) VALUES (%L,%L,%L,%L,10,%L,%L,%L)',
    '00000000-0000-4000-8000-000000017a01','despesa','Outros','parcial',g,n,t),'23514');
 END LOOP;
 FOR n,t IN SELECT * FROM (VALUES (4,3),(1,1),(1,25),(0,3),(-1,3)) limites LOOP
   PERFORM pg_temp.erro(pg_catalog.format(
    'INSERT INTO public.transacoes(user_id,tipo,categoria,descricao,valor,parcela_grupo,parcela_num,parcela_total) VALUES (%L,%L,%L,%L,10,%L,%s,%s)',
    '00000000-0000-4000-8000-000000017a01','despesa','Outros','limites','00000000-0000-4000-8000-000000017a03',n,t),'23514');
 END LOOP;
END $$;
SELECT pg_temp.erro($q$INSERT INTO public.transacoes(user_id,tipo,categoria,descricao,valor,parcela_grupo,parcela_num,parcela_total)
 VALUES ('00000000-0000-4000-8000-000000017a01','receita','Outros','receita',10,'00000000-0000-4000-8000-000000017a03',1,3)$q$,'23514');
INSERT INTO public.carteiras(id,user_id,nome,saldo_inicial,saldo_inicial_em) VALUES
 ('00000000-0000-4000-8000-000000017a02','00000000-0000-4000-8000-000000017a01','Banco A',1000,'2026-10-01T00:00:00Z');
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.transacoes TO authenticated;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000017a01',true);
-- Controle positivo: 3 parcelas com o mesmo grupo e statement único.
INSERT INTO public.transacoes(user_id,tipo,categoria,descricao,valor,data,carteira_id,parcela_grupo,parcela_num,parcela_total) VALUES
 ('00000000-0000-4000-8000-000000017a01','despesa','Compras','Tênis',33.34,'2026-11-20','00000000-0000-4000-8000-000000017a02','00000000-0000-4000-8000-000000017a03',1,3),
 ('00000000-0000-4000-8000-000000017a01','despesa','Compras','Tênis',33.33,'2026-12-20','00000000-0000-4000-8000-000000017a02','00000000-0000-4000-8000-000000017a03',2,3),
 ('00000000-0000-4000-8000-000000017a01','despesa','Compras','Tênis',33.33,'2027-01-20','00000000-0000-4000-8000-000000017a02','00000000-0000-4000-8000-000000017a03',3,3);
SELECT pg_temp.assert((SELECT count(*)=3 AND sum(valor)=100 FROM public.transacoes WHERE parcela_grupo IS NOT NULL),'lote válido completo');
SELECT pg_temp.erro($q$INSERT INTO public.transacoes(user_id,tipo,categoria,descricao,valor,parcela_grupo,parcela_num,parcela_total)
 VALUES ('00000000-0000-4000-8000-000000017a01','despesa','Outros','repetida',10,'00000000-0000-4000-8000-000000017a03',1,3)$q$,'23505');
-- Um item ruim no meio do lote não pode deixar nenhum item válido persistido.
SELECT pg_temp.erro($q$INSERT INTO public.transacoes(user_id,tipo,categoria,descricao,valor,parcela_grupo,parcela_num,parcela_total) VALUES
 ('00000000-0000-4000-8000-000000017a01','despesa','Outros','lote inválido',10,'00000000-0000-4000-8000-000000017a04',1,3),
 ('00000000-0000-4000-8000-000000017a01','despesa','Outros','lote inválido',10,'00000000-0000-4000-8000-000000017a04',4,3),
 ('00000000-0000-4000-8000-000000017a01','despesa','Outros','lote inválido',10,'00000000-0000-4000-8000-000000017a04',3,3)$q$,'23514');
SELECT pg_temp.assert(NOT EXISTS(SELECT FROM public.transacoes WHERE parcela_grupo='00000000-0000-4000-8000-000000017a04'),'lote inválido inteiro revertido');
-- RPCs 015 não contam parcelas futuras; no dia de cada parcela, passam a contar.
DO $$
DECLARE dia DATE; esperado NUMERIC; j JSONB;
BEGIN
 FOR dia,esperado IN SELECT * FROM (VALUES
   ('2026-11-19'::date,1000::numeric),('2026-11-20',966.66),('2026-12-19',966.66),
   ('2026-12-20',933.33),('2027-01-19',933.33),('2027-01-20',900)) pontos LOOP
   PERFORM pg_temp.assert((SELECT saldo FROM public.saldos_carteiras_em(dia))=esperado,'saldo por data');
   j := public.resumo_painel_saldo(dia);
   PERFORM pg_temp.assert((j->'carteiras'->0->>'saldo')::numeric=esperado,'resumo por data');
 END LOOP;
END $$;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000017b01',true);
SELECT pg_temp.assert(NOT EXISTS(SELECT FROM public.transacoes WHERE parcela_grupo IS NOT NULL),'B não vê A');
-- Mesmo grupo e número para outro dono é permitido (índice tem user_id).
INSERT INTO public.transacoes(user_id,tipo,categoria,descricao,valor,parcela_grupo,parcela_num,parcela_total) VALUES
 ('00000000-0000-4000-8000-000000017b01','despesa','Outros','B',10,'00000000-0000-4000-8000-000000017a03',1,3);
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000017a01',true);
SELECT pg_temp.assert(NOT EXISTS(SELECT FROM public.transacoes WHERE user_id='00000000-0000-4000-8000-000000017b01'),'A não vê B');
WITH apagadas AS (DELETE FROM public.transacoes WHERE user_id='00000000-0000-4000-8000-000000017b01' RETURNING *)
 SELECT pg_temp.assert((SELECT count(*) FROM apagadas)=0,'A não exclui B');
-- Filtro real de exclusão desde k mantém parcela anterior e a de B.
WITH apagadas AS (DELETE FROM public.transacoes WHERE user_id=auth.uid() AND parcela_grupo='00000000-0000-4000-8000-000000017a03' AND parcela_num>=2 RETURNING *)
 SELECT pg_temp.assert((SELECT count(*) FROM apagadas)=2,'apaga somente A desde 2');
RESET ROLE;
SELECT pg_temp.assert((SELECT count(*) FROM public.transacoes WHERE user_id='00000000-0000-4000-8000-000000017b01')=1,'B intacto');
-- Todas as colunas anteriores e todas as linhas são preservadas pelo down, inclusive as parcelas.
CREATE TEMP TABLE antes_down AS SELECT to_jsonb(t)-'parcela_grupo'-'parcela_num'-'parcela_total' AS linha FROM public.transacoes t;
\ir ../migrations/017_parcelamento_down.sql
\ir ../migrations/017_parcelamento_down.sql
SELECT pg_temp.assert(NOT EXISTS((SELECT * FROM antes) EXCEPT (SELECT * FROM public.transacoes)),'legado intacto após down');
SELECT pg_temp.assert(NOT EXISTS((SELECT linha FROM antes_down) EXCEPT (SELECT to_jsonb(t) FROM public.transacoes t))
 AND (SELECT count(*) FROM antes_down)=(SELECT count(*) FROM public.transacoes),'down preserva todas as linhas');
SELECT pg_temp.assert(pg_catalog.to_regclass('public.uq_transacoes_parcela') IS NULL,'down remove índice');
SELECT pg_temp.assert(NOT EXISTS(SELECT FROM pg_catalog.pg_constraint WHERE conrelid='public.transacoes'::regclass AND conname='transacoes_parcela_check'),'down remove CHECK');
SELECT pg_temp.assert(NOT EXISTS(SELECT FROM pg_catalog.pg_attribute WHERE attrelid='public.transacoes'::regclass AND attname IN ('parcela_grupo','parcela_num','parcela_total') AND NOT attisdropped),'down remove colunas');
\ir ../migrations/017_parcelamento.sql
SELECT pg_temp.assert(NOT EXISTS((SELECT to_jsonb(t) FROM antes t) EXCEPT (SELECT to_jsonb(t)-'parcela_grupo'-'parcela_num'-'parcela_total' FROM public.transacoes t)),'round trip preserva legado');
SELECT pg_temp.assert(NOT EXISTS((SELECT linha FROM antes_down) EXCEPT (SELECT to_jsonb(t)-'parcela_grupo'-'parcela_num'-'parcela_total' FROM public.transacoes t))
 AND (SELECT count(*) FROM antes_down)=(SELECT count(*) FROM public.transacoes),'round trip preserva todas as linhas e campos anteriores');
-- Colisão de nome: down nunca apaga índice de outra tabela.
\ir ../migrations/017_parcelamento_down.sql
CREATE TABLE public.wave3_indice_alheio(id INTEGER);
CREATE INDEX uq_transacoes_parcela ON public.wave3_indice_alheio(id);
\ir ../migrations/017_parcelamento_down.sql
SELECT pg_temp.assert((SELECT indrelid='public.wave3_indice_alheio'::regclass FROM pg_catalog.pg_index WHERE indexrelid='public.uq_transacoes_parcela'::regclass),'down preserva índice alheio');
-- Colisão antes do up deve abortar; SAVEPOINT mantém a fixture para conferir o erro.
SAVEPOINT colisao_up;
\set ON_ERROR_STOP off
\ir ../migrations/017_parcelamento.sql
\set erro_colisao :SQLSTATE
\set ON_ERROR_STOP on
ROLLBACK TO SAVEPOINT colisao_up;
SELECT pg_temp.assert(:'erro_colisao' = 'P0001','up rejeita índice alheio');
RELEASE SAVEPOINT colisao_up;
ROLLBACK;
SELECT 1 / (CASE WHEN current_setting('lock_timeout')='0' THEN 1 ELSE 0 END) AS timeout_sem_vazamento;


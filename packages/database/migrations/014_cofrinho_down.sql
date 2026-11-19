-- Desfaz a 014 (APAGA o histórico do Cofrinho: guardar/tirar/corrigir/sobras). Fazer backup antes.
DROP FUNCTION IF EXISTS public.cofrinho_fechar_mes(TEXT, BOOLEAN, NUMERIC);
DROP FUNCTION IF EXISTS public.cofrinho_corrigir(NUMERIC, UUID);
DROP FUNCTION IF EXISTS public.cofrinho_mover(TEXT, NUMERIC, UUID);
DROP FUNCTION IF EXISTS public.cofrinho_iniciar();
DROP FUNCTION IF EXISTS public.cofrinho_saldo_atual();
DROP FUNCTION IF EXISTS public.cofrinho_garantir_inicial();
DROP FUNCTION IF EXISTS public.cofrinho_total_bancos(UUID, DATE);
DROP TABLE IF EXISTS public.cofrinho_fechamentos;
DROP TABLE IF EXISTS public.cofrinho_movimentos;

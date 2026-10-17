-- Destrutivo: remove só o que a 006 criou (carteiras, transferências, recebimentos e as colunas novas).
-- Preserva 000/005: transacoes, rendas, pagar_conta e set_updated_at continuam.
-- Triggers, policies e índices das tabelas novas são removidos com as tabelas.
DROP FUNCTION IF EXISTS public.corrigir_saldo(UUID, NUMERIC, UUID);
DROP FUNCTION IF EXISTS public.pagar_conta_v2(UUID, TEXT, DATE, TEXT, UUID);
DROP FUNCTION IF EXISTS public.desfazer_recebimento(UUID, TEXT);
DROP FUNCTION IF EXISTS public.receber_renda(UUID, TEXT, DATE, UUID);
DROP TABLE IF EXISTS public.recebimentos_renda;
DROP TABLE IF EXISTS public.transferencias;
DROP INDEX IF EXISTS public.idx_transacoes_user_carteira;
ALTER TABLE IF EXISTS public.transacoes DROP CONSTRAINT IF EXISTS transacoes_carteira_fkey;
ALTER TABLE IF EXISTS public.transacoes DROP COLUMN IF EXISTS carteira_id;
ALTER TABLE IF EXISTS public.transacoes DROP COLUMN IF EXISTS ajuste;
DROP INDEX IF EXISTS public.uq_transacoes_user_chave_ajuste;
ALTER TABLE IF EXISTS public.transacoes DROP COLUMN IF EXISTS chave_ajuste;
ALTER TABLE IF EXISTS public.rendas DROP CONSTRAINT IF EXISTS rendas_carteira_fkey;
ALTER TABLE IF EXISTS public.rendas DROP COLUMN IF EXISTS carteira_id;
ALTER TABLE IF EXISTS public.rendas DROP CONSTRAINT IF EXISTS rendas_id_user_key;
DROP TABLE IF EXISTS public.carteiras;

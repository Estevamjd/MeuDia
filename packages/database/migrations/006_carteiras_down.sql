-- Destrutivo: remove só o que a 006 criou (carteiras, transferências, recebimentos e as colunas novas).
-- Preserva 000/005: transacoes, rendas, pagar_conta e set_updated_at continuam.
-- Triggers, policies e índices das tabelas novas são removidos com as tabelas.
-- ATENÇÃO: apaga dados. Faça backup (pg_dump de transacoes, carteiras, transferencias, recebimentos_renda) antes.
-- Os "Ajuste de saldo" (transacoes.ajuste) são removidos: sem a coluna ajuste eles virariam receitas/despesas
-- comuns e distorceriam o resumo mensal e o analisador do código anterior à 006.
DROP TRIGGER IF EXISTS trg_vinculo_transacoes ON public.transacoes;
DROP TRIGGER IF EXISTS trg_vinculo_orfao ON public.pagamentos_conta;
DROP TRIGGER IF EXISTS trg_vinculo_orfao ON public.recebimentos_renda;
DROP TRIGGER IF EXISTS trg_vinculo_proteger ON public.pagamentos_conta;
DROP TRIGGER IF EXISTS trg_vinculo_proteger ON public.recebimentos_renda;
DROP FUNCTION IF EXISTS public.proteger_transacao_vinculada();
DROP FUNCTION IF EXISTS public.checar_vinculo_orfao();
DROP FUNCTION IF EXISTS public.proteger_vinculo();
DROP INDEX IF EXISTS public.idx_pagamentos_conta_transacao;
DROP FUNCTION IF EXISTS public.corrigir_saldo(UUID, NUMERIC, UUID);
DROP FUNCTION IF EXISTS public.pagar_conta_v2(UUID, TEXT, DATE, TEXT, UUID);
DROP FUNCTION IF EXISTS public.desfazer_recebimento(UUID, TEXT);
DROP FUNCTION IF EXISTS public.receber_renda(UUID, TEXT, DATE, UUID);
DROP TABLE IF EXISTS public.recebimentos_renda;
DROP TABLE IF EXISTS public.transferencias;
DROP INDEX IF EXISTS public.idx_transacoes_user_carteira;
ALTER TABLE IF EXISTS public.transacoes DROP CONSTRAINT IF EXISTS transacoes_carteira_fkey;
ALTER TABLE IF EXISTS public.transacoes DROP COLUMN IF EXISTS carteira_id;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'transacoes' AND column_name = 'ajuste') THEN
    DELETE FROM public.transacoes WHERE ajuste;
  END IF;
END $$;
ALTER TABLE IF EXISTS public.transacoes DROP COLUMN IF EXISTS ajuste;
ALTER TABLE IF EXISTS public.transacoes DROP COLUMN IF EXISTS ajuste_valor_real;
DROP INDEX IF EXISTS public.uq_transacoes_user_chave_ajuste;
ALTER TABLE IF EXISTS public.transacoes DROP COLUMN IF EXISTS chave_ajuste;
ALTER TABLE IF EXISTS public.rendas DROP CONSTRAINT IF EXISTS rendas_carteira_fkey;
ALTER TABLE IF EXISTS public.rendas DROP COLUMN IF EXISTS carteira_id;
ALTER TABLE IF EXISTS public.rendas DROP CONSTRAINT IF EXISTS rendas_id_user_key;
DROP TABLE IF EXISTS public.carteiras;

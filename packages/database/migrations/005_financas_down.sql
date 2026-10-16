-- Destrutivo: remove o modelo de finanças da 005; preserva dados do baseline.
-- Triggers, policies e índices das tabelas novas são removidos com as tabelas.
DROP FUNCTION IF EXISTS public.pagar_conta(UUID, TEXT, DATE, TEXT);
DROP FUNCTION IF EXISTS public.desfazer_pagamento(UUID, TEXT);
DROP TABLE IF EXISTS public.lembretes_enviados;
DROP TABLE IF EXISTS public.push_subscriptions;
DROP TABLE IF EXISTS public.orcamento_categorias;
DROP TABLE IF EXISTS public.rendas;
DROP TABLE IF EXISTS public.pagamentos_conta;
DROP TABLE IF EXISTS public.contas_pagar;
ALTER TABLE IF EXISTS public.assinaturas
  DROP CONSTRAINT IF EXISTS assinaturas_id_user_key;
ALTER TABLE IF EXISTS public.transacoes
  DROP CONSTRAINT IF EXISTS transacoes_id_user_key;
-- public.set_updated_at() pertence ao baseline e é preservada.

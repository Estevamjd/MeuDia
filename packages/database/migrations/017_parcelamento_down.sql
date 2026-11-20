SET LOCAL lock_timeout = '5s';
DO $$
BEGIN
  IF pg_catalog.current_setting('lock_timeout') <> '5s' THEN
    RAISE EXCEPTION '017: execute em transação única';
  END IF;
END $$;
-- Remove apenas os objetos da 017; preserva todas as linhas, valores e datas.
-- A marca de agrupamento das parcelas é perdida. Não aplica CASCADE.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_index
    WHERE indexrelid = pg_catalog.to_regclass('public.uq_transacoes_parcela')
      AND indrelid = 'public.transacoes'::pg_catalog.regclass) THEN
    DROP INDEX public.uq_transacoes_parcela;
  END IF;
END $$;
ALTER TABLE public.transacoes DROP CONSTRAINT IF EXISTS transacoes_parcela_check;
ALTER TABLE public.transacoes DROP COLUMN IF EXISTS parcela_grupo;
ALTER TABLE public.transacoes DROP COLUMN IF EXISTS parcela_num;
ALTER TABLE public.transacoes DROP COLUMN IF EXISTS parcela_total;

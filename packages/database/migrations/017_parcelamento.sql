-- Executar em transação única (psql -1 ou runner de migrations transacional).
SET LOCAL lock_timeout = '5s';
DO $$
BEGIN
  IF pg_catalog.current_setting('lock_timeout') <> '5s' THEN
    RAISE EXCEPTION '017: execute em transação única';
  END IF;
END $$;
-- 017: somente aditiva e idempotente; nenhum UPDATE/DELETE, RPC ou policy nova.
-- As parcelas são linhas comuns, protegidas pela RLS atual e inseridas em um único statement.
ALTER TABLE public.transacoes ADD COLUMN IF NOT EXISTS parcela_grupo UUID NULL;
ALTER TABLE public.transacoes ADD COLUMN IF NOT EXISTS parcela_num SMALLINT NULL;
ALTER TABLE public.transacoes ADD COLUMN IF NOT EXISTS parcela_total SMALLINT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
    WHERE conrelid = 'public.transacoes'::pg_catalog.regclass AND conname = 'transacoes_parcela_check') THEN
    ALTER TABLE public.transacoes ADD CONSTRAINT transacoes_parcela_check CHECK (
      (parcela_grupo IS NULL AND parcela_num IS NULL AND parcela_total IS NULL)
      -- CHECK aceita NULL: exige os três campos presentes para não aceitar parcela parcial.
      OR (parcela_grupo IS NOT NULL AND parcela_num IS NOT NULL AND parcela_total IS NOT NULL
        AND tipo = 'despesa'
        AND parcela_total BETWEEN 2 AND 24 AND parcela_num BETWEEN 1 AND parcela_total)
    ) NOT VALID;
  END IF;
END $$;

ALTER TABLE public.transacoes VALIDATE CONSTRAINT transacoes_parcela_check;

CREATE UNIQUE INDEX IF NOT EXISTS uq_transacoes_parcela
  ON public.transacoes (user_id, parcela_grupo, parcela_num)
  WHERE parcela_grupo IS NOT NULL;

DO $$
BEGIN
  IF NOT COALESCE((SELECT indrelid = 'public.transacoes'::pg_catalog.regclass AND indisunique
    FROM pg_catalog.pg_index
    WHERE indexrelid = pg_catalog.to_regclass('public.uq_transacoes_parcela')), false) THEN
    RAISE EXCEPTION '017: uq_transacoes_parcela deve ser índice único de public.transacoes';
  END IF;
END $$;

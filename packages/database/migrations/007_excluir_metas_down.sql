-- Destrutivo: desfaz a 007 e volta transferências/carteiras ao contrato da 006.
-- ATENÇÃO: apaga dados. Faça backup (pg_dump de metas e transferencias) antes:
--   * metas são removidas;
--   * transferências com um lado NULL (banco excluído) são apagadas: a 006 exige os dois lados. Isso muda o saldo
--     do banco que sobrou (a transferência deixa de contar nele).
DROP FUNCTION IF EXISTS public.guardar_na_meta(UUID, NUMERIC);
DROP TABLE IF EXISTS public.metas;

DROP TRIGGER IF EXISTS trg_carteiras_preparar_exclusao ON public.carteiras;
DROP FUNCTION IF EXISTS public.preparar_exclusao_carteira();
DO $$
BEGIN
  IF pg_catalog.to_regclass('public.carteiras') IS NOT NULL THEN
    REVOKE DELETE ON public.carteiras FROM authenticated;
  END IF;
  IF pg_catalog.to_regclass('public.transferencias') IS NULL THEN
    RETURN;
  END IF;
  DELETE FROM public.transferencias WHERE origem_id IS NULL OR destino_id IS NULL;
  ALTER TABLE public.transferencias DROP CONSTRAINT IF EXISTS transferencias_algum_lado;
  ALTER TABLE public.transferencias DROP CONSTRAINT IF EXISTS transferencias_origem_id_carteira_fkey;
  ALTER TABLE public.transferencias DROP CONSTRAINT IF EXISTS transferencias_destino_id_carteira_fkey;
  ALTER TABLE public.transferencias ALTER COLUMN origem_id SET NOT NULL;
  ALTER TABLE public.transferencias ALTER COLUMN destino_id SET NOT NULL;
  -- Mesmos nomes automáticos e NO ACTION da 006.
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
    WHERE conrelid = 'public.transferencias'::pg_catalog.regclass AND conname = 'transferencias_origem_id_user_id_fkey') THEN
    ALTER TABLE public.transferencias ADD CONSTRAINT transferencias_origem_id_user_id_fkey
      FOREIGN KEY (origem_id, user_id) REFERENCES public.carteiras (id, user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
    WHERE conrelid = 'public.transferencias'::pg_catalog.regclass AND conname = 'transferencias_destino_id_user_id_fkey') THEN
    ALTER TABLE public.transferencias ADD CONSTRAINT transferencias_destino_id_user_id_fkey
      FOREIGN KEY (destino_id, user_id) REFERENCES public.carteiras (id, user_id);
  END IF;
END $$;

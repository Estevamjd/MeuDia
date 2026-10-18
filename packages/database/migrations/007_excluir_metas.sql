-- 007: excluir bancos/carteiras (e as transferências deles) + metas de compra.
-- Depende de 000_baseline.sql + 005_financas.sql + 006_carteiras.sql; PostgreSQL 15+.
-- Aditiva e idempotente. A 006 não é editada: o que muda nela (FKs de transferências, DELETE em carteiras) é
-- refeito aqui. NÃO aplicar sem OK do dono (ver AGENTS.md).
--
-- Excluir carteira (decisão documentada em IMPL-EXCLUIR-METAS.md):
--   * lançamentos e rendas do banco ficam com carteira_id NULL ("Sem banco"): FKs da 006 já são ON DELETE SET NULL;
--     o texto `banco` desses lançamentos (cópia do nome da carteira) também é limpo, senão o nome excluído reaparece;
--   * transferências: o lado do banco excluído vira NULL (ON DELETE SET NULL) e o outro lado continua contando,
--     então o saldo dos DEMAIS bancos não muda; a transferência que ficaria sem os dois lados é apagada antes
--     (preparar_exclusao_carteira), porque não mexe em saldo de nenhum banco que ainda existe;
--   * lançamento vinculado a Recebi/Paguei: o SET NULL chega por RI (pg_trigger_depth() > 1) e passa por
--     proteger_transacao_vinculada; o vínculo (transacao_id) não muda, então não há vínculo órfão.

-- Transferências: cada lado aceita NULL (banco excluído), nunca os dois; origem <> destino continua (CHECK da 006).
ALTER TABLE public.transferencias ALTER COLUMN origem_id DROP NOT NULL;
ALTER TABLE public.transferencias ALTER COLUMN destino_id DROP NOT NULL;

DO $$
DECLARE
  col TEXT;
  fk RECORD;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
    WHERE conrelid = 'public.transferencias'::pg_catalog.regclass AND conname = 'transferencias_algum_lado') THEN
    ALTER TABLE public.transferencias ADD CONSTRAINT transferencias_algum_lado
      CHECK (origem_id IS NOT NULL OR destino_id IS NOT NULL);
  END IF;
  -- Troca as FKs NO ACTION da 006 (nome automático) por ON DELETE SET NULL só da coluna do banco (o user_id fica).
  FOREACH col IN ARRAY ARRAY['origem_id', 'destino_id'] LOOP
    FOR fk IN
      SELECT c.conname FROM pg_catalog.pg_constraint c
      WHERE c.conrelid = 'public.transferencias'::pg_catalog.regclass AND c.contype = 'f'
        AND c.confrelid = 'public.carteiras'::pg_catalog.regclass AND c.confdeltype <> 'n'
        AND c.conkey[1] = (SELECT attnum FROM pg_catalog.pg_attribute
          WHERE attrelid = 'public.transferencias'::pg_catalog.regclass AND attname = col)
    LOOP
      EXECUTE pg_catalog.format('ALTER TABLE public.transferencias DROP CONSTRAINT %I', fk.conname);
    END LOOP;
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
      WHERE conrelid = 'public.transferencias'::pg_catalog.regclass AND conname = 'transferencias_' || col || '_carteira_fkey') THEN
      EXECUTE pg_catalog.format('ALTER TABLE public.transferencias ADD CONSTRAINT %I FOREIGN KEY (%I, user_id) '
        'REFERENCES public.carteiras (id, user_id) ON DELETE SET NULL (%I)', 'transferencias_' || col || '_carteira_fkey', col, col);
    END IF;
  END LOOP;
END $$;

-- Antes de apagar a carteira: some a transferência cujo outro lado já foi excluído (senão violaria algum_lado) e o
-- texto `banco` dos lançamentos dela é limpo. Este UPDATE roda dentro do trigger (pg_trigger_depth() > 1), então passa
-- por proteger_transacao_vinculada também em lançamento de Recebi/Paguei; só mexe no texto do banco excluído.
CREATE OR REPLACE FUNCTION public.preparar_exclusao_carteira()
RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
BEGIN
  DELETE FROM public.transferencias
    WHERE user_id = OLD.user_id
      AND ((origem_id = OLD.id AND destino_id IS NULL) OR (destino_id = OLD.id AND origem_id IS NULL));
  UPDATE public.transacoes SET banco = NULL
    WHERE user_id = OLD.user_id AND carteira_id = OLD.id AND banco IS NOT NULL;
  RETURN OLD;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.preparar_exclusao_carteira() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_trigger
    WHERE tgname = 'trg_carteiras_preparar_exclusao' AND tgrelid = 'public.carteiras'::pg_catalog.regclass) THEN
    CREATE TRIGGER trg_carteiras_preparar_exclusao BEFORE DELETE ON public.carteiras
      FOR EACH ROW EXECUTE FUNCTION public.preparar_exclusao_carteira();
  END IF;
END $$;

-- Carteira agora se apaga (a policy users_own_data FOR ALL da 006 já restringe a auth.uid() = user_id).
GRANT DELETE ON public.carteiras TO authenticated;

-- Metas de compra: quanto quer juntar, até quando (opcional) e quanto já guardou. Sem investimento/rendimento.
CREATE TABLE IF NOT EXISTS public.metas (
  id             UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  nome           TEXT NOT NULL CHECK (pg_catalog.length(pg_catalog.btrim(nome)) BETWEEN 1 AND 80),
  -- Chave de um ícone do app (ICONES_META em packages/shared); o formato impede texto livre.
  icone          TEXT CHECK (icone IS NULL OR icone ~ '^[a-z][a-z0-9-]{0,39}$'),
  valor_alvo     DECIMAL(12,2) NOT NULL CHECK (valor_alvo > 0),
  data_limite    DATE,
  valor_guardado DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (valor_guardado >= 0),
  criado_em      TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now()
);
CREATE INDEX IF NOT EXISTS idx_metas_user ON public.metas(user_id);

ALTER TABLE public.metas ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_policies
    WHERE schemaname = 'public' AND tablename = 'metas' AND policyname = 'users_own_data') THEN
    CREATE POLICY users_own_data ON public.metas FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_trigger
    WHERE tgname = 'trg_metas_updated_at' AND tgrelid = 'public.metas'::pg_catalog.regclass) THEN
    CREATE TRIGGER trg_metas_updated_at BEFORE UPDATE ON public.metas FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

-- "Guardei": soma atômica (duas abas não perdem um depósito). Corrigir o valor é UPDATE comum de valor_guardado.
-- P0002: meta inexistente ou de outro usuário; 22023: valor <= 0 ou com mais de 2 casas.
CREATE OR REPLACE FUNCTION public.guardar_na_meta(p_meta_id UUID, p_valor NUMERIC)
RETURNS public.metas
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE
  v_meta public.metas;
BEGIN
  IF p_valor IS NULL OR p_valor <= 0 OR p_valor <> pg_catalog.round(p_valor, 2) OR p_valor > 9999999999.99 THEN
    RAISE EXCEPTION 'Valor inválido' USING ERRCODE = '22023', HINT = 'Exige valor positivo com até 2 casas.';
  END IF;
  UPDATE public.metas SET valor_guardado = valor_guardado + p_valor
    WHERE id = p_meta_id AND user_id = auth.uid()
    RETURNING * INTO v_meta;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Meta não encontrada ou acesso negado' USING ERRCODE = 'P0002';
  END IF;
  RETURN v_meta;
END;
$$;

-- REVOKE ALL antes do GRANT: no Supabase os default privileges dão ALL a anon/authenticated em tabela nova.
REVOKE ALL ON public.metas FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.metas TO authenticated;
REVOKE EXECUTE ON FUNCTION public.guardar_na_meta(UUID, NUMERIC) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.guardar_na_meta(UUID, NUMERIC) TO authenticated;

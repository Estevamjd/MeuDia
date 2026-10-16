-- BE-02: depende de 000_baseline.sql; PostgreSQL 15+.
-- FKs compostas impedem referências a dados de outro usuário.
-- SET NULL (coluna) preserva user_id, que é NOT NULL.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
    WHERE conrelid = 'public.assinaturas'::pg_catalog.regclass AND conname = 'assinaturas_id_user_key') THEN
    ALTER TABLE public.assinaturas ADD CONSTRAINT assinaturas_id_user_key UNIQUE (id, user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
    WHERE conrelid = 'public.transacoes'::pg_catalog.regclass AND conname = 'transacoes_id_user_key') THEN
    ALTER TABLE public.transacoes ADD CONSTRAINT transacoes_id_user_key UNIQUE (id, user_id);
  END IF;
END $$;

-- assinaturas = contas recorrentes
ALTER TABLE public.assinaturas
  ADD COLUMN IF NOT EXISTS categoria     TEXT NOT NULL DEFAULT 'Assinaturas',
  ADD COLUMN IF NOT EXISTS recorrencia   TEXT NOT NULL DEFAULT 'mensal'
    CHECK (recorrencia IN ('mensal','anual')),
  ADD COLUMN IF NOT EXISTS mes_vencimento INTEGER CHECK (mes_vencimento BETWEEN 1 AND 12);
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
    WHERE conrelid = 'public.assinaturas'::pg_catalog.regclass
      AND conname = 'assinaturas_recorrencia_mes_check') THEN
    ALTER TABLE public.assinaturas ADD CONSTRAINT assinaturas_recorrencia_mes_check
      CHECK ((recorrencia = 'anual') = (mes_vencimento IS NOT NULL));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.contas_pagar (
  id            UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  assinatura_id UUID,                         -- NULL = conta única
  descricao     TEXT NOT NULL,
  categoria     TEXT NOT NULL DEFAULT 'Contas',
  valor         DECIMAL(10,2) NOT NULL CHECK (valor > 0),
  competencia   DATE NOT NULL,                -- 1º dia do mês da ocorrência
  vencimento    DATE NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pendente'
                  CHECK (status IN ('pendente','paga','cancelada')),
  pago_em       DATE,
  transacao_id  UUID,
  created_at    TIMESTAMPTZ DEFAULT pg_catalog.now(),
  updated_at    TIMESTAMPTZ DEFAULT pg_catalog.now(),
  UNIQUE (id, user_id),
  CHECK ((status = 'paga') = (pago_em IS NOT NULL)),
  CHECK (competencia = pg_catalog.date_trunc('month', vencimento::timestamp)::date),
  -- FK compostas (id, user_id): impedem apontar para assinatura/transação de outro usuário
  FOREIGN KEY (assinatura_id, user_id) REFERENCES public.assinaturas (id, user_id)
    ON DELETE SET NULL (assinatura_id),
  FOREIGN KEY (transacao_id, user_id) REFERENCES public.transacoes (id, user_id)
    ON DELETE SET NULL (transacao_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_contas_pagar_assinatura_comp
  ON public.contas_pagar(assinatura_id, competencia) WHERE assinatura_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contas_pagar_user_venc   ON public.contas_pagar(user_id, vencimento);
CREATE INDEX IF NOT EXISTS idx_contas_pagar_status_venc ON public.contas_pagar(status, vencimento);

CREATE TABLE IF NOT EXISTS public.rendas (
  id              UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  descricao       TEXT NOT NULL,
  valor           DECIMAL(10,2) NOT NULL CHECK (valor > 0),
  dia_recebimento INTEGER CHECK (dia_recebimento BETWEEN 1 AND 31),
  ativo           BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT pg_catalog.now(),
  updated_at      TIMESTAMPTZ DEFAULT pg_catalog.now()
);

CREATE TABLE IF NOT EXISTS public.orcamento_categorias (
  id              UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  categoria       TEXT NOT NULL,
  valor_planejado DECIMAL(10,2) NOT NULL CHECK (valor_planejado >= 0),
  created_at      TIMESTAMPTZ DEFAULT pg_catalog.now(),
  updated_at      TIMESTAMPTZ DEFAULT pg_catalog.now(),
  UNIQUE (user_id, categoria)
);

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id           UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  endpoint     TEXT NOT NULL UNIQUE,
  p256dh       TEXT NOT NULL,
  auth         TEXT NOT NULL,
  user_agent   TEXT,
  created_at   TIMESTAMPTZ DEFAULT pg_catalog.now(),
  last_used_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON public.push_subscriptions(user_id);

CREATE TABLE IF NOT EXISTS public.lembretes_enviados (
  id          UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  conta_id    UUID NOT NULL,
  competencia DATE NOT NULL,
  etapa       TEXT NOT NULL CHECK (etapa IN ('D-2','D-1','D0')),
  canal       TEXT NOT NULL DEFAULT 'push' CHECK (canal IN ('push','email')),
  enviado_em  TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
  FOREIGN KEY (conta_id, user_id) REFERENCES public.contas_pagar (id, user_id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_lembretes_enviados
  ON public.lembretes_enviados(conta_id, competencia, etapa, canal);

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['contas_pagar', 'rendas', 'orcamento_categorias', 'push_subscriptions', 'lembretes_enviados'] LOOP
    EXECUTE pg_catalog.format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_policies
      WHERE schemaname = 'public' AND tablename = t AND policyname = 'users_own_data') THEN
      IF t = 'lembretes_enviados' THEN
        EXECUTE pg_catalog.format('CREATE POLICY users_own_data ON public.%I FOR SELECT USING (auth.uid() = user_id)', t);
      ELSE
        EXECUTE pg_catalog.format('CREATE POLICY users_own_data ON public.%I FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)', t);
      END IF;
    END IF;
  END LOOP;
  FOREACH t IN ARRAY ARRAY['contas_pagar', 'rendas', 'orcamento_categorias'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_trigger
      WHERE tgname = 'trg_' || t || '_updated_at'
        AND tgrelid = pg_catalog.to_regclass(pg_catalog.format('public.%I', t))) THEN
      EXECUTE pg_catalog.format('CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()', 'trg_' || t || '_updated_at', t);
    END IF;
  END LOOP;
END $$;

-- Contrato de erros das RPCs:
-- P0002: conta inexistente ou invisível por RLS (sem revelar o proprietário).
-- 22023: estado inválido; HINT identifica o estado exigido para a operação.
-- NULL em p_pago_em usa a data corrente em America/Sao_Paulo.
CREATE OR REPLACE FUNCTION public.pagar_conta(
  p_conta_id UUID,
  p_pago_em DATE DEFAULT NULL,
  p_banco TEXT DEFAULT NULL
) RETURNS public.contas_pagar
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE
  v_conta public.contas_pagar;
  v_transacao_id UUID;
  v_pago_em DATE;
BEGIN
  SELECT * INTO v_conta FROM public.contas_pagar
    WHERE id = p_conta_id AND user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conta não encontrada ou acesso negado' USING ERRCODE = 'P0002';
  END IF;
  IF v_conta.status <> 'pendente' THEN
    RAISE EXCEPTION 'Apenas contas pendentes podem ser pagas'
      USING ERRCODE = '22023', HINT = 'Exige status=pendente.';
  END IF;
  v_pago_em := coalesce(p_pago_em, (pg_catalog.now() AT TIME ZONE 'America/Sao_Paulo')::date);

  INSERT INTO public.transacoes (user_id, tipo, categoria, descricao, valor, data, banco, automatico)
    VALUES (v_conta.user_id, 'despesa', v_conta.categoria, v_conta.descricao,
            v_conta.valor, v_pago_em, p_banco, TRUE)
    RETURNING id INTO v_transacao_id;

  UPDATE public.contas_pagar
    SET status = 'paga', pago_em = v_pago_em, transacao_id = v_transacao_id, updated_at = pg_catalog.now()
    WHERE id = v_conta.id RETURNING * INTO v_conta;
  RETURN v_conta;
END;
$$;

CREATE OR REPLACE FUNCTION public.desfazer_pagamento(p_conta_id UUID)
RETURNS public.contas_pagar
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE
  v_conta public.contas_pagar;
BEGIN
  SELECT * INTO v_conta FROM public.contas_pagar
    WHERE id = p_conta_id AND user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conta não encontrada ou acesso negado' USING ERRCODE = 'P0002';
  END IF;
  IF v_conta.status <> 'paga' THEN
    RAISE EXCEPTION 'Apenas contas pagas podem ter o pagamento desfeito'
      USING ERRCODE = '22023', HINT = 'Exige status=paga.';
  END IF;

  DELETE FROM public.transacoes WHERE id = v_conta.transacao_id AND user_id = v_conta.user_id;
  UPDATE public.contas_pagar
    SET status = 'pendente', pago_em = NULL, transacao_id = NULL, updated_at = pg_catalog.now()
    WHERE id = v_conta.id RETURNING * INTO v_conta;
  RETURN v_conta;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.pagar_conta(UUID, DATE, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.desfazer_pagamento(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pagar_conta(UUID, DATE, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.desfazer_pagamento(UUID) TO authenticated;

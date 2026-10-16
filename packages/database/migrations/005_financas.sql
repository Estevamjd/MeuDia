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

CREATE TABLE IF NOT EXISTS public.contas_pagar (
  id              UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  assinatura_id   UUID,                       -- espelho de uma assinatura (opcional)
  descricao       TEXT NOT NULL,
  categoria       TEXT NOT NULL DEFAULT 'Contas',
  valor           DECIMAL(10,2) NOT NULL CHECK (valor > 0),
  recorrencia     TEXT NOT NULL CHECK (recorrencia IN ('mensal','anual','unica')),
  dia_vencimento  INTEGER CHECK (dia_vencimento BETWEEN 1 AND 31),   -- mensal/anual
  mes_vencimento  INTEGER CHECK (mes_vencimento BETWEEN 1 AND 12),   -- anual
  data_vencimento DATE,                                              -- unica
  ativo           BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT pg_catalog.now(),
  updated_at      TIMESTAMPTZ DEFAULT pg_catalog.now(),
  UNIQUE (id, user_id),
  CHECK (
    (recorrencia = 'mensal' AND dia_vencimento IS NOT NULL AND mes_vencimento IS NULL AND data_vencimento IS NULL) OR
    (recorrencia = 'anual'  AND dia_vencimento IS NOT NULL AND mes_vencimento IS NOT NULL AND data_vencimento IS NULL) OR
    (recorrencia = 'unica'  AND data_vencimento IS NOT NULL AND dia_vencimento IS NULL AND mes_vencimento IS NULL)
  ),
  -- FK composta (id, user_id): impede apontar para assinatura de outro usuário
  FOREIGN KEY (assinatura_id, user_id) REFERENCES public.assinaturas (id, user_id)
    ON DELETE SET NULL (assinatura_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_contas_pagar_assinatura
  ON public.contas_pagar(assinatura_id) WHERE assinatura_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contas_pagar_user_ativo ON public.contas_pagar(user_id) WHERE ativo;

-- um pagamento por (conta, competência)
CREATE TABLE IF NOT EXISTS public.pagamentos_conta (
  id           UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  conta_id     UUID NOT NULL,
  user_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  competencia  TEXT NOT NULL CHECK (competencia ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  pago_em      DATE NOT NULL,
  transacao_id UUID,                          -- despesa criada por pagar_conta (opcional)
  created_at   TIMESTAMPTZ DEFAULT pg_catalog.now(),
  UNIQUE (conta_id, competencia),
  FOREIGN KEY (conta_id, user_id) REFERENCES public.contas_pagar (id, user_id) ON DELETE CASCADE,
  FOREIGN KEY (transacao_id, user_id) REFERENCES public.transacoes (id, user_id)
    ON DELETE SET NULL (transacao_id)
);
CREATE INDEX IF NOT EXISTS idx_pagamentos_conta_user_comp ON public.pagamentos_conta(user_id, competencia);

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
  competencia TEXT NOT NULL CHECK (competencia ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
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
  FOREACH t IN ARRAY ARRAY['contas_pagar', 'pagamentos_conta', 'rendas', 'orcamento_categorias', 'push_subscriptions', 'lembretes_enviados'] LOOP
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

-- P0002: conta inexistente/invisível; 22023: competência/estado inválido.
-- NULL em p_pago_em usa a data corrente em America/Sao_Paulo.
CREATE OR REPLACE FUNCTION public.pagar_conta(
  p_conta_id UUID,
  p_competencia TEXT,
  p_pago_em DATE DEFAULT NULL,
  p_banco TEXT DEFAULT NULL
) RETURNS public.pagamentos_conta
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE
  v_conta public.contas_pagar;
  v_pagamento public.pagamentos_conta;
  v_transacao_id UUID;
  v_pago_em DATE;
BEGIN
  SELECT * INTO v_conta FROM public.contas_pagar
    WHERE id = p_conta_id AND user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conta não encontrada ou acesso negado' USING ERRCODE = 'P0002';
  END IF;
  IF p_competencia IS NULL OR p_competencia !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' THEN
    RAISE EXCEPTION 'Competência inválida' USING ERRCODE = '22023', HINT = 'Exige YYYY-MM.';
  END IF;
  IF NOT v_conta.ativo
    OR (v_conta.recorrencia = 'anual' AND pg_catalog.substring(p_competencia, 6, 2)::integer <> v_conta.mes_vencimento)
    OR (v_conta.recorrencia = 'unica' AND p_competencia <> pg_catalog.to_char(v_conta.data_vencimento, 'YYYY-MM'))
    OR (v_conta.recorrencia IN ('mensal', 'anual') AND p_competencia < pg_catalog.to_char(v_conta.created_at AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM')) THEN
    RAISE EXCEPTION 'Conta sem ocorrência nesta competência'
      USING ERRCODE = '22023', HINT = 'Exige conta ativa e competência compatível com a recorrência e criação.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.pagamentos_conta WHERE conta_id = p_conta_id AND competencia = p_competencia AND user_id = v_conta.user_id) THEN
    RAISE EXCEPTION 'Competência já paga' USING ERRCODE = '22023', HINT = 'Exige competência sem pagamento.';
  END IF;
  v_pago_em := coalesce(p_pago_em, (pg_catalog.now() AT TIME ZONE 'America/Sao_Paulo')::date);
  INSERT INTO public.transacoes (user_id, tipo, categoria, descricao, valor, data, banco, automatico)
    VALUES (v_conta.user_id, 'despesa', v_conta.categoria, v_conta.descricao,
            v_conta.valor, v_pago_em, p_banco, TRUE)
    RETURNING id INTO v_transacao_id;
  INSERT INTO public.pagamentos_conta (conta_id, user_id, competencia, pago_em, transacao_id)
    VALUES (v_conta.id, v_conta.user_id, p_competencia, v_pago_em, v_transacao_id)
    RETURNING * INTO v_pagamento;
  RETURN v_pagamento;
END;
$$;

CREATE OR REPLACE FUNCTION public.desfazer_pagamento(p_conta_id UUID, p_competencia TEXT)
RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE
  v_pagamento public.pagamentos_conta;
BEGIN
  -- Mesma ordem de locks de pagar_conta; serializa as operações da conta.
  PERFORM 1 FROM public.contas_pagar
    WHERE id = p_conta_id AND user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conta não encontrada ou acesso negado' USING ERRCODE = 'P0002';
  END IF;
  IF p_competencia IS NULL OR p_competencia !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' THEN
    RAISE EXCEPTION 'Competência inválida' USING ERRCODE = '22023', HINT = 'Exige YYYY-MM.';
  END IF;
  SELECT * INTO v_pagamento FROM public.pagamentos_conta
    WHERE conta_id = p_conta_id AND competencia = p_competencia AND user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pagamento não encontrado nesta competência'
      USING ERRCODE = '22023', HINT = 'Exige competência paga.';
  END IF;
  DELETE FROM public.transacoes WHERE id = v_pagamento.transacao_id AND user_id = v_pagamento.user_id;
  DELETE FROM public.pagamentos_conta WHERE id = v_pagamento.id AND user_id = v_pagamento.user_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.pagar_conta(UUID, TEXT, DATE, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.desfazer_pagamento(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pagar_conta(UUID, TEXT, DATE, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.desfazer_pagamento(UUID, TEXT) TO authenticated;

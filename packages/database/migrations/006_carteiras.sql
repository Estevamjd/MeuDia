-- 006: bancos e carteira com saldo, transferências e "Recebi" do salário.
-- Depende de 000_baseline.sql + 005_financas.sql; PostgreSQL 15+.
-- Apenas ADITIVA e idempotente: nenhuma tabela/coluna existente é removida ou reescrita.
-- Lançamentos antigos ficam com carteira_id NULL (não entram em nenhum saldo).
-- FKs compostas (x_id, user_id) impedem referências a dados de outro usuário.

CREATE TABLE IF NOT EXISTS public.carteiras (
  id               UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  nome             TEXT NOT NULL CHECK (pg_catalog.length(pg_catalog.btrim(nome)) BETWEEN 1 AND 60),
  tipo             TEXT NOT NULL DEFAULT 'banco' CHECK (tipo IN ('banco','dinheiro','poupanca')),
  saldo_inicial    DECIMAL(12,2) NOT NULL DEFAULT 0,           -- aceita negativo (cheque especial)
  saldo_inicial_em TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(), -- âncora: "o saldo era X neste momento"
  incluir_no_total BOOLEAN NOT NULL DEFAULT TRUE,
  arquivada        BOOLEAN NOT NULL DEFAULT FALSE,             -- não existe excluir, só arquivar
  ordem            INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ DEFAULT pg_catalog.now(),
  updated_at       TIMESTAMPTZ DEFAULT pg_catalog.now(),
  UNIQUE (id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_carteiras_user ON public.carteiras(user_id);

ALTER TABLE public.transacoes ADD COLUMN IF NOT EXISTS carteira_id UUID;
ALTER TABLE public.transacoes ADD COLUMN IF NOT EXISTS ajuste BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.rendas ADD COLUMN IF NOT EXISTS carteira_id UUID;
-- Idempotência do "Corrigir saldo": a mesma chave nunca gera dois ajustes (ver corrigir_saldo).
ALTER TABLE public.transacoes ADD COLUMN IF NOT EXISTS chave_ajuste UUID;
CREATE UNIQUE INDEX IF NOT EXISTS uq_transacoes_user_chave_ajuste
  ON public.transacoes(user_id, chave_ajuste) WHERE chave_ajuste IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
    WHERE conrelid = 'public.transacoes'::pg_catalog.regclass AND conname = 'transacoes_carteira_fkey') THEN
    ALTER TABLE public.transacoes ADD CONSTRAINT transacoes_carteira_fkey
      FOREIGN KEY (carteira_id, user_id) REFERENCES public.carteiras (id, user_id) ON DELETE SET NULL (carteira_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
    WHERE conrelid = 'public.rendas'::pg_catalog.regclass AND conname = 'rendas_id_user_key') THEN
    ALTER TABLE public.rendas ADD CONSTRAINT rendas_id_user_key UNIQUE (id, user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
    WHERE conrelid = 'public.rendas'::pg_catalog.regclass AND conname = 'rendas_carteira_fkey') THEN
    ALTER TABLE public.rendas ADD CONSTRAINT rendas_carteira_fkey
      FOREIGN KEY (carteira_id, user_id) REFERENCES public.carteiras (id, user_id) ON DELETE SET NULL (carteira_id);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_transacoes_user_carteira ON public.transacoes(user_id, carteira_id) WHERE carteira_id IS NOT NULL;

-- Fora de `transacoes` de propósito: transferência não é gasto nem renda.
-- "data <= hoje" é validado no app (CHECK com now() não é imutável).
CREATE TABLE IF NOT EXISTS public.transferencias (
  id          UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  origem_id   UUID NOT NULL,
  destino_id  UUID NOT NULL,
  valor       DECIMAL(12,2) NOT NULL CHECK (valor > 0),
  data        DATE NOT NULL,
  descricao   TEXT CHECK (descricao IS NULL OR pg_catalog.length(descricao) <= 200),
  created_at  TIMESTAMPTZ DEFAULT pg_catalog.now(),
  updated_at  TIMESTAMPTZ DEFAULT pg_catalog.now(),
  CHECK (origem_id <> destino_id),
  -- NO ACTION: carteira com transferências não pode ser apagada (arquivar); o CASCADE de profiles segue funcionando.
  FOREIGN KEY (origem_id, user_id) REFERENCES public.carteiras (id, user_id),
  FOREIGN KEY (destino_id, user_id) REFERENCES public.carteiras (id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_transferencias_user_data ON public.transferencias(user_id, data);

-- Espelho de pagamentos_conta: um recebimento por (renda, competência).
CREATE TABLE IF NOT EXISTS public.recebimentos_renda (
  id           UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  renda_id     UUID NOT NULL,
  user_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  competencia  TEXT NOT NULL CHECK (competencia ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  recebido_em  DATE NOT NULL,
  transacao_id UUID,                          -- receita criada por receber_renda
  created_at   TIMESTAMPTZ DEFAULT pg_catalog.now(),
  UNIQUE (renda_id, competencia),
  FOREIGN KEY (renda_id, user_id) REFERENCES public.rendas (id, user_id) ON DELETE CASCADE,
  FOREIGN KEY (transacao_id, user_id) REFERENCES public.transacoes (id, user_id)
    ON DELETE SET NULL (transacao_id)
);
CREATE INDEX IF NOT EXISTS idx_recebimentos_renda_user_comp ON public.recebimentos_renda(user_id, competencia);

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['carteiras', 'transferencias', 'recebimentos_renda'] LOOP
    EXECUTE pg_catalog.format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_policies
      WHERE schemaname = 'public' AND tablename = t AND policyname = 'users_own_data') THEN
      EXECUTE pg_catalog.format('CREATE POLICY users_own_data ON public.%I FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)', t);
    END IF;
  END LOOP;
  FOREACH t IN ARRAY ARRAY['carteiras', 'transferencias'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_trigger
      WHERE tgname = 'trg_' || t || '_updated_at'
        AND tgrelid = pg_catalog.to_regclass(pg_catalog.format('public.%I', t))) THEN
      EXECUTE pg_catalog.format('CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()', 'trg_' || t || '_updated_at', t);
    END IF;
  END LOOP;
END $$;

-- P0002: renda/carteira inexistente, arquivada ou de outro usuário; 22023: competência/estado inválido;
-- P0003: competência já recebida. NULL em p_recebido_em usa a data corrente em America/Sao_Paulo.
-- NULL em p_carteira_id usa a carteira padrão da renda (rendas.carteira_id), se houver.
CREATE OR REPLACE FUNCTION public.receber_renda(
  p_renda_id UUID,
  p_competencia TEXT,
  p_recebido_em DATE DEFAULT NULL,
  p_carteira_id UUID DEFAULT NULL
) RETURNS public.recebimentos_renda
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE
  v_renda public.rendas;
  v_recebimento public.recebimentos_renda;
  v_carteira_id UUID;
  v_carteira_nome TEXT;
  v_transacao_id UUID;
  v_recebido_em DATE;
BEGIN
  SELECT * INTO v_renda FROM public.rendas
    WHERE id = p_renda_id AND user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Renda não encontrada ou acesso negado' USING ERRCODE = 'P0002';
  END IF;
  IF p_competencia IS NULL OR p_competencia !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' THEN
    RAISE EXCEPTION 'Competência inválida' USING ERRCODE = '22023', HINT = 'Exige YYYY-MM.';
  END IF;
  IF NOT v_renda.ativo THEN
    RAISE EXCEPTION 'Renda inativa' USING ERRCODE = '22023', HINT = 'Exige renda ativa.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.recebimentos_renda
    WHERE renda_id = p_renda_id AND competencia = p_competencia AND user_id = v_renda.user_id) THEN
    RAISE EXCEPTION 'Competência já recebida' USING ERRCODE = 'P0003', HINT = 'Exige competência sem recebimento.';
  END IF;
  v_carteira_id := coalesce(p_carteira_id, v_renda.carteira_id);
  IF v_carteira_id IS NOT NULL THEN
    SELECT nome INTO v_carteira_nome FROM public.carteiras
      WHERE id = v_carteira_id AND user_id = v_renda.user_id AND NOT arquivada;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Carteira não encontrada ou arquivada' USING ERRCODE = 'P0002';
    END IF;
  END IF;
  v_recebido_em := coalesce(p_recebido_em, (pg_catalog.now() AT TIME ZONE 'America/Sao_Paulo')::date);
  INSERT INTO public.transacoes (user_id, tipo, categoria, descricao, valor, data, banco, automatico, carteira_id, ajuste)
    VALUES (v_renda.user_id, 'receita', 'Salário', v_renda.descricao, v_renda.valor, v_recebido_em,
            v_carteira_nome, TRUE, v_carteira_id, FALSE)
    RETURNING id INTO v_transacao_id;
  INSERT INTO public.recebimentos_renda (renda_id, user_id, competencia, recebido_em, transacao_id)
    VALUES (v_renda.id, v_renda.user_id, p_competencia, v_recebido_em, v_transacao_id)
    RETURNING * INTO v_recebimento;
  RETURN v_recebimento;
END;
$$;

CREATE OR REPLACE FUNCTION public.desfazer_recebimento(p_renda_id UUID, p_competencia TEXT)
RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE
  v_recebimento public.recebimentos_renda;
BEGIN
  -- Mesma ordem de locks de receber_renda; serializa as operações da renda.
  PERFORM 1 FROM public.rendas
    WHERE id = p_renda_id AND user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Renda não encontrada ou acesso negado' USING ERRCODE = 'P0002';
  END IF;
  IF p_competencia IS NULL OR p_competencia !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' THEN
    RAISE EXCEPTION 'Competência inválida' USING ERRCODE = '22023', HINT = 'Exige YYYY-MM.';
  END IF;
  SELECT * INTO v_recebimento FROM public.recebimentos_renda
    WHERE renda_id = p_renda_id AND competencia = p_competencia AND user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Recebimento não encontrado nesta competência'
      USING ERRCODE = '22023', HINT = 'Exige competência recebida.';
  END IF;
  DELETE FROM public.transacoes WHERE id = v_recebimento.transacao_id AND user_id = v_recebimento.user_id;
  DELETE FROM public.recebimentos_renda WHERE id = v_recebimento.id AND user_id = v_recebimento.user_id;
END;
$$;

-- "Paguei" com carteira. Nome novo (e não uma sobrecarga de pagar_conta): com p_carteira_id DEFAULT NULL,
-- pagar_conta(uuid,text) ficaria ambígua no SQL (42725) e no PostgREST (PGRST203).
-- A pagar_conta da 005 continua intacta; esta delega a ela e só vincula a despesa à carteira.
CREATE OR REPLACE FUNCTION public.pagar_conta_v2(
  p_conta_id UUID,
  p_competencia TEXT,
  p_pago_em DATE DEFAULT NULL,
  p_banco TEXT DEFAULT NULL,
  p_carteira_id UUID DEFAULT NULL
) RETURNS public.pagamentos_conta
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE
  v_pagamento public.pagamentos_conta;
  v_carteira_nome TEXT;
BEGIN
  IF p_carteira_id IS NOT NULL THEN
    SELECT nome INTO v_carteira_nome FROM public.carteiras
      WHERE id = p_carteira_id AND user_id = auth.uid() AND NOT arquivada;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Carteira não encontrada ou arquivada' USING ERRCODE = 'P0002';
    END IF;
  END IF;
  v_pagamento := public.pagar_conta(p_conta_id, p_competencia, p_pago_em, coalesce(p_banco, v_carteira_nome));
  IF p_carteira_id IS NOT NULL THEN
    UPDATE public.transacoes SET carteira_id = p_carteira_id
      WHERE id = v_pagamento.transacao_id AND user_id = v_pagamento.user_id;
  END IF;
  RETURN v_pagamento;
END;
$$;

-- R9 "Corrigir saldo" atômico: trava a carteira (FOR UPDATE), calcula o saldo de hoje pela mesma fórmula de
-- saldoCarteira (packages/shared/src/utils/saldo.ts) e grava o ajuste com a diferença (ajuste=true).
-- Idempotente por p_chave: repetir a mesma chave devolve o ajuste já criado. Duas abas com chaves diferentes
-- são serializadas pelo lock; a segunda vê o saldo já corrigido e não cria nada.
-- Sem diferença não cria nada (0 linhas). P0002: carteira inexistente/arquivada/de outro usuário; 22023: valor/chave inválidos.
CREATE OR REPLACE FUNCTION public.corrigir_saldo(p_carteira_id UUID, p_valor_real NUMERIC, p_chave UUID)
RETURNS SETOF public.transacoes
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE
  v_carteira public.carteiras;
  v_ajuste public.transacoes;
  v_hoje DATE := (pg_catalog.now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_dia_ancora DATE;
  v_saldo NUMERIC;
  v_diferenca NUMERIC;
BEGIN
  IF p_chave IS NULL THEN
    RAISE EXCEPTION 'Chave de idempotência obrigatória' USING ERRCODE = '22023';
  END IF;
  IF p_valor_real IS NULL OR p_valor_real <> pg_catalog.round(p_valor_real, 2) OR pg_catalog.abs(p_valor_real) > 9999999999.99 THEN
    RAISE EXCEPTION 'Valor inválido' USING ERRCODE = '22023', HINT = 'Exige no máximo 2 casas decimais.';
  END IF;
  SELECT * INTO v_carteira FROM public.carteiras
    WHERE id = p_carteira_id AND user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND OR v_carteira.arquivada THEN
    RAISE EXCEPTION 'Carteira não encontrada ou arquivada' USING ERRCODE = 'P0002';
  END IF;
  SELECT * INTO v_ajuste FROM public.transacoes
    WHERE user_id = v_carteira.user_id AND chave_ajuste = p_chave;
  IF FOUND THEN
    IF v_ajuste.carteira_id IS DISTINCT FROM v_carteira.id THEN
      RAISE EXCEPTION 'Chave já usada em outra carteira' USING ERRCODE = '22023';
    END IF;
    RETURN NEXT v_ajuste;
    RETURN;
  END IF;
  -- R2: conta o que veio depois da âncora (dia seguinte, ou mesmo dia com created_at posterior), até hoje.
  v_dia_ancora := (v_carteira.saldo_inicial_em AT TIME ZONE 'America/Sao_Paulo')::date;
  SELECT v_carteira.saldo_inicial
    + coalesce((SELECT pg_catalog.sum(CASE WHEN t.tipo = 'receita' THEN t.valor ELSE -t.valor END)
        FROM public.transacoes t
        WHERE t.user_id = v_carteira.user_id AND t.carteira_id = v_carteira.id AND t.data <= v_hoje
          AND (t.data > v_dia_ancora OR (t.data = v_dia_ancora AND t.created_at > v_carteira.saldo_inicial_em))), 0)
    + coalesce((SELECT pg_catalog.sum(CASE WHEN tr.destino_id = v_carteira.id THEN tr.valor ELSE -tr.valor END)
        FROM public.transferencias tr
        WHERE tr.user_id = v_carteira.user_id AND (tr.origem_id = v_carteira.id OR tr.destino_id = v_carteira.id)
          AND tr.data <= v_hoje
          AND (tr.data > v_dia_ancora OR (tr.data = v_dia_ancora AND tr.created_at > v_carteira.saldo_inicial_em))), 0)
    INTO v_saldo;
  v_diferenca := p_valor_real - v_saldo;
  IF v_diferenca = 0 THEN
    RETURN;
  END IF;
  INSERT INTO public.transacoes (user_id, tipo, categoria, descricao, valor, data, banco, automatico, carteira_id, ajuste, chave_ajuste)
    VALUES (v_carteira.user_id, CASE WHEN v_diferenca > 0 THEN 'receita' ELSE 'despesa' END, 'Ajuste de saldo',
            'Correção de saldo', pg_catalog.abs(v_diferenca), v_hoje, v_carteira.nome, FALSE, v_carteira.id, TRUE, p_chave)
    RETURNING * INTO v_ajuste;
  RETURN NEXT v_ajuste;
END;
$$;

-- Tabelas novas: acesso explícito para authenticated (RLS users_own_data filtra as linhas), nada para anon.
-- Não depende dos default privileges do projeto. UPDATE em recebimentos_renda é exigido pelo SELECT ... FOR UPDATE
-- de desfazer_recebimento (RPC SECURITY INVOKER).
REVOKE ALL ON public.carteiras, public.transferencias, public.recebimentos_renda FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.carteiras, public.transferencias, public.recebimentos_renda TO authenticated;

REVOKE EXECUTE ON FUNCTION public.corrigir_saldo(UUID, NUMERIC, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.corrigir_saldo(UUID, NUMERIC, UUID) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.receber_renda(UUID, TEXT, DATE, UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.desfazer_recebimento(UUID, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.pagar_conta_v2(UUID, TEXT, DATE, TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.receber_renda(UUID, TEXT, DATE, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.desfazer_recebimento(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pagar_conta_v2(UUID, TEXT, DATE, TEXT, UUID) TO authenticated;

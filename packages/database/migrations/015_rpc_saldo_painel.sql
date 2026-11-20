-- 015: agregação de saldos, sem transportar o histórico para o cliente.
CREATE INDEX IF NOT EXISTS idx_transacoes_user_carteira_data ON public.transacoes(user_id, carteira_id, data);

CREATE OR REPLACE FUNCTION public.saldos_carteiras_em(p_ate DATE)
RETURNS TABLE(carteira_id UUID, saldo NUMERIC(12,2))
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Autenticação necessária' USING ERRCODE = '42501'; END IF;
  RETURN QUERY
  WITH bancos AS (
    SELECT c.*, (c.saldo_inicial_em AT TIME ZONE 'America/Sao_Paulo')::date AS dia
    FROM public.carteiras c WHERE c.user_id = auth.uid()
  ), movimentos AS (
    SELECT t.carteira_id AS id, t.data, t.created_at,
      CASE WHEN t.tipo = 'receita' THEN t.valor ELSE -t.valor END AS valor
    FROM public.transacoes t WHERE t.user_id = auth.uid() AND t.data <= p_ate
    UNION ALL
    SELECT tr.destino_id, tr.data, tr.created_at, tr.valor
    FROM public.transferencias tr WHERE tr.user_id = auth.uid() AND tr.data <= p_ate
    UNION ALL
    SELECT tr.origem_id, tr.data, tr.created_at, -tr.valor
    FROM public.transferencias tr WHERE tr.user_id = auth.uid() AND tr.data <= p_ate
  ), totais AS (
    SELECT c.id, pg_catalog.sum(m.valor) AS valor
    FROM bancos c JOIN movimentos m ON m.id = c.id
      AND (m.data > c.dia OR (m.data = c.dia AND m.created_at IS NOT NULL
        AND pg_catalog.date_trunc('milliseconds', m.created_at) > pg_catalog.date_trunc('milliseconds', c.saldo_inicial_em)))
    GROUP BY c.id
  )
  SELECT c.id, (c.saldo_inicial + coalesce(t.valor, 0))::numeric(12,2)
  FROM bancos c LEFT JOIN totais t ON t.id = c.id;
END $$;

CREATE OR REPLACE FUNCTION public.resumo_painel_saldo(p_hoje DATE)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Autenticação necessária' USING ERRCODE = '42501'; END IF;
  RETURN pg_catalog.jsonb_build_object(
    'carteiras', (SELECT coalesce(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(c) || pg_catalog.jsonb_build_object(
      'saldo', s.saldo, 'saldo_fim_mes_anterior', a.saldo) ORDER BY c.ordem, c.created_at), '[]'::jsonb)
      FROM (SELECT id, user_id, nome, tipo, saldo_inicial, saldo_inicial_em, incluir_no_total, arquivada, ordem, created_at, updated_at FROM public.carteiras WHERE user_id = auth.uid()) c
      JOIN public.saldos_carteiras_em(p_hoje) s ON s.carteira_id = c.id
      JOIN public.saldos_carteiras_em(pg_catalog.date_trunc('month', p_hoje::timestamp)::date - 1) a ON a.carteira_id = c.id
      WHERE c.user_id = auth.uid()),
    'ultima_carteira_id', (SELECT t.carteira_id FROM public.transacoes t
      JOIN public.carteiras c ON c.id = t.carteira_id AND c.user_id = auth.uid() AND NOT c.arquivada
      WHERE t.user_id = auth.uid() AND NOT t.ajuste
        AND t.data >= (SELECT pg_catalog.min((b.saldo_inicial_em AT TIME ZONE 'America/Sao_Paulo')::date)
          FROM public.carteiras b WHERE b.user_id = auth.uid())
      -- Igual ao sort estável do JS antigo sobre a leitura em (data, id): created_at desc, nulos por último, empate na ordem (data, id).
      ORDER BY t.created_at DESC NULLS LAST, t.data ASC, t.id ASC LIMIT 1)
  );
END $$;
REVOKE ALL ON FUNCTION public.saldos_carteiras_em(DATE), public.resumo_painel_saldo(DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.saldos_carteiras_em(DATE), public.resumo_painel_saldo(DATE) TO authenticated;

-- 013: lembretes proativos no WhatsApp (ligados com segurança). Só aditiva e idempotente.
-- Só para quem tem conta ligada, já escreveu para o bot (ultima_msg_em) e não pediu "parar lembretes".
-- whatsapp_contatos: lembretes_ativos (opt-in padrão no onboarding), lembrete_hora (preferida; NULL = inferir), ultima_msg_em.
-- private.whatsapp_envios: log de cada envio proativo (reserva idempotente por chave; teto de 2 por dia no banco).
-- whatsapp_lembretes_candidatos()  servidor: dados para escolher lembretes (plano de treino, registros do dia, contas a vencer).
-- whatsapp_lembrete_reservar()/status()  servidor: reserva antes de enviar e marca enviado/falhou.
-- whatsapp_lembretes_config()  servidor: "parar lembretes", "voltar lembretes", "lembretes às 19h".

ALTER TABLE public.whatsapp_contatos ADD COLUMN IF NOT EXISTS lembretes_ativos BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE public.whatsapp_contatos ADD COLUMN IF NOT EXISTS lembrete_hora SMALLINT;
ALTER TABLE public.whatsapp_contatos ADD COLUMN IF NOT EXISTS ultima_msg_em TIMESTAMPTZ;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conname = 'whatsapp_contatos_lembrete_hora_check') THEN
    ALTER TABLE public.whatsapp_contatos ADD CONSTRAINT whatsapp_contatos_lembrete_hora_check CHECK (lembrete_hora BETWEEN 8 AND 21);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS private.whatsapp_envios (
  id          BIGSERIAL PRIMARY KEY,
  telefone    TEXT NOT NULL,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo        TEXT NOT NULL CHECK (tipo IN ('treino', 'parabens', 'checkin', 'conta', 'refeicao')),
  chave       TEXT NOT NULL CHECK (char_length(chave) <= 120),
  dia         DATE NOT NULL,
  status      TEXT NOT NULL DEFAULT 'reservado' CHECK (status IN ('reservado', 'enviado', 'falhou')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (telefone, chave)
);
CREATE INDEX IF NOT EXISTS idx_whatsapp_envios_tel_dia ON private.whatsapp_envios (telefone, dia);
REVOKE ALL ON private.whatsapp_envios FROM PUBLIC, anon, authenticated;

-- ── Servidor: candidatos a lembrete ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.whatsapp_lembretes_candidatos(p_segredo TEXT, p_agora TIMESTAMPTZ DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_agora TIMESTAMPTZ := COALESCE(p_agora, NOW());
  v_hoje DATE := (COALESCE(p_agora, NOW()) AT TIME ZONE 'America/Sao_Paulo')::DATE;
  v JSONB;
BEGIN
  IF NOT private.whatsapp_segredo_ok(p_segredo) THEN RETURN jsonb_build_object('ok', false, 'erro', 'nao_autorizado'); END IF;
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'telefone', c.telefone,
    'nome', COALESCE(NULLIF(p.nome, ''), c.nome),
    'objetivo', c.objetivo, 'metas', pg_catalog.to_jsonb(c.metas), 'fatos', pg_catalog.to_jsonb(c.fatos),
    'estilo_tamanho', c.estilo_tamanho, 'estilo_emoji', c.estilo_emoji, 'lembrete_hora', c.lembrete_hora,
    'hora_inferida', (SELECT h FROM (
        SELECT EXTRACT(HOUR FROM r.created_at AT TIME ZONE 'America/Sao_Paulo')::INT AS h, COUNT(*) AS n
          FROM public.registros_treino r WHERE r.user_id = c.user_id AND r.created_at >= v_agora - INTERVAL '30 days'
         GROUP BY 1 HAVING COUNT(*) >= 3 ORDER BY 2 DESC, 1 LIMIT 1) m),
    'envios_hoje', (SELECT COUNT(*) FROM private.whatsapp_envios e WHERE e.telefone = c.telefone AND e.dia = v_hoje AND e.status <> 'falhou'),
    'envios_total', (SELECT COUNT(*) FROM private.whatsapp_envios e WHERE e.telefone = c.telefone AND e.status = 'enviado'),
    'envios_sem_resposta', (SELECT COUNT(*) FROM private.whatsapp_envios e WHERE e.telefone = c.telefone AND e.status = 'enviado' AND e.created_at > c.ultima_msg_em),
    'chaves_7d', COALESCE((SELECT jsonb_agg(e.chave) FROM private.whatsapp_envios e WHERE e.telefone = c.telefone AND e.dia > v_hoje - 7 AND e.status <> 'falhou'), '[]'::jsonb),
    -- `horario` vem da 008 (pode não existir ainda): lido via to_jsonb para funcionar com ou sem a coluna.
    'treino_hoje', (SELECT jsonb_build_object('nome', t.nome, 'hora', EXTRACT(HOUR FROM (pg_catalog.to_jsonb(t)->>'horario')::TIME)::INT)
        FROM public.treinos t WHERE t.user_id = c.user_id AND COALESCE(t.ativo, TRUE) AND t.dia_semana = EXTRACT(DOW FROM v_hoje)::INT
        ORDER BY (pg_catalog.to_jsonb(t)->>'horario') NULLS LAST, t.created_at LIMIT 1),
    'treinou_hoje', EXISTS (SELECT 1 FROM public.registros_treino r WHERE r.user_id = c.user_id AND r.data = v_hoje)
                 OR EXISTS (SELECT 1 FROM public.sessoes_treino s WHERE s.user_id = c.user_id AND s.concluida
                              AND (s.inicio AT TIME ZONE 'America/Sao_Paulo')::DATE = v_hoje),
    'gastos_hoje', (SELECT COUNT(*) FROM public.transacoes t WHERE t.user_id = c.user_id AND t.tipo = 'despesa' AND t.data = v_hoje),
    'refeicoes_hoje', (SELECT COUNT(*) FROM public.registros_refeicao r WHERE r.user_id = c.user_id AND r.data = v_hoje),
    'contas', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', x.id, 'descricao', x.descricao, 'valor', x.valor, 'vence', x.vence) ORDER BY x.vence)
        FROM (
          SELECT DISTINCT ON (k.id) k.id, k.descricao, k.valor, d.dia::DATE AS vence
            FROM public.contas_pagar k
            CROSS JOIN pg_catalog.generate_series(v_hoje, v_hoje + 2, INTERVAL '1 day') d(dia)
           WHERE k.user_id = c.user_id AND k.ativo
             AND CASE k.recorrencia
                   WHEN 'unica' THEN k.data_vencimento = d.dia::DATE
                   ELSE (k.recorrencia = 'mensal' OR k.mes_vencimento = EXTRACT(MONTH FROM d.dia)::INT)
                        AND LEAST(k.dia_vencimento, EXTRACT(DAY FROM (pg_catalog.date_trunc('month', d.dia) + INTERVAL '1 month - 1 day'))::INT)
                            = EXTRACT(DAY FROM d.dia)::INT
                 END
             AND NOT EXISTS (SELECT 1 FROM public.pagamentos_conta pc WHERE pc.conta_id = k.id AND pc.competencia = pg_catalog.to_char(d.dia, 'YYYY-MM'))
           ORDER BY k.id, d.dia) x), '[]'::jsonb)
  )), '[]'::jsonb) INTO v
  FROM public.whatsapp_contatos c
  JOIN public.profiles p ON p.id = c.user_id AND p.whatsapp IN (c.telefone, private.whatsapp_variante(c.telefone))
  WHERE c.user_id IS NOT NULL AND c.etapa = 'concluido' AND c.lembretes_ativos
    AND c.ultima_msg_em IS NOT NULL AND c.ultima_msg_em >= v_agora - INTERVAL '14 days';
  RETURN jsonb_build_object('ok', true, 'hoje', v_hoje, 'candidatos', v);
END $$;

-- ── Servidor: reservar (antes de enviar) e marcar o resultado ────────────────
-- Recusa: chave repetida (mesmo lembrete), 2 envios no dia, número sem conta/sem opt-in, ou quem não escreveu em 14 dias.
CREATE OR REPLACE FUNCTION public.whatsapp_lembrete_reservar(p_segredo TEXT, p_telefone TEXT, p_tipo TEXT, p_chave TEXT, p_agora TIMESTAMPTZ DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_hoje DATE := (COALESCE(p_agora, NOW()) AT TIME ZONE 'America/Sao_Paulo')::DATE;
  c public.whatsapp_contatos;
  v_id BIGINT;
BEGIN
  IF NOT private.whatsapp_segredo_ok(p_segredo) THEN RETURN jsonb_build_object('ok', false, 'erro', 'nao_autorizado'); END IF;
  SELECT * INTO c FROM public.whatsapp_contatos WHERE telefone = p_telefone FOR UPDATE;
  IF c.user_id IS NULL OR NOT c.lembretes_ativos OR c.ultima_msg_em IS NULL OR c.ultima_msg_em < NOW() - INTERVAL '14 days' THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'sem_permissao');
  END IF;
  IF (SELECT COUNT(*) FROM private.whatsapp_envios e WHERE e.telefone = p_telefone AND e.dia = v_hoje AND e.status <> 'falhou') >= 2 THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'limite_dia');
  END IF;
  DELETE FROM private.whatsapp_envios WHERE created_at < NOW() - INTERVAL '60 days';
  INSERT INTO private.whatsapp_envios (telefone, user_id, tipo, chave, dia) VALUES (p_telefone, c.user_id, p_tipo, p_chave, v_hoje)
  ON CONFLICT (telefone, chave) DO NOTHING RETURNING id INTO v_id;
  IF v_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'erro', 'repetido'); END IF;
  RETURN jsonb_build_object('ok', true, 'id', v_id);
EXCEPTION WHEN check_violation THEN
  RETURN jsonb_build_object('ok', false, 'erro', 'dados_invalidos');
END $$;

CREATE OR REPLACE FUNCTION public.whatsapp_lembrete_status(p_segredo TEXT, p_id BIGINT, p_status TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT private.whatsapp_segredo_ok(p_segredo) THEN RETURN jsonb_build_object('ok', false, 'erro', 'nao_autorizado'); END IF;
  IF p_status NOT IN ('enviado', 'falhou') THEN RETURN jsonb_build_object('ok', false, 'erro', 'dados_invalidos'); END IF;
  UPDATE private.whatsapp_envios SET status = p_status WHERE id = p_id AND status = 'reservado';
  RETURN jsonb_build_object('ok', FOUND);
END $$;

-- ── Servidor: preferências de lembrete pelo chat ────────────────────────────
CREATE OR REPLACE FUNCTION public.whatsapp_lembretes_config(p_segredo TEXT, p_telefone TEXT, p_ativos BOOLEAN, p_hora INTEGER DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE c public.whatsapp_contatos;
BEGIN
  IF NOT private.whatsapp_segredo_ok(p_segredo) THEN RETURN jsonb_build_object('ok', false, 'erro', 'nao_autorizado'); END IF;
  IF p_hora IS NOT NULL AND (p_hora < 8 OR p_hora > 21) THEN RETURN jsonb_build_object('ok', false, 'erro', 'hora_invalida'); END IF;
  UPDATE public.whatsapp_contatos SET
    lembretes_ativos = COALESCE(p_ativos, lembretes_ativos),
    lembrete_hora = COALESCE(p_hora, lembrete_hora),
    updated_at = NOW()
  WHERE telefone = p_telefone AND user_id IS NOT NULL RETURNING * INTO c;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'erro', 'numero_sem_conta'); END IF;
  RETURN jsonb_build_object('ok', true, 'lembretes_ativos', c.lembretes_ativos, 'lembrete_hora', c.lembrete_hora);
END $$;

-- ── whatsapp_contato: marca a última mensagem recebida e devolve as preferências ──
CREATE OR REPLACE FUNCTION public.whatsapp_contato(p_segredo TEXT, p_telefone TEXT, p_limite INTEGER)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_hoje DATE := (NOW() AT TIME ZONE 'America/Sao_Paulo')::DATE;
  v_user UUID;
  v_nome TEXT;
  c public.whatsapp_contatos;
BEGIN
  IF NOT private.whatsapp_segredo_ok(p_segredo) THEN RETURN jsonb_build_object('ok', false, 'erro', 'nao_autorizado'); END IF;
  IF p_telefone IS NULL OR p_telefone !~ '^[0-9]{10,15}$' THEN RETURN jsonb_build_object('ok', false, 'erro', 'telefone_invalido'); END IF;

  SELECT id, nome INTO v_user, v_nome FROM public.profiles
   WHERE whatsapp IN (p_telefone, private.whatsapp_variante(p_telefone)) ORDER BY (whatsapp = p_telefone) DESC LIMIT 1;

  INSERT INTO public.whatsapp_contatos (telefone) VALUES (p_telefone) ON CONFLICT (telefone) DO NOTHING;
  UPDATE public.whatsapp_contatos SET
    msgs_hoje = CASE WHEN msgs_dia IS DISTINCT FROM v_hoje THEN 1 ELSE msgs_hoje + 1 END,
    msgs_dia = v_hoje,
    -- Conta ligada (pelo link ou por Configurações → Seu WhatsApp) encerra o onboarding; desligada, recomeça.
    user_id = CASE WHEN v_user IS NOT NULL THEN v_user WHEN etapa = 'concluido' THEN NULL ELSE user_id END,
    etapa = CASE WHEN v_user IS NOT NULL THEN 'concluido' WHEN etapa = 'concluido' THEN 'inicio' ELSE etapa END,
    ultima_msg_em = NOW(),
    updated_at = NOW()
  WHERE telefone = p_telefone
  RETURNING * INTO c;

  RETURN jsonb_build_object(
    'ok', true, 'vinculado', v_user IS NOT NULL, 'etapa', c.etapa, 'tentativas', c.tentativas,
    'nome', COALESCE(NULLIF(v_nome, ''), c.nome), 'objetivo', c.objetivo, 'metas', pg_catalog.to_jsonb(c.metas),
    'estilo_tamanho', c.estilo_tamanho, 'estilo_emoji', c.estilo_emoji,
    'fatos', pg_catalog.to_jsonb(c.fatos), 'lembretes_ativos', c.lembretes_ativos, 'lembrete_hora', c.lembrete_hora,
    'msgs_hoje', c.msgs_hoje, 'limite_excedido', c.msgs_hoje > GREATEST(COALESCE(p_limite, 30), 1));
END $$;

REVOKE ALL ON FUNCTION public.whatsapp_lembretes_candidatos(TEXT, TIMESTAMPTZ), public.whatsapp_lembrete_reservar(TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ),
  public.whatsapp_lembrete_status(TEXT, BIGINT, TEXT), public.whatsapp_lembretes_config(TEXT, TEXT, BOOLEAN, INTEGER),
  public.whatsapp_contato(TEXT, TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.whatsapp_lembretes_candidatos(TEXT, TIMESTAMPTZ), public.whatsapp_lembrete_reservar(TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ),
  public.whatsapp_lembrete_status(TEXT, BIGINT, TEXT), public.whatsapp_lembretes_config(TEXT, TEXT, BOOLEAN, INTEGER),
  public.whatsapp_contato(TEXT, TEXT, INTEGER) TO anon;

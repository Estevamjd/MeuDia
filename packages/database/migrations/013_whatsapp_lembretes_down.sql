-- Desfaz a 013: volta o whatsapp_contato da 012 e apaga o log de envios.
DROP FUNCTION IF EXISTS public.whatsapp_lembretes_candidatos(TEXT, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS public.whatsapp_lembrete_reservar(TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS public.whatsapp_lembrete_status(TEXT, BIGINT, TEXT);
DROP FUNCTION IF EXISTS public.whatsapp_lembretes_config(TEXT, TEXT, BOOLEAN, INTEGER);
DROP TABLE IF EXISTS private.whatsapp_envios;

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
    updated_at = NOW()
  WHERE telefone = p_telefone
  RETURNING * INTO c;

  RETURN jsonb_build_object(
    'ok', true, 'vinculado', v_user IS NOT NULL, 'etapa', c.etapa, 'tentativas', c.tentativas,
    'nome', COALESCE(NULLIF(v_nome, ''), c.nome), 'objetivo', c.objetivo, 'metas', pg_catalog.to_jsonb(c.metas),
    'estilo_tamanho', c.estilo_tamanho, 'estilo_emoji', c.estilo_emoji,
    'fatos', pg_catalog.to_jsonb(c.fatos),
    'msgs_hoje', c.msgs_hoje, 'limite_excedido', c.msgs_hoje > GREATEST(COALESCE(p_limite, 30), 1));
END $$;

ALTER TABLE public.whatsapp_contatos DROP CONSTRAINT IF EXISTS whatsapp_contatos_lembrete_hora_check;
ALTER TABLE public.whatsapp_contatos DROP COLUMN IF EXISTS lembretes_ativos;
ALTER TABLE public.whatsapp_contatos DROP COLUMN IF EXISTS lembrete_hora;
ALTER TABLE public.whatsapp_contatos DROP COLUMN IF EXISTS ultima_msg_em;
REVOKE ALL ON FUNCTION public.whatsapp_contato(TEXT, TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.whatsapp_contato(TEXT, TEXT, INTEGER) TO anon;

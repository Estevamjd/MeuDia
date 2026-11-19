-- Roteiro para banco local DESCARTÁVEL como superusuário (ver tests/supabase_stub.sql); nunca no Supabase.
-- Dados fictícios; tudo some no ROLLBACK.
\set ON_ERROR_STOP on
BEGIN;
\ir ../migrations/000_baseline.sql
\ir ../migrations/005_financas.sql
\ir ../migrations/006_carteiras.sql
\ir ../migrations/007_excluir_metas.sql
\ir ../migrations/008_saude_treino.sql
\ir ../migrations/009_origem_lancamento.sql
\ir ../migrations/010_treino_dieta_whatsapp.sql
\ir ../migrations/011_whatsapp_onboarding.sql
\ir ../migrations/012_whatsapp_amigo.sql
\ir ../migrations/013_whatsapp_lembretes.sql
\ir ../migrations/013_whatsapp_lembretes.sql

DO $$
DECLARE
  u UUID := '00000000-0000-0000-0000-000000013a01';
  calado UUID := '00000000-0000-0000-0000-000000013a02';
  agora TIMESTAMPTZ := '2026-11-23 15:00:00-03'; -- segunda-feira, 15h em SP
  hoje DATE := '2026-11-23';
  r JSONB;
  cand JSONB;
  tel TEXT := '5511955554444';
BEGIN
  INSERT INTO auth.users (id) VALUES (u), (calado);
  INSERT INTO public.profiles (id) VALUES (u), (calado) ON CONFLICT (id) DO NOTHING;
  UPDATE public.profiles SET nome = 'Lia Teste', whatsapp = tel WHERE id = u;
  UPDATE public.profiles SET whatsapp = '5511955553333' WHERE id = calado;
  INSERT INTO private.integracoes (nome, segredo_sha256) VALUES ('whatsapp', encode(sha256(convert_to('segredo-teste', 'UTF8')), 'hex'));

  -- whatsapp_contato marca a última mensagem e devolve as preferências (opt-in padrão).
  r := public.whatsapp_contato('segredo-teste', tel, 30);
  IF NOT (r->>'lembretes_ativos')::boolean OR r->'lembrete_hora' <> 'null'::jsonb THEN RAISE EXCEPTION '013: contato: %', r; END IF;
  IF (SELECT ultima_msg_em FROM public.whatsapp_contatos WHERE telefone = tel) IS NULL THEN RAISE EXCEPTION '013: ultima_msg_em'; END IF;
  UPDATE public.whatsapp_contatos SET ultima_msg_em = NOW() - INTERVAL '1 hour' WHERE telefone = tel; -- escreveu antes dos envios
  -- O outro número tem conta mas nunca escreveu: não é candidato.
  INSERT INTO public.whatsapp_contatos (telefone, user_id, etapa) VALUES ('5511955553333', calado, 'concluido');

  -- Plano: segunda (dow 1) = Perna às 19h. Conta mensal dia 24 (amanhã) não paga; outra dia 24 já paga; outra dia 28 (fora da janela).
  INSERT INTO public.treinos (user_id, nome, dia_semana, horario) VALUES (u, 'Perna', 1, '19:00'), (u, 'Peito', 2, NULL);
  INSERT INTO public.contas_pagar (user_id, descricao, valor, recorrencia, dia_vencimento) VALUES (u, 'Luz', 120, 'mensal', 24), (u, 'Internet', 99, 'mensal', 28);
  INSERT INTO public.contas_pagar (user_id, descricao, valor, recorrencia, dia_vencimento) VALUES (u, 'Água', 80, 'mensal', 24);
  INSERT INTO public.pagamentos_conta (conta_id, user_id, competencia, pago_em)
    SELECT id, u, '2026-11', hoje FROM public.contas_pagar WHERE descricao = 'Água';
  INSERT INTO public.contas_pagar (user_id, descricao, valor, recorrencia, data_vencimento) VALUES (u, 'IPVA', 900, 'unica', hoje + 2);

  r := public.whatsapp_lembretes_candidatos('errado', agora);
  IF r->>'erro' <> 'nao_autorizado' THEN RAISE EXCEPTION '013: segredo errado: %', r; END IF;
  r := public.whatsapp_lembretes_candidatos('segredo-teste', agora);
  IF jsonb_array_length(r->'candidatos') <> 1 THEN RAISE EXCEPTION '013: candidatos: %', r; END IF;
  cand := r->'candidatos'->0;
  IF cand->>'telefone' <> tel OR cand->>'nome' <> 'Lia Teste' OR cand->'treino_hoje'->>'nome' <> 'Perna' OR (cand->'treino_hoje'->>'hora')::int <> 19
     OR (cand->>'treinou_hoje')::boolean OR (cand->>'gastos_hoje')::int <> 0 OR (cand->>'envios_hoje')::int <> 0 THEN
    RAISE EXCEPTION '013: candidato: %', cand;
  END IF;
  IF jsonb_array_length(cand->'contas') <> 2 OR cand->'contas'->0->>'descricao' <> 'Luz' OR cand->'contas'->0->>'vence' <> '2026-11-24'
     OR cand->'contas'->1->>'descricao' <> 'IPVA' THEN RAISE EXCEPTION '013: contas: %', cand->'contas'; END IF;

  -- Registrou treino e gasto hoje: aparece.
  INSERT INTO public.registros_treino (user_id, data, descricao) VALUES (u, hoje, 'Perna');
  INSERT INTO public.transacoes (user_id, tipo, categoria, descricao, valor, data) VALUES (u, 'despesa', 'Comida', 'Lanche', 20, hoje);
  cand := public.whatsapp_lembretes_candidatos('segredo-teste', agora)->'candidatos'->0;
  IF NOT (cand->>'treinou_hoje')::boolean OR (cand->>'gastos_hoje')::int <> 1 THEN RAISE EXCEPTION '013: registros do dia: %', cand; END IF;

  -- Reserva: idempotente por chave, teto de 2 por dia, falhou não conta.
  r := public.whatsapp_lembrete_reservar('segredo-teste', tel, 'conta', 'conta:x:2026-11-24', agora);
  IF NOT (r->>'ok')::boolean THEN RAISE EXCEPTION '013: reservar: %', r; END IF;
  PERFORM public.whatsapp_lembrete_status('segredo-teste', (r->>'id')::bigint, 'enviado');
  r := public.whatsapp_lembrete_reservar('segredo-teste', tel, 'conta', 'conta:x:2026-11-24', agora);
  IF r->>'erro' <> 'repetido' THEN RAISE EXCEPTION '013: repetido: %', r; END IF;
  r := public.whatsapp_lembrete_reservar('segredo-teste', tel, 'treino', 'treino:2026-11-23', agora);
  PERFORM public.whatsapp_lembrete_status('segredo-teste', (r->>'id')::bigint, 'falhou');
  r := public.whatsapp_lembrete_reservar('segredo-teste', tel, 'checkin', 'checkin:2026-11-23', agora);
  IF NOT (r->>'ok')::boolean THEN RAISE EXCEPTION '013: falhou contou no teto: %', r; END IF;
  r := public.whatsapp_lembrete_reservar('segredo-teste', tel, 'refeicao', 'refeicao:2026-11-23', agora);
  IF r->>'erro' <> 'limite_dia' THEN RAISE EXCEPTION '013: teto de 2: %', r; END IF;
  r := public.whatsapp_lembrete_reservar('segredo-teste', tel, 'spam', 'spam:1', agora);
  IF r->>'erro' NOT IN ('limite_dia', 'dados_invalidos') THEN RAISE EXCEPTION '013: tipo inválido: %', r; END IF;
  cand := public.whatsapp_lembretes_candidatos('segredo-teste', agora)->'candidatos'->0;
  IF (cand->>'envios_hoje')::int <> 2 OR NOT (cand->'chaves_7d' ? 'conta:x:2026-11-24') OR (cand->>'envios_sem_resposta')::int < 1 THEN
    RAISE EXCEPTION '013: contadores: %', cand;
  END IF;
  r := public.whatsapp_lembrete_reservar('segredo-teste', '5511955553333', 'treino', 'treino:2026-11-23', agora);
  IF r->>'erro' <> 'sem_permissao' THEN RAISE EXCEPTION '013: quem nunca escreveu: %', r; END IF;

  -- Responder zera "sem resposta"; "parar lembretes" tira da lista; hora preferida validada.
  PERFORM public.whatsapp_contato('segredo-teste', tel, 30);
  cand := public.whatsapp_lembretes_candidatos('segredo-teste', NOW())->'candidatos'->0;
  IF (cand->>'envios_sem_resposta')::int <> 0 THEN RAISE EXCEPTION '013: sem resposta não zerou: %', cand; END IF;
  r := public.whatsapp_lembretes_config('segredo-teste', tel, NULL, 23);
  IF r->>'erro' <> 'hora_invalida' THEN RAISE EXCEPTION '013: hora 23: %', r; END IF;
  r := public.whatsapp_lembretes_config('segredo-teste', tel, NULL, 19);
  IF (r->>'lembrete_hora')::int <> 19 OR NOT (r->>'lembretes_ativos')::boolean THEN RAISE EXCEPTION '013: hora: %', r; END IF;
  r := public.whatsapp_lembretes_config('segredo-teste', tel, FALSE);
  IF jsonb_array_length(public.whatsapp_lembretes_candidatos('segredo-teste', agora)->'candidatos') <> 0 THEN RAISE EXCEPTION '013: parar não tirou'; END IF;
  r := public.whatsapp_lembrete_reservar('segredo-teste', tel, 'treino', 'treino:outro', NOW());
  IF r->>'erro' <> 'sem_permissao' THEN RAISE EXCEPTION '013: reservou com lembretes parados: %', r; END IF;
  r := public.whatsapp_lembretes_config('segredo-teste', tel, TRUE);
  IF jsonb_array_length(public.whatsapp_lembretes_candidatos('segredo-teste', agora)->'candidatos') <> 1 THEN RAISE EXCEPTION '013: voltar não voltou'; END IF;

  -- Silêncio de 14+ dias: sai da lista.
  UPDATE public.whatsapp_contatos SET ultima_msg_em = NOW() - INTERVAL '15 days' WHERE telefone = tel;
  IF jsonb_array_length(public.whatsapp_lembretes_candidatos('segredo-teste', NOW())->'candidatos') <> 0 THEN RAISE EXCEPTION '013: 14 dias'; END IF;

  -- Excluir a conta apaga o log.
  DELETE FROM auth.users WHERE id = u;
  IF EXISTS (SELECT 1 FROM private.whatsapp_envios) THEN RAISE EXCEPTION '013: log sobreviveu à exclusão'; END IF;
END $$;

SET LOCAL ROLE anon;
DO $$
BEGIN
  PERFORM 1 FROM private.whatsapp_envios;
  RAISE EXCEPTION '013: anon leu envios';
EXCEPTION WHEN insufficient_privilege THEN NULL;
END $$;
RESET ROLE;

\ir ../migrations/013_whatsapp_lembretes_down.sql
\ir ../migrations/013_whatsapp_lembretes_down.sql
DO $$ BEGIN
  IF public.whatsapp_contato('segredo-teste', '5511900001111', 30) ? 'lembretes_ativos' THEN RAISE EXCEPTION '013: down'; END IF;
END $$;
\ir ../migrations/013_whatsapp_lembretes.sql
ROLLBACK;

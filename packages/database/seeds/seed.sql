-- ============================================================================
-- Seed: Dados de desenvolvimento realistas
-- ============================================================================
-- ⚠️ Executar APENAS em ambiente de desenvolvimento
-- ⚠️ Requer um usuário já criado via Supabase Auth
-- ⚠️ Substituir USER_ID pelo UUID real do usuário de teste
-- ============================================================================

-- Variável para facilitar (substituir pelo UUID real)
-- No Supabase SQL Editor, use: SET my.user_id = 'seu-uuid-aqui';

DO $$
DECLARE
  v_user_id UUID;
  v_treino_peito UUID;
  v_treino_costas UUID;
  v_treino_pernas UUID;
  v_treino_ombros UUID;
  v_treino_bracos UUID;
  v_sessao_id UUID;
  v_ex_supino UUID;
  v_ex_crucifixo UUID;
  v_ex_agachamento UUID;
  v_habito_agua UUID;
  v_habito_leitura UUID;
  v_habito_meditacao UUID;
  v_habito_caminhada UUID;
  v_habito_vitamina UUID;
BEGIN

  -- Pegar o primeiro usuário existente (para dev)
  SELECT id INTO v_user_id FROM profiles LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE NOTICE 'Nenhum usuário encontrado. Crie um usuário via Supabase Auth primeiro.';
    RETURN;
  END IF;

  -- ══ ATUALIZAR PROFILE ══
  UPDATE profiles SET
    nome = 'João Silva',
    peso_atual = 82.5,
    altura = 1.78,
    meta_peso = 78.0,
    meta_calorias = 2200,
    meta_agua = 8,
    objetivo = 'saude_geral',
    onboarding_feito = TRUE
  WHERE id = v_user_id;

  -- ══ TREINOS (5x/semana — musculação para saúde geral) ══

  -- Segunda — Peito + Tríceps
  INSERT INTO treinos (id, user_id, nome, dia_semana, tipo, ordem)
  VALUES (gen_random_uuid(), v_user_id, 'Peito + Tríceps', 1, 'musculacao', 0)
  RETURNING id INTO v_treino_peito;

  INSERT INTO exercicios (treino_id, nome, series, repeticoes, carga, tempo_descanso, ordem) VALUES
    (v_treino_peito, 'Supino reto com barra', 4, '8-12', 60.0, 90, 0),
    (v_treino_peito, 'Supino inclinado com halteres', 3, '10-12', 22.0, 75, 1),
    (v_treino_peito, 'Crucifixo na máquina', 3, '12-15', 40.0, 60, 2),
    (v_treino_peito, 'Tríceps corda na polia', 3, '12-15', 25.0, 60, 3),
    (v_treino_peito, 'Tríceps francês com halter', 3, '10-12', 14.0, 60, 4),
    (v_treino_peito, 'Mergulho no banco', 3, '12-15', NULL, 60, 5);

  -- Terça — Costas + Bíceps
  INSERT INTO treinos (id, user_id, nome, dia_semana, tipo, ordem)
  VALUES (gen_random_uuid(), v_user_id, 'Costas + Bíceps', 2, 'musculacao', 1)
  RETURNING id INTO v_treino_costas;

  INSERT INTO exercicios (treino_id, nome, series, repeticoes, carga, tempo_descanso, ordem) VALUES
    (v_treino_costas, 'Puxada frontal', 4, '8-12', 55.0, 90, 0),
    (v_treino_costas, 'Remada curvada com barra', 4, '8-12', 50.0, 90, 1),
    (v_treino_costas, 'Remada unilateral com halter', 3, '10-12', 24.0, 75, 2),
    (v_treino_costas, 'Pullover na polia', 3, '12-15', 30.0, 60, 3),
    (v_treino_costas, 'Rosca direta com barra', 3, '10-12', 25.0, 60, 4),
    (v_treino_costas, 'Rosca martelo', 3, '12-15', 12.0, 60, 5);

  -- Quarta — Pernas
  INSERT INTO treinos (id, user_id, nome, dia_semana, tipo, ordem)
  VALUES (gen_random_uuid(), v_user_id, 'Pernas', 3, 'musculacao', 2)
  RETURNING id INTO v_treino_pernas;

  INSERT INTO exercicios (treino_id, nome, series, repeticoes, carga, tempo_descanso, ordem) VALUES
    (v_treino_pernas, 'Agachamento livre', 4, '8-10', 80.0, 120, 0),
    (v_treino_pernas, 'Leg press 45°', 4, '10-12', 180.0, 90, 1),
    (v_treino_pernas, 'Cadeira extensora', 3, '12-15', 45.0, 60, 2),
    (v_treino_pernas, 'Mesa flexora', 3, '12-15', 35.0, 60, 3),
    (v_treino_pernas, 'Panturrilha no smith', 4, '15-20', 60.0, 45, 4),
    (v_treino_pernas, 'Afundo com halteres', 3, '10-12', 14.0, 75, 5);

  -- Quinta — Ombros + Trapézio
  INSERT INTO treinos (id, user_id, nome, dia_semana, tipo, ordem)
  VALUES (gen_random_uuid(), v_user_id, 'Ombros + Trapézio', 4, 'musculacao', 3)
  RETURNING id INTO v_treino_ombros;

  INSERT INTO exercicios (treino_id, nome, series, repeticoes, carga, tempo_descanso, ordem) VALUES
    (v_treino_ombros, 'Desenvolvimento com halteres', 4, '8-12', 18.0, 90, 0),
    (v_treino_ombros, 'Elevação lateral', 4, '12-15', 10.0, 60, 1),
    (v_treino_ombros, 'Elevação frontal alternada', 3, '12-15', 10.0, 60, 2),
    (v_treino_ombros, 'Face pull na polia', 3, '15-20', 20.0, 60, 3),
    (v_treino_ombros, 'Encolhimento com halteres', 4, '12-15', 22.0, 60, 4);

  -- Sexta — Braços (bi + tri) + Abdômen
  INSERT INTO treinos (id, user_id, nome, dia_semana, tipo, ordem)
  VALUES (gen_random_uuid(), v_user_id, 'Braços + Abdômen', 5, 'musculacao', 4)
  RETURNING id INTO v_treino_bracos;

  INSERT INTO exercicios (treino_id, nome, series, repeticoes, carga, tempo_descanso, ordem) VALUES
    (v_treino_bracos, 'Rosca Scott na máquina', 3, '10-12', 20.0, 60, 0),
    (v_treino_bracos, 'Rosca concentrada', 3, '12-15', 10.0, 60, 1),
    (v_treino_bracos, 'Tríceps testa com barra W', 3, '10-12', 20.0, 60, 2),
    (v_treino_bracos, 'Tríceps kickback', 3, '12-15', 8.0, 60, 3),
    (v_treino_bracos, 'Abdominal na máquina', 3, '15-20', 30.0, 45, 4),
    (v_treino_bracos, 'Prancha', 3, '45s', NULL, 30, 5);

  -- Sábado e Domingo — Descanso
  INSERT INTO treinos (user_id, nome, dia_semana, tipo, ordem) VALUES
    (v_user_id, 'Descanso', 6, 'descanso', 5),
    (v_user_id, 'Descanso', 0, 'descanso', 6);

  -- ══ SESSÕES DE TREINO (última semana) ══

  -- Guardar ID do supino e agachamento para séries
  SELECT id INTO v_ex_supino FROM exercicios WHERE treino_id = v_treino_peito AND nome = 'Supino reto com barra';
  SELECT id INTO v_ex_crucifixo FROM exercicios WHERE treino_id = v_treino_peito AND nome = 'Crucifixo na máquina';
  SELECT id INTO v_ex_agachamento FROM exercicios WHERE treino_id = v_treino_pernas AND nome = 'Agachamento livre';

  -- Sessão de segunda passada (concluída)
  INSERT INTO sessoes_treino (id, user_id, treino_id, data, duracao_minutos, concluido)
  VALUES (gen_random_uuid(), v_user_id, v_treino_peito, CURRENT_DATE - 7, 65, TRUE)
  RETURNING id INTO v_sessao_id;

  INSERT INTO series_realizadas (sessao_id, exercicio_id, numero_serie, carga_usada, reps_feitas, concluido) VALUES
    (v_sessao_id, v_ex_supino, 1, 55.0, 12, TRUE),
    (v_sessao_id, v_ex_supino, 2, 57.5, 10, TRUE),
    (v_sessao_id, v_ex_supino, 3, 60.0, 8, TRUE),
    (v_sessao_id, v_ex_supino, 4, 60.0, 7, TRUE);

  -- Sessão de quarta passada (concluída)
  INSERT INTO sessoes_treino (id, user_id, treino_id, data, duracao_minutos, concluido)
  VALUES (gen_random_uuid(), v_user_id, v_treino_pernas, CURRENT_DATE - 5, 72, TRUE)
  RETURNING id INTO v_sessao_id;

  INSERT INTO series_realizadas (sessao_id, exercicio_id, numero_serie, carga_usada, reps_feitas, concluido) VALUES
    (v_sessao_id, v_ex_agachamento, 1, 70.0, 10, TRUE),
    (v_sessao_id, v_ex_agachamento, 2, 75.0, 9, TRUE),
    (v_sessao_id, v_ex_agachamento, 3, 80.0, 8, TRUE),
    (v_sessao_id, v_ex_agachamento, 4, 80.0, 7, TRUE);

  -- ══ HÁBITOS ══

  INSERT INTO habitos (id, user_id, nome, icone, frequencia, meta, ordem)
  VALUES (gen_random_uuid(), v_user_id, 'Beber 8 copos de água', '💧', 'diario', 8, 0)
  RETURNING id INTO v_habito_agua;

  INSERT INTO habitos (id, user_id, nome, icone, frequencia, meta, ordem)
  VALUES (gen_random_uuid(), v_user_id, 'Ler 30 minutos', '📚', 'diario', 1, 1)
  RETURNING id INTO v_habito_leitura;

  INSERT INTO habitos (id, user_id, nome, icone, frequencia, meta, ordem)
  VALUES (gen_random_uuid(), v_user_id, 'Meditar 10 minutos', '🧘', 'diario', 1, 2)
  RETURNING id INTO v_habito_meditacao;

  INSERT INTO habitos (id, user_id, nome, icone, frequencia, meta, ordem)
  VALUES (gen_random_uuid(), v_user_id, 'Caminhar 30 minutos', '🚶', 'diario', 1, 3)
  RETURNING id INTO v_habito_caminhada;

  INSERT INTO habitos (id, user_id, nome, icone, frequencia, meta, ordem)
  VALUES (gen_random_uuid(), v_user_id, 'Tomar vitaminas', '💊', 'diario', 1, 4)
  RETURNING id INTO v_habito_vitamina;

  -- ══ REGISTROS DE HÁBITOS (últimos 10 dias) ══

  -- Água — concluído nos últimos 8 de 10 dias
  FOR i IN 0..9 LOOP
    INSERT INTO registro_habitos (habito_id, user_id, data, concluido, valor)
    VALUES (
      v_habito_agua,
      v_user_id,
      CURRENT_DATE - i,
      CASE WHEN i IN (3, 7) THEN FALSE ELSE TRUE END,
      CASE WHEN i IN (3, 7) THEN 4 ELSE 8 END
    );
  END LOOP;

  -- Leitura — concluído nos últimos 6 de 10 dias
  FOR i IN 0..9 LOOP
    INSERT INTO registro_habitos (habito_id, user_id, data, concluido, valor)
    VALUES (
      v_habito_leitura,
      v_user_id,
      CURRENT_DATE - i,
      CASE WHEN i IN (1, 4, 6, 8) THEN FALSE ELSE TRUE END,
      1
    );
  END LOOP;

  -- Meditação — concluído nos últimos 7 de 10 dias
  FOR i IN 0..9 LOOP
    INSERT INTO registro_habitos (habito_id, user_id, data, concluido, valor)
    VALUES (
      v_habito_meditacao,
      v_user_id,
      CURRENT_DATE - i,
      CASE WHEN i IN (2, 5, 9) THEN FALSE ELSE TRUE END,
      1
    );
  END LOOP;

  -- Caminhada — concluído nos últimos 5 de 10 dias
  FOR i IN 0..9 LOOP
    INSERT INTO registro_habitos (habito_id, user_id, data, concluido, valor)
    VALUES (
      v_habito_caminhada,
      v_user_id,
      CURRENT_DATE - i,
      CASE WHEN i < 5 THEN TRUE ELSE FALSE END,
      1
    );
  END LOOP;

  -- Vitaminas — quase perfeito, falhou 1 dia
  FOR i IN 0..9 LOOP
    INSERT INTO registro_habitos (habito_id, user_id, data, concluido, valor)
    VALUES (
      v_habito_vitamina,
      v_user_id,
      CURRENT_DATE - i,
      CASE WHEN i = 6 THEN FALSE ELSE TRUE END,
      1
    );
  END LOOP;

  -- ══ SCORES DIÁRIOS (últimos 10 dias) ══

  INSERT INTO scores_diarios (user_id, data, score, pts_treino, pts_habitos, pts_agua, pts_calorias, pts_medicamentos) VALUES
    (v_user_id, CURRENT_DATE,     72, 30, 16, 15, 11, 0),
    (v_user_id, CURRENT_DATE - 1, 65, 0,  20, 15, 20, 10),
    (v_user_id, CURRENT_DATE - 2, 85, 30, 20, 15, 20, 0),
    (v_user_id, CURRENT_DATE - 3, 45, 0,  12, 8,  15, 10),
    (v_user_id, CURRENT_DATE - 4, 78, 30, 18, 15, 15, 0),
    (v_user_id, CURRENT_DATE - 5, 90, 30, 20, 15, 20, 5),
    (v_user_id, CURRENT_DATE - 6, 62, 0,  16, 15, 16, 15),
    (v_user_id, CURRENT_DATE - 7, 88, 30, 20, 15, 18, 5),
    (v_user_id, CURRENT_DATE - 8, 70, 30, 14, 11, 15, 0),
    (v_user_id, CURRENT_DATE - 9, 55, 0,  16, 15, 14, 10);

  -- ══ CONQUISTAS ══

  INSERT INTO conquistas (user_id, tipo, titulo, descricao, icone) VALUES
    (v_user_id, 'semana_perfeita', 'Semana Perfeita', '7 dias consecutivos com score acima de 80', '🏆'),
    (v_user_id, 'hidratado', 'Hidratado', '7 dias seguidos batendo a meta de água', '💧');

  RAISE NOTICE 'Seed concluído com sucesso para o usuário %', v_user_id;

END $$;

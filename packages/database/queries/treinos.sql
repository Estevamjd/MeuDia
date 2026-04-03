-- ============================================================================
-- Queries comuns: Módulo Treinos
-- ============================================================================

-- Listar treinos do usuário com exercícios (ordenados)
-- Usada em: treinoRepository.findByUserId
SELECT t.*,
  COALESCE(
    json_agg(
      json_build_object(
        'id', e.id,
        'nome', e.nome,
        'series', e.series,
        'repeticoes', e.repeticoes,
        'carga', e.carga,
        'tempo_descanso', e.tempo_descanso,
        'observacao', e.observacao,
        'ordem', e.ordem
      ) ORDER BY e.ordem
    ) FILTER (WHERE e.id IS NOT NULL),
    '[]'
  ) AS exercicios
FROM treinos t
LEFT JOIN exercicios e ON e.treino_id = t.id
WHERE t.user_id = :user_id
GROUP BY t.id
ORDER BY t.dia_semana, t.ordem;

-- Treino do dia com exercícios
-- Usada em: treinoRepository.findTreinoHoje
SELECT t.*,
  COALESCE(
    json_agg(
      json_build_object(
        'id', e.id,
        'nome', e.nome,
        'series', e.series,
        'repeticoes', e.repeticoes,
        'carga', e.carga,
        'tempo_descanso', e.tempo_descanso,
        'ordem', e.ordem
      ) ORDER BY e.ordem
    ) FILTER (WHERE e.id IS NOT NULL),
    '[]'
  ) AS exercicios
FROM treinos t
LEFT JOIN exercicios e ON e.treino_id = t.id
WHERE t.user_id = :user_id
  AND t.dia_semana = EXTRACT(DOW FROM CURRENT_DATE)
GROUP BY t.id
ORDER BY t.ordem
LIMIT 1;

-- Sessões da semana atual
-- Usada em: treinoRepository.findSessoesSemana
SELECT s.*, t.nome AS treino_nome
FROM sessoes_treino s
LEFT JOIN treinos t ON t.id = s.treino_id
WHERE s.user_id = :user_id
  AND s.data >= date_trunc('week', CURRENT_DATE)
  AND s.data <= date_trunc('week', CURRENT_DATE) + INTERVAL '6 days'
ORDER BY s.data;

-- Evolução de carga de um exercício (últimas 12 sessões)
-- Usada em: gráfico de evolução
SELECT
  st.data,
  MAX(sr.carga_usada) AS carga_maxima,
  AVG(sr.carga_usada) AS carga_media,
  SUM(sr.reps_feitas) AS total_reps
FROM series_realizadas sr
JOIN sessoes_treino st ON st.id = sr.sessao_id
WHERE sr.exercicio_id = :exercicio_id
  AND st.user_id = :user_id
  AND sr.concluido = TRUE
GROUP BY st.data
ORDER BY st.data DESC
LIMIT 12;

-- Stats rápidos do mês
-- Usada em: dashboard de treinos
SELECT
  COUNT(*) FILTER (WHERE concluido = TRUE) AS treinos_concluidos,
  ROUND(AVG(duracao_minutos) FILTER (WHERE concluido = TRUE)) AS duracao_media,
  COUNT(*) AS total_sessoes
FROM sessoes_treino
WHERE user_id = :user_id
  AND data >= date_trunc('month', CURRENT_DATE)
  AND data < date_trunc('month', CURRENT_DATE) + INTERVAL '1 month';

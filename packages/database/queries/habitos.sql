-- ============================================================================
-- Queries comuns: Módulo Hábitos
-- ============================================================================

-- Hábitos do usuário com registro de hoje
-- Usada em: habitoRepository.findComRegistroHoje
SELECT h.*,
  rh.concluido AS concluido_hoje,
  rh.valor AS valor_hoje
FROM habitos h
LEFT JOIN registro_habitos rh
  ON rh.habito_id = h.id
  AND rh.data = CURRENT_DATE
WHERE h.user_id = :user_id
  AND h.ativo = TRUE
ORDER BY h.ordem;

-- Streak atual de um hábito (dias consecutivos concluídos)
-- Usada em: cálculo de streak individual
WITH dias AS (
  SELECT data, concluido,
    data - ROW_NUMBER() OVER (ORDER BY data)::INTEGER AS grp
  FROM registro_habitos
  WHERE habito_id = :habito_id
    AND concluido = TRUE
  ORDER BY data DESC
)
SELECT COUNT(*) AS streak
FROM dias
WHERE grp = (SELECT grp FROM dias ORDER BY data DESC LIMIT 1);

-- Progresso semanal de todos os hábitos
-- Usada em: WeekProgress component
SELECT
  rh.data,
  COUNT(*) FILTER (WHERE rh.concluido = TRUE) AS concluidos,
  COUNT(*) AS total
FROM registro_habitos rh
JOIN habitos h ON h.id = rh.habito_id AND h.ativo = TRUE
WHERE rh.user_id = :user_id
  AND rh.data >= date_trunc('week', CURRENT_DATE)
  AND rh.data <= CURRENT_DATE
GROUP BY rh.data
ORDER BY rh.data;

-- Percentual de conclusão do dia (para gamificação)
-- Usada em: cálculo de score diário
SELECT
  COUNT(*) FILTER (WHERE rh.concluido = TRUE)::FLOAT /
  NULLIF(COUNT(*), 0) * 100 AS percentual
FROM habitos h
LEFT JOIN registro_habitos rh
  ON rh.habito_id = h.id
  AND rh.data = CURRENT_DATE
WHERE h.user_id = :user_id
  AND h.ativo = TRUE;

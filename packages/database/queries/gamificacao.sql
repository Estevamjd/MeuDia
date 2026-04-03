-- ============================================================================
-- Queries comuns: Gamificação
-- ============================================================================

-- Score de hoje
-- Usada em: dashboard
SELECT * FROM scores_diarios
WHERE user_id = :user_id
  AND data = CURRENT_DATE;

-- Streak atual (dias consecutivos com score >= 60)
WITH dias AS (
  SELECT data, score,
    data - ROW_NUMBER() OVER (ORDER BY data)::INTEGER AS grp
  FROM scores_diarios
  WHERE user_id = :user_id
    AND score >= 60
  ORDER BY data DESC
)
SELECT COUNT(*) AS streak
FROM dias
WHERE grp = (SELECT grp FROM dias ORDER BY data DESC LIMIT 1);

-- Histórico de scores (últimos 30 dias)
-- Usada em: gráfico de evolução no dashboard
SELECT data, score, pts_treino, pts_habitos, pts_agua, pts_calorias, pts_medicamentos
FROM scores_diarios
WHERE user_id = :user_id
  AND data >= CURRENT_DATE - 30
ORDER BY data;

-- Conquistas do usuário
-- Usada em: página de perfil
SELECT * FROM conquistas
WHERE user_id = :user_id
ORDER BY conquistado_em DESC;

-- Verificar se merece badge "Semana Perfeita"
-- (7 dias consecutivos com score > 80)
WITH dias AS (
  SELECT data, score,
    data - ROW_NUMBER() OVER (ORDER BY data)::INTEGER AS grp
  FROM scores_diarios
  WHERE user_id = :user_id
    AND score > 80
  ORDER BY data DESC
)
SELECT COUNT(*) >= 7 AS merece_badge
FROM dias
WHERE grp = (SELECT grp FROM dias ORDER BY data DESC LIMIT 1);

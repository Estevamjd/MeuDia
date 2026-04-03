-- ============================================================================
-- MeuDia — Migration 002 DOWN: Remover tabelas do Agente IA
-- ============================================================================

DROP TABLE IF EXISTS preferencias_agente CASCADE;
DROP TABLE IF EXISTS acoes_agente CASCADE;
DROP TABLE IF EXISTS chat_agente CASCADE;
DROP TABLE IF EXISTS notificacoes_agente CASCADE;

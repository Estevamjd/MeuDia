-- ============================================================================
-- Migration 001 DOWN: Reverter schema inicial
-- ⚠️ CUIDADO: Isso apaga TODOS os dados!
-- ============================================================================

-- Remover trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Remover tabelas (ordem reversa por dependências)
DROP TABLE IF EXISTS conquistas CASCADE;
DROP TABLE IF EXISTS scores_diarios CASCADE;
DROP TABLE IF EXISTS manutencoes CASCADE;
DROP TABLE IF EXISTS veiculos CASCADE;
DROP TABLE IF EXISTS itens_compras CASCADE;
DROP TABLE IF EXISTS listas_compras CASCADE;
DROP TABLE IF EXISTS registro_medicamentos CASCADE;
DROP TABLE IF EXISTS medicamentos CASCADE;
DROP TABLE IF EXISTS registro_agua CASCADE;
DROP TABLE IF EXISTS refeicoes CASCADE;
DROP TABLE IF EXISTS registros_peso CASCADE;
DROP TABLE IF EXISTS compromissos CASCADE;
DROP TABLE IF EXISTS assinaturas CASCADE;
DROP TABLE IF EXISTS transacoes CASCADE;
DROP TABLE IF EXISTS registro_habitos CASCADE;
DROP TABLE IF EXISTS habitos CASCADE;
DROP TABLE IF EXISTS series_realizadas CASCADE;
DROP TABLE IF EXISTS sessoes_treino CASCADE;
DROP TABLE IF EXISTS exercicios CASCADE;
DROP TABLE IF EXISTS treinos CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

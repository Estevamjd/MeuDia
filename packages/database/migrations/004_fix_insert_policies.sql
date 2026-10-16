-- Corrigir policies de INSERT adicionando WITH CHECK

-- profiles
DROP POLICY IF EXISTS "Users can insert own profiles" ON public.profiles;
CREATE POLICY "Users can insert own profiles" ON public.profiles
  FOR INSERT WITH CHECK (id = auth.uid());

-- treinos
DROP POLICY IF EXISTS "Users can insert own treinos" ON public.treinos;
CREATE POLICY "Users can insert own treinos" ON public.treinos
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- exercicios
DROP POLICY IF EXISTS "Users can insert own exercicios" ON public.exercicios;
CREATE POLICY "Users can insert own exercicios" ON public.exercicios
  FOR INSERT WITH CHECK (
    treino_id IN (SELECT id FROM treinos WHERE user_id = auth.uid())
  );

-- sessoes_treino
DROP POLICY IF EXISTS "Users can insert own sessoes_treino" ON public.sessoes_treino;
CREATE POLICY "Users can insert own sessoes_treino" ON public.sessoes_treino
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- series_realizadas
DROP POLICY IF EXISTS "Users can insert own series" ON public.series_realizadas;
CREATE POLICY "Users can insert own series" ON public.series_realizadas
  FOR INSERT WITH CHECK (
    sessao_id IN (SELECT id FROM sessoes_treino WHERE user_id = auth.uid())
  );

-- habitos
DROP POLICY IF EXISTS "Users can insert own habitos" ON public.habitos;
CREATE POLICY "Users can insert own habitos" ON public.habitos
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- registros_habito
DROP POLICY IF EXISTS "Users can insert own registros_habito" ON public.registros_habito;
CREATE POLICY "Users can insert own registros_habito" ON public.registros_habito
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- compromissos
DROP POLICY IF EXISTS "Users can insert own compromissos" ON public.compromissos;
CREATE POLICY "Users can insert own compromissos" ON public.compromissos
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- transacoes
DROP POLICY IF EXISTS "Users can insert own transacoes" ON public.transacoes;
CREATE POLICY "Users can insert own transacoes" ON public.transacoes
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- refeicoes
DROP POLICY IF EXISTS "Users can insert own refeicoes" ON public.refeicoes;
CREATE POLICY "Users can insert own refeicoes" ON public.refeicoes
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- registros_agua
DROP POLICY IF EXISTS "Users can insert own registros_agua" ON public.registros_agua;
CREATE POLICY "Users can insert own registros_agua" ON public.registros_agua
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- registros_peso
DROP POLICY IF EXISTS "Users can insert own registros_peso" ON public.registros_peso;
CREATE POLICY "Users can insert own registros_peso" ON public.registros_peso
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- medicamentos
DROP POLICY IF EXISTS "Users can insert own medicamentos" ON public.medicamentos;
CREATE POLICY "Users can insert own medicamentos" ON public.medicamentos
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- registro_medicamentos
DROP POLICY IF EXISTS "Users can insert own registro_medicamentos" ON public.registro_medicamentos;
CREATE POLICY "Users can insert own registro_medicamentos" ON public.registro_medicamentos
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- assinaturas
DROP POLICY IF EXISTS "Users can insert own assinaturas" ON public.assinaturas;
CREATE POLICY "Users can insert own assinaturas" ON public.assinaturas
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- listas_compras
DROP POLICY IF EXISTS "Users can insert own listas_compras" ON public.listas_compras;
CREATE POLICY "Users can insert own listas_compras" ON public.listas_compras
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- itens_compras
DROP POLICY IF EXISTS "Users can insert own itens_compras" ON public.itens_compras;
CREATE POLICY "Users can insert own itens_compras" ON public.itens_compras
  FOR INSERT WITH CHECK (
    lista_id IN (SELECT id FROM listas_compras WHERE user_id = auth.uid())
  );

-- veiculos
DROP POLICY IF EXISTS "Users can insert own veiculos" ON public.veiculos;
CREATE POLICY "Users can insert own veiculos" ON public.veiculos
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- manutencoes
DROP POLICY IF EXISTS "Users can insert own manutencoes" ON public.manutencoes;
CREATE POLICY "Users can insert own manutencoes" ON public.manutencoes
  FOR INSERT WITH CHECK (
    veiculo_id IN (SELECT id FROM veiculos WHERE user_id = auth.uid())
  );

-- scores_diarios
DROP POLICY IF EXISTS "Users can insert own scores_diarios" ON public.scores_diarios;
CREATE POLICY "Users can insert own scores_diarios" ON public.scores_diarios
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- conquistas
DROP POLICY IF EXISTS "Users can insert own conquistas" ON public.conquistas;
CREATE POLICY "Users can insert own conquistas" ON public.conquistas
  FOR INSERT WITH CHECK (user_id = auth.uid());

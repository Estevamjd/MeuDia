-- 008: Saúde e Treino, fase F2 (treino e lembrete de treino). Ver docs/saude-treino/PLANO-F1.md §3.1, §3.7, §4.2 e §5.2.
-- Depende de 000_baseline.sql (+ 005/006/007 se já aplicadas; não mexe nelas); PostgreSQL 15+.
-- Aditiva e idempotente: só ADD COLUMN (NULL ou DEFAULT constante, sem reescrever a tabela), índices, policies
-- RESTRICTIVE e uma tabela nova. Nenhum UPDATE/DELETE em linha existente; nenhuma coluna muda de nome ou tipo.
-- NÃO aplicar sem backup e OK do dono (ver AGENTS.md).

-- 1. Faixa de repetições (8–12; fixo = min = max; prancha "3 séries" = os dois NULL). `repeticoes` antigo fica como está:
--    sem min/max o app lê `repeticoes` como número fixo (sem backfill).
ALTER TABLE public.exercicios ADD COLUMN IF NOT EXISTS repeticoes_min SMALLINT;
ALTER TABLE public.exercicios ADD COLUMN IF NOT EXISTS repeticoes_max SMALLINT;
-- Marca do modelo inicial (constante MODELO_TREINO_V1 em @meudia/shared): aplicar o modelo duas vezes não duplica.
ALTER TABLE public.exercicios ADD COLUMN IF NOT EXISTS modelo_origem TEXT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
    WHERE conrelid = 'public.exercicios'::pg_catalog.regclass AND conname = 'exercicios_repeticoes_min_check') THEN
    ALTER TABLE public.exercicios ADD CONSTRAINT exercicios_repeticoes_min_check
      CHECK (repeticoes_min IS NULL OR repeticoes_min >= 1);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
    WHERE conrelid = 'public.exercicios'::pg_catalog.regclass AND conname = 'exercicios_repeticoes_max_check') THEN
    ALTER TABLE public.exercicios ADD CONSTRAINT exercicios_repeticoes_max_check
      CHECK (repeticoes_max IS NULL OR repeticoes_max >= COALESCE(repeticoes_min, 1));
  END IF;
END $$;

-- 2. Horário do treino (agenda e lembrete) e a marca do modelo.
ALTER TABLE public.treinos ADD COLUMN IF NOT EXISTS horario TIME;
ALTER TABLE public.treinos ADD COLUMN IF NOT EXISTS modelo_origem TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS uq_treinos_modelo
  ON public.treinos (user_id, modelo_origem, dia_semana) WHERE modelo_origem IS NOT NULL;
-- Mesmo motivo nos exercícios do modelo (um por posição no treino).
CREATE UNIQUE INDEX IF NOT EXISTS uq_exercicios_modelo
  ON public.exercicios (treino_id, modelo_origem, ordem) WHERE modelo_origem IS NOT NULL;

-- 3. Observação por série feita. Carga, repetições e "concluída" já existem (C4: o código foi corrigido, o banco não muda).
ALTER TABLE public.series_realizadas ADD COLUMN IF NOT EXISTS observacao TEXT;

-- 4. Buracos B1/B2 (PLANO §4.2). As policies atuais só olham o dono da sessão; sessão podia apontar para treino de
--    outra pessoa e série para exercício de outra pessoa (e o CASCADE do outro lado apagava o histórico).
--    Policies RESTRICTIVE somam a condição às que já existem, sem depender do nome delas no banco real.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_policies
    WHERE schemaname = 'public' AND tablename = 'sessoes_treino' AND policyname = 'saude_sessao_treino_do_dono_ins') THEN
    CREATE POLICY saude_sessao_treino_do_dono_ins ON public.sessoes_treino AS RESTRICTIVE FOR INSERT TO authenticated
      WITH CHECK (treino_id IS NULL OR EXISTS (
        SELECT 1 FROM public.treinos t WHERE t.id = sessoes_treino.treino_id AND t.user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_policies
    WHERE schemaname = 'public' AND tablename = 'sessoes_treino' AND policyname = 'saude_sessao_treino_do_dono_upd') THEN
    CREATE POLICY saude_sessao_treino_do_dono_upd ON public.sessoes_treino AS RESTRICTIVE FOR UPDATE TO authenticated
      WITH CHECK (treino_id IS NULL OR EXISTS (
        SELECT 1 FROM public.treinos t WHERE t.id = sessoes_treino.treino_id AND t.user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_policies
    WHERE schemaname = 'public' AND tablename = 'series_realizadas' AND policyname = 'saude_serie_exercicio_do_dono_ins') THEN
    CREATE POLICY saude_serie_exercicio_do_dono_ins ON public.series_realizadas AS RESTRICTIVE FOR INSERT TO authenticated
      WITH CHECK (EXISTS (
        SELECT 1 FROM public.exercicios e JOIN public.treinos t ON t.id = e.treino_id
        WHERE e.id = series_realizadas.exercicio_id AND t.user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_policies
    WHERE schemaname = 'public' AND tablename = 'series_realizadas' AND policyname = 'saude_serie_exercicio_do_dono_upd') THEN
    CREATE POLICY saude_serie_exercicio_do_dono_upd ON public.series_realizadas AS RESTRICTIVE FOR UPDATE TO authenticated
      WITH CHECK (EXISTS (
        SELECT 1 FROM public.exercicios e JOIN public.treinos t ON t.id = e.treino_id
        WHERE e.id = series_realizadas.exercicio_id AND t.user_id = auth.uid()));
  END IF;
END $$;

-- 5. Liga/desliga por tipo de lembrete. Tudo desligado por padrão (BRIEF §5). DEFAULT constante: linhas antigas
--    passam a ler false sem UPDATE (só metadado no Postgres 11+).
ALTER TABLE public.preferencias_agente ADD COLUMN IF NOT EXISTS notif_treino BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.preferencias_agente ADD COLUMN IF NOT EXISTS notif_refeicao BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.preferencias_agente ADD COLUMN IF NOT EXISTS notif_suplemento BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.preferencias_agente ADD COLUMN IF NOT EXISTS agenda_saude TEXT NOT NULL DEFAULT 'nao';
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
    WHERE conrelid = 'public.preferencias_agente'::pg_catalog.regclass AND conname = 'preferencias_agente_agenda_saude_check') THEN
    ALTER TABLE public.preferencias_agente ADD CONSTRAINT preferencias_agente_agenda_saude_check
      CHECK (agenda_saude IN ('nao', 'compromisso', 'lembrete'));
  END IF;
END $$;

-- 6. Registro de lembretes de saúde enviados (idempotência do cron: reservar antes de enviar, liberar se falhar).
--    `lembretes_enviados` não serve: FK para contas_pagar e etapa D-2/D-1/D0. Escrita só pelo cron (service role);
--    a pessoa só lê os próprios, como em lembretes_enviados.
CREATE TABLE IF NOT EXISTS public.notificacoes_saude_enviadas (
  id         UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tipo       TEXT NOT NULL CHECK (tipo IN ('treino', 'refeicao', 'suplemento')),
  origem_id  UUID NOT NULL,
  data       DATE NOT NULL,
  canal      TEXT NOT NULL DEFAULT 'push' CHECK (canal IN ('push')),
  enviado_em TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_notificacoes_saude_enviadas
  ON public.notificacoes_saude_enviadas (user_id, tipo, origem_id, data, canal);

ALTER TABLE public.notificacoes_saude_enviadas ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_policies
    WHERE schemaname = 'public' AND tablename = 'notificacoes_saude_enviadas' AND policyname = 'users_own_data') THEN
    CREATE POLICY users_own_data ON public.notificacoes_saude_enviadas FOR SELECT TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;
-- REVOKE ALL antes do GRANT: no Supabase os default privileges dão ALL a anon/authenticated em tabela nova.
REVOKE ALL ON public.notificacoes_saude_enviadas FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.notificacoes_saude_enviadas TO authenticated;

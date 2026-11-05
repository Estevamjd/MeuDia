-- Destrutivo: desfaz a 008 e volta treinos/preferências ao estado da 007.
-- ATENÇÃO: apaga dados. Faça backup (pg_dump de exercicios, treinos, series_realizadas, preferencias_agente e
-- notificacoes_saude_enviadas) antes. Perde:
--   * faixas de repetição digitadas (repeticoes_min/max), horários de treino e observações de série;
--   * as preferências de lembrete de saúde (notif_treino/refeicao/suplemento, agenda_saude);
--   * o registro de lembretes de saúde enviados.
-- Não perde nenhuma coluna ou linha que existia antes da 008. Treinos criados pelo modelo continuam (linhas comuns).
DROP TABLE IF EXISTS public.notificacoes_saude_enviadas;

ALTER TABLE public.preferencias_agente DROP CONSTRAINT IF EXISTS preferencias_agente_agenda_saude_check;
ALTER TABLE public.preferencias_agente DROP COLUMN IF EXISTS agenda_saude;
ALTER TABLE public.preferencias_agente DROP COLUMN IF EXISTS notif_suplemento;
ALTER TABLE public.preferencias_agente DROP COLUMN IF EXISTS notif_refeicao;
ALTER TABLE public.preferencias_agente DROP COLUMN IF EXISTS notif_treino;

-- As policies de antes não foram tocadas pela 008: basta tirar as RESTRICTIVE.
DROP POLICY IF EXISTS saude_sessao_treino_do_dono_ins ON public.sessoes_treino;
DROP POLICY IF EXISTS saude_sessao_treino_do_dono_upd ON public.sessoes_treino;
DROP POLICY IF EXISTS saude_serie_exercicio_do_dono_ins ON public.series_realizadas;
DROP POLICY IF EXISTS saude_serie_exercicio_do_dono_upd ON public.series_realizadas;

ALTER TABLE public.series_realizadas DROP COLUMN IF EXISTS observacao;

DROP INDEX IF EXISTS public.uq_exercicios_modelo;
DROP INDEX IF EXISTS public.uq_treinos_modelo;
ALTER TABLE public.treinos DROP COLUMN IF EXISTS modelo_origem;
ALTER TABLE public.treinos DROP COLUMN IF EXISTS horario;

ALTER TABLE public.exercicios DROP CONSTRAINT IF EXISTS exercicios_repeticoes_max_check;
ALTER TABLE public.exercicios DROP CONSTRAINT IF EXISTS exercicios_repeticoes_min_check;
ALTER TABLE public.exercicios DROP COLUMN IF EXISTS modelo_origem;
ALTER TABLE public.exercicios DROP COLUMN IF EXISTS repeticoes_max;
ALTER TABLE public.exercicios DROP COLUMN IF EXISTS repeticoes_min;

-- Desfaz a 010. Apaga os registros rápidos de treino e dieta (use só se tiver certeza).
DROP FUNCTION IF EXISTS public.whatsapp_registrar(TEXT, TEXT, TEXT, TEXT, JSONB);
DROP TABLE IF EXISTS private.whatsapp_mensagens;
DROP TABLE IF EXISTS private.integracoes;
DROP TABLE IF EXISTS public.registros_refeicao;
DROP TABLE IF EXISTS public.registros_treino;
DROP INDEX IF EXISTS public.uq_profiles_whatsapp;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_whatsapp_check;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS whatsapp;

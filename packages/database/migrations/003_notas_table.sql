-- Idempotente: pode rodar depois de 000_baseline.sql e ser reexecutada.
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;

-- Tabela de notas
CREATE TABLE IF NOT EXISTS public.notas (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL DEFAULT '',
  conteudo TEXT NOT NULL DEFAULT '',
  tags TEXT[] DEFAULT '{}',
  cor TEXT DEFAULT 'default',
  fixada BOOLEAN DEFAULT false,
  checklist JSONB DEFAULT '[]',
  lembrete TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE public.notas ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  p TEXT[];
BEGIN
  FOREACH p SLICE 1 IN ARRAY ARRAY[
    ['Users can view own notas',   'FOR SELECT USING (user_id = auth.uid())'],
    ['Users can insert own notas', 'FOR INSERT WITH CHECK (user_id = auth.uid())'],
    ['Users can update own notas', 'FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())'],
    ['Users can delete own notas', 'FOR DELETE USING (user_id = auth.uid())']
  ] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'notas' AND policyname = p[1]
    ) THEN
      EXECUTE format('CREATE POLICY %I ON public.notas %s', p[1], p[2]);
    END IF;
  END LOOP;
END $$;

-- Index para buscas
CREATE INDEX IF NOT EXISTS idx_notas_user_id ON public.notas(user_id);
CREATE INDEX IF NOT EXISTS idx_notas_fixada ON public.notas(user_id, fixada);

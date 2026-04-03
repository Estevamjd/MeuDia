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

CREATE POLICY "Users can view own notas"
  ON public.notas FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own notas"
  ON public.notas FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own notas"
  ON public.notas FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own notas"
  ON public.notas FOR DELETE
  USING (user_id = auth.uid());

-- Index para buscas
CREATE INDEX idx_notas_user_id ON public.notas(user_id);
CREATE INDEX idx_notas_fixada ON public.notas(user_id, fixada);

-- 009: origem do lançamento (selo "Manual" ou "WhatsApp" na Início, design v2 aprovado em 18/11/2026).
-- Aditiva e idempotente: um ADD COLUMN com DEFAULT constante (sem reescrever a tabela) e um CHECK. Nenhum UPDATE/DELETE.
-- 'app' = lançado no app (inclui "Paguei"/"Recebi" e ajustes); 'whatsapp' = lançado pelo assistente no WhatsApp (Fase 1).
-- `automatico` NÃO serve para isso: já marca pagamento de conta e recebimento de renda (005/006).
ALTER TABLE public.transacoes ADD COLUMN IF NOT EXISTS origem TEXT NOT NULL DEFAULT 'app';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
    WHERE conrelid = 'public.transacoes'::pg_catalog.regclass AND conname = 'transacoes_origem_check') THEN
    ALTER TABLE public.transacoes ADD CONSTRAINT transacoes_origem_check CHECK (origem IN ('app', 'whatsapp'));
  END IF;
END $$;

COMMENT ON COLUMN public.transacoes.origem IS 'Onde o lançamento nasceu: app (manual) ou whatsapp (assistente).';

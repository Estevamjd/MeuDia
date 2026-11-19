-- Desfaz a 009. Perde só a marca de origem (todos os lançamentos voltam a não ter selo de origem no banco).
ALTER TABLE public.transacoes DROP CONSTRAINT IF EXISTS transacoes_origem_check;
ALTER TABLE public.transacoes DROP COLUMN IF EXISTS origem;

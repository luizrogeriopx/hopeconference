-- =========== Alterar public.inscricoes ===========
-- Adiciona colunas para armazenar Regional e Congregação com valores padrão para backfill
ALTER TABLE public.inscricoes ADD COLUMN IF NOT EXISTS regional TEXT NOT NULL DEFAULT 'SEDE';
ALTER TABLE public.inscricoes ADD COLUMN IF NOT EXISTS congregacao TEXT NOT NULL DEFAULT '';

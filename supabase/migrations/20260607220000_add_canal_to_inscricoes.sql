-- Adicionar coluna 'canal' na tabela public.inscricoes
ALTER TABLE public.inscricoes ADD COLUMN IF NOT EXISTS canal text NOT NULL DEFAULT 'internet';

-- Atualizar registros existentes para 'recepcao' se houver pagamento com método 'dinheiro' ou 'isento'
UPDATE public.inscricoes i
SET canal = 'recepcao'
FROM public.pagamentos p
WHERE p.inscricao_id = i.id AND p.metodo IN ('dinheiro', 'isento');

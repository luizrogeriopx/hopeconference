-- =========== Alterações para Recepção ===========
-- 1. Adicionar o valor 'recepcao' ao enum de papéis (app_role)
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'recepcao';

-- 2. Adicionar coluna exclusivo_recepcao na tabela labs
ALTER TABLE public.labs ADD COLUMN IF NOT EXISTS exclusivo_recepcao BOOLEAN NOT NULL DEFAULT false;

-- 3. Inserir de forma segura o LAB de Dirigentes e Coordenadores (isento)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.labs WHERE nome = 'Dirigentes e Coordenadores (Anexo 2)') THEN
    INSERT INTO public.labs (nome, limite_vagas, local, ativo, requer_cpf, eh_geral, exclusivo_recepcao)
    VALUES ('Dirigentes e Coordenadores (Anexo 2)', 9999, 'Anexo 2', true, false, false, true);
  END IF;
END $$;

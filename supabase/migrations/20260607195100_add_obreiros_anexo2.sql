-- Inserir de forma segura o LAB de Obreiros (Anexo 2) como exclusivo da recepção (isento)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.labs WHERE nome = 'Obreiros (Anexo 2)') THEN
    INSERT INTO public.labs (nome, limite_vagas, local, ativo, requer_cpf, eh_geral, exclusivo_recepcao)
    VALUES ('Obreiros (Anexo 2)', 9999, 'Anexo 2', true, false, false, true);
  END IF;
END $$;

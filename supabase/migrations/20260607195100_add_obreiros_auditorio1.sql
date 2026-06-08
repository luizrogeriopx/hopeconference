-- Inserir de forma segura o LAB de Obreiros (Auditório 1) como exclusivo da recepção (com cobrança)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.labs WHERE nome = 'Obreiros (Auditório 1)') THEN
    INSERT INTO public.labs (nome, limite_vagas, local, ativo, requer_cpf, eh_geral, exclusivo_recepcao)
    VALUES ('Obreiros (Auditório 1)', 9999, 'Auditório 1', true, false, false, true);
  END IF;
END $$;

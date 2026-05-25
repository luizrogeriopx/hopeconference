ALTER TABLE public.inscricoes REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.inscricoes;
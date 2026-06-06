-- =========== Criar tabela public.ministerios ===========
CREATE TABLE IF NOT EXISTS public.ministerios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE,
  ativo BOOLEAN NOT NULL DEFAULT true,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Habilitar RLS na tabela ministerios
ALTER TABLE public.ministerios ENABLE ROW LEVEL SECURITY;

-- Qualquer usuário pode listar os ministérios ativos
CREATE POLICY "ministerios_select_all" ON public.ministerios
  FOR SELECT USING (true);

-- Apenas super_admin pode gerenciar ministérios
CREATE POLICY "ministerios_super_all" ON public.ministerios
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- =========== Inserir ministérios padrão ===========
INSERT INTO public.ministerios (nome) VALUES
  ('Ativação Profética e Libertação'),
  ('Célula'),
  ('Diaconia e Recepção'),
  ('HopeKids'),
  ('Pastores'),
  ('Juventude Hope'),
  ('Obreiro'),
  ('Louvor'),
  ('Hope Creative')
ON CONFLICT (nome) DO NOTHING;

-- =========== Alterar public.inscricoes ===========
ALTER TABLE public.inscricoes ADD COLUMN IF NOT EXISTS ministerio_id UUID REFERENCES public.ministerios(id) ON DELETE SET NULL;

-- Adicionar à publicação de realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.ministerios;

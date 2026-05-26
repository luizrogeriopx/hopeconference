
CREATE TABLE public.app_settings (
  id BOOLEAN PRIMARY KEY DEFAULT true CHECK (id = true),
  inscricoes_abertas BOOLEAN NOT NULL DEFAULT true,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.app_settings TO anon;
GRANT SELECT, UPDATE ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "App settings legíveis por todos"
ON public.app_settings FOR SELECT
USING (true);

CREATE POLICY "Apenas super admin atualiza settings"
ON public.app_settings FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

INSERT INTO public.app_settings (id, inscricoes_abertas) VALUES (true, true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.app_settings;

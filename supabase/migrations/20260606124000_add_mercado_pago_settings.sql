-- =========== Alterar public.app_settings ===========
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS mercado_pago_ativo BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS mercado_pago_public_key TEXT NOT NULL DEFAULT '';

-- =========== Criar public.app_secrets ===========
CREATE TABLE IF NOT EXISTS public.app_secrets (
  id BOOLEAN PRIMARY KEY DEFAULT true CHECK (id = true),
  mercado_pago_access_token TEXT NOT NULL DEFAULT '',
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Permissões de tabela
GRANT SELECT ON public.app_secrets TO anon;
GRANT SELECT, UPDATE ON public.app_secrets TO authenticated;
GRANT ALL ON public.app_secrets TO service_role;
GRANT ALL ON public.app_secrets TO postgres;

-- Habilitar RLS
ALTER TABLE public.app_secrets ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para app_secrets
-- Apenas super_admin pode interagir com esta tabela de segredos
CREATE POLICY "Super admin gerencia segredos"
ON public.app_secrets FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- Inserir linha inicial de segredos
INSERT INTO public.app_secrets (id, mercado_pago_access_token) VALUES (true, '')
ON CONFLICT (id) DO NOTHING;

-- =========== Alterar public.pagamentos ===========
ALTER TABLE public.pagamentos ADD COLUMN IF NOT EXISTS preference_id TEXT DEFAULT NULL;
ALTER TABLE public.pagamentos ADD COLUMN IF NOT EXISTS payment_id TEXT DEFAULT NULL;
ALTER TABLE public.pagamentos ADD COLUMN IF NOT EXISTS payment_url TEXT DEFAULT NULL;
ALTER TABLE public.pagamentos ADD COLUMN IF NOT EXISTS pix_qr_base64 TEXT DEFAULT NULL;

-- =========== Habilitar Realtime para app_secrets (opcional, manter consistente) ===========
ALTER PUBLICATION supabase_realtime ADD TABLE public.app_secrets;

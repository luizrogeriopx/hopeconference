-- Add whatsapp support columns to app_settings
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS whatsapp_suporte_ativo BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS whatsapp_suporte_numero TEXT NOT NULL DEFAULT '5562996897483';

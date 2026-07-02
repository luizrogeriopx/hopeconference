-- Add material_ativo column to app_settings table
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS material_ativo BOOLEAN NOT NULL DEFAULT true;

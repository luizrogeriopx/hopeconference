-- Add mostrar_segunda_homepage column to app_settings table
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS mostrar_segunda_homepage BOOLEAN NOT NULL DEFAULT false;

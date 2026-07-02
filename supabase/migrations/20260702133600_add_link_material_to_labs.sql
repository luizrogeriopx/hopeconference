-- Add link_material column to labs table
ALTER TABLE public.labs ADD COLUMN IF NOT EXISTS link_material TEXT;

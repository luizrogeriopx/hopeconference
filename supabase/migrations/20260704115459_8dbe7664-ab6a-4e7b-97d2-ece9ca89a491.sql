CREATE TABLE public.notificacoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  link TEXT,
  lida BOOLEAN NOT NULL DEFAULT false,
  criado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  lida_em TIMESTAMPTZ
);

CREATE INDEX idx_notificacoes_user ON public.notificacoes(user_id, criado_em DESC);
CREATE INDEX idx_notificacoes_nao_lidas ON public.notificacoes(user_id) WHERE lida = false;

GRANT SELECT, UPDATE ON public.notificacoes TO authenticated;
GRANT ALL ON public.notificacoes TO service_role;

ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuário vê suas próprias notificações"
  ON public.notificacoes FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Usuário marca suas próprias notificações como lidas"
  ON public.notificacoes FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Super admin cria notificações"
  ON public.notificacoes FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admin apaga notificações"
  ON public.notificacoes FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

ALTER PUBLICATION supabase_realtime ADD TABLE public.notificacoes;
ALTER TABLE public.notificacoes REPLICA IDENTITY FULL;
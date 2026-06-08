-- =========== Criar tabela public.regional_congregacoes ===========
CREATE TABLE IF NOT EXISTS public.regional_congregacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  regional text NOT NULL,
  congregacao text NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE(regional, congregacao)
);

-- Habilitar RLS
ALTER TABLE public.regional_congregacoes ENABLE ROW LEVEL SECURITY;

-- Qualquer um pode ler
CREATE POLICY "regional_congregacoes_select_all" ON public.regional_congregacoes
  FOR SELECT TO authenticated, anonymous
  USING (true);

-- Apenas super_admin pode gerenciar
CREATE POLICY "regional_congregacoes_super_all" ON public.regional_congregacoes
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- Inserir dados iniciais
INSERT INTO public.regional_congregacoes (regional, congregacao) VALUES
('2', 'Estrela do Sul'), ('2', 'Cidade Vera Cruz 2'), ('2', 'Conj. Santa Fé'), ('2', 'Jardim Luz'), ('2', 'Vila Rosa'),
('3', 'Veiga Jardim'), ('3', 'Cidade Vera Cruz 3'), ('3', 'Res. Alva Luz'), ('3', 'Terra Prometida'),
('4', 'Pontal Sul'), ('4', 'Pontal Sul 2'), ('4', 'Village Garavelo'), ('4', 'JD. Girassóis'),
('5', 'Oriente Ville'), ('5', 'Cond. Esmeralda 1'), ('5', 'JD. Real Conquista'), ('5', 'JD. Ipanema'), ('5', 'Res. Itaipú'),
('6', 'Morada'), ('6', 'São Carlos'), ('6', 'Brisas da Mata'), ('6', 'Estrela D''Alva'), ('6', 'Lago Azul'), ('6', 'Vista Bela'),
('7', 'Porto Dourado'), ('7', 'Aragoiania'), ('7', 'Crominia'), ('7', 'JD. Ipê'), ('7', 'Madre Germana 1'), ('7', 'Quinta da Boa Vista'),
('8', 'Hidrolandia'), ('8', 'JD. Miramar'), ('8', 'Parque Flamboyant'),
('9', 'Parque Paraíso'), ('9', 'Bairro Goiá'), ('9', 'Beatriz Nascimento'), ('9', 'JD. Imperial'),
('10', 'Nerópolis'), ('10', 'Res. Fratelli'), ('10', 'Santo Antonio de Goiás'),
('11', 'Colina Azul'), ('11', 'JD. Ipiranga'), ('11', 'Virginia Park'),
('12', 'Triunfo 2'), ('12', 'Nova Goianira'), ('12', 'Paineiras'), ('12', 'Res. Araguaia'), ('12', 'Setor Sul'), ('12', 'Triunfo 1'), ('12', 'Triunfo 3'),
('13', 'Buriti de Goiás'), ('13', 'Jaupaci'), ('13', 'Jussara'), ('13', 'Parauna'),
('14', 'JD. Cerrado 4'), ('14', 'Alto do Cerrado'), ('14', 'Lírios do Campo'), ('14', 'Monte Pascoal 1'), ('14', 'Monte Pascoal 2'), ('14', 'Res. Portinari'),
('15', 'Res. Pedro Miranda'), ('15', 'Flor do Ipê'), ('15', 'Res. Primavera'), ('15', 'Setor Alvorada'), ('15', 'Vila Galvão'),
('16', 'Orlando de Morais'), ('16', 'Montes Claros'), ('16', 'Bela Goiania'), ('16', 'Res. Morumbi'), ('16', 'Vale dos Sonhos'),
('17', 'Abadia Central'), ('17', 'Goiania Sul'), ('17', 'Porto Seguro - Abadia'), ('17', 'Res. Dori'), ('17', 'Res. Primavera'),
('18', 'Morada dos Pássaros'), ('18', 'Cid. Vera Cruz 1'), ('18', 'Goiania Park Sul'), ('18', 'JD. Veneza'),
('19', 'St. Cristina'), ('19', 'JD. Marista'), ('19', 'Serra Branca'), ('19', 'Rosa Morena'), ('19', 'Vida Nova'),
('20', 'JD. Scala'), ('20', 'Maisa 2'), ('20', 'Renata Parque'), ('20', 'St. dos Bandeirantes'),
('21', 'Tiradentes'), ('21', 'Parque Haiala'), ('21', 'Ind. Mansões'), ('21', 'Vila Delfiori')
ON CONFLICT (regional, congregacao) DO NOTHING;

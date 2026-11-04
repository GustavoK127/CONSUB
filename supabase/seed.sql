insert into public.especialidades (nome, slug) values
  ('Cardiologia', 'cardiologia'),
  ('Ortopedia', 'ortopedia'),
  ('Neurologia', 'neurologia'),
  ('Ginecologia', 'ginecologia'),
  ('Dermatologia', 'dermatologia'),
  ('Psicologia', 'psicologia'),
  ('Oftalmologia', 'oftalmologia'),
  ('Endocrinologia', 'endocrinologia'),
  ('Clínico Geral', 'clinico-geral')
on conflict (slug) do update set nome = excluded.nome;

insert into public.cidades (nome, uf, slug) values
  ('São Paulo', 'SP', 'sao-paulo'),
  ('Ribeirão Preto', 'SP', 'ribeirao-preto'),
  ('Fortaleza', 'CE', 'fortaleza'),
  ('Recife', 'PE', 'recife'),
  ('Goiânia', 'GO', 'goiania'),
  ('Belo Horizonte', 'MG', 'belo-horizonte'),
  ('Curitiba', 'PR', 'curitiba'),
  ('Salvador', 'BA', 'salvador'),
  ('Porto Alegre', 'RS', 'porto-alegre')
on conflict (slug) do update set nome = excluded.nome, uf = excluded.uf;

insert into public.unidades_saude (cidade_id, nome, tipo)
select c.id, v.nome, v.tipo
from (values
  ('sao-paulo', 'Unidade ConSub SP-01', 'Unidade ConSub'),
  ('ribeirao-preto', 'Unidade ConSub SP-02', 'Unidade ConSub'),
  ('fortaleza', 'Unidade ConSub CE-01', 'Unidade ConSub'),
  ('recife', 'Unidade ConSub PE-01', 'Unidade ConSub'),
  ('goiania', 'Unidade ConSub GO-01', 'Unidade ConSub'),
  ('belo-horizonte', 'Unidade ConSub MG-01', 'Unidade ConSub'),
  ('curitiba', 'Unidade ConSub PR-01', 'Unidade ConSub'),
  ('salvador', 'Unidade ConSub BA-01', 'Unidade ConSub'),
  ('porto-alegre', 'Unidade ConSub RS-01', 'Unidade ConSub')
) as v(cidade_slug, nome, tipo)
join public.cidades c on c.slug = v.cidade_slug
on conflict (cidade_id, nome) do update set tipo = excluded.tipo;

insert into public.profissionais_saude (nome) values
  ('Profissional 01'),
  ('Profissional 02'),
  ('Profissional 03'),
  ('Profissional 04'),
  ('Profissional 05'),
  ('Profissional 06'),
  ('Profissional 07'),
  ('Profissional 08'),
  ('Profissional 09')
on conflict (nome) do nothing;

insert into public.consultas (
  especialidade_id, unidade_id, profissional_id, data_hora,
  vagas_disponiveis, urgencia, status
)
select e.id, u.id, p.id, v.data_hora::timestamptz,
       v.vagas, v.urgencia, 'disponivel'
from (values
  ('cardiologia', 'sao-paulo', 'Unidade ConSub SP-01', 'Profissional 01', '2026-11-20T09:30:00-03:00', 2, 'normal'),
  ('ortopedia', 'ribeirao-preto', 'Unidade ConSub SP-02', 'Profissional 02', '2026-11-20T14:00:00-03:00', 1, 'normal'),
  ('neurologia', 'fortaleza', 'Unidade ConSub CE-01', 'Profissional 03', '2026-11-21T10:15:00-03:00', 1, 'moderada'),
  ('ginecologia', 'recife', 'Unidade ConSub PE-01', 'Profissional 04', '2026-11-23T11:00:00-03:00', 3, 'normal'),
  ('dermatologia', 'goiania', 'Unidade ConSub GO-01', 'Profissional 05', '2026-11-24T08:45:00-03:00', 2, 'normal'),
  ('psicologia', 'belo-horizonte', 'Unidade ConSub MG-01', 'Profissional 06', '2026-11-25T13:30:00-03:00', 1, 'normal'),
  ('oftalmologia', 'curitiba', 'Unidade ConSub PR-01', 'Profissional 07', '2026-11-26T15:00:00-03:00', 2, 'normal'),
  ('endocrinologia', 'salvador', 'Unidade ConSub BA-01', 'Profissional 08', '2026-11-27T09:00:00-03:00', 1, 'moderada'),
  ('clinico-geral', 'porto-alegre', 'Unidade ConSub RS-01', 'Profissional 09', '2026-11-28T10:30:00-03:00', 3, 'normal')
) as v(especialidade_slug, cidade_slug, unidade_nome, profissional_nome, data_hora, vagas, urgencia)
join public.especialidades e on e.slug = v.especialidade_slug
join public.cidades c on c.slug = v.cidade_slug
join public.unidades_saude u on u.cidade_id = c.id and u.nome = v.unidade_nome
join public.profissionais_saude p on p.nome = v.profissional_nome
on conflict (especialidade_id, data_hora) do update set
  unidade_id = excluded.unidade_id,
  profissional_id = excluded.profissional_id,
  vagas_disponiveis = excluded.vagas_disponiveis,
  urgencia = excluded.urgencia,
  status = excluded.status;

insert into public.capacidade_transporte (data, capacidade, ocupados) values
  ('2026-11-20', 8, 5),
  ('2026-11-21', 8, 7),
  ('2026-11-23', 8, 8),
  ('2026-11-24', 8, 4),
  ('2026-11-25', 8, 6),
  ('2026-11-26', 8, 8),
  ('2026-11-27', 8, 2),
  ('2026-11-28', 8, 8),
  ('2026-11-29', 8, 3)
on conflict (data) do update set
  capacidade = excluded.capacidade,
  ocupados = excluded.ocupados;

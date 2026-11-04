-- Run after the schema/catalog seed and after creating the single operator account.
-- Uses only synthetic data and is safe to run more than once.
do $$
declare
  v_operator_id uuid;
  v_user_count integer;
  v_registration_count integer;
begin
  select count(*) into v_user_count from auth.users;
  if v_user_count <> 1 then
    raise exception 'Expected exactly one operator account before creating demo records.'
      using errcode = '55000';
  end if;

  select id into v_operator_id from auth.users limit 1;

  insert into public.pacientes (
    owner_id, nome_completo, cpf, data_nascimento, telefone,
    email, cns, telefone_responsavel
  ) values
    (v_operator_id, 'Pessoa Teste 01', '00000000001', '1988-05-14', '00000000001', 'pessoa.teste.01@example.invalid', null, null),
    (v_operator_id, 'Pessoa Teste 02', '00000000002', '1976-09-23', '00000000002', 'pessoa.teste.02@example.invalid', null, '00000000012'),
    (v_operator_id, 'Pessoa Teste 03', '00000000003', '1995-12-02', '00000000003', null, null, null)
  on conflict (owner_id, cpf) do update set
    nome_completo = excluded.nome_completo,
    data_nascimento = excluded.data_nascimento,
    telefone = excluded.telefone,
    email = excluded.email,
    cns = excluded.cns,
    telefone_responsavel = excluded.telefone_responsavel;

  insert into public.inscricoes_fila (
    owner_id, paciente_id, especialidade_id, cidade_id,
    unidade_referencia_id, urgencia, descricao, aceite, status
  )
  select
    v_operator_id,
    p.id,
    e.id,
    c.id,
    u.id,
    sample.urgencia,
    'Registro sintético para validar o fluxo de inscrição.',
    true,
    'ativa'
  from (values
    ('00000000001', 'cardiologia', 'sao-paulo', 'Unidade ConSub SP-01', 'normal'),
    ('00000000002', 'dermatologia', 'fortaleza', 'Unidade ConSub CE-01', 'moderada'),
    ('00000000003', 'ortopedia', 'curitiba', 'Unidade ConSub PR-01', 'alta')
  ) as sample(cpf, especialidade_slug, cidade_slug, unidade_nome, urgencia)
  join public.pacientes p
    on p.owner_id = v_operator_id and p.cpf = sample.cpf
  join public.especialidades e on e.slug = sample.especialidade_slug
  join public.cidades c on c.slug = sample.cidade_slug
  join public.unidades_saude u
    on u.cidade_id = c.id and u.nome = sample.unidade_nome
  where not exists (
    select 1
    from public.inscricoes_fila existing
    where existing.owner_id = v_operator_id
      and existing.paciente_id = p.id
      and existing.especialidade_id = e.id
      and existing.cidade_id = c.id
      and existing.unidade_referencia_id = u.id
      and existing.status = 'ativa'
  );

  select count(*) into v_registration_count
  from public.inscricoes_fila q
  join public.pacientes p on p.id = q.paciente_id
  join public.especialidades e on e.id = q.especialidade_id
  join public.cidades c on c.id = q.cidade_id
  join public.unidades_saude u on u.id = q.unidade_referencia_id
  where q.owner_id = v_operator_id
    and q.status = 'ativa'
    and (p.cpf, e.slug, c.slug, u.nome) in (
      ('00000000001', 'cardiologia', 'sao-paulo', 'Unidade ConSub SP-01'),
      ('00000000002', 'dermatologia', 'fortaleza', 'Unidade ConSub CE-01'),
      ('00000000003', 'ortopedia', 'curitiba', 'Unidade ConSub PR-01')
    );

  if v_registration_count <> 3 then
    raise exception 'Catalog seed is incomplete; expected all three synthetic queue registrations.'
      using errcode = '55000';
  end if;
end;
$$;

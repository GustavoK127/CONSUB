create table public.especialidades (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  slug text not null unique
);

create table public.cidades (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  uf char(2) not null check (uf ~ '^[A-Z]{2}$'),
  slug text not null unique,
  unique (nome, uf)
);

create table public.unidades_saude (
  id uuid primary key default gen_random_uuid(),
  cidade_id uuid not null references public.cidades(id) on delete restrict,
  nome text not null,
  tipo text not null default 'Unidade de saúde',
  unique (cidade_id, nome)
);

create table public.profissionais_saude (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique
);

create table public.consultas (
  id uuid primary key default gen_random_uuid(),
  especialidade_id uuid not null references public.especialidades(id) on delete restrict,
  unidade_id uuid not null references public.unidades_saude(id) on delete restrict,
  profissional_id uuid not null references public.profissionais_saude(id) on delete restrict,
  data_hora timestamptz not null,
  vagas_disponiveis integer not null default 1 check (vagas_disponiveis >= 0),
  urgencia text not null default 'normal' check (urgencia in ('normal', 'moderada', 'alta')),
  status text not null default 'disponivel' check (status in ('disponivel', 'indisponivel')),
  created_at timestamptz not null default now(),
  unique (especialidade_id, data_hora)
);

create table public.capacidade_transporte (
  data date primary key,
  capacidade integer not null check (capacidade > 0),
  ocupados integer not null default 0 check (ocupados >= 0 and ocupados <= capacidade)
);

create table public.pacientes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nome_completo text not null check (length(trim(nome_completo)) >= 3),
  cpf text not null check (cpf ~ '^[0-9]{11}$'),
  data_nascimento date not null,
  telefone text not null,
  email text,
  cns text,
  telefone_responsavel text,
  created_at timestamptz not null default now(),
  unique (owner_id, cpf)
);

create table public.inscricoes_fila (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  paciente_id uuid not null references public.pacientes(id) on delete cascade,
  especialidade_id uuid not null references public.especialidades(id) on delete restrict,
  cidade_id uuid not null references public.cidades(id) on delete restrict,
  unidade_referencia_id uuid references public.unidades_saude(id) on delete set null,
  urgencia text not null default 'normal' check (urgencia in ('normal', 'moderada', 'alta')),
  descricao text,
  aceite boolean not null check (aceite),
  status text not null default 'ativa' check (status in ('ativa', 'cancelada', 'atendida')),
  created_at timestamptz not null default now()
);

create unique index inscricoes_fila_unica_ativa_idx
  on public.inscricoes_fila (
    owner_id,
    paciente_id,
    especialidade_id,
    cidade_id,
    coalesce(unidade_referencia_id, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  where status = 'ativa';

create table public.solicitacoes_consulta (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  consulta_id uuid not null references public.consultas(id) on delete restrict,
  status text not null default 'solicitada' check (status in ('solicitada', 'cancelada')),
  created_at timestamptz not null default now()
);

create table public.solicitacoes_transporte (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  solicitacao_consulta_id uuid not null unique references public.solicitacoes_consulta(id) on delete cascade,
  data date not null,
  ponto_embarque text not null check (length(trim(ponto_embarque)) > 0),
  area_rural boolean not null default false,
  comunidade_rural text,
  passageiros integer not null check (passageiros between 1 and 8),
  created_at timestamptz not null default now(),
  check (not area_rural or nullif(trim(comunidade_rural), '') is not null)
);

create index consultas_data_status_idx on public.consultas (data_hora, status);
create index inscricoes_fila_owner_status_idx on public.inscricoes_fila (owner_id, status);
create index solicitacoes_consulta_owner_created_idx on public.solicitacoes_consulta (owner_id, created_at desc);

alter table public.especialidades enable row level security;
alter table public.cidades enable row level security;
alter table public.unidades_saude enable row level security;
alter table public.profissionais_saude enable row level security;
alter table public.consultas enable row level security;
alter table public.capacidade_transporte enable row level security;
alter table public.pacientes enable row level security;
alter table public.inscricoes_fila enable row level security;
alter table public.solicitacoes_consulta enable row level security;
alter table public.solicitacoes_transporte enable row level security;

revoke all on table
  public.especialidades,
  public.cidades,
  public.unidades_saude,
  public.profissionais_saude,
  public.consultas,
  public.capacidade_transporte,
  public.pacientes,
  public.inscricoes_fila,
  public.solicitacoes_consulta,
  public.solicitacoes_transporte
from anon, authenticated;

grant select on table
  public.especialidades,
  public.cidades,
  public.unidades_saude,
  public.profissionais_saude,
  public.consultas,
  public.capacidade_transporte
to authenticated;

grant select on table
  public.pacientes,
  public.inscricoes_fila,
  public.solicitacoes_consulta,
  public.solicitacoes_transporte
to authenticated;

create policy "Operador autenticado pode consultar especialidades"
  on public.especialidades for select to authenticated using (true);
create policy "Operador autenticado pode consultar cidades"
  on public.cidades for select to authenticated using (true);
create policy "Operador autenticado pode consultar unidades"
  on public.unidades_saude for select to authenticated using (true);
create policy "Operador autenticado pode consultar profissionais"
  on public.profissionais_saude for select to authenticated using (true);
create policy "Operador autenticado pode consultar consultas"
  on public.consultas for select to authenticated using (true);
create policy "Operador autenticado pode consultar capacidade de transporte"
  on public.capacidade_transporte for select to authenticated using (true);

create policy "Operador consulta seus pacientes"
  on public.pacientes for select to authenticated
  using ((select auth.uid()) = owner_id);

create policy "Operador consulta suas inscricoes"
  on public.inscricoes_fila for select to authenticated
  using ((select auth.uid()) = owner_id);

create policy "Operador consulta seus pedidos de consulta"
  on public.solicitacoes_consulta for select to authenticated
  using ((select auth.uid()) = owner_id);

create policy "Operador consulta seus pedidos de transporte"
  on public.solicitacoes_transporte for select to authenticated
  using ((select auth.uid()) = owner_id);

create or replace function public.registrar_inscricao_fila(
  p_paciente jsonb,
  p_inscricao jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_paciente_id uuid;
  v_inscricao_id uuid;
  v_cpf text := regexp_replace(coalesce(p_paciente->>'cpf', ''), '[^0-9]', '', 'g');
begin
  if v_owner is null then
    raise exception 'Autenticacao necessaria.' using errcode = '42501';
  end if;

  if v_cpf !~ '^[0-9]{11}$' then
    raise exception 'Informe um CPF de teste com 11 digitos.' using errcode = '22023';
  end if;

  if coalesce((p_inscricao->>'aceite')::boolean, false) is not true then
    raise exception 'O aceite e obrigatorio.' using errcode = '22023';
  end if;

  insert into public.pacientes (
    owner_id, nome_completo, cpf, data_nascimento, telefone, email, cns, telefone_responsavel
  ) values (
    v_owner,
    trim(p_paciente->>'nome_completo'),
    v_cpf,
    (p_paciente->>'data_nascimento')::date,
    trim(p_paciente->>'telefone'),
    nullif(trim(p_paciente->>'email'), ''),
    nullif(regexp_replace(coalesce(p_paciente->>'cns', ''), '[^0-9]', '', 'g'), ''),
    nullif(trim(p_paciente->>'telefone_responsavel'), '')
  )
  on conflict (owner_id, cpf) do update set
    nome_completo = excluded.nome_completo,
    data_nascimento = excluded.data_nascimento,
    telefone = excluded.telefone,
    email = excluded.email,
    cns = excluded.cns,
    telefone_responsavel = excluded.telefone_responsavel
  returning id into v_paciente_id;

  insert into public.inscricoes_fila (
    owner_id, paciente_id, especialidade_id, cidade_id,
    unidade_referencia_id, urgencia, descricao, aceite
  ) values (
    v_owner,
    v_paciente_id,
    (p_inscricao->>'especialidade_id')::uuid,
    (p_inscricao->>'cidade_id')::uuid,
    nullif(p_inscricao->>'unidade_referencia_id', '')::uuid,
    coalesce(nullif(p_inscricao->>'urgencia', ''), 'normal'),
    nullif(trim(p_inscricao->>'descricao'), ''),
    true
  ) returning id into v_inscricao_id;

  return v_inscricao_id;
end;
$$;

create or replace function public.registrar_solicitacao_consulta(
  p_consulta_id uuid,
  p_transporte jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_consulta_data date;
  v_transporte_data date;
  v_passageiros integer;
  v_disponiveis integer;
  v_solicitacao_id uuid;
begin
  if v_owner is null then
    raise exception 'Autenticacao necessaria.' using errcode = '42501';
  end if;

  select c.data_hora::date into v_consulta_data
  from public.consultas c
  where c.id = p_consulta_id
    and c.status = 'disponivel'
    and c.vagas_disponiveis > 0
    and c.data_hora > now();

  if v_consulta_data is null then
    raise exception 'Consulta indisponivel.' using errcode = '22023';
  end if;

  if p_transporte is not null and p_transporte <> 'null'::jsonb then
    v_transporte_data := (p_transporte->>'data')::date;
    v_passageiros := (p_transporte->>'passageiros')::integer;

    if v_transporte_data <> v_consulta_data then
      raise exception 'A data do transporte deve corresponder a data da consulta.' using errcode = '22023';
    end if;

    select ct.capacidade - ct.ocupados into v_disponiveis
    from public.capacidade_transporte ct
    where ct.data = v_transporte_data;

    if v_disponiveis is null or v_passageiros < 1 or v_passageiros > v_disponiveis then
      raise exception 'Nao ha capacidade para o transporte informado.' using errcode = '22023';
    end if;

    if coalesce((p_transporte->>'area_rural')::boolean, false)
      and nullif(trim(p_transporte->>'comunidade_rural'), '') is null then
      raise exception 'Informe a comunidade rural.' using errcode = '22023';
    end if;
  end if;

  insert into public.solicitacoes_consulta (owner_id, consulta_id)
  values (v_owner, p_consulta_id)
  returning id into v_solicitacao_id;

  if p_transporte is not null and p_transporte <> 'null'::jsonb then
    insert into public.solicitacoes_transporte (
      owner_id, solicitacao_consulta_id, data, ponto_embarque,
      area_rural, comunidade_rural, passageiros
    ) values (
      v_owner,
      v_solicitacao_id,
      v_transporte_data,
      trim(p_transporte->>'ponto_embarque'),
      coalesce((p_transporte->>'area_rural')::boolean, false),
      nullif(trim(p_transporte->>'comunidade_rural'), ''),
      v_passageiros
    );
  end if;

  return v_solicitacao_id;
end;
$$;

revoke all on function public.registrar_inscricao_fila(jsonb, jsonb) from public, anon;
revoke all on function public.registrar_solicitacao_consulta(uuid, jsonb) from public, anon;
grant execute on function public.registrar_inscricao_fila(jsonb, jsonb) to authenticated;
grant execute on function public.registrar_solicitacao_consulta(uuid, jsonb) to authenticated;

begin;

create table public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'operator')),
  created_at timestamptz not null default now()
);

alter table public.user_roles enable row level security;
revoke all on table public.user_roles from public, anon, authenticated;

create or replace function public.is_operator()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles r
    where r.user_id = (select auth.uid())
      and r.role = 'operator'
  );
$$;

revoke all on function public.is_operator() from public, anon;
grant execute on function public.is_operator() to authenticated;

create or replace function public.meu_papel()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select r.role
  from public.user_roles r
  where r.user_id = (select auth.uid());
$$;

revoke all on function public.meu_papel() from public, anon;
grant execute on function public.meu_papel() to authenticated;

do $$
declare
  v_user_count integer;
  v_operator_id uuid;
begin
  select count(*) into v_user_count from auth.users;
  if v_user_count <> 1 then
    raise exception 'Expected exactly one existing Auth user to promote as the initial operator; found %.', v_user_count
      using errcode = '55000';
  end if;

  select id into v_operator_id from auth.users limit 1;
  insert into public.user_roles (user_id, role)
  values (v_operator_id, 'operator');
end;
$$;

create or replace function public.assign_default_user_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.user_roles (user_id, role)
  values (new.id, 'user');
  return new;
end;
$$;

revoke all on function public.assign_default_user_role() from public, anon, authenticated;

create trigger consub_assign_default_user_role
after insert on auth.users
for each row execute function public.assign_default_user_role();

create table public.perfis_usuarios (
  user_id uuid primary key references auth.users(id) on delete cascade,
  paciente_id uuid not null unique references public.pacientes(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.perfis_usuarios enable row level security;
revoke all on table public.perfis_usuarios from public, anon, authenticated;

create or replace function public.prevent_owner_reassignment()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.owner_id is distinct from old.owner_id then
    raise exception 'The record owner cannot be changed.' using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function public.prevent_owner_reassignment() from public, anon, authenticated;

create trigger pacientes_owner_immutable
before update of owner_id on public.pacientes
for each row execute function public.prevent_owner_reassignment();

create trigger inscricoes_fila_owner_immutable
before update of owner_id on public.inscricoes_fila
for each row execute function public.prevent_owner_reassignment();

create trigger solicitacoes_consulta_owner_immutable
before update of owner_id on public.solicitacoes_consulta
for each row execute function public.prevent_owner_reassignment();

create trigger solicitacoes_transporte_owner_immutable
before update of owner_id on public.solicitacoes_transporte
for each row execute function public.prevent_owner_reassignment();

drop policy if exists "Operador consulta seus pacientes" on public.pacientes;
drop policy if exists "Operador consulta suas inscricoes" on public.inscricoes_fila;
drop policy if exists "Operador consulta seus pedidos de consulta" on public.solicitacoes_consulta;
drop policy if exists "Operador consulta seus pedidos de transporte" on public.solicitacoes_transporte;

create policy "Usuarios consultam seus pacientes e operadores todos"
  on public.pacientes for select to authenticated
  using ((select auth.uid()) = owner_id or (select public.is_operator()));
create policy "Operadores atualizam pacientes"
  on public.pacientes for update to authenticated
  using ((select public.is_operator()))
  with check ((select public.is_operator()));
create policy "Operadores excluem pacientes"
  on public.pacientes for delete to authenticated
  using ((select public.is_operator()));

create policy "Usuarios consultam suas inscricoes e operadores todas"
  on public.inscricoes_fila for select to authenticated
  using ((select auth.uid()) = owner_id or (select public.is_operator()));
create policy "Operadores atualizam inscricoes"
  on public.inscricoes_fila for update to authenticated
  using ((select public.is_operator()))
  with check ((select public.is_operator()));
create policy "Operadores excluem inscricoes"
  on public.inscricoes_fila for delete to authenticated
  using ((select public.is_operator()));

create policy "Usuarios consultam seus pedidos e operadores todos"
  on public.solicitacoes_consulta for select to authenticated
  using ((select auth.uid()) = owner_id or (select public.is_operator()));
create policy "Operadores atualizam pedidos de consulta"
  on public.solicitacoes_consulta for update to authenticated
  using ((select public.is_operator()))
  with check ((select public.is_operator()));
create policy "Operadores excluem pedidos de consulta"
  on public.solicitacoes_consulta for delete to authenticated
  using ((select public.is_operator()));

create policy "Usuarios consultam seus transportes e operadores todos"
  on public.solicitacoes_transporte for select to authenticated
  using ((select auth.uid()) = owner_id or (select public.is_operator()));
create policy "Operadores atualizam pedidos de transporte"
  on public.solicitacoes_transporte for update to authenticated
  using ((select public.is_operator()))
  with check ((select public.is_operator()));
create policy "Operadores excluem pedidos de transporte"
  on public.solicitacoes_transporte for delete to authenticated
  using ((select public.is_operator()));

grant select on table
  public.pacientes,
  public.inscricoes_fila,
  public.solicitacoes_consulta,
  public.solicitacoes_transporte
to authenticated;
grant update, delete on table
  public.pacientes,
  public.inscricoes_fila,
  public.solicitacoes_consulta,
  public.solicitacoes_transporte
to authenticated;
revoke insert on table
  public.pacientes,
  public.inscricoes_fila,
  public.solicitacoes_consulta,
  public.solicitacoes_transporte
from public, anon, authenticated;

create or replace function public.meu_perfil()
returns table (
  id uuid,
  nome_completo text,
  cpf text,
  data_nascimento date,
  telefone text,
  email text,
  cns text,
  telefone_responsavel text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null or not exists (
    select 1 from public.user_roles r where r.user_id = v_user_id and r.role = 'user'
  ) then
    raise exception 'Acesso restrito a contas de usuário.' using errcode = '42501';
  end if;

  return query
  select p.id, p.nome_completo, p.cpf, p.data_nascimento, p.telefone,
         p.email, p.cns, p.telefone_responsavel, p.created_at
  from public.perfis_usuarios up
  join public.pacientes p on p.id = up.paciente_id
  where up.user_id = v_user_id and p.owner_id = v_user_id;
end;
$$;

create or replace function public.criar_meu_perfil(p_paciente jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_patient_id uuid;
  v_cpf text := regexp_replace(coalesce(p_paciente->>'cpf', ''), '[^0-9]', '', 'g');
  v_name text := trim(coalesce(p_paciente->>'nome_completo', ''));
begin
  if v_user_id is null or not exists (
    select 1 from public.user_roles r where r.user_id = v_user_id and r.role = 'user'
  ) then
    raise exception 'Acesso restrito a contas de usuário.' using errcode = '42501';
  end if;
  if exists (select 1 from public.perfis_usuarios up where up.user_id = v_user_id) then
    raise exception 'A conta já possui um perfil de paciente.' using errcode = '23505';
  end if;
  if length(v_name) < 3 or v_cpf !~ '^[0-9]{11}$'
     or coalesce(p_paciente->>'data_nascimento', '') !~ '^\d{4}-\d{2}-\d{2}$'
     or length(regexp_replace(coalesce(p_paciente->>'telefone', ''), '[^0-9]', '', 'g')) < 10 then
    raise exception 'Revise nome, CPF, data de nascimento e telefone.' using errcode = '22023';
  end if;

  insert into public.pacientes (
    owner_id, nome_completo, cpf, data_nascimento, telefone,
    email, cns, telefone_responsavel
  ) values (
    v_user_id,
    v_name,
    v_cpf,
    (p_paciente->>'data_nascimento')::date,
    regexp_replace(coalesce(p_paciente->>'telefone', ''), '[^0-9]', '', 'g'),
    nullif(trim(coalesce(p_paciente->>'email', '')), ''),
    nullif(regexp_replace(coalesce(p_paciente->>'cns', ''), '[^0-9]', '', 'g'), ''),
    nullif(regexp_replace(coalesce(p_paciente->>'telefone_responsavel', ''), '[^0-9]', '', 'g'), '')
  ) returning id into v_patient_id;

  insert into public.perfis_usuarios (user_id, paciente_id)
  values (v_user_id, v_patient_id);
  return v_patient_id;
end;
$$;

create or replace function public.atualizar_meu_perfil(p_paciente jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_patient_id uuid;
  v_cpf text := regexp_replace(coalesce(p_paciente->>'cpf', ''), '[^0-9]', '', 'g');
  v_name text := trim(coalesce(p_paciente->>'nome_completo', ''));
begin
  if v_user_id is null or not exists (
    select 1 from public.user_roles r where r.user_id = v_user_id and r.role = 'user'
  ) then
    raise exception 'Acesso restrito a contas de usuário.' using errcode = '42501';
  end if;
  if length(v_name) < 3 or v_cpf !~ '^[0-9]{11}$'
     or coalesce(p_paciente->>'data_nascimento', '') !~ '^\d{4}-\d{2}-\d{2}$'
     or length(regexp_replace(coalesce(p_paciente->>'telefone', ''), '[^0-9]', '', 'g')) < 10 then
    raise exception 'Revise nome, CPF, data de nascimento e telefone.' using errcode = '22023';
  end if;

  select up.paciente_id into v_patient_id
  from public.perfis_usuarios up
  where up.user_id = v_user_id;
  if v_patient_id is null then
    raise exception 'Cadastre seu perfil antes de atualizá-lo.' using errcode = 'P0002';
  end if;

  update public.pacientes p set
    nome_completo = v_name,
    cpf = v_cpf,
    data_nascimento = (p_paciente->>'data_nascimento')::date,
    telefone = regexp_replace(coalesce(p_paciente->>'telefone', ''), '[^0-9]', '', 'g'),
    email = nullif(trim(coalesce(p_paciente->>'email', '')), ''),
    cns = nullif(regexp_replace(coalesce(p_paciente->>'cns', ''), '[^0-9]', '', 'g'), ''),
    telefone_responsavel = nullif(regexp_replace(coalesce(p_paciente->>'telefone_responsavel', ''), '[^0-9]', '', 'g'), '')
  where p.id = v_patient_id and p.owner_id = v_user_id;
end;
$$;

create or replace function public.registrar_inscricao_fila(p_paciente jsonb, p_inscricao jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_patient_id uuid;
  v_registration_id uuid;
  v_cpf text := regexp_replace(coalesce(p_paciente->>'cpf', ''), '[^0-9]', '', 'g');
  v_name text := trim(coalesce(p_paciente->>'nome_completo', ''));
  v_urgency text := coalesce(nullif(p_inscricao->>'urgencia', ''), 'normal');
begin
  if v_user_id is null or not exists (
    select 1 from public.user_roles r where r.user_id = v_user_id and r.role = 'user'
  ) then
    raise exception 'Acesso restrito a contas de usuário.' using errcode = '42501';
  end if;
  if length(v_name) < 3 or v_cpf !~ '^[0-9]{11}$'
     or coalesce(p_paciente->>'data_nascimento', '') !~ '^\d{4}-\d{2}-\d{2}$'
     or length(regexp_replace(coalesce(p_paciente->>'telefone', ''), '[^0-9]', '', 'g')) < 10 then
    raise exception 'Revise nome, CPF, data de nascimento e telefone.' using errcode = '22023';
  end if;
  if coalesce((p_inscricao->>'aceite')::boolean, false) is not true then
    raise exception 'O aceite é obrigatório.' using errcode = '22023';
  end if;
  if v_urgency not in ('normal', 'moderada', 'alta') then
    raise exception 'Nível de urgência inválido.' using errcode = '22023';
  end if;

  select up.paciente_id into v_patient_id
  from public.perfis_usuarios up where up.user_id = v_user_id;
  if v_patient_id is null then
    insert into public.pacientes (
      owner_id, nome_completo, cpf, data_nascimento, telefone,
      email, cns, telefone_responsavel
    ) values (
      v_user_id,
      v_name,
      v_cpf,
      (p_paciente->>'data_nascimento')::date,
      regexp_replace(coalesce(p_paciente->>'telefone', ''), '[^0-9]', '', 'g'),
      nullif(trim(coalesce(p_paciente->>'email', '')), ''),
      nullif(regexp_replace(coalesce(p_paciente->>'cns', ''), '[^0-9]', '', 'g'), ''),
      nullif(regexp_replace(coalesce(p_paciente->>'telefone_responsavel', ''), '[^0-9]', '', 'g'), '')
    ) returning id into v_patient_id;
    insert into public.perfis_usuarios (user_id, paciente_id)
    values (v_user_id, v_patient_id);
  else
    update public.pacientes p set
      nome_completo = v_name,
      cpf = v_cpf,
      data_nascimento = (p_paciente->>'data_nascimento')::date,
      telefone = regexp_replace(coalesce(p_paciente->>'telefone', ''), '[^0-9]', '', 'g'),
      email = nullif(trim(coalesce(p_paciente->>'email', '')), ''),
      cns = nullif(regexp_replace(coalesce(p_paciente->>'cns', ''), '[^0-9]', '', 'g'), ''),
      telefone_responsavel = nullif(regexp_replace(coalesce(p_paciente->>'telefone_responsavel', ''), '[^0-9]', '', 'g'), '')
    where p.id = v_patient_id and p.owner_id = v_user_id;
  end if;

  insert into public.inscricoes_fila (
    owner_id, paciente_id, especialidade_id, cidade_id,
    unidade_referencia_id, urgencia, descricao, aceite
  ) values (
    v_user_id,
    v_patient_id,
    (p_inscricao->>'especialidade_id')::uuid,
    (p_inscricao->>'cidade_id')::uuid,
    nullif(p_inscricao->>'unidade_referencia_id', '')::uuid,
    v_urgency,
    nullif(trim(coalesce(p_inscricao->>'descricao', '')), ''),
    true
  ) returning id into v_registration_id;

  return v_registration_id;
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
  v_user_id uuid := auth.uid();
  v_consulta_data date;
  v_transporte_data date;
  v_passageiros integer;
  v_disponiveis integer;
  v_solicitacao_id uuid;
begin
  if v_user_id is null or not exists (
    select 1 from public.user_roles r where r.user_id = v_user_id and r.role = 'user'
  ) then
    raise exception 'Acesso restrito a contas de usuário.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.perfis_usuarios up where up.user_id = v_user_id) then
    raise exception 'Complete seu perfil antes de solicitar uma consulta.' using errcode = 'P0002';
  end if;

  select c.data_hora::date into v_consulta_data
  from public.consultas c
  where c.id = p_consulta_id
    and c.status = 'disponivel'
    and c.vagas_disponiveis > 0
    and c.data_hora > now();
  if v_consulta_data is null then
    raise exception 'Consulta indisponível.' using errcode = '22023';
  end if;

  if p_transporte is not null and p_transporte <> 'null'::jsonb then
    v_transporte_data := (p_transporte->>'data')::date;
    v_passageiros := (p_transporte->>'passageiros')::integer;
    if v_transporte_data <> v_consulta_data then
      raise exception 'A data do transporte deve corresponder à data da consulta.' using errcode = '22023';
    end if;
    select ct.capacidade - ct.ocupados into v_disponiveis
    from public.capacidade_transporte ct where ct.data = v_transporte_data;
    if v_disponiveis is null or v_passageiros < 1 or v_passageiros > v_disponiveis then
      raise exception 'Não há capacidade para o transporte informado.' using errcode = '22023';
    end if;
    if coalesce((p_transporte->>'area_rural')::boolean, false)
       and nullif(trim(coalesce(p_transporte->>'comunidade_rural', '')), '') is null then
      raise exception 'Informe a comunidade rural.' using errcode = '22023';
    end if;
  end if;

  insert into public.solicitacoes_consulta (owner_id, consulta_id)
  values (v_user_id, p_consulta_id)
  returning id into v_solicitacao_id;

  if p_transporte is not null and p_transporte <> 'null'::jsonb then
    insert into public.solicitacoes_transporte (
      owner_id, solicitacao_consulta_id, data, ponto_embarque,
      area_rural, comunidade_rural, passageiros
    ) values (
      v_user_id,
      v_solicitacao_id,
      v_transporte_data,
      trim(p_transporte->>'ponto_embarque'),
      coalesce((p_transporte->>'area_rural')::boolean, false),
      nullif(trim(coalesce(p_transporte->>'comunidade_rural', '')), ''),
      v_passageiros
    );
  end if;
  return v_solicitacao_id;
end;
$$;

create or replace function public.cancelar_inscricao_fila(p_inscricao_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null or not exists (
    select 1 from public.user_roles r where r.user_id = v_user_id and r.role = 'user'
  ) then
    raise exception 'Acesso restrito a contas de usuário.' using errcode = '42501';
  end if;
  update public.inscricoes_fila q set status = 'cancelada'
  where q.id = p_inscricao_id and q.owner_id = v_user_id and q.status = 'ativa';
  if not found then
    raise exception 'Inscrição não encontrada ou já cancelada.' using errcode = 'P0002';
  end if;
end;
$$;

create or replace function public.cancelar_solicitacao_consulta(p_solicitacao_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null or not exists (
    select 1 from public.user_roles r where r.user_id = v_user_id and r.role = 'user'
  ) then
    raise exception 'Acesso restrito a contas de usuário.' using errcode = '42501';
  end if;
  update public.solicitacoes_consulta q set status = 'cancelada'
  where q.id = p_solicitacao_id and q.owner_id = v_user_id and q.status = 'solicitada';
  if not found then
    raise exception 'Pedido não encontrado ou já cancelado.' using errcode = 'P0002';
  end if;
  delete from public.solicitacoes_transporte t
  where t.solicitacao_consulta_id = p_solicitacao_id and t.owner_id = v_user_id;
end;
$$;

revoke all on function public.meu_perfil() from public, anon;
revoke all on function public.criar_meu_perfil(jsonb) from public, anon;
revoke all on function public.atualizar_meu_perfil(jsonb) from public, anon;
revoke all on function public.registrar_inscricao_fila(jsonb, jsonb) from public, anon;
revoke all on function public.registrar_solicitacao_consulta(uuid, jsonb) from public, anon;
revoke all on function public.cancelar_inscricao_fila(uuid) from public, anon;
revoke all on function public.cancelar_solicitacao_consulta(uuid) from public, anon;

grant execute on function public.meu_perfil() to authenticated;
grant execute on function public.criar_meu_perfil(jsonb) to authenticated;
grant execute on function public.atualizar_meu_perfil(jsonb) to authenticated;
grant execute on function public.registrar_inscricao_fila(jsonb, jsonb) to authenticated;
grant execute on function public.registrar_solicitacao_consulta(uuid, jsonb) to authenticated;
grant execute on function public.cancelar_inscricao_fila(uuid) to authenticated;
grant execute on function public.cancelar_solicitacao_consulta(uuid) to authenticated;

commit;

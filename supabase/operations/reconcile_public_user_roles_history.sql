-- Run only when 20261106000100_public_user_roles.sql was already applied
-- through the SQL Editor. Equivalent to migration repair --status applied;
-- never use this operation to skip executing an unapplied migration.
begin;
do $$
begin
  if to_regclass('public.user_roles') is null
     or to_regclass('public.perfis_usuarios') is null
     or to_regprocedure('public.meu_papel()') is null
     or to_regprocedure('public.cancelar_inscricao_fila(uuid)') is null
     or to_regprocedure('public.cancelar_solicitacao_consulta(uuid)') is null
     or not exists (select 1 from pg_trigger where tgname='consub_assign_default_user_role' and not tgisinternal)
     or (select count(*) from pg_policies where schemaname='public' and tablename in ('pacientes','inscricoes_fila','solicitacoes_consulta','solicitacoes_transporte'))<>12
  then
    raise exception 'Migration objects are incomplete. Apply/review the migration before repairing its history.';
  end if;
end;
$$;
insert into supabase_migrations.schema_migrations(version,name,statements)
values ('20261106000100','public_user_roles',array[]::text[])
on conflict (version) do nothing;
commit;
select version,name from supabase_migrations.schema_migrations order by version;

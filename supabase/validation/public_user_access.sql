-- Run as postgres in the Supabase SQL Editor. Test accounts and records are
-- created only inside this transaction and discarded by ROLLBACK.
-- Does not validate email delivery or the Auth HTTP login flow.
begin;

do $test$
declare
  a uuid := gen_random_uuid();
  b uuid := gen_random_uuid();
  operator_id uuid;
  pa uuid;
  pb uuid;
  qa uuid;
  qb uuid;
  ra uuid;
  rb uuid;
  consultation_id uuid;
  consultation_date date;
  specialty_id uuid;
  city_id uuid;
  unit_id uuid;
  before_vacancies integer;
  before_occupied integer;
  affected integer;
  patient_data jsonb;
  subject_id uuid;
  other_id uuid;
  table_name text;
begin
  select user_id into strict operator_id from public.user_roles where role='operator';
  select c.id, c.data_hora::date, c.vagas_disponiveis, ct.ocupados
    into strict consultation_id, consultation_date, before_vacancies, before_occupied
    from public.consultas c join public.capacidade_transporte ct on ct.data=c.data_hora::date
    where c.status='disponivel' and c.data_hora>now() and c.vagas_disponiveis>0 and ct.capacidade>ct.ocupados
    order by c.data_hora limit 1;
  select u.id,u.cidade_id,e.id into strict unit_id,city_id,specialty_id
    from public.unidades_saude u cross join public.especialidades e order by u.nome,e.nome limit 1;

  insert into auth.users(id,email,raw_user_meta_data) values
    (a,'consub-validation-a@example.invalid','{"role":"operator"}'),
    (b,'consub-validation-b@example.invalid','{"role":"operator"}');
  if (select count(*) from public.user_roles where user_id in(a,b) and role='user')<>2 then
    raise exception 'FAIL: default user role or metadata escalation';
  end if;

  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub',a::text,true);
  if public.meu_papel()<>'user' or public.is_operator() then raise exception 'FAIL: user role'; end if;
  patient_data := jsonb_build_object('nome_completo','Validation A','cpf','00000000101','data_nascimento','1990-01-01','telefone','00000000101','owner_id',b);
  pa := public.criar_meu_perfil(patient_data);
  begin
    perform public.criar_meu_perfil(patient_data);
    raise exception 'FAIL: more than one profile per account';
  exception when unique_violation then null;
  end;
  perform public.atualizar_meu_perfil(patient_data || '{"nome_completo":"Validation A edited"}'::jsonb);
  if (select nome_completo from public.meu_perfil())<>'Validation A edited' then raise exception 'FAIL: own profile edit'; end if;
  qa := public.registrar_inscricao_fila(patient_data,jsonb_build_object('especialidade_id',specialty_id,'cidade_id',city_id,'unidade_referencia_id',unit_id,'aceite',true,'owner_id',b));
  ra := public.registrar_solicitacao_consulta(consultation_id,jsonb_build_object('data',consultation_date,'ponto_embarque','Ponto Teste A','passageiros',1,'area_rural',false,'owner_id',b));
  if (select count(*) from public.pacientes where owner_id=a)<>1 then raise exception 'FAIL: profile owner'; end if;
  if (select count(*) from public.inscricoes_fila where id=qa and owner_id=a)<>1 then raise exception 'FAIL: queue owner'; end if;
  if (select count(*) from public.solicitacoes_transporte where solicitacao_consulta_id=ra and owner_id=a)<>1 then raise exception 'FAIL: transport owner'; end if;

  perform set_config('request.jwt.claim.sub',b::text,true);
  patient_data := jsonb_build_object('nome_completo','Validation B','cpf','00000000102','data_nascimento','1992-02-02','telefone','00000000102');
  pb := public.criar_meu_perfil(patient_data);
  qb := public.registrar_inscricao_fila(patient_data,jsonb_build_object('especialidade_id',specialty_id,'cidade_id',city_id,'unidade_referencia_id',unit_id,'aceite',true));
  rb := public.registrar_solicitacao_consulta(consultation_id,jsonb_build_object('data',consultation_date,'ponto_embarque','Ponto Teste B','passageiros',1,'area_rural',false));
  foreach subject_id in array array[a,b] loop
    perform set_config('request.jwt.claim.sub',subject_id::text,true);
    other_id := case when subject_id=a then b else a end;
    foreach table_name in array array['pacientes','inscricoes_fila','solicitacoes_consulta','solicitacoes_transporte'] loop
      execute format('select count(*) from public.%I where owner_id<>$1',table_name) into affected using subject_id;
      if affected<>0 then raise exception 'FAIL: cross-user SELECT on %',table_name; end if;
      execute format('update public.%I set created_at=created_at where owner_id=$1',table_name) using other_id;
      get diagnostics affected=row_count;
      if affected<>0 then raise exception 'FAIL: cross-user UPDATE on %',table_name; end if;
      execute format('delete from public.%I where owner_id=$1',table_name) using other_id;
      get diagnostics affected=row_count;
      if affected<>0 then raise exception 'FAIL: cross-user DELETE on %',table_name; end if;
    end loop;
  end loop;
  perform set_config('request.jwt.claim.sub',b::text,true);
  if exists(select 1 from public.pacientes where id=pa) or exists(select 1 from public.inscricoes_fila where id=qa)
     or exists(select 1 from public.solicitacoes_consulta where id=ra)
     or exists(select 1 from public.solicitacoes_transporte where solicitacao_consulta_id=ra) then raise exception 'FAIL: B reads A'; end if;
  update public.pacientes set nome_completo='Tentativa B' where id=pa;
  get diagnostics affected=row_count;
  if affected<>0 then raise exception 'FAIL: B edits A'; end if;
  delete from public.pacientes where id=pa;
  get diagnostics affected=row_count;
  if affected<>0 then raise exception 'FAIL: B deletes A'; end if;
  begin
    perform public.cancelar_solicitacao_consulta(ra);
    raise exception 'FAIL: B cancels A';
  exception when no_data_found then null;
  end;
  begin
    update public.user_roles set role='operator' where user_id=b;
    raise exception 'FAIL: role promotion';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.pacientes(owner_id,nome_completo,cpf,data_nascimento,telefone) values(a,'Tentativa B','00000000103','1990-01-01','00000000103');
    raise exception 'FAIL: direct creation for another owner';
  exception when insufficient_privilege then null;
  end;

  perform set_config('request.jwt.claim.sub',a::text,true);
  if exists(select 1 from public.pacientes where id=pb) or exists(select 1 from public.inscricoes_fila where id=qb)
     or exists(select 1 from public.solicitacoes_consulta where id=rb)
     or exists(select 1 from public.solicitacoes_transporte where solicitacao_consulta_id=rb) then raise exception 'FAIL: A reads B'; end if;
  update public.inscricoes_fila set status='cancelada' where id=qb;
  get diagnostics affected=row_count;
  if affected<>0 then raise exception 'FAIL: A edits B queue'; end if;
  delete from public.solicitacoes_consulta where id=rb;
  get diagnostics affected=row_count;
  if affected<>0 then raise exception 'FAIL: A deletes B request'; end if;
  begin
    perform public.cancelar_inscricao_fila(qb);
    raise exception 'FAIL: A cancels B queue';
  exception when no_data_found then null;
  end;
  perform public.cancelar_inscricao_fila(qa);
  perform public.cancelar_solicitacao_consulta(ra);
  if (select status from public.inscricoes_fila where id=qa)<>'cancelada'
     or (select status from public.solicitacoes_consulta where id=ra)<>'cancelada'
     or exists(select 1 from public.solicitacoes_transporte where solicitacao_consulta_id=ra) then raise exception 'FAIL: own cancellation'; end if;

  perform set_config('request.jwt.claim.sub',operator_id::text,true);
  if not public.is_operator() or (select count(*) from public.pacientes where id in(pa,pb))<>2 then raise exception 'FAIL: operator visibility'; end if;
  foreach table_name in array array['pacientes','inscricoes_fila','solicitacoes_consulta','solicitacoes_transporte'] loop
    begin
      execute format('update public.%I set owner_id=$1 where owner_id=$2',table_name) using a,b;
      raise exception 'FAIL: owner reassignment on %',table_name;
    exception when insufficient_privilege then null;
    end;
    if has_table_privilege('authenticated',format('public.%I',table_name),'INSERT') then raise exception 'FAIL: direct INSERT on %',table_name; end if;
  end loop;
  update public.pacientes set nome_completo='Operador editou' where id in(pa,pb);
  get diagnostics affected=row_count;
  if affected<>2 then raise exception 'FAIL: operator profile edits'; end if;
  update public.inscricoes_fila set status='atendida' where id in(qa,qb);
  get diagnostics affected=row_count;
  if affected<>2 then raise exception 'FAIL: operator status changes'; end if;
  update public.solicitacoes_transporte set ponto_embarque='Ponto editado' where solicitacao_consulta_id=rb;
  get diagnostics affected=row_count;
  if affected<>1 then raise exception 'FAIL: operator transport edits'; end if;
  begin
    update public.pacientes set owner_id=b where id=pa;
    raise exception 'FAIL: owner reassignment';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.criar_meu_perfil(patient_data);
    raise exception 'FAIL: operator creating user profile';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.registrar_solicitacao_consulta(consultation_id,null);
    raise exception 'FAIL: operator creating request';
  exception when insufficient_privilege then null;
  end;
  if (select vagas_disponiveis from public.consultas where id=consultation_id)<>before_vacancies
     or (select ocupados from public.capacidade_transporte where data=consultation_date)<>before_occupied then raise exception 'FAIL: requests reserve capacity'; end if;
  delete from public.pacientes where id in(pa,pb);
  get diagnostics affected=row_count;
  if affected<>2 then raise exception 'FAIL: operator deletion'; end if;
  delete from public.solicitacoes_consulta where id in(ra,rb);
  get diagnostics affected=row_count;
  if affected<>2 then raise exception 'FAIL: operator request deletion'; end if;
  execute 'set local role anon';
  begin
    perform count(*) from public.pacientes;
    raise exception 'FAIL: anonymous reads patients';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.criar_meu_perfil(patient_data);
    raise exception 'FAIL: anonymous invokes RPC';
  exception when insufficient_privilege then null;
  end;
  execute 'reset role';
end;
$test$;

rollback;
select 'PASS: two users isolated; own profile, requests and cancellation; no role escalation; operator management; capacity unchanged; all test data rolled back' as validation_result;

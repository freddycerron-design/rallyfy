-- Emulación mínima de Supabase para validar migraciones en PGlite (scripts/validar-sql).
-- Replica: esquemas auth/extensions/realtime, roles anon/authenticated/service_role,
-- privilegios por defecto de Supabase, auth.uid()/auth.jwt(), realtime.send y un stub de pgTAP.
create schema extensions;
create schema auth;
create schema realtime;
create role anon nologin noinherit;
create role authenticated nologin noinherit;
create role service_role nologin noinherit bypassrls;
grant usage on schema public, extensions, auth, realtime to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
set search_path = public, extensions;

create table auth.users (
  instance_id uuid, id uuid primary key, aud varchar(255), role varchar(255), email varchar(255),
  encrypted_password varchar(255), email_confirmed_at timestamptz,
  raw_app_meta_data jsonb, raw_user_meta_data jsonb, is_anonymous boolean not null default false,
  created_at timestamptz default now(), updated_at timestamptz default now(),
  confirmation_token varchar(255), recovery_token varchar(255),
  email_change_token_new varchar(255), email_change varchar(255)
);
create table auth.identities (
  id uuid primary key, user_id uuid references auth.users(id) on delete cascade,
  provider_id text, identity_data jsonb, provider text, last_sign_in_at timestamptz,
  created_at timestamptz, updated_at timestamptz
);
create function auth.uid() returns uuid language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'))::uuid $$;
create function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claim', true), ''),
    nullif(current_setting('request.jwt.claims', true), ''))::jsonb $$;
grant execute on all functions in schema auth to anon, authenticated, service_role;

create table realtime.messages (
  id bigserial primary key, topic text not null, extension text not null default 'broadcast',
  payload jsonb, event text, private boolean, inserted_at timestamptz default now()
);
create function realtime.send(payload jsonb, event text, topic text, private boolean default true)
returns void language plpgsql as $$
begin
  insert into realtime.messages (payload, event, topic, private) values (payload, event, topic, private);
end $$;
create publication supabase_realtime;

-- Stub de pgTAP (subconjunto usado en supabase/tests). Corre como el rol actual.
create table extensions.tap_resultados (n serial, ok boolean, descripcion text, detalle text);
create table extensions.tap_plan (total int);
grant all on extensions.tap_resultados, extensions.tap_plan to public;
grant usage on sequence extensions.tap_resultados_n_seq to public;
create function extensions.plan(int) returns text language sql as $$
  truncate extensions.tap_resultados restart identity; delete from extensions.tap_plan;
  insert into extensions.tap_plan values ($1); select '1..' || $1 $$;
create function extensions._registrar(boolean, text, text default null) returns text language sql as $$
  insert into extensions.tap_resultados (ok, descripcion, detalle) values ($1, $2, $3);
  select case when $1 then 'ok' else 'not ok' end || ' - ' || $2 $$;
create function extensions.ok(boolean, text) returns text language sql as $$
  select extensions._registrar(coalesce($1, false), $2) $$;
create function extensions.is(anyelement, anyelement, text) returns text language sql as $$
  select extensions._registrar($1 is not distinct from $2, $3,
    format('obtenido: %s, esperado: %s', $1, $2)) $$;
create function extensions.lives_ok(text, text) returns text language plpgsql as $$
begin
  execute $1;
  return extensions._registrar(true, $2);
exception when others then
  return extensions._registrar(false, $2, sqlstate || ': ' || sqlerrm);
end $$;
create function extensions.throws_ok(text, text, text, text) returns text language plpgsql as $$
begin
  execute $1;
  return extensions._registrar(false, $4, 'no lanzó error');
exception when others then
  return extensions._registrar(sqlstate = $2 and ($3 is null or sqlerrm = $3), $4,
    sqlstate || ': ' || sqlerrm);
end $$;
create function extensions.is_empty(text, text) returns text language plpgsql as $$
declare v int;
begin
  execute format('select count(*) from (%s) q', $1) into v;
  return extensions._registrar(v = 0, $2, format('%s filas', v));
exception when others then
  return extensions._registrar(false, $2, sqlstate || ': ' || sqlerrm);
end $$;
create function extensions.finish() returns setof text language sql as $$
  select * from (
    select (case when ok then 'ok ' else 'not ok ' end) || n || ' - ' || descripcion ||
           case when ok then '' else '  # ' || coalesce(detalle, '') end
    from extensions.tap_resultados order by n
  ) r
  union all
  select '# plan ' || (select total from extensions.tap_plan) || ', ejecutadas ' ||
         (select count(*) from extensions.tap_resultados) $$;

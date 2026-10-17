-- Operaciones del panel de administración.
-- Ejecutar con: npm run supabase -- test db
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(8);

insert into auth.users (id, aud, role, email, is_anonymous)
values
  ('12000000-0000-4000-8000-0000000000a1', 'authenticated', 'authenticated', 'admin3@test.local', false),
  ('12000000-0000-4000-8000-0000000000a2', 'authenticated', 'authenticated', 'mod3@test.local', false);
update perfiles set rol = 'admin' where usuario_id = '12000000-0000-4000-8000-0000000000a1';
update perfiles set rol = 'moderador' where usuario_id = '12000000-0000-4000-8000-0000000000a2';

update eventos set activo = false;
insert into eventos (id, nombre, fecha_inicio, fecha_fin, activo)
values
  ('22000000-0000-4000-8000-000000000001', 'Evento A', current_date, current_date, true),
  ('22000000-0000-4000-8000-000000000002', 'Evento B', current_date, current_date, false);

-- Moderador: no puede activar.
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"12000000-0000-4000-8000-0000000000a2","role":"authenticated","is_anonymous":false}', true);
select throws_ok($$ select activar_evento('22000000-0000-4000-8000-000000000002') $$,
  '42501', null, 'moderador: no puede activar eventos');

-- Admin
select set_config('request.jwt.claims',
  '{"sub":"12000000-0000-4000-8000-0000000000a1","role":"authenticated","is_anonymous":false}', true);
select lives_ok($$ select activar_evento('22000000-0000-4000-8000-000000000002') $$,
  'admin: activa otro evento aunque ya haya uno activo');
select is(
  (select array_agg(nombre order by nombre) from eventos where activo),
  array['Evento B'], 'queda activo solo el nuevo');
select throws_ok($$ select activar_evento('22000000-0000-4000-8000-0000000000ff') $$,
  'PT404', null, 'admin: evento inexistente da 404');
select is(
  (select count(*)::int from eventos where activo), 1, 'un error no deja la app sin evento activo');
select lives_ok($$ select activar_evento(null) $$, 'admin: puede desactivar todos');
select is((select count(*)::int from eventos where activo), 0, 'sin eventos activos');

-- Carga de tramo como la hace el panel: geometría en EWKT.
select lives_ok(
  $$ insert into tramos (evento_id, codigo, nombre, orden, trazado)
     values ('22000000-0000-4000-8000-000000000001', 'A1', 'Desde EWKT', 1,
             'SRID=4326;LINESTRING(-64.5 -31.4,-64.49 -31.39)') $$,
  'admin: inserta un tramo enviando el trazado como EWKT');

select * from finish();
rollback;

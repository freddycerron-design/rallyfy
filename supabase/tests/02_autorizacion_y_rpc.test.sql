-- Autorización por rol (docs/03-matriz-rls.md) y funciones RPC.
-- Ejecutar con: npm run supabase -- test db
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(44);

-- ---------------------------------------------------------------------------
-- Datos de prueba
-- ---------------------------------------------------------------------------
insert into auth.users (id, aud, role, email, is_anonymous)
values
  ('11000000-0000-4000-8000-0000000000a1', 'authenticated', 'authenticated', 'admin@test.local', false),
  ('11000000-0000-4000-8000-0000000000a2', 'authenticated', 'authenticated', 'mod@test.local', false),
  ('11000000-0000-4000-8000-0000000000a3', 'authenticated', 'authenticated', 'nuevo@test.local', false),
  ('11000000-0000-4000-8000-0000000000f1', 'authenticated', 'authenticated', null, true),
  ('11000000-0000-4000-8000-0000000000f2', 'authenticated', 'authenticated', null, true),
  -- Anónimo con perfil de moderador forzado: no debe obtener permisos.
  ('11000000-0000-4000-8000-0000000000f3', 'authenticated', 'authenticated', null, true);

update perfiles set rol = 'admin' where usuario_id = '11000000-0000-4000-8000-0000000000a1';
update perfiles set rol = 'moderador'
where usuario_id in ('11000000-0000-4000-8000-0000000000a2', '11000000-0000-4000-8000-0000000000f3');

insert into eventos (id, nombre, fecha_inicio, fecha_fin)
values ('21000000-0000-4000-8000-000000000001', 'Evento RLS', current_date, current_date);
insert into tramos (id, evento_id, codigo, nombre, orden, trazado)
values ('31000000-0000-4000-8000-000000000001', '21000000-0000-4000-8000-000000000001',
  'R1', 'Tramo RLS', 1, st_geomfromtext('LINESTRING(-64.0 -31.0, -64.0 -30.9)', 4326));
insert into inscritos (evento_id, numero, piloto)
values ('21000000-0000-4000-8000-000000000001', 3, 'Tres');

-- f1: una pendiente; f2: una aprobada.
insert into publicaciones (id, evento_id, tramo_id, usuario_id, url_original, url_canonica,
  plataforma, id_externo, autos, ubicacion, ip_hash, estado, moderado_en)
values
  ('41000000-0000-4000-8000-000000000001', '21000000-0000-4000-8000-000000000001',
   '31000000-0000-4000-8000-000000000001', '11000000-0000-4000-8000-0000000000f1',
   'u', 'https://www.youtube.com/watch?v=RlsPendient', 'youtube', 'RlsPendient', '{3}',
   st_setsrid(st_makepoint(-64.0, -30.95), 4326), 'hash-f1', 'pendiente', null),
  ('41000000-0000-4000-8000-000000000002', '21000000-0000-4000-8000-000000000001',
   '31000000-0000-4000-8000-000000000001', '11000000-0000-4000-8000-0000000000f2',
   'u', 'https://www.youtube.com/watch?v=RlsAprobada', 'youtube', 'RlsAprobada', '{3}',
   st_setsrid(st_makepoint(-64.0, -30.92), 4326), 'hash-f2', 'aprobada', now());

-- ===========================================================================
-- Público (anon, sin sesión)
-- ===========================================================================
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select throws_ok($$ select * from publicaciones $$, '42501', null,
  'anon: no puede leer la tabla publicaciones');
select throws_ok($$ select * from perfiles $$, '42501', null,
  'anon: no puede leer perfiles');
select throws_ok($$ select * from votos $$, '42501', null,
  'anon: no puede leer votos');
select is(
  (select count(*)::int from muro_publico where evento_id = '21000000-0000-4000-8000-000000000001'),
  1, 'anon: el muro muestra solo la aprobada');
select ok(
  (select count(*) > 0 from tramos_publicos), 'anon: puede leer tramos_publicos');
select throws_ok($$ select votar('41000000-0000-4000-8000-000000000002') $$, '42501', null,
  'anon: no puede votar sin sesión');
select throws_ok(
  $$ select moderar_publicacion('41000000-0000-4000-8000-000000000001', 'aprobar') $$,
  '42501', null, 'anon: no puede moderar');
select throws_ok(
  $$ insert into eventos (nombre, fecha_inicio, fecha_fin) values ('x x x', current_date, current_date) $$,
  '42501', null, 'anon: no puede crear eventos');

-- ===========================================================================
-- Aficionado anónimo f1
-- ===========================================================================
reset role;
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"11000000-0000-4000-8000-0000000000f1","role":"authenticated","is_anonymous":true}', true);

select is(
  (select count(*)::int from publicaciones), 1,
  'aficionado: solo ve sus propias publicaciones');
select is(
  (select estado from publicaciones), 'pendiente'::estado_publicacion,
  'aficionado: ve su envío pendiente');
select throws_ok($$ select ip_hash from publicaciones $$, '42501', null,
  'aficionado: no puede leer ip_hash');
select throws_ok(
  $$ insert into publicaciones (evento_id, tramo_id, url_original, url_canonica, plataforma,
       id_externo, ubicacion)
     values ('21000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000001',
       'u', 'https://www.youtube.com/watch?v=Directo0001', 'youtube', 'Directo0001',
       st_setsrid(st_makepoint(-64, -30.95), 4326)) $$,
  '42501', null, 'aficionado: no puede insertar publicaciones directamente');
select throws_ok(
  $$ update publicaciones set estado = 'aprobada' $$,
  '42501', null, 'aficionado: no puede aprobar con un UPDATE directo');
select throws_ok(
  $$ update perfiles set rol = 'admin' where usuario_id = auth.uid() $$,
  '42501', null, 'aficionado: no puede cambiarse el rol');
select lives_ok(
  $$ update perfiles set alias = 'Nuevo alias' where usuario_id = auth.uid() $$,
  'aficionado: puede cambiar su alias');
select is(
  (select count(*)::int from perfiles), 1, 'aficionado: solo ve su perfil');
select throws_ok(
  $$ select moderar_publicacion('41000000-0000-4000-8000-000000000001', 'aprobar') $$,
  '42501', null, 'aficionado: no puede moderar');
select throws_ok(
  $$ insert into tramos (evento_id, codigo, nombre, orden, trazado)
     values ('21000000-0000-4000-8000-000000000001', 'Z', 'Z', 5,
             st_geomfromtext('LINESTRING(0 0, 0 1)', 4326)) $$,
  '42501', null, 'aficionado: no puede crear tramos');
select throws_ok($$ select cambiar_rol('nuevo@test.local', 'admin') $$, '42501', null,
  'aficionado: no puede cambiar roles');

select is(votar('41000000-0000-4000-8000-000000000002'), 1, 'votar suma un voto');
select is(votar('41000000-0000-4000-8000-000000000002'), 1, 'votar dos veces no suma otro');
select is(
  (select count(*)::int from votos), 1, 'aficionado: ve su voto');
select is(quitar_voto('41000000-0000-4000-8000-000000000002'), 0, 'quitar_voto resta el voto');
select throws_ok($$ select votar('41000000-0000-4000-8000-000000000001') $$, 'PT404', null,
  'no se puede votar una publicación pendiente');

-- ===========================================================================
-- Aficionado anónimo f2 no ve lo pendiente de f1
-- ===========================================================================
select set_config('request.jwt.claims',
  '{"sub":"11000000-0000-4000-8000-0000000000f2","role":"authenticated","is_anonymous":true}', true);
select is_empty(
  $$ select 1 from publicaciones where id = '41000000-0000-4000-8000-000000000001' $$,
  'aficionado: no ve envíos pendientes de otros');

-- ===========================================================================
-- Sesión anónima con perfil de moderador (forzado)
-- ===========================================================================
select set_config('request.jwt.claims',
  '{"sub":"11000000-0000-4000-8000-0000000000f3","role":"authenticated","is_anonymous":true}', true);
select is(es_moderador(), false, 'una sesión anónima nunca es moderadora');
select throws_ok(
  $$ select moderar_publicacion('41000000-0000-4000-8000-000000000001', 'aprobar') $$,
  '42501', null, 'sesión anónima con rol forzado: no puede moderar');

-- ===========================================================================
-- Moderador
-- ===========================================================================
select set_config('request.jwt.claims',
  '{"sub":"11000000-0000-4000-8000-0000000000a2","role":"authenticated","is_anonymous":false}', true);

select is(es_moderador(), true, 'moderador: es_moderador() es verdadero');
select ok(
  (select count(*) >= 2 from publicaciones), 'moderador: ve las publicaciones de todos');
select throws_ok(
  $$ select moderar_publicacion('41000000-0000-4000-8000-000000000001', 'rechazar') $$,
  '22023', null, 'moderador: rechazar exige motivo');
select throws_ok(
  $$ select moderar_publicacion('41000000-0000-4000-8000-000000000001', 'corregir',
       p_autos => '{3,99}') $$,
  '23514', null, 'moderador: no puede corregir con autos no inscritos');
select is(
  moderar_publicacion('41000000-0000-4000-8000-000000000001', 'aprobar'),
  'aprobada'::estado_publicacion, 'moderador: aprueba');
reset role;
select is(
  (select count(*)::int from realtime.messages
   where topic = 'muro:21000000-0000-4000-8000-000000000001'),
  1, 'aprobar emite un aviso Broadcast al canal del evento');
set local role authenticated;
select is(
  moderar_publicacion('41000000-0000-4000-8000-000000000002', 'rechazar', 'duplicado'),
  'rechazada'::estado_publicacion, 'moderador: rechaza con motivo');
select is(
  (select count(*)::int from muro_publico where evento_id = '21000000-0000-4000-8000-000000000001'
     and id = '41000000-0000-4000-8000-000000000002'),
  0, 'una rechazada sale del muro');
select throws_ok(
  $$ insert into tramos (evento_id, codigo, nombre, orden, trazado)
     values ('21000000-0000-4000-8000-000000000001', 'Z', 'Z', 5,
             st_geomfromtext('LINESTRING(0 0, 0 1)', 4326)) $$,
  '42501', null, 'moderador: no puede crear tramos');
select throws_ok($$ select * from listar_equipo() $$, '42501', null,
  'moderador: no puede listar el equipo');

-- ===========================================================================
-- Admin
-- ===========================================================================
select set_config('request.jwt.claims',
  '{"sub":"11000000-0000-4000-8000-0000000000a1","role":"authenticated","is_anonymous":false}', true);

select lives_ok(
  $$ insert into inscritos (evento_id, numero, piloto)
     values ('21000000-0000-4000-8000-000000000001', 50, 'Cincuenta') $$,
  'admin: puede cargar inscritos');
select lives_ok($$ select cambiar_rol('nuevo@test.local', 'moderador') $$,
  'admin: promueve a moderador por correo');
select throws_ok($$ select cambiar_rol('admin@test.local', 'aficionado') $$, '22023', null,
  'admin: no puede cambiar su propio rol');
select throws_ok($$ select cambiar_rol('nadie@test.local', 'moderador') $$, 'PT404', null,
  'admin: correo inexistente da 404');
select ok(
  exists (select 1 from listar_equipo() where email = 'nuevo@test.local' and rol = 'moderador'),
  'admin: el equipo incluye al nuevo moderador');
select lives_ok(
  $$ delete from publicaciones where id = '41000000-0000-4000-8000-000000000002' $$,
  'admin: puede borrar publicaciones');

-- ===========================================================================
-- Límite de votos: 60 por hora
-- ===========================================================================
reset role;
insert into publicaciones (evento_id, tramo_id, url_original, url_canonica, plataforma,
  id_externo, ubicacion, estado, moderado_en)
select '21000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000001', 'u',
  'https://www.youtube.com/watch?v=Lim' || lpad(g::text, 8, '0'), 'youtube',
  'Lim' || lpad(g::text, 8, '0'), st_setsrid(st_makepoint(-64, -30.95), 4326), 'aprobada', now()
from generate_series(1, 61) g;
insert into votos (publicacion_id, usuario_id)
select id, '11000000-0000-4000-8000-0000000000f2'
from publicaciones where id_externo like 'Lim%' and id_externo <> 'Lim00000061';
select set_config('prueba.pub61',
  (select id::text from publicaciones where id_externo = 'Lim00000061'), true);

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"11000000-0000-4000-8000-0000000000f2","role":"authenticated","is_anonymous":true}', true);
select throws_ok(
  $$ select votar(current_setting('prueba.pub61')::uuid) $$,
  'PT429', null, 'el voto 61 en una hora se rechaza');

select * from finish();
rollback;

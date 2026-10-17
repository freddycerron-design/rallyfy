-- Cálculos de triggers y contenido de las vistas públicas.
-- Ejecutar con: npm run supabase -- test db
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(27);

-- ---------------------------------------------------------------------------
-- Datos de prueba (independientes del seed)
-- ---------------------------------------------------------------------------
insert into auth.users (id, aud, role, email, raw_user_meta_data, is_anonymous)
values
  ('10000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', null,
   '{"alias":"Fan Test"}', true),
  ('10000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', null,
   '{"alias":"x"}', true);

insert into eventos (id, nombre, fecha_inicio, fecha_fin)
values
  ('20000000-0000-4000-8000-000000000001', 'Evento de prueba', current_date, current_date),
  ('20000000-0000-4000-8000-000000000002', 'Otro evento', current_date, current_date);

-- Tramo recto sur→norte de 0,1° de latitud (≈ 11,1 km).
insert into tramos (id, evento_id, codigo, nombre, orden, trazado, hora_inicio_prevista)
values
  ('30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001',
   'T1', 'Recta', 1, st_geomfromtext('LINESTRING(-64.0 -31.0, -64.0 -30.9)', 4326),
   now() + interval '1 hour'),
  ('30000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001',
   'T2', 'Segunda', 2, st_geomfromtext('LINESTRING(-64.1 -31.0, -64.1 -30.9)', 4326),
   now() - interval '1 hour'),
  ('30000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000002',
   'X1', 'De otro evento', 1, st_geomfromtext('LINESTRING(-65.0 -31.0, -65.0 -30.9)', 4326),
   null);

insert into inscritos (evento_id, numero, piloto)
values
  ('20000000-0000-4000-8000-000000000001', 7, 'Siete'),
  ('20000000-0000-4000-8000-000000000001', 9, 'Nueve'),
  ('20000000-0000-4000-8000-000000000001', 40, 'Cuarenta');

-- ---------------------------------------------------------------------------
-- Perfiles
-- ---------------------------------------------------------------------------
select is(
  (select alias from perfiles where usuario_id = '10000000-0000-4000-8000-000000000001'),
  'Fan Test',
  'el trigger crea el perfil con el alias de los metadatos'
);
select is(
  (select alias from perfiles where usuario_id = '10000000-0000-4000-8000-000000000002'),
  null,
  'un alias demasiado corto se descarta'
);
select is(
  (select rol from perfiles where usuario_id = '10000000-0000-4000-8000-000000000001'),
  'aficionado'::rol_usuario,
  'el rol por defecto es aficionado'
);

-- ---------------------------------------------------------------------------
-- Tramos y eventos
-- ---------------------------------------------------------------------------
select ok(
  (select longitud_km between 11.0 and 11.2 from tramos
   where id = '30000000-0000-4000-8000-000000000001'),
  'longitud_km se calcula desde el trazado (≈ 11,1 km)'
);

select throws_ok(
  $$ insert into tramos (evento_id, codigo, nombre, orden, trazado)
     values ('20000000-0000-4000-8000-000000000001', 'T1', 'Repetido', 9,
             st_geomfromtext('LINESTRING(0 0, 0 1)', 4326)) $$,
  '23505', null,
  'no se repite el código de tramo dentro del evento'
);

update eventos set activo = false;
select lives_ok(
  $$ update eventos set activo = true where id = '20000000-0000-4000-8000-000000000001' $$,
  'se puede activar un evento'
);
select throws_ok(
  $$ update eventos set activo = true where id = '20000000-0000-4000-8000-000000000002' $$,
  '23505', null,
  'no puede haber dos eventos activos'
);

-- ---------------------------------------------------------------------------
-- Publicaciones: posición en el tramo y validaciones
-- ---------------------------------------------------------------------------
-- A mitad del tramo, ≈ 95 m al este del trazado.
insert into publicaciones (id, evento_id, tramo_id, usuario_id, url_original, url_canonica,
  plataforma, id_externo, autos, ubicacion)
values ('40000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001',
  'https://youtu.be/TestVideo01', 'https://www.youtube.com/watch?v=TestVideo01',
  'youtube', 'TestVideo01', '{9,7,7}', st_setsrid(st_makepoint(-63.999, -30.95), 4326));

select ok(
  (select abs(fraccion_tramo - 0.5) < 0.001 from publicaciones
   where id = '40000000-0000-4000-8000-000000000001'),
  'fraccion_tramo ≈ 0,5 a mitad del tramo'
);
select ok(
  (select abs(km_en_tramo - t.longitud_km / 2) < 0.01
   from publicaciones p join tramos t on t.id = p.tramo_id
   where p.id = '40000000-0000-4000-8000-000000000001'),
  'km_en_tramo = mitad de la longitud'
);
select ok(
  (select distancia_al_trazado_m between 90 and 100 from publicaciones
   where id = '40000000-0000-4000-8000-000000000001'),
  'distancia_al_trazado_m ≈ 95 m'
);
select is(
  (select lejos_del_trazado from publicaciones where id = '40000000-0000-4000-8000-000000000001'),
  false,
  'a menos de 500 m no está lejos del trazado'
);
select is(
  (select autos from publicaciones where id = '40000000-0000-4000-8000-000000000001'),
  '{7,9}'::integer[],
  'autos se ordenan y se quitan repetidos'
);

-- ≈ 950 m al este, km 8 aprox.
insert into publicaciones (id, evento_id, tramo_id, url_original, url_canonica, plataforma,
  id_externo, autos, ubicacion, es_en_vivo)
values ('40000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000001', 'https://www.tiktok.com/@x/video/1',
  'https://www.tiktok.com/@x/video/1', 'tiktok', '1', '{7}',
  st_setsrid(st_makepoint(-63.99, -30.93), 4326), true);

select is(
  (select lejos_del_trazado from publicaciones where id = '40000000-0000-4000-8000-000000000002'),
  true,
  'a más de 500 m queda marcada como lejos del trazado'
);
select is(
  (select en_vivo_hasta - creado_en from publicaciones
   where id = '40000000-0000-4000-8000-000000000002'),
  interval '2 hours',
  'en vivo vence a las 2 horas'
);

select throws_ok(
  $$ insert into publicaciones (evento_id, tramo_id, url_original, url_canonica, plataforma,
       id_externo, autos, ubicacion)
     values ('20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001',
       'u', 'https://www.youtube.com/watch?v=Otro0000001', 'youtube', 'Otro0000001', '{7,99}',
       st_setsrid(st_makepoint(-64, -30.95), 4326)) $$,
  '23514', 'Autos no inscritos en el evento: 99',
  'rechaza autos que no están inscritos'
);
select throws_ok(
  $$ insert into publicaciones (evento_id, tramo_id, url_original, url_canonica, plataforma,
       id_externo, ubicacion)
     values ('20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000003',
       'u', 'https://www.youtube.com/watch?v=Otro0000002', 'youtube', 'Otro0000002',
       st_setsrid(st_makepoint(-65, -30.95), 4326)) $$,
  '23514', 'El tramo no pertenece al evento',
  'rechaza un tramo de otro evento'
);
select throws_ok(
  $$ insert into publicaciones (evento_id, tramo_id, url_original, url_canonica, plataforma,
       id_externo, ubicacion)
     values ('20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001',
       'u', 'https://www.youtube.com/watch?v=TestVideo01', 'youtube', 'TestVideo01',
       st_setsrid(st_makepoint(-64, -30.95), 4326)) $$,
  '23505', null,
  'una URL canónica repetida no crea otra publicación'
);

-- ---------------------------------------------------------------------------
-- Votos
-- ---------------------------------------------------------------------------
insert into votos (publicacion_id, usuario_id)
values ('40000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001'),
       ('40000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002');
delete from votos where usuario_id = '10000000-0000-4000-8000-000000000002';

select is(
  (select votos from publicaciones where id = '40000000-0000-4000-8000-000000000001'),
  1,
  'el contador de votos sigue a la tabla votos'
);

-- ---------------------------------------------------------------------------
-- Vistas públicas
-- ---------------------------------------------------------------------------
select is_empty(
  $$ select 1 from muro_publico where evento_id = '20000000-0000-4000-8000-000000000001' $$,
  'una publicación pendiente no aparece en el muro'
);

update publicaciones set estado = 'aprobada'
where id in ('40000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000002');

select is(
  (select count(*)::int from muro_publico where evento_id = '20000000-0000-4000-8000-000000000001'),
  2,
  'las aprobadas aparecen en el muro'
);
select ok(
  (select st_distance(st_setsrid(st_makepoint(m.punto_lon, m.punto_lat), 4326), t.trazado) < 1e-9
   from muro_publico m join tramos t on t.id = m.tramo_id
   where m.id = '40000000-0000-4000-8000-000000000001'),
  'el punto público está sobre el trazado, no en la coordenada original'
);
select is_empty(
  $$ select column_name from information_schema.columns
     where table_schema = 'public' and table_name in ('muro_publico', 'ultimo_visto_por_auto')
       and column_name in ('ubicacion', 'usuario_id', 'ip_hash', 'precision_gps_m',
                           'distancia_al_trazado_m') $$,
  'las vistas públicas no tienen columnas privadas'
);

-- Último visto del 7: en T1 está en km ≈ 5,5 y ≈ 7,7; luego aparece en T2 (orden 2) en km ≈ 1.
select ok(
  (select abs(km_en_tramo - (select km_en_tramo from publicaciones
                             where id = '40000000-0000-4000-8000-000000000002')) < 0.001
   from ultimo_visto_por_auto
   where evento_id = '20000000-0000-4000-8000-000000000001' and numero = 7),
  'último visto toma el km más avanzado dentro del tramo'
);

insert into publicaciones (evento_id, tramo_id, url_original, url_canonica, plataforma,
  id_externo, autos, ubicacion, estado, moderado_en)
values ('20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000002',
  'u', 'https://www.youtube.com/watch?v=TestVideo03', 'youtube', 'TestVideo03', '{7}',
  st_setsrid(st_makepoint(-64.1, -30.99), 4326), 'aprobada', now());

select is(
  (select tramo_codigo from ultimo_visto_por_auto
   where evento_id = '20000000-0000-4000-8000-000000000001' and numero = 7),
  'T2',
  'último visto prioriza el tramo de mayor orden'
);
select is_empty(
  $$ select 1 from ultimo_visto_por_auto
     where evento_id = '20000000-0000-4000-8000-000000000001' and numero = 40 $$,
  'un auto sin publicaciones aprobadas no tiene último visto'
);

select is(
  (select estado from tramos_publicos where id = '30000000-0000-4000-8000-000000000001'),
  'por_iniciar'::estado_tramo,
  'un tramo con hora futura está por iniciar'
);
update tramos set estado = 'finalizado' where id = '30000000-0000-4000-8000-000000000002';
select is(
  (select estado from tramos_publicos where id = '30000000-0000-4000-8000-000000000002'),
  'finalizado'::estado_tramo,
  'el estado manual del admin tiene prioridad'
);

select * from finish();
rollback;

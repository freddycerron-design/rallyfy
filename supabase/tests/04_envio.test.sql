-- Reglas de unicidad que usa la Edge Function enviar-publicacion.
-- Ejecutar con: npm run supabase -- test db
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(3);

insert into eventos (id, nombre, fecha_inicio, fecha_fin)
values
  ('24000000-0000-4000-8000-000000000001', 'Fecha A', current_date, current_date),
  ('24000000-0000-4000-8000-000000000002', 'Fecha B', current_date, current_date);
insert into tramos (id, evento_id, codigo, nombre, orden, trazado)
values
  ('34000000-0000-4000-8000-000000000001', '24000000-0000-4000-8000-000000000001', 'A1', 'A', 1,
   st_geomfromtext('LINESTRING(-64.0 -31.0, -64.0 -30.9)', 4326)),
  ('34000000-0000-4000-8000-000000000002', '24000000-0000-4000-8000-000000000002', 'B1', 'B', 1,
   st_geomfromtext('LINESTRING(-64.0 -31.0, -64.0 -30.9)', 4326));

insert into publicaciones (evento_id, tramo_id, url_original, url_canonica, plataforma,
  id_externo, ubicacion, es_en_vivo)
values ('24000000-0000-4000-8000-000000000001', '34000000-0000-4000-8000-000000000001', 'u',
  'https://www.tiktok.com/@fan/live', 'tiktok', 'live:@fan',
  st_setsrid(st_makepoint(-64, -30.95), 4326), true);

select lives_ok(
  $$ insert into publicaciones (evento_id, tramo_id, url_original, url_canonica, plataforma,
       id_externo, ubicacion, es_en_vivo)
     values ('24000000-0000-4000-8000-000000000002', '34000000-0000-4000-8000-000000000002', 'u',
       'https://www.tiktok.com/@fan/live', 'tiktok', 'live:@fan',
       st_setsrid(st_makepoint(-64, -30.95), 4326), true) $$,
  'la misma transmisión se puede registrar en otro evento');

select throws_ok(
  $$ insert into publicaciones (evento_id, tramo_id, url_original, url_canonica, plataforma,
       id_externo, ubicacion)
     values ('24000000-0000-4000-8000-000000000001', '34000000-0000-4000-8000-000000000001', 'u',
       'https://www.tiktok.com/@fan/live', 'tiktok', 'otro-id',
       st_setsrid(st_makepoint(-64, -30.95), 4326)) $$,
  '23505', null, 'la URL canónica es única dentro del evento');

select throws_ok(
  $$ insert into publicaciones (evento_id, tramo_id, url_original, url_canonica, plataforma,
       id_externo, ubicacion)
     values ('24000000-0000-4000-8000-000000000001', '34000000-0000-4000-8000-000000000001', 'u',
       'https://www.tiktok.com/@otro/video/1', 'tiktok', 'live:@fan',
       st_setsrid(st_makepoint(-64, -30.95), 4326)) $$,
  '23505', null, 'el id externo es único dentro del evento');

select * from finish();
rollback;

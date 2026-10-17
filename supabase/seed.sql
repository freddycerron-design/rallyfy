-- Datos de prueba para desarrollo local (`npm run supabase -- db reset`).
--
-- ⚠ Los trazados son SINTÉTICOS (líneas aproximadas en las sierras de Córdoba) y los
--   pilotos y videos son ficticios. Reemplazar por los GPX reales de una fecha
--   (ver prerrequisitos en docs/06-plan-implementacion.md).
--
-- Usuarios locales (inician sesión con enlace mágico; los correos llegan a Inbucket,
-- http://127.0.0.1:54324):
--   admin@rallyfy.test      → admin
--   moderador@rallyfy.test  → moderador
-- Además hay dos aficionados anónimos que figuran como autores de publicaciones y votos.

-- ---------------------------------------------------------------------------
-- Usuarios de Auth (el trigger crea sus perfiles)
-- ---------------------------------------------------------------------------
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, is_anonymous, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
values
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-0000000000a1',
   'authenticated', 'authenticated', 'admin@rallyfy.test', '', now(),
   '{"provider":"email","providers":["email"]}', '{"alias":"Admin"}', false, now(), now(),
   '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-0000000000a2',
   'authenticated', 'authenticated', 'moderador@rallyfy.test', '', now(),
   '{"provider":"email","providers":["email"]}', '{"alias":"Mod Ana"}', false, now(), now(),
   '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-0000000000f1',
   'authenticated', 'authenticated', null, '', null,
   '{}', '{"alias":"La Curva TV"}', true, now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-0000000000f2',
   'authenticated', 'authenticated', null, '', null,
   '{}', '{}', true, now(), now(), '', '', '', '');

insert into auth.identities (
  id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
)
select gen_random_uuid(), u.id, u.id::text,
  jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
  'email', now(), now(), now()
from auth.users u
where u.email like '%@rallyfy.test';

update public.perfiles set rol = 'admin'
where usuario_id = '00000000-0000-4000-8000-0000000000a1';
update public.perfiles set rol = 'moderador'
where usuario_id = '00000000-0000-4000-8000-0000000000a2';

-- ---------------------------------------------------------------------------
-- Evento, tramos e inscritos
-- ---------------------------------------------------------------------------
insert into public.eventos (id, nombre, fecha_inicio, fecha_fin, activo)
values ('e0000000-0000-4000-8000-000000000001', 'Rally de Ejemplo · Fecha 1',
        current_date, current_date + 1, true);

insert into public.tramos (id, evento_id, codigo, nombre, orden, trazado, hora_inicio_prevista)
values
  ('a0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000001',
   'TC1', 'Ejemplo Norte', 1,
   extensions.st_geomfromtext('LINESTRING(
     -64.6000 -31.4000, -64.6080 -31.3950, -64.6150 -31.3930, -64.6230 -31.3870,
     -64.6290 -31.3800, -64.6380 -31.3760, -64.6450 -31.3690, -64.6540 -31.3640,
     -64.6620 -31.3550, -64.6700 -31.3480, -64.6800 -31.3400)', 4326),
   now() - interval '2 hours'),
  ('a0000000-0000-4000-8000-000000000002', 'e0000000-0000-4000-8000-000000000001',
   'TC2', 'Ejemplo Oeste', 2,
   extensions.st_geomfromtext('LINESTRING(
     -64.7000 -31.3000, -64.7090 -31.3050, -64.7160 -31.3120, -64.7250 -31.3160,
     -64.7330 -31.3230, -64.7400 -31.3310, -64.7490 -31.3360, -64.7580 -31.3420,
     -64.7660 -31.3490, -64.7800 -31.3600)', 4326),
   now() + interval '3 hours');

insert into public.inscritos (evento_id, numero, piloto, copiloto, auto, clase)
select 'e0000000-0000-4000-8000-000000000001', n, piloto, copiloto, auto, clase
from (values
  (1,  'Piloto Uno',      'Navegante Uno',      'Škoda Fabia RS Rally2',   'Rally2'),
  (2,  'Piloto Dos',      'Navegante Dos',      'Toyota GR Yaris Rally2',  'Rally2'),
  (3,  'Piloto Tres',     'Navegante Tres',     'Hyundai i20 N Rally2',    'Rally2'),
  (4,  'Piloto Cuatro',   'Navegante Cuatro',   'Citroën C3 Rally2',       'Rally2'),
  (5,  'Piloto Cinco',    'Navegante Cinco',    'Volkswagen Polo GTI R5',  'Rally2'),
  (7,  'Piloto Siete',    'Navegante Siete',    'Peugeot 208 Rally4',      'Rally4'),
  (8,  'Piloto Ocho',     'Navegante Ocho',     'Renault Clio Rally4',     'Rally4'),
  (9,  'Piloto Nueve',    'Navegante Nueve',    'Ford Fiesta Rally4',      'Rally4'),
  (11, 'Piloto Once',     'Navegante Once',     'Toyota Etios',            'N2'),
  (12, 'Piloto Doce',     'Navegante Doce',     'Volkswagen Gol Trend',    'N2'),
  (14, 'Piloto Catorce',  'Navegante Catorce',  'Fiat Uno',                'N1'),
  (15, 'Piloto Quince',   'Navegante Quince',   'Suzuki Swift',            'N1'),
  (21, 'Piloto Veintiuno','Navegante Veintiuno','Mitsubishi Lancer Evo X', 'N4'),
  (22, 'Piloto Veintidós','Navegante Veintidós','Subaru Impreza WRX',      'N4'),
  (33, 'Piloto Treinta',  'Navegante Treinta',  'Chevrolet Corsa',         'Clásicos')
) as v (n, piloto, copiloto, auto, clase);

-- ---------------------------------------------------------------------------
-- Publicaciones (los triggers calculan km, distancia y vencimiento en vivo)
-- frac = fracción del tramo; dx/dy = desplazamiento en grados desde el trazado.
-- ---------------------------------------------------------------------------
insert into public.publicaciones (
  id, evento_id, tramo_id, usuario_id, url_original, url_canonica, plataforma, id_externo,
  titulo, autor, es_en_vivo, autos, ubicacion, origen_ubicacion, precision_gps_m,
  hora_captura, estado, motivo_rechazo, moderado_por, moderado_en, creado_en
)
select
  ('b0000000-0000-4000-8000-0000000000' || lpad(v.n::text, 2, '0'))::uuid,
  t.evento_id,
  t.id,
  v.usuario::uuid,
  v.url,
  v.url,
  v.plataforma::public.plataforma,
  v.id_externo,
  v.titulo,
  v.autor,
  v.en_vivo,
  v.autos,
  extensions.st_translate(extensions.st_lineinterpolatepoint(t.trazado, v.frac), v.dx, v.dy),
  v.origen::public.origen_ubicacion,
  case when v.origen = 'gps' then 12 else null end,
  now() - make_interval(mins => v.minutos),
  v.estado::public.estado_publicacion,
  v.motivo::public.motivo_rechazo,
  case when v.estado <> 'pendiente' then '00000000-0000-4000-8000-0000000000a2'::uuid end,
  case when v.estado <> 'pendiente' then now() - make_interval(mins => v.minutos - 2) end,
  now() - make_interval(mins => v.minutos)
from (values
  -- n, tramo, frac, dx, dy, plataforma, id_externo, url, titulo, autor, en_vivo, autos, origen, minutos, estado, motivo, usuario
  (1,  'TC1', 0.05, 0.0002, 0.0001, 'youtube', 'EjemploTC1a', 'https://www.youtube.com/watch?v=EjemploTC1a', 'Largada TC1', 'La Curva TV', false, '{1}'::int[],        'gps',    110, 'aprobada',  null, '00000000-0000-4000-8000-0000000000f1'),
  (2,  'TC1', 0.12, -0.0003, 0.0002,'tiktok',  '7400000000000000002', 'https://www.tiktok.com/@ejemplo/video/7400000000000000002', 'El 2 pasando fuerte', 'ejemplo', false, '{2}', 'gps', 105, 'aprobada', null, '00000000-0000-4000-8000-0000000000f2'),
  (3,  'TC1', 0.20, 0.0001, -0.0002,'youtube', 'EjemploTC1c', 'https://www.youtube.com/watch?v=EjemploTC1c', 'Horquilla km 2', null, false, '{3,4}', 'gps', 100, 'aprobada', null, '00000000-0000-4000-8000-0000000000f1'),
  (4,  'TC1', 0.33, 0.0002, 0.0002, 'tiktok',  '7400000000000000004', 'https://www.tiktok.com/@ejemplo/video/7400000000000000004', 'Salto', 'ejemplo', false, '{5,7}', 'gps', 95, 'aprobada', null, '00000000-0000-4000-8000-0000000000f2'),
  (5,  'TC1', 0.41, -0.0001, 0.0001,'youtube', 'EjemploTC1e', 'https://www.youtube.com/watch?v=EjemploTC1e', 'Los Rally4', null, false, '{8,9}', 'gps', 90, 'aprobada', null, '00000000-0000-4000-8000-0000000000f1'),
  (6,  'TC1', 0.48, 0.0100, 0.0050, 'youtube', 'EjemploTC1f', 'https://www.youtube.com/watch?v=EjemploTC1f', 'Desde el mirador', null, false, '{1,2}', 'gps', 85, 'aprobada', null, '00000000-0000-4000-8000-0000000000f2'),
  (7,  'TC1', 0.55, 0.0001, 0.0001, 'tiktok',  '7400000000000000007', 'https://www.tiktok.com/@ejemplo/video/7400000000000000007', 'N2 en el vado', 'ejemplo', false, '{11,12}', 'manual', 80, 'aprobada', null, '00000000-0000-4000-8000-0000000000f1'),
  (8,  'TC1', 0.63, -0.0002, 0.0001,'youtube', 'EjemploTC1h', 'https://www.youtube.com/watch?v=EjemploTC1h', 'El 1 en el km 6', null, false, '{1}', 'gps', 75, 'aprobada', null, '00000000-0000-4000-8000-0000000000f2'),
  (9,  'TC1', 0.72, 0.0002, -0.0001,'tiktok',  '7400000000000000009', 'https://www.tiktok.com/@ejemplo/video/7400000000000000009', 'Clásicos', 'ejemplo', false, '{33}', 'gps', 70, 'aprobada', null, '00000000-0000-4000-8000-0000000000f1'),
  (10, 'TC1', 0.86, 0.0001, 0.0002, 'youtube', 'EjemploTC1j', 'https://www.youtube.com/watch?v=EjemploTC1j', 'Cerca de la llegada', null, false, '{2,3}', 'gps', 65, 'aprobada', null, '00000000-0000-4000-8000-0000000000f2'),
  (11, 'TC1', 0.30, 0.0001, 0.0001, 'youtube', 'EjemploTC1k', 'https://www.youtube.com/watch?v=EjemploTC1k', 'Video de otro rally', null, false, '{}', 'gps', 60, 'rechazada', 'no_es_del_evento', '00000000-0000-4000-8000-0000000000f1'),
  (12, 'TC1', 0.90, 0.0002, 0.0001, 'tiktok',  '7400000000000000012', 'https://www.tiktok.com/@ejemplo/video/7400000000000000012', 'Pendiente km 9', 'ejemplo', false, '{4}', 'gps', 10, 'pendiente', null, '00000000-0000-4000-8000-0000000000f2'),
  (13, 'TC1', 0.25, 0.0001, 0.0001, 'tiktok',  'live:@ejemplo', 'https://www.tiktok.com/@ejemplo/live', 'En vivo desde la horquilla', 'ejemplo', true, '{}', 'gps', 5, 'aprobada', null, '00000000-0000-4000-8000-0000000000f1'),
  (14, 'TC2', 0.04, 0.0001, 0.0001, 'youtube', 'EjemploTC2a', 'https://www.youtube.com/watch?v=EjemploTC2a', 'Largada TC2', null, false, '{1,2,3}', 'gps', 40, 'aprobada', null, '00000000-0000-4000-8000-0000000000f2'),
  (15, 'TC2', 0.18, -0.0002, 0.0001,'tiktok',  '7400000000000000015', 'https://www.tiktok.com/@ejemplo/video/7400000000000000015', 'Curva rápida', 'ejemplo', false, '{2}', 'gps', 35, 'aprobada', null, '00000000-0000-4000-8000-0000000000f1'),
  (16, 'TC2', 0.37, 0.0002, 0.0002, 'youtube', 'EjemploTC2c', 'https://www.youtube.com/watch?v=EjemploTC2c', 'El 21 y el 22', null, false, '{21,22}', 'gps', 30, 'aprobada', null, '00000000-0000-4000-8000-0000000000f2'),
  (17, 'TC2', 0.52, 0.0001, -0.0001,'youtube', 'EjemploTC2d', 'https://www.youtube.com/watch?v=EjemploTC2d', 'Pendiente medio tramo', null, false, '{14,15}', 'gps', 8, 'pendiente', null, '00000000-0000-4000-8000-0000000000f1'),
  (18, 'TC2', 0.66, 0.0120, 0.0000, 'tiktok',  '7400000000000000018', 'https://www.tiktok.com/@ejemplo/video/7400000000000000018', 'Lejos del trazado', 'ejemplo', false, '{5}', 'gps', 6, 'pendiente', null, '00000000-0000-4000-8000-0000000000f2'),
  (19, 'TC2', 0.74, 0.0001, 0.0001, 'youtube', 'EjemploTC2f', 'https://www.youtube.com/watch?v=EjemploTC2f', 'Ubicación elegida a mano', null, false, '{7}', 'manual', 4, 'pendiente', null, '00000000-0000-4000-8000-0000000000f1'),
  (20, 'TC2', 0.81, 0.0002, 0.0001, 'youtube', 'EjemploTC2g', 'https://www.youtube.com/watch?v=EjemploTC2g', 'Contenido no válido', null, false, '{}', 'gps', 20, 'rechazada', 'contenido_inapropiado', '00000000-0000-4000-8000-0000000000f2'),
  (21, 'TC2', 0.10, 0.0001, 0.0001, 'youtube', 'EjemploTC2h', 'https://www.youtube.com/watch?v=EjemploTC2h', 'Vivo ya terminado', null, true, '{}', 'gps', 200, 'aprobada', null, '00000000-0000-4000-8000-0000000000f2')
) as v (n, tramo, frac, dx, dy, plataforma, id_externo, url, titulo, autor, en_vivo, autos,
        origen, minutos, estado, motivo, usuario)
join public.tramos t on t.codigo = v.tramo and t.evento_id = 'e0000000-0000-4000-8000-000000000001';

-- ---------------------------------------------------------------------------
-- Votos (el trigger actualiza el contador)
-- ---------------------------------------------------------------------------
insert into public.votos (publicacion_id, usuario_id)
values
  ('b0000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-0000000000f1'),
  ('b0000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-0000000000f2'),
  ('b0000000-0000-4000-8000-000000000006', '00000000-0000-4000-8000-0000000000f1'),
  ('b0000000-0000-4000-8000-000000000016', '00000000-0000-4000-8000-0000000000f2');

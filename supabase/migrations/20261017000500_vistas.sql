-- Fase 1 · Vistas públicas.
--
-- muro_publico y ultimo_visto_por_auto se ejecutan con los permisos del dueño
-- (security_invoker = false) porque el público no tiene acceso a `publicaciones`.
-- Por eso:
--   * filtran explícitamente estado = 'aprobada';
--   * enumeran columnas a mano y NUNCA incluyen ubicacion, usuario_id, ip_hash,
--     precision_gps_m ni distancia_al_trazado_m;
--   * el punto del mapa es la proyección sobre el trazado, no la coordenada original.

create view public.muro_publico
with (security_invoker = false, security_barrier = true)
as
select
  p.id,
  p.evento_id,
  p.tramo_id,
  t.codigo as tramo_codigo,
  t.nombre as tramo_nombre,
  t.orden as tramo_orden,
  p.plataforma,
  p.id_externo,
  p.url_canonica,
  p.titulo,
  p.autor,
  pf.alias,
  p.es_en_vivo,
  p.en_vivo_hasta,
  (p.es_en_vivo and p.en_vivo_hasta > now()) as en_vivo_ahora,
  p.autos,
  p.km_en_tramo,
  extensions.st_x(extensions.st_lineinterpolatepoint(t.trazado, p.fraccion_tramo)) as punto_lon,
  extensions.st_y(extensions.st_lineinterpolatepoint(t.trazado, p.fraccion_tramo)) as punto_lat,
  p.hora_captura,
  p.votos,
  p.moderado_en as aprobada_en
from public.publicaciones p
join public.tramos t on t.id = p.tramo_id
left join public.perfiles pf on pf.usuario_id = p.usuario_id
where p.estado = 'aprobada';

comment on view public.muro_publico is
  'Publicaciones aprobadas sin datos privados. Ver docs/03-matriz-rls.md.';

-- Último visto: la publicación aprobada más avanzada de cada auto
-- (mayor orden de tramo, luego mayor km, luego la más reciente).
create view public.ultimo_visto_por_auto
with (security_invoker = false, security_barrier = true)
as
select
  i.evento_id,
  i.numero,
  i.piloto,
  i.copiloto,
  i.auto,
  i.clase,
  u.id as publicacion_id,
  u.tramo_id,
  u.tramo_codigo,
  u.tramo_orden,
  u.km_en_tramo,
  u.punto_lon,
  u.punto_lat,
  u.hora_captura
from public.inscritos i
join lateral (
  select m.*
  from public.muro_publico m
  where m.evento_id = i.evento_id and i.numero = any (m.autos)
  order by m.tramo_orden desc, m.km_en_tramo desc, m.hora_captura desc
  limit 1
) u on true;

comment on view public.ultimo_visto_por_auto is
  'Último km conocido de cada auto según publicaciones aprobadas. La hora es la del envío.';

-- Tramos con datos listos para el mapa y el inicio. Los tramos ya son públicos,
-- así que esta vista sí respeta los permisos de quien consulta.
create view public.tramos_publicos
with (security_invoker = true)
as
select
  t.id,
  t.evento_id,
  t.codigo,
  t.nombre,
  t.orden,
  t.longitud_km,
  t.hora_inicio_prevista,
  coalesce(
    t.estado,
    case
      when t.hora_inicio_prevista is null or now() < t.hora_inicio_prevista then 'por_iniciar'
      else 'en_curso'
    end::public.estado_tramo
  ) as estado,
  extensions.st_asgeojson(t.trazado)::jsonb as trazado_geojson,
  (select count(*) from public.muro_publico m where m.tramo_id = t.id) as publicaciones_aprobadas
from public.tramos t;

-- Solo lectura (tramos_publicos sería actualizable por ser de una sola tabla).
revoke all on public.muro_publico, public.ultimo_visto_por_auto, public.tramos_publicos
  from anon, authenticated;
grant select on public.muro_publico, public.ultimo_visto_por_auto, public.tramos_publicos
  to anon, authenticated;

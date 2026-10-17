-- Fase 1 · Extensiones y tipos enumerados.
-- PostGIS va en el esquema `extensions`, como recomienda Supabase.

create extension if not exists postgis with schema extensions;

create type public.plataforma as enum ('tiktok', 'youtube');
-- Instagram y Facebook quedan fuera del MVP: se agregarán con `alter type ... add value`.

create type public.estado_publicacion as enum ('pendiente', 'aprobada', 'rechazada');

create type public.estado_tramo as enum ('por_iniciar', 'en_curso', 'finalizado');

create type public.rol_usuario as enum ('aficionado', 'moderador', 'admin');

create type public.origen_ubicacion as enum ('gps', 'manual');

create type public.motivo_rechazo as enum (
  'duplicado',
  'no_es_del_evento',
  'contenido_inapropiado',
  'sin_autos_visibles',
  'otro'
);

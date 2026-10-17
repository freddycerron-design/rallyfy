-- Fase 1 · Tablas e índices.
-- Las columnas calculadas (longitud_km, km_en_tramo, etc.) las completan los triggers de la
-- migración siguiente; no se aceptan valores enviados por el cliente.

-- ---------------------------------------------------------------------------
-- eventos
-- ---------------------------------------------------------------------------
create table public.eventos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (char_length(nombre) between 3 and 120),
  fecha_inicio date not null,
  fecha_fin date not null,
  activo boolean not null default false,
  creado_en timestamptz not null default now(),
  constraint eventos_fechas_ck check (fecha_fin >= fecha_inicio)
);

-- Solo un evento activo a la vez.
create unique index eventos_un_solo_activo_idx on public.eventos (activo) where activo;

-- ---------------------------------------------------------------------------
-- tramos
-- ---------------------------------------------------------------------------
create table public.tramos (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null references public.eventos (id) on delete cascade,
  codigo text not null check (char_length(codigo) between 1 and 12),
  nombre text not null check (char_length(nombre) between 1 and 120),
  orden integer not null check (orden > 0),
  trazado extensions.geometry (LineString, 4326) not null,
  longitud_km numeric(8, 3) not null default 0,
  hora_inicio_prevista timestamptz,
  -- null = derivar de hora_inicio_prevista (ver vista tramos_publicos).
  estado public.estado_tramo,
  creado_en timestamptz not null default now(),
  constraint tramos_codigo_uk unique (evento_id, codigo),
  constraint tramos_orden_uk unique (evento_id, orden)
);

create index tramos_evento_idx on public.tramos (evento_id);
create index tramos_trazado_gix on public.tramos using gist (trazado);

-- ---------------------------------------------------------------------------
-- inscritos
-- ---------------------------------------------------------------------------
create table public.inscritos (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null references public.eventos (id) on delete cascade,
  numero integer not null check (numero > 0),
  piloto text not null check (char_length(piloto) between 1 and 120),
  copiloto text check (char_length(copiloto) <= 120),
  auto text check (char_length(auto) <= 120),
  clase text check (char_length(clase) <= 40),
  constraint inscritos_numero_uk unique (evento_id, numero)
);

-- ---------------------------------------------------------------------------
-- perfiles (uno por usuario de Supabase Auth, creado por trigger)
-- ---------------------------------------------------------------------------
create table public.perfiles (
  usuario_id uuid primary key references auth.users (id) on delete cascade,
  alias text check (char_length(alias) between 2 and 30),
  rol public.rol_usuario not null default 'aficionado',
  creado_en timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- publicaciones
-- ---------------------------------------------------------------------------
create table public.publicaciones (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null references public.eventos (id) on delete cascade,
  tramo_id uuid not null references public.tramos (id) on delete restrict,
  usuario_id uuid references auth.users (id) on delete set null,

  url_original text not null check (char_length(url_original) <= 2048),
  url_canonica text not null check (char_length(url_canonica) <= 512),
  plataforma public.plataforma not null,
  id_externo text not null check (char_length(id_externo) between 1 and 64),
  titulo text check (char_length(titulo) <= 300),
  autor text check (char_length(autor) <= 120),

  es_en_vivo boolean not null default false,
  en_vivo_hasta timestamptz,

  autos integer[] not null default '{}',

  ubicacion extensions.geometry (Point, 4326) not null,
  origen_ubicacion public.origen_ubicacion not null default 'gps',
  precision_gps_m real check (precision_gps_m >= 0),
  fraccion_tramo double precision,
  km_en_tramo numeric(8, 3),
  distancia_al_trazado_m numeric(10, 1),
  lejos_del_trazado boolean generated always as (distancia_al_trazado_m > 500) stored,

  hora_captura timestamptz not null default now(),
  ip_hash text,

  estado public.estado_publicacion not null default 'pendiente',
  motivo_rechazo public.motivo_rechazo,
  moderado_por uuid references auth.users (id) on delete set null,
  moderado_en timestamptz,

  votos integer not null default 0 check (votos >= 0),
  creado_en timestamptz not null default now(),

  constraint publicaciones_url_canonica_uk unique (url_canonica),
  constraint publicaciones_externo_uk unique (plataforma, id_externo),
  constraint publicaciones_rechazo_ck check (
    (estado = 'rechazada') = (motivo_rechazo is not null)
  ),
  constraint publicaciones_en_vivo_ck check (es_en_vivo or en_vivo_hasta is null),
  constraint publicaciones_manual_ck check (
    origen_ubicacion = 'gps' or precision_gps_m is null
  )
);

create index publicaciones_muro_idx on public.publicaciones (tramo_id, estado, km_en_tramo);
create index publicaciones_pendientes_idx on public.publicaciones (creado_en)
  where estado = 'pendiente';
create index publicaciones_autos_gin on public.publicaciones using gin (autos);
create index publicaciones_usuario_idx on public.publicaciones (usuario_id, creado_en);
create index publicaciones_ip_idx on public.publicaciones (ip_hash, creado_en)
  where ip_hash is not null;
create index publicaciones_en_vivo_idx on public.publicaciones (en_vivo_hasta)
  where es_en_vivo;

-- ---------------------------------------------------------------------------
-- votos
-- ---------------------------------------------------------------------------
create table public.votos (
  publicacion_id uuid not null references public.publicaciones (id) on delete cascade,
  usuario_id uuid not null references auth.users (id) on delete cascade,
  creado_en timestamptz not null default now(),
  primary key (publicacion_id, usuario_id)
);

create index votos_usuario_idx on public.votos (usuario_id, creado_en);

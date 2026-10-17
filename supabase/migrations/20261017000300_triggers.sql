-- Fase 1 · Triggers de cálculo y validación.

-- ---------------------------------------------------------------------------
-- tramos: longitud en km a partir del trazado
-- ---------------------------------------------------------------------------
create function public.tramos_calcular_longitud()
returns trigger
language plpgsql
set search_path = public, extensions
as $$
begin
  if st_npoints(new.trazado) < 2 then
    raise exception 'El trazado del tramo necesita al menos 2 puntos'
      using errcode = '22023';
  end if;
  new.longitud_km := round((st_length(new.trazado::geography) / 1000)::numeric, 3);
  return new;
end;
$$;

create trigger tramos_longitud_trg
  before insert or update of trazado on public.tramos
  for each row execute function public.tramos_calcular_longitud();

-- Si cambia el trazado, recalcular la posición de sus publicaciones.
create function public.tramos_recalcular_publicaciones()
returns trigger
language plpgsql
set search_path = public, extensions
as $$
begin
  update public.publicaciones set tramo_id = tramo_id where tramo_id = new.id;
  return null;
end;
$$;

create trigger tramos_recalcular_publicaciones_trg
  after update of trazado on public.tramos
  for each row
  -- Se comparan los bytes: `geometry = geometry` es ambiguo con PostGIS en el esquema extensions.
  when (extensions.st_asewkb(old.trazado) is distinct from extensions.st_asewkb(new.trazado))
  execute function public.tramos_recalcular_publicaciones();

-- ---------------------------------------------------------------------------
-- publicaciones: coherencia evento/tramo, autos inscritos y posición en el tramo
-- ---------------------------------------------------------------------------
create function public.publicaciones_validar_y_ubicar()
returns trigger
language plpgsql
set search_path = public, extensions
as $$
declare
  v_tramo public.tramos;
  v_desconocidos integer[];
begin
  select * into v_tramo from public.tramos where id = new.tramo_id;

  if v_tramo.evento_id is distinct from new.evento_id then
    raise exception 'El tramo no pertenece al evento'
      using errcode = '23514';
  end if;

  -- Autos: sin repetidos y todos inscritos en el evento.
  new.autos := coalesce(
    array(select distinct a from unnest(new.autos) as a where a is not null order by a),
    '{}'
  );
  select array_agg(a order by a) into v_desconocidos
  from unnest(new.autos) as a
  where not exists (
    select 1 from public.inscritos i where i.evento_id = new.evento_id and i.numero = a
  );
  if v_desconocidos is not null then
    raise exception 'Autos no inscritos en el evento: %', array_to_string(v_desconocidos, ', ')
      using errcode = '23514';
  end if;

  -- Posición sobre el trazado. La coordenada original queda solo en `ubicacion`.
  new.fraccion_tramo := st_linelocatepoint(v_tramo.trazado, new.ubicacion);
  new.km_en_tramo := round((new.fraccion_tramo * v_tramo.longitud_km)::numeric, 3);
  new.distancia_al_trazado_m := round(
    st_distance(new.ubicacion::geography, st_closestpoint(v_tramo.trazado, new.ubicacion)::geography)::numeric,
    1
  );

  -- "En vivo ahora" vence a las 2 horas salvo que se indique otra cosa.
  if tg_op = 'INSERT' and new.es_en_vivo and new.en_vivo_hasta is null then
    new.en_vivo_hasta := new.creado_en + interval '2 hours';
  end if;

  return new;
end;
$$;

create trigger publicaciones_validar_y_ubicar_trg
  before insert or update of tramo_id, evento_id, autos, ubicacion, es_en_vivo
  on public.publicaciones
  for each row execute function public.publicaciones_validar_y_ubicar();

-- ---------------------------------------------------------------------------
-- votos: contador desnormalizado en publicaciones
-- ---------------------------------------------------------------------------
create function public.votos_actualizar_contador()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.publicaciones set votos = votos + 1 where id = new.publicacion_id;
  else
    update public.publicaciones set votos = greatest(votos - 1, 0) where id = old.publicacion_id;
  end if;
  return null;
end;
$$;

create trigger votos_contador_trg
  after insert or delete on public.votos
  for each row execute function public.votos_actualizar_contador();

-- ---------------------------------------------------------------------------
-- perfiles: se crea uno por cada usuario nuevo de Auth (anónimo o no)
-- ---------------------------------------------------------------------------
create function public.crear_perfil_para_usuario()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_alias text := nullif(trim(new.raw_user_meta_data ->> 'alias'), '');
begin
  if v_alias is not null and char_length(v_alias) not between 2 and 30 then
    v_alias := null;
  end if;
  insert into public.perfiles (usuario_id, alias) values (new.id, v_alias)
  on conflict (usuario_id) do nothing;
  return new;
end;
$$;

create trigger crear_perfil_trg
  after insert on auth.users
  for each row execute function public.crear_perfil_para_usuario();

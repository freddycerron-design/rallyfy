-- Fase 1 · Funciones RPC (moderación, votos, gestión del equipo).
-- Todas son security definer y verifican el rol adentro: el cliente nunca escribe
-- `publicaciones`, `votos` ni `perfiles.rol` directamente.
-- Errores con SQLSTATE 'PTxxx' hacen que PostgREST responda con el estado HTTP xxx.

-- ---------------------------------------------------------------------------
-- Moderación
-- ---------------------------------------------------------------------------
create function public.moderar_publicacion(
  p_id uuid,
  p_accion text,
  p_motivo public.motivo_rechazo default null,
  p_tramo_id uuid default null,
  p_autos integer[] default null
)
returns public.estado_publicacion
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_estado public.estado_publicacion;
begin
  if not public.es_moderador() then
    raise exception 'Solo los moderadores pueden moderar publicaciones'
      using errcode = '42501';
  end if;

  if p_accion not in ('aprobar', 'rechazar', 'corregir', 'cerrar_en_vivo') then
    raise exception 'Acción desconocida: %', p_accion using errcode = '22023';
  end if;

  if p_accion = 'rechazar' and p_motivo is null then
    raise exception 'Para rechazar hay que indicar un motivo' using errcode = '22023';
  end if;

  -- Correcciones opcionales (cualquier acción puede traerlas); los triggers recalculan km.
  if p_tramo_id is not null or p_autos is not null then
    update public.publicaciones
    set tramo_id = coalesce(p_tramo_id, tramo_id),
        autos = coalesce(p_autos, autos)
    where id = p_id;
  end if;

  update public.publicaciones
  set estado = case p_accion
                 when 'aprobar' then 'aprobada'::public.estado_publicacion
                 when 'rechazar' then 'rechazada'::public.estado_publicacion
                 else estado
               end,
      motivo_rechazo = case p_accion
                         when 'aprobar' then null
                         when 'rechazar' then p_motivo
                         else motivo_rechazo
                       end,
      en_vivo_hasta = case
                        when p_accion = 'cerrar_en_vivo' and es_en_vivo then now()
                        else en_vivo_hasta
                      end,
      moderado_por = auth.uid(),
      moderado_en = now()
  where id = p_id
  returning estado into v_estado;

  if v_estado is null then
    raise exception 'Publicación no encontrada' using errcode = 'PT404';
  end if;

  return v_estado;
end;
$$;

-- ---------------------------------------------------------------------------
-- Votos
-- ---------------------------------------------------------------------------
create function public.votar(p_publicacion_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_votos integer;
begin
  if v_uid is null then
    raise exception 'Necesitas una sesión para votar' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.publicaciones where id = p_publicacion_id and estado = 'aprobada'
  ) then
    raise exception 'Publicación no disponible' using errcode = 'PT404';
  end if;

  if (
    select count(*) from public.votos
    where usuario_id = v_uid and creado_en > now() - interval '1 hour'
  ) >= 60 then
    raise exception 'Demasiados votos en la última hora; intenta más tarde'
      using errcode = 'PT429';
  end if;

  insert into public.votos (publicacion_id, usuario_id)
  values (p_publicacion_id, v_uid)
  on conflict do nothing;

  select votos into v_votos from public.publicaciones where id = p_publicacion_id;
  return v_votos;
end;
$$;

create function public.quitar_voto(p_publicacion_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_votos integer;
begin
  if v_uid is null then
    raise exception 'Necesitas una sesión para votar' using errcode = '42501';
  end if;

  delete from public.votos where publicacion_id = p_publicacion_id and usuario_id = v_uid;

  select votos into v_votos
  from public.publicaciones
  where id = p_publicacion_id and estado = 'aprobada';
  return coalesce(v_votos, 0);
end;
$$;

-- ---------------------------------------------------------------------------
-- Gestión del equipo (solo admin)
-- ---------------------------------------------------------------------------
create function public.cambiar_rol(p_email text, p_rol public.rol_usuario)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario uuid;
begin
  if not public.es_admin() then
    raise exception 'Solo un administrador puede cambiar roles' using errcode = '42501';
  end if;

  select u.id into v_usuario
  from auth.users u
  where lower(u.email) = lower(trim(p_email))
    and not coalesce(u.is_anonymous, false);

  if v_usuario is null then
    raise exception 'No hay un usuario con ese correo. Debe iniciar sesión una vez antes de asignarle un rol.'
      using errcode = 'PT404';
  end if;

  if v_usuario = auth.uid() then
    raise exception 'No puedes cambiar tu propio rol' using errcode = '22023';
  end if;

  update public.perfiles set rol = p_rol where usuario_id = v_usuario;
end;
$$;

create function public.listar_equipo()
returns table (usuario_id uuid, email text, alias text, rol public.rol_usuario)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.es_admin() then
    raise exception 'Solo un administrador puede ver el equipo' using errcode = '42501';
  end if;

  return query
  select p.usuario_id, u.email::text, p.alias, p.rol
  from public.perfiles p
  join auth.users u on u.id = p.usuario_id
  where p.rol in ('moderador', 'admin')
  order by p.rol desc, u.email;
end;
$$;

-- ---------------------------------------------------------------------------
-- Permisos de ejecución: nada para el público sin sesión.
-- ---------------------------------------------------------------------------
revoke execute on function
  public.moderar_publicacion(uuid, text, public.motivo_rechazo, uuid, integer[]),
  public.votar(uuid),
  public.quitar_voto(uuid),
  public.cambiar_rol(text, public.rol_usuario),
  public.listar_equipo()
from public, anon;

grant execute on function
  public.moderar_publicacion(uuid, text, public.motivo_rechazo, uuid, integer[]),
  public.votar(uuid),
  public.quitar_voto(uuid),
  public.cambiar_rol(text, public.rol_usuario),
  public.listar_equipo()
to authenticated;

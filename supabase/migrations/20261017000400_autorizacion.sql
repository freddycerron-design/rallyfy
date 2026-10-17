-- Fase 1 · Autorización: funciones de rol, privilegios explícitos y políticas RLS.
-- Contrato: docs/03-matriz-rls.md

-- ---------------------------------------------------------------------------
-- Funciones de rol
-- ---------------------------------------------------------------------------
-- Una sesión anónima nunca es moderadora, aunque su perfil diga lo contrario.
create function public.sesion_es_anonima()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)
$$;

create function public.rol_actual()
returns public.rol_usuario
language sql
stable
security definer
set search_path = ''
as $$
  select p.rol from public.perfiles p where p.usuario_id = auth.uid()
$$;

create function public.es_moderador()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
    and not public.sesion_es_anonima()
    and coalesce(public.rol_actual() in ('moderador', 'admin'), false)
$$;

create function public.es_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
    and not public.sesion_es_anonima()
    and coalesce(public.rol_actual() = 'admin', false)
$$;

revoke execute on function public.rol_actual() from public, anon;

-- ---------------------------------------------------------------------------
-- Privilegios: partir de cero y otorgar solo lo necesario.
-- (Supabase otorga ALL por defecto a anon/authenticated; acá se restringe.)
-- ---------------------------------------------------------------------------
revoke all on public.eventos, public.tramos, public.inscritos, public.perfiles,
  public.publicaciones, public.votos from anon, authenticated;

grant select on public.eventos, public.tramos, public.inscritos to anon, authenticated;
grant insert, update, delete on public.eventos, public.tramos, public.inscritos to authenticated;

grant select on public.perfiles to authenticated;
grant update (alias) on public.perfiles to authenticated;

-- publicaciones: todas las columnas salvo ip_hash; sin escritura directa.
grant select (
  id, evento_id, tramo_id, usuario_id, url_original, url_canonica, plataforma, id_externo,
  titulo, autor, es_en_vivo, en_vivo_hasta, autos, ubicacion, origen_ubicacion,
  precision_gps_m, fraccion_tramo, km_en_tramo, distancia_al_trazado_m, lejos_del_trazado,
  hora_captura, estado, motivo_rechazo, moderado_por, moderado_en, votos, creado_en
) on public.publicaciones to authenticated;
grant delete on public.publicaciones to authenticated;

grant select on public.votos to authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.eventos enable row level security;
alter table public.tramos enable row level security;
alter table public.inscritos enable row level security;
alter table public.perfiles enable row level security;
alter table public.publicaciones enable row level security;
alter table public.votos enable row level security;

-- Catálogos: lectura pública, escritura de admin.
create policy eventos_lectura on public.eventos for select to anon, authenticated using (true);
create policy eventos_admin_insertar on public.eventos for insert to authenticated
  with check ((select public.es_admin()));
create policy eventos_admin_actualizar on public.eventos for update to authenticated
  using ((select public.es_admin())) with check ((select public.es_admin()));
create policy eventos_admin_borrar on public.eventos for delete to authenticated
  using ((select public.es_admin()));

create policy tramos_lectura on public.tramos for select to anon, authenticated using (true);
create policy tramos_admin_insertar on public.tramos for insert to authenticated
  with check ((select public.es_admin()));
create policy tramos_admin_actualizar on public.tramos for update to authenticated
  using ((select public.es_admin())) with check ((select public.es_admin()));
create policy tramos_admin_borrar on public.tramos for delete to authenticated
  using ((select public.es_admin()));

create policy inscritos_lectura on public.inscritos for select to anon, authenticated using (true);
create policy inscritos_admin_insertar on public.inscritos for insert to authenticated
  with check ((select public.es_admin()));
create policy inscritos_admin_actualizar on public.inscritos for update to authenticated
  using ((select public.es_admin())) with check ((select public.es_admin()));
create policy inscritos_admin_borrar on public.inscritos for delete to authenticated
  using ((select public.es_admin()));

-- Perfiles: cada uno ve y edita (solo alias) el propio; el admin ve todos.
create policy perfiles_lectura on public.perfiles for select to authenticated
  using (usuario_id = (select auth.uid()) or (select public.es_admin()));
create policy perfiles_editar_propio on public.perfiles for update to authenticated
  using (usuario_id = (select auth.uid())) with check (usuario_id = (select auth.uid()));

-- Publicaciones: el autor ve las suyas; moderadores ven todas; solo el admin borra.
create policy publicaciones_lectura on public.publicaciones for select to authenticated
  using (usuario_id = (select auth.uid()) or (select public.es_moderador()));
create policy publicaciones_admin_borrar on public.publicaciones for delete to authenticated
  using ((select public.es_admin()));

-- Votos: cada uno ve los suyos (para pintar el botón). Se escriben vía RPC.
create policy votos_lectura on public.votos for select to authenticated
  using (usuario_id = (select auth.uid()));

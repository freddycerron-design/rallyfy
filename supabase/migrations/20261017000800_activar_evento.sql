-- Fase 2 · Activar un evento desactivando el anterior en una sola operación.
-- El índice único parcial impide dos activos; hacerlo desde el cliente en dos pasos
-- dejaría la app sin evento activo si el segundo paso falla.

create function public.activar_evento(p_evento_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.es_admin() then
    raise exception 'Solo un administrador puede activar eventos' using errcode = '42501';
  end if;

  -- null = dejar todos inactivos.
  if p_evento_id is not null
     and not exists (select 1 from public.eventos where id = p_evento_id) then
    raise exception 'Evento no encontrado' using errcode = 'PT404';
  end if;

  update public.eventos set activo = false where activo and id is distinct from p_evento_id;
  if p_evento_id is not null then
    update public.eventos set activo = true where id = p_evento_id;
  end if;
end;
$$;

revoke execute on function public.activar_evento(uuid) from public, anon;
grant execute on function public.activar_evento(uuid) to authenticated;

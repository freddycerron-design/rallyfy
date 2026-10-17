-- Fase 1 · Tiempo real.
--
-- Público: Broadcast en el canal `muro:{evento_id}` con solo {id, tramo_id}; el cliente
-- vuelve a consultar muro_publico. Nunca recibe la fila (que tiene la ubicación exacta).
--
-- Moderadores: postgres_changes sobre `publicaciones`. Realtime aplica RLS por suscriptor,
-- y el público no tiene SELECT sobre la tabla, así que no recibe esos eventos.

create function public.publicaciones_avisar_muro()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Solo interesa al público lo que entra, sale o cambia dentro del muro.
  if new.estado = 'aprobada' or old.estado = 'aprobada' then
    perform realtime.send(
      jsonb_build_object('id', new.id, 'tramo_id', new.tramo_id, 'estado', new.estado),
      'cambio',
      'muro:' || new.evento_id::text,
      false
    );
  end if;
  return null;
end;
$$;

create trigger publicaciones_avisar_muro_trg
  after update of estado, tramo_id, autos, en_vivo_hasta on public.publicaciones
  for each row execute function public.publicaciones_avisar_muro();

alter publication supabase_realtime add table public.publicaciones;

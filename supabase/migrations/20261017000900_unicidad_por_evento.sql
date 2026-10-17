-- Fase 3 · Unicidad de publicaciones por evento.
--
-- Antes la URL canónica era única en toda la base. Eso impedía registrar la misma
-- transmisión en vivo de un aficionado (tiktok.com/@usuario/live) en otra fecha.
-- Ahora un mismo video o transmisión puede aparecer una vez por evento; dentro del
-- evento, la Edge Function renueva el "en vivo" en lugar de duplicarlo.

alter table public.publicaciones
  drop constraint publicaciones_url_canonica_uk,
  drop constraint publicaciones_externo_uk,
  add constraint publicaciones_url_canonica_uk unique (evento_id, url_canonica),
  add constraint publicaciones_externo_uk unique (evento_id, plataforma, id_externo);

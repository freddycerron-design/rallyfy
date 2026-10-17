# 03 — Matriz de autorización (RLS y privilegios)

Esta matriz es el contrato que verifican las pruebas de `supabase/tests/`. Toda la autorización vive en la base de datos y el frontend solo la refleja.

## Roles

| Rol | Cómo se identifica | Notas |
|---|---|---|
| **Público** | rol Postgres `anon`, sin sesión | Solo lee vistas y catálogos públicos. |
| **Aficionado** | rol `authenticated`, con `perfiles.rol = 'aficionado'`; casi siempre `is_anonymous = true` | **Tener `authenticated` no da ningún permiso especial.** |
| **Moderador** | `perfiles.rol = 'moderador'` y sesión no anónima | Se verifica con `es_moderador()`. |
| **Admin** | `perfiles.rol = 'admin'` y sesión no anónima | `es_admin()`. Un admin también es moderador. |
| **Edge Function** | `service_role` (salta RLS) | Es la única vía para insertar publicaciones (valida Turnstile, URL, límites). |

## Tablas

`L` = leer, `I` = insertar, `A` = actualizar, `B` = borrar. "—" = sin acceso.

| Tabla | Público | Aficionado | Moderador | Admin |
|---|---|---|---|---|
| `eventos` | L | L | L | L I A B |
| `tramos` | L | L | L | L I A B |
| `inscritos` | L | L | L | L I A B |
| `perfiles` | — | L (la propia), A (solo `alias` de la propia) | L (la propia) | L (todas). El rol se cambia solo vía RPC. |
| `publicaciones` | — | L (las propias, sin `ip_hash`) | L (todas, sin `ip_hash`) | L (todas, sin `ip_hash`), B |
| `votos` | — | L (los propios) | L (los propios) | L (los propios) |

- Nadie escribe `publicaciones` ni `votos` directamente desde el cliente. Para eso están la Edge Function y las RPC.
- `ip_hash` solo lo ve `service_role`.

## Vistas públicas (todos pueden leer)

| Vista | Contenido | Lo que **nunca** expone |
|---|---|---|
| `muro_publico` | Publicaciones `aprobada`: tramo, km, punto proyectado sobre el trazado, autos, votos, alias | `ubicacion`, `usuario_id`, `ip_hash`, `precision_gps_m`, `distancia_al_trazado_m` |
| `ultimo_visto_por_auto` | Por inscrito: tramo, km, punto proyectado y hora de la publicación aprobada más avanzada | Lo mismo |
| `tramos_publicos` | Tramos con trazado en GeoJSON, conteo de aprobadas y estado efectivo | — |

`muro_publico` y `ultimo_visto_por_auto` se ejecutan con los permisos del dueño (`security_invoker = false`) porque el público no tiene acceso a `publicaciones`. Por eso filtran explícitamente `estado = 'aprobada'` y seleccionan columnas a mano.

## RPC

| Función | Quién | Efecto |
|---|---|---|
| `moderar_publicacion(id, accion, motivo?, tramo_id?, autos?)` | Moderador | Con `aprobar`, `rechazar` (motivo obligatorio de la lista), `corregir` (tramo o autos) o `cerrar_en_vivo`. |
| `votar(id)` / `quitar_voto(id)` | Cualquier sesión (incluida la anónima) | Un voto por usuario y publicación aprobada, con máximo 60 votos por hora. |
| `cambiar_rol(email, rol)` | Admin | Promueve o degrada a un usuario no anónimo. No puede cambiar su propio rol. |
| `listar_equipo()` | Admin | Correo, alias y rol de los moderadores y admins. |

## Tiempo real

| Canal | Quién lo recibe | Contenido |
|---|---|---|
| Broadcast `muro:{evento_id}`, evento `cambio` | Todos | `{id, tramo_id}`: el cliente vuelve a consultar `muro_publico`. |
| `postgres_changes` sobre `publicaciones` | Solo quien puede leer la fila según RLS (moderadores, el propio autor) | La fila. El público no tiene `SELECT`, así que no recibe nada. |

## Casos que deben fallar (pruebas)

1. El público lee `publicaciones` → error de permiso.
2. El público lee `perfiles` → error de permiso.
3. Un aficionado anónimo llama a `moderar_publicacion` → `42501`.
4. Un aficionado inserta en `publicaciones` → error de permiso.
5. Un aficionado se pone `rol = 'admin'` en su perfil → error de permiso.
6. Un aficionado lee publicaciones pendientes de otro → 0 filas.
7. Alguien lee `ip_hash` sin ser `service_role` → error de permiso.
8. `muro_publico` muestra una publicación pendiente o rechazada → 0 filas.
9. `muro_publico` devuelve la coordenada original → el punto expuesto debe estar sobre el trazado (distancia ≈ 0).
10. Una sesión anónima con `rol = 'moderador'` (datos forzados) → `es_moderador()` devuelve falso.

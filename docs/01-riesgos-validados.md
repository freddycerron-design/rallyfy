# 01 — Riesgos validados (Etapa 1)

Resultados de las pruebas rápidas contra servicios reales. Fecha: 2026-10-17.
Proyecto de Supabase: `fibgpatebaocpojaowov` (plan gratuito).

## Cuotas de los planes gratuitos (fuentes oficiales)

| Servicio | Dato | Decisión |
|---|---|---|
| Supabase Free | 500 MB de base, 5 GB de egress, 500 000 invocaciones de funciones al mes, 200 conexiones Realtime simultáneas, 2 M de mensajes, pausa tras 7 días sin actividad | Realtime público con fallback a sondeo; keepalive en la Fase 8 |
| SMTP integrado de Supabase | 2 correos por hora, solo a miembros del equipo | SMTP gratuito (Brevo o Resend) obligatorio para moderadores |
| OpenFreeMap | Sin clave ni límite de vistas; exige atribución | Proveedor de teselas por defecto |
| TikTok embed | `tiktok.com/player/v1/{id}` con API `postMessage` | Iframe del reproductor oficial; oEmbed solo para metadatos |

## Pruebas contra el proyecto real

| Prueba | Resultado |
|---|---|
| Migraciones en el Postgres real | ⚠️ La migración 3 falló: `geometry = geometry` es ambiguo con PostGIS en `extensions`. **Ni PGlite ni el Supabase local de la CI lo detectaron.** Se corrigió comparando por `st_asewkb`. Lección: probar `db push` contra la nube antes de dar una migración por buena. |
| Permisos con la publishable key | ✅ El público lee las vistas y recibe `42501` en `publicaciones`, `perfiles` y `votar`. |
| Edge Function desplegada | ✅ Carga con sus variables de entorno, valida la sesión, Turnstile (clave de prueba) y el límite de frecuencia con la service role. |
| Enlace corto real de TikTok (`vt.tiktok.com/…`) | ✅ **TikTok no bloquea las IP de Supabase**: redirige con 301 y la función lo resuelve en unos 3 s. |
| Formato de los enlaces cortos | ⚠️ Los códigos reales traen `-` (`ZS9UaHaodEtrj-3qXBa`). La validación los rechazaba. Corregido para aceptar `[A-Za-z0-9_-]{4,40}`. |
| Enlace corto que redirige a algo que no es un video | ✅ Mensaje claro: "El enlace corto no lleva a un video de TikTok". |
| Parámetros de seguimiento de TikTok | ✅ La URL resuelta trae ~20 parámetros (ids de usuario, región, origen del compartido). La URL canónica los descarta. |

## Pendiente

- **Vencimiento del `thumbnail_url` de oEmbed de TikTok.** No se probó. Mientras tanto, la tarjeta de TikTok usa un marcador sin miniatura (decisión de la Fase 5).
- **Turnstile real.** Hoy se usan las claves de prueba de Cloudflare. Hay que reemplazarlas por las del sitio y activar el captcha en Supabase Auth.
- **Limpieza.** La prueba creó un usuario anónimo en el proyecto (`a61aa6d3-…`). Es inofensivo; se puede borrar desde Authentication → Users.

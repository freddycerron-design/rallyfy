# 06 — Plan de implementación: Muro Rally

Fuentes: `especificacion-app-rally.md` (ya incluye las decisiones de `00-dudas-y-supuestos.md`). Este documento convierte las 8 fases de la sección 12 en tareas concretas. Cada fase lleva su criterio de "hecho" y sus pruebas.

---

## 1. Hechos verificados que condicionan el diseño (fuentes oficiales, 2026-10-17)

| Tema | Dato | Consecuencia en el plan |
|---|---|---|
| Supabase Free | 500 MB de base, 5 GB de egress, 500 000 invocaciones de Edge Functions al mes, **200 conexiones Realtime simultáneas**, 2 M de mensajes al mes, pausa tras 1 semana sin actividad, 2 proyectos. | Realtime público con fallback a sondeo (§3.3). Workflow de keepalive. |
| Postgres Changes | Por defecto envía la **fila completa**. Admite `select` de columnas y `filter`. RLS no se aplica a los DELETE. Para muchos suscriptores, Supabase recomienda **Broadcast**. | El público nunca se suscribe a `publicaciones`: usa Broadcast con una carga mínima. |
| SMTP integrado de Supabase | **2 correos por hora**, solo a miembros del equipo. | Hace falta un SMTP gratuito (Brevo o Resend) antes de la Fase 2. |
| OpenFreeMap | Gratis, sin clave ni límite de vistas, compatible con MapLibre, exige atribución. | Proveedor de teselas por defecto. MapTiler o Stadia quedan como opción por variable de entorno. |
| Reproductor de TikTok | `https://www.tiktok.com/player/v1/{id}`, con parámetros (`controls`, `autoplay`, `rel`…) y API `postMessage` (`onPlayerReady`, `onPlayerError`). | Se usa este iframe y no el `embed.js` del blockquote. oEmbed queda solo para extraer metadatos y como alternativa. |

**Sin verificar todavía (spike al inicio de la Fase 3):**
- si TikTok bloquea la resolución de `vm.tiktok.com` desde una Edge Function;
- si vence el `thumbnail_url` de oEmbed.

---

## 2. Prerrequisitos (antes de la Fase 0)

- [ ] Cuenta de GitHub y repositorio, necesarios para Actions y Cloudflare Pages.
- [ ] Docker Desktop instalado, para correr Supabase en local (`supabase start`) y las pruebas pgTAP.
- [ ] Proyecto de Supabase (Free) creado.
- [ ] Sitio de Turnstile creado, con sus claves de sitio y secreta.
- [ ] Cuenta de SMTP gratuita (Brevo o Resend).
- [ ] **2 trazados reales de tramos** (GPX, KML o GeoJSON) para el seed. Si no hay, se trazan sobre rutas de OSM.

---

## 3. Decisiones de arquitectura

### 3.1 Estructura del repositorio (una sola app de Vite más la carpeta de Supabase)
```
rallyfy/
├─ src/
│  ├─ app/            router (react-router), providers, layout, aviso offline
│  ├─ features/
│  │  ├─ inicio/  muro/  mapa/  autos/  envio/  moderacion/  admin/  votos/
│  ├─ components/     LazyEmbed, TarjetaPublicacion, SelectorAutos, MapaBase…
│  ├─ lib/            supabase.ts, queries.ts, geo.ts, turnstile.ts, realtime.ts
│  └─ shared → ../supabase/functions/_shared   (alias de Vite; código compartido)
├─ supabase/
│  ├─ migrations/     0001_extensiones … 00NN_realtime
│  ├─ functions/
│  │  ├─ _shared/urls.ts      validación y normalización de URLs, sin dependencias
│  │  └─ enviar-publicacion/index.ts
│  ├─ tests/          pruebas pgTAP (RLS, triggers, vistas)
│  └─ seed.sql
├─ e2e/               Playwright (viewport móvil)
├─ .github/workflows/ ci.yml, keepalive.yml
└─ docs/
```

### 3.2 Librerías
- **Interfaz:** react-router y TanStack Query (caché y reintentos con señal débil).
- **Mapa y datos:** maplibre-gl, `@tmcw/togeojson` (GPX/KML), papaparse (CSV), `@turf/nearest-point-on-line` y `@turf/distance` (tramo más cercano en el cliente).
- **PWA y pruebas:** vite-plugin-pwa, Vitest y Testing Library, Playwright.
- **Turnstile:** `@marsidev/react-turnstile` o el script oficial.

### 3.3 Tiempo real
- **Moderadores:** `postgres_changes` sobre `publicaciones` con `filter: estado=eq.pendiente`. RLS solo les permite ver esas filas a ellos.
- **Público:** un trigger `AFTER UPDATE OF estado` emite `realtime.send()` en el canal `muro:{evento_id}` con `{id, tramo_id}` y nada más. El cliente invalida la consulta de TanStack Query y vuelve a pedir `muro_publico`.
- **Fallback:** si el canal no conecta (por ejemplo, se alcanzó el tope de 200), se sondea cada 30 s con la pestaña visible. La bandera `VITE_REALTIME_PUBLICO=false` fuerza el sondeo.

### 3.4 Privacidad de la ubicación
- `publicaciones` guarda `ubicacion` (exacta) y además `fraccion_tramo` (resultado de `ST_LineLocatePoint`).
- `muro_publico` expone `km_en_tramo` y `punto_publico = ST_LineInterpolatePoint(trazado, fraccion_tramo)`. **Nunca** expone `ubicacion`, `usuario_id` ni `ip_hash`.
- El público no tiene `SELECT` sobre la tabla `publicaciones`: solo sobre las vistas. Las vistas son `security_invoker = false` a propósito y solo filtran `estado = 'aprobada'`. La matriz RLS documenta y prueba ese acceso.

### 3.5 Autorización
- **Cuidado:** los usuarios anónimos de Supabase tienen el rol `authenticated`. Las políticas nunca deben usar "authenticated" como sinónimo de "moderador": siempre consultan `perfiles.rol` con `es_moderador()` / `es_admin()` (funciones `security definer` y `stable`).
- Las acciones de moderación y votos pasan por RPC (`moderar_publicacion`, `votar`, `quitar_voto`) en lugar de `UPDATE` directo. Así la lógica y la auditoría quedan en un solo lugar.

### 3.6 Embeds
- **YouTube:** la miniatura sale de `https://i.ytimg.com/vi/{id}/hqdefault.jpg` y el iframe es `youtube-nocookie.com/embed/{id}?autoplay=1`.
- **TikTok:**
  - Al enviar, la Edge Function llama a oEmbed y guarda `titulo` y `autor`, pero **no** la miniatura.
  - La tarjeta muestra un marcador con el logo, el autor y el botón de reproducir. Al tocarla carga `player/v1/{id}?autoplay=1&rel=0`.
  - Si el spike muestra que la miniatura no vence, se guarda `miniatura_url`.

---

## 4. Fases

Convención: cada tarea dura medio día como máximo. ✅ indica el criterio de "hecho". 🧪 indica las pruebas que exige la fase.

### Fase 0 — Base del proyecto ✔️ completada (2026-10-17)
1. `git init`, Vite + React + TS, Tailwind, ESLint/Prettier, alias `@/` y `@shared/`.
2. Vitest, Playwright y el workflow `ci.yml` (lint, typecheck, test).
3. `supabase init`, `supabase start` en local, `.env.example` (URL, anon key, clave de Turnstile, estilo de teselas, banderas).
4. Layout mobile-first, router con rutas vacías y página 404.

✅ `npm run dev` levanta la app, y la CI corre en verde con un repo vacío de lógica.

### Fase 1 — Migraciones, RLS y seed ✔️ completada (2026-10-17)
1. `0001`: extensión `postgis` y enums (`plataforma`, `estado_publicacion`, `estado_tramo`, `rol`, `origen_ubicacion`).
2. `0002`: tablas de §5 con constraints. Incluye el índice único parcial `eventos(activo) WHERE activo`, un GIST en `trazado` y `ubicacion`, y un GIN en `autos`.
3. `0003`: triggers.
   - `longitud_km` con `ST_Length(geography)`.
   - En publicaciones, al insertar o cambiar la ubicación o el tramo: `fraccion_tramo`, `km_en_tramo` y `distancia_al_trazado_m`.
   - Validar `autos ⊆ inscritos`.
   - `en_vivo_hasta = creado_en + 2 h` si `es_en_vivo`.
   - Contador de `votos`.
4. `0004`: funciones `es_moderador()` y `es_admin()`, la creación automática del perfil al registrarse (trigger en `auth.users`) y las políticas RLS de todas las tablas.
5. `0005`: vistas `muro_publico`, `ultimo_visto_por_auto` y `tramos_publicos` (con el conteo de aprobadas y el estado derivado).
6. `0006`: RPC `moderar_publicacion(id, accion, motivo, tramo_id?, autos?)`, `votar(id)`, `quitar_voto(id)`, `cambiar_rol(email, rol)` y `listar_equipo()` (las dos últimas solo admin).
7. `0007`: trigger de broadcast de Realtime (§3.3).
8. `seed.sql`: 1 evento activo, 2 tramos reales, 15 inscritos, unas 20 publicaciones en los 3 estados (alguna lejos del trazado, alguna manual y alguna en vivo).
9. `docs/03-matriz-rls.md` y pruebas pgTAP que la recorren.

🧪 pgTAP:
- Un anónimo no ve pendientes ni `ubicacion`, y no puede moderar ni insertar directamente en `publicaciones`.
- Un aficionado no se puede autopromover.
- El moderador puede moderar y el admin puede gestionar.
- El km se calcula bien en un tramo conocido y el contador de votos funciona.

✅ `supabase db reset` aplica todo y carga el seed, y `supabase test db` pasa en verde.

> **Estado:** con `npm run db:validar` (PGlite + PostGIS, sin Docker) se aplican las 7 migraciones y el seed, y pasan 71 de 71 aserciones pgTAP. Una prueba de mutación (abrir permisos a propósito) confirmó que las pruebas detectan las fugas. `supabase test db` contra el Postgres real de Supabase también pasó en la CI (job `base-de-datos`, ejecución 39076332231).
>
> **Seed:** los trazados son sintéticos; se reemplazan cuando estén los GPX reales.

### Fase 2 — Administración ✔️ completada (2026-10-17)
1. Login con enlace mágico (configurar SMTP), `RutaProtegida` según el rol y gestión de la sesión.
2. CRUD del evento y botón "activar". El índice único garantiza que haya uno solo activo.
3. Carga de tramos:
   - parsear GPX, KML o GeoJSON en el cliente y unir segmentos;
   - vista previa en MapLibre con la largada marcada y botón "invertir sentido";
   - guardar el código, el nombre, el orden y la hora prevista.
4. Cambiar el estado del tramo a mano.
5. Importar inscritos desde CSV: vista previa, errores por fila y upsert por `(evento_id, numero)`.
6. Gestionar moderadores: lista, promover por email y quitar el rol.

🧪 Vitest para el parser de tramos (varios segmentos, inversión) y el validador de CSV.

✅ Desde el panel se crea un evento completo equivalente al seed.

> **Estado:**
> - Panel en `/admin`, `/admin/evento/:id` y `/admin/equipo`, con carga diferida. `/moderacion` exige sesión de moderador.
> - Nueva RPC `activar_evento`, que cambia el evento activo en una sola operación, con 8 pruebas pgTAP.
> - Parsers de GPX, KML y GeoJSON y de CSV, con 17 pruebas Vitest.
> - e2e de Playwright contra una API de Supabase simulada: alta de tramo con mapa e inversión de sentido, e importación de CSV con errores.
> - Se corrigió el worker de MapLibre 6 (`setWorkerUrl`), que no se encontraba al empaquetar.
>
> **Pendiente:**
> - Probar el panel contra un Supabase real (local con Docker o en la nube).
> - Configurar SMTP (Brevo o Resend) en el proyecto en la nube para los enlaces mágicos. En local, los correos llegan a Inbucket.

### Fase 3 — Envío de publicaciones
1. **Spike (primera tarea):** probar desde una Edge Function desplegada la resolución de `vm.tiktok.com` y `youtu.be`, oEmbed y el vencimiento de la miniatura. Resultado en `docs/01-riesgos-validados.md`.
   - Si TikTok bloquea: pedirle al usuario el enlace largo, con un mensaje de ayuda, y resolver en el cliente cuando sea posible.
2. `_shared/urls.ts`: `validarDominio`, `normalizar` (canónica más `id_externo`, para shorts, `watch`, `live` y `/video/`) y `esEnlaceCorto`.
3. Edge Function `enviar-publicacion`: los pasos 1 a 9 de §6, con el límite por usuario y por IP hasheada (tabla `limites_envio` o una consulta sobre `publicaciones`). Si la URL ya existe, responde 409 "Esta publicación ya fue enviada".
4. Activar el captcha de Supabase Auth y crear la sesión anónima con Turnstile. Alias opcional.
5. Pantalla de envío en 3 pasos:
   - pegar el enlace, con validación inmediata y vista previa;
   - elegir el tramo (preseleccionado por GPS en el cliente) y los autos con botones grandes;
   - confirmar.

   Incluye el interruptor "Estoy transmitiendo en vivo" y el selector manual en el mapa si se niega el GPS.

🧪
- Vitest exhaustivo de `urls.ts`, con una tabla de URL válidas e inválidas.
- `deno test` de la función, con fetch simulado.
- Playwright: envío completo en un viewport móvil en menos de 30 s y envío duplicado.

✅ Los criterios 1 y 2 de §13 se cumplen.

### Fase 4 — Panel de moderación
1. Cola de pendientes (la más antigua primero) con `LazyEmbed` (ya cargado en esta vista), km, distancia y alertas: lejos del trazado, ubicación manual, en vivo.
2. Acciones: aprobar, rechazar con motivo predefinido (duplicado, no es del evento, contenido inapropiado, sin autos visibles, otro) y corregir el tramo o los autos (recalcula el km).
3. Atajos de teclado: A, R, J/K para navegar, y el foco gestionado para que el panel sea accesible.
4. Realtime con `postgres_changes` filtrado (§3.3) y aviso de "nueva publicación".
5. Cerrar antes un enlace en vivo.

🧪 Pruebas de componentes de los atajos. pgTAP de la RPC de moderación por rol.

✅ Dos moderadores en paralelo ven la cola actualizada sin recargar.

### Fase 5 — Inicio, muro del tramo y ficha del auto
1. Inicio: evento activo y lista de tramos con conteo y estado, más el botón destacado "Enviar mi video".
2. `LazyEmbed` y `TarjetaPublicacion` (miniatura con botón de reproducir; el iframe se carga recién al tocar).
3. Muro: orden por km, hora o votos (guardado en la URL), filtro por auto y sección "En vivo ahora" (`en_vivo_hasta > now()`).
4. Ficha del auto: datos del inscrito y sus publicaciones ordenadas por tramo y km.
5. Hook `useRealtimeMuro` (broadcast más fallback a sondeo).

🧪 Playwright: el orden por km respeta el recorrido y una publicación pendiente no aparece.

✅ Los criterios 3 y 4 de §13 se cumplen.

### Fase 6 — Mapa
1. `MapaBase`: MapLibre con OpenFreeMap (configurable) y atribución.
2. Capa de trazados con etiquetas de código y pines desde `muro_publico.punto_publico`, con `cluster: true`.
3. Tocar un pin abre la tarjeta en una hoja inferior.
4. Modo "Último visto": un marcador por número de auto en `ultimo_visto_por_auto`, con la hora "aprox.".

🧪 Prueba (pgTAP o e2e) de que la respuesta del mapa no contiene la coordenada original del seed.

✅ El criterio 5 de §13 se cumple.

### Fase 7 — Votos y "En vivo ahora"
1. Botón de voto optimista con las RPC `votar` y `quitar_voto`, y el límite de 60 por hora en la RPC.
2. Tarjeta "en vivo" que abre la red social en una pestaña nueva y desaparece al vencer.

🧪 pgTAP: se admite un voto por usuario y el contador queda consistente.

### Fase 8 — PWA, operación y documentación
1. vite-plugin-pwa: manifest, íconos y caché del app shell. Las teselas y la API **no** se cachean de forma agresiva. Aviso offline.
2. `keepalive.yml`: cron dos veces por semana con una consulta liviana a `tramos_publicos`, más un commit mensual automático o una alerta para que GitHub no desactive el workflow a los 60 días.
3. README: Supabase, PostGIS, migraciones, variables de entorno, Turnstile, SMTP y Cloudflare Pages (build `npm run build`, salida `dist`, rutas SPA).
4. `docs/08-operacion-dia-rally.md`: checklist previa, monitoreo de cuotas y plan B (`VITE_REALTIME_PUBLICO=false`).
5. Auditoría de Lighthouse en móvil (PWA, accesibilidad, rendimiento) y repaso de los 7 criterios de §13.

✅ La app queda desplegada en Cloudflare Pages contra Supabase en la nube, con todos los criterios de §13 verificados.

---

## 5. Dependencias y paralelismo
```
F0 → F1 → F2 ─┐
          └→ F3 → F4 → F5 → F6 → F7 → F8
```
- **Se pueden hacer en paralelo después de F1:**
  - F2 (administración);
  - el spike y `urls.ts` de F3;
  - `LazyEmbed` y `MapaBase` como componentes aislados (con el seed).
- F4 necesita F3, porque las pendientes reales vienen del envío. F5 y F6 pueden avanzar con los datos del seed.

## 6. Riesgos y planes B
| Riesgo | Plan B |
|---|---|
| TikTok bloquea la resolución de enlaces cortos | Pedir el enlace largo, resolverlo en el cliente o que lo corrija el moderador. |
| Más de 200 conexiones Realtime el día del rally | Fallback automático a sondeo cada 30 s y bandera para desactivar Realtime público. |
| Se agota el egress de 5 GB | Las vistas devuelven solo los campos necesarios, con paginación y caché HTTP en las vistas públicas. |
| Llega spam de sesiones anónimas | Captcha en el inicio de sesión anónimo y límite por IP hasheada. |
| Proyecto pausado | Keepalive y checklist previa que confirma que el proyecto está activo. |

## 7. Trazabilidad con los criterios de aceptación (§13)
| Criterio | Fase | Prueba |
|---|---|---|
| Envío en menos de 30 s desde el celular | F3 | Playwright en móvil |
| Sin duplicados | F1 y F3 | UNIQUE, pgTAP y e2e |
| Solo lo aprobado es visible | F1 y F5 | pgTAP y e2e |
| El orden por km sigue el recorrido | F5 | e2e con el seed |
| El mapa nunca muestra la coordenada exacta | F1 y F6 | pgTAP del contenido de la vista |
| Un anónimo no puede moderar vía API | F1 | pgTAP |
| Todo funciona en planes gratuitos | F8 | Revisión de cuotas en `08` |

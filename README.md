# Muro Rally

PWA sin fines de lucro que reúne las publicaciones de los aficionados (TikTok, YouTube) durante una fecha de rally y las ordena **por tramo, por km y por auto**, en un muro y en un mapa. No aloja videos: guarda el enlace y lo incrusta. Funciona completa en planes gratuitos.

- Especificación: [`especificacion-app-rally.md`](especificacion-app-rally.md)
- Plan e historial de fases: [`docs/06-plan-implementacion.md`](docs/06-plan-implementacion.md)
- Permisos por rol: [`docs/03-matriz-rls.md`](docs/03-matriz-rls.md)
- Riesgos validados contra servicios reales: [`docs/01-riesgos-validados.md`](docs/01-riesgos-validados.md)
- **Checklist del día del rally:** [`docs/08-operacion-dia-rally.md`](docs/08-operacion-dia-rally.md)

## Arquitectura

| Capa              | Tecnología                                                                       |
| ----------------- | -------------------------------------------------------------------------------- |
| Frontend          | Vite + React + TypeScript + Tailwind, PWA (vite-plugin-pwa)                      |
| Mapa              | MapLibre GL con teselas de OpenFreeMap (sin clave)                               |
| Backend           | Supabase: Postgres + PostGIS, Auth (anónima y enlace mágico), RLS, Realtime      |
| Envío de videos   | Edge Function `enviar-publicacion` (Deno), con Turnstile y límites de frecuencia |
| Hosting           | Cloudflare Pages                                                                 |
| Tareas periódicas | GitHub Actions (CI y keepalive)                                                  |

```
src/app/            router, layout, aviso sin conexión
src/features/       una carpeta por pantalla (inicio, muro, mapa, autos, envio, moderacion, admin)
src/components/     componentes compartidos (Video, TarjetaPublicacion, mapas, BotonVoto…)
src/lib/            cliente de Supabase, consultas, geo, formato, tiempo real
supabase/           migraciones, Edge Functions (_shared se comparte con el frontend), pgTAP, seed
e2e/                pruebas Playwright (viewport de celular; API simulada)
scripts/validar-sql validación de migraciones y pgTAP sin Docker (PGlite)
docs/ejemplos/      trazados y CSV de inscritos para probar el panel
```

## Desarrollo local

Requisitos: Node 24. Docker Desktop solo si quieres el Supabase local completo.

```bash
npm install
cp .env.example .env.local
npm run dev
```

| Comando                           | Qué hace                                                    |
| --------------------------------- | ----------------------------------------------------------- |
| `npm run dev`                     | Servidor de desarrollo en http://localhost:5173             |
| `npm run build`                   | Typecheck y build de producción en `dist/` (incluye la PWA) |
| `npm run lint` / `npm run format` | ESLint / Prettier                                           |
| `npm test`                        | Pruebas unitarias (Vitest)                                  |
| `npm run e2e`                     | Pruebas de punta a punta (Playwright, modo `e2e`)           |
| `npm run db:validar`              | Migraciones, seed y pgTAP sobre PGlite (sin Docker)         |
| `npm run supabase -- start`       | Supabase local (requiere Docker)                            |
| `npm run supabase -- test db`     | Pruebas pgTAP en el Supabase local                          |

Las e2e se construyen con `vite --mode e2e` (`.env.e2e`), así nunca apuntan al proyecto real aunque exista `.env.local`.

## Despliegue

### 1. Supabase

1. Crea un proyecto en [supabase.com](https://supabase.com) (plan gratuito).
2. Vincula el repo y aplica las migraciones (PostGIS se activa en la primera):

   ```bash
   npx supabase login
   ```

   ```bash
   npx supabase link --project-ref <ref>
   ```

   ```bash
   npx supabase db push
   ```

   No uses `--include-seed` en producción: el seed crea usuarios y datos de prueba.

3. En el panel de Supabase:
   - **Authentication → Sign In / Providers:** activa "Allow anonymous sign-ins".
   - **Authentication → Bot protection:** activa CAPTCHA con **Turnstile** y la clave secreta de Cloudflare.
   - **Authentication → SMTP Settings:** configura un SMTP gratuito (Brevo o Resend). El integrado envía solo 2 correos por hora y solo a miembros del equipo.
   - **Authentication → URL Configuration:** Site URL = la URL de Cloudflare Pages; en Redirect URLs agrega `https://<tu-sitio>/**` (y `http://localhost:5173/**` para desarrollo).
4. Crea el primer administrador: entra una vez en `/admin` con tu correo y luego, en el SQL Editor:

   ```sql
   update public.perfiles set rol = 'admin'
   where usuario_id = (select id from auth.users where email = 'tu@correo');
   ```

   El resto del equipo se gestiona desde `/admin/equipo`.

### 2. Edge Function

```bash
npx supabase secrets set TURNSTILE_SECRET_KEY=<clave-secreta> IP_HASH_SALT=<texto-aleatorio-largo>
```

```bash
npx supabase functions deploy enviar-publicacion --use-api
```

`SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` los inyecta Supabase. `IP_HASH_SALT` evita guardar las IP en claro; no lo cambies durante un evento porque reinicia los límites por IP.

### 3. Cloudflare Turnstile

En Cloudflare → Turnstile, crea un sitio en modo **Managed** con los dominios `<tu-sitio>.pages.dev` y `localhost`. La **site key** va en el frontend (`VITE_TURNSTILE_SITE_KEY`); la **secret key**, en Supabase Auth (Bot protection) y en el secreto de la función.

### 4. Cloudflare Pages

1. Cloudflare → Workers & Pages → Create → Pages → conecta el repositorio de GitHub.
2. Build: framework **None**, comando `npm run build`, directorio `dist`, variable `NODE_VERSION=24`.
3. Variables de entorno (Production y Preview):

   | Variable                  | Valor                                                 |
   | ------------------------- | ----------------------------------------------------- |
   | `VITE_SUPABASE_URL`       | `https://<ref>.supabase.co`                           |
   | `VITE_SUPABASE_ANON_KEY`  | la publishable key (`sb_publishable_…`)               |
   | `VITE_TURNSTILE_SITE_KEY` | la site key de Turnstile                              |
   | `VITE_MAP_STYLE_URL`      | `https://tiles.openfreemap.org/styles/liberty`        |
   | `VITE_REALTIME_PUBLICO`   | `true` (ponlo en `false` si se agotan las conexiones) |

4. Las rutas de la SPA funcionan solas: no hay `404.html`, así que Pages sirve `index.html`. Las cabeceras de caché y seguridad están en `public/_headers`.

### 5. Keepalive (GitHub Actions)

Supabase pausa los proyectos gratuitos tras 7 días sin actividad. El workflow `.github/workflows/keepalive.yml` hace una consulta liviana los lunes y jueves. Configura en GitHub → Settings → Secrets and variables → Actions → **Variables**:

- `SUPABASE_URL` = `https://<ref>.supabase.co`
- `SUPABASE_PUBLISHABLE_KEY` = `sb_publishable_…`

Pruébalo con **Run workflow**. GitHub desactiva los workflows programados tras 60 días sin actividad en el repo; la checklist incluye revisarlo.

## Costos

Todo cabe en planes gratuitos. Los límites que importan el día del rally (200 conexiones Realtime simultáneas, 5 GB de egress al mes, 500 000 invocaciones de funciones) y sus planes B están en la [checklist](docs/08-operacion-dia-rally.md).

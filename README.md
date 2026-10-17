# Muro Rally

PWA sin fines de lucro que reúne las publicaciones de los aficionados (TikTok, YouTube) durante una fecha de rally y las ordena por tramo, km y auto.

- Especificación: [`especificacion-app-rally.md`](especificacion-app-rally.md)
- Plan de implementación: [`docs/06-plan-implementacion.md`](docs/06-plan-implementacion.md)

> El README de despliegue completo (Supabase, Turnstile, Cloudflare Pages, checklist del día del rally) se escribe en la Fase 8.

## Desarrollo

Requisitos: Node 24. Para la base de datos local también hace falta Docker Desktop.

```bash
npm install
cp .env.example .env.local
npm run dev
```

| Comando                        | Qué hace                                        |
| ------------------------------ | ----------------------------------------------- |
| `npm run dev`                  | Servidor de desarrollo en http://localhost:5173 |
| `npm run build`                | Typecheck y build de producción en `dist/`      |
| `npm run lint`                 | ESLint                                          |
| `npm run format`               | Prettier                                        |
| `npm test`                     | Pruebas unitarias (Vitest)                      |
| `npm run e2e`                  | Pruebas de punta a punta (Playwright, móvil)    |
| `npm run supabase -- start`    | Supabase local (requiere Docker)                |
| `npm run supabase -- db reset` | Aplica migraciones y seed en local              |

## Estructura

```
src/app/         router, layout, páginas de error
src/features/    una carpeta por pantalla (inicio, muro, mapa, autos, envio, moderacion, admin)
src/components/  componentes compartidos
src/lib/         cliente de Supabase, entorno, hooks utilitarios
supabase/        configuración, migraciones, Edge Functions, pruebas pgTAP
e2e/             pruebas Playwright
```

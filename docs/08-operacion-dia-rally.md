# 08 — Operación: checklist del día del rally

Imprimible. Cada casilla tiene un responsable y un momento.

## Una semana antes

- [ ] **Supabase no está pausado.** Abre el panel del proyecto. Si dice "Paused", tócalo para reanudarlo y espera unos minutos.
- [ ] **El keepalive corre.** GitHub → Actions → "Keepalive Supabase": la última ejecución debe estar en verde. Si GitHub lo desactivó por inactividad, aparece un aviso amarillo con "Enable workflow".
- [ ] **Evento cargado** en `/admin`: nombre, fechas y **Activar**. Solo puede haber uno activo.
- [ ] **Tramos** desde los GPX o KML oficiales. Verifica en la vista previa que la **largada** quede en el km 0 (si no, "Invertir sentido") y carga el código, el orden y la hora prevista.
- [ ] **Inscritos** desde el CSV oficial (`numero,piloto,copiloto,auto,clase`). Revisa los errores por fila.
- [ ] **Equipo de moderación**: cada voluntario entra una vez en `/moderacion` con su correo y después un admin le asigna el rol en `/admin/equipo`. Mínimo 2 por turno.
- [ ] **El correo funciona**: con el SMTP configurado, el enlace mágico llega en menos de 1 minuto. Revisa también la carpeta de spam.
- [ ] **Turnstile en producción**: claves reales, no las de prueba `1x000…AA`, en Cloudflare Pages (`VITE_TURNSTILE_SITE_KEY`), en Supabase Auth (Bot protection) y en el secreto `TURNSTILE_SECRET_KEY` de la función.

## El día anterior (ensayo)

- [ ] Desde un celular con datos móviles, sin Wi-Fi: abre la app, **instálala** (Agregar a pantalla de inicio) y envía un video real de prueba en menos de 30 s.
- [ ] Un moderador lo ve aparecer solo, **sin recargar**, y lo aprueba con la tecla A.
- [ ] En otro celular, el video aparece en el muro del tramo y en el mapa **sin recargar**.
- [ ] Prueba un enlace corto de TikTok (`vt.tiktok.com/…`) y uno de YouTube Shorts.
- [ ] Prueba sin permiso de ubicación: se marca el punto en el mapa.
- [ ] Borra o rechaza las publicaciones de prueba.

## Durante la fecha

| Qué mirar | Dónde | Señal de alarma |
|---|---|---|
| Cola de moderación | `/moderacion` | Más de 20 pendientes: sumar un moderador |
| Conexiones Realtime | Supabase → Reports → Realtime | Cerca de **200 simultáneas** |
| Errores de la función | Supabase → Edge Functions → enviar-publicacion → Logs | Muchos 500 o 403 (captcha) |
| Egress | Supabase → Usage | Cerca de **5 GB** al mes |
| Estado de servicios | status.supabase.com · cloudflarestatus.com | Incidentes activos |

### Planes B

| Problema | Acción |
|---|---|
| Se alcanzan las 200 conexiones Realtime | La app pasa sola a consultar cada 30 s. Si hace falta, en Cloudflare Pages pon `VITE_REALTIME_PUBLICO=false` y redespliega: el público sondea y Realtime queda libre para los moderadores. |
| TikTok bloquea los enlaces cortos | La función ya pide el enlace completo con instrucciones. Avisa por redes: "Compartir → Copiar enlace y pegar el enlace completo". |
| Spam de envíos | Rechazar en bloque desde la moderación. Los límites (10 por hora por usuario y 30 por IP) ya frenan la mayoría. Si persiste, revisa que Turnstile tenga las claves reales. |
| Un tramo se suspende o se neutraliza | `/admin` → evento → Tramos → Estado "Finalizado". |
| Un auto cambia de número | Corregir en el CSV y reimportar: se actualiza por número. Las publicaciones ya aprobadas conservan el número viejo. |
| Supabase caído | No hay plan B dentro del costo cero: avisa por redes y sigue juntando enlaces para cargarlos después. |

## Después de la fecha

- [ ] Cierra las transmisiones que sigan en vivo (vencen solas a las 2 h).
- [ ] Desactiva el evento en `/admin` si no habrá otro pronto.
- [ ] Mira el uso en Supabase → Usage y anota los picos para la próxima fecha.

## Mantenimiento mensual (fuera de temporada)

- [ ] GitHub → Actions → "Keepalive Supabase" sigue **habilitado**. GitHub lo desactiva tras 60 días sin commits; si pasó, tocar "Enable workflow".
- [ ] Supabase no está pausado.

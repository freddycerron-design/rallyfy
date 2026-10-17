# 00 — Dudas y supuestos (Etapa 0)

Fuente: `especificacion-app-rally.md`. Cada duda trae una **propuesta por defecto**. Marca el estado en cada una: `[ ] pendiente` → `[x] confirmada` (o escribe la decisión alternativa).

| # | Duda | Propuesta por defecto | Estado |
|---|---|---|---|
| 1 | **Hora del "último visto".** `hora_captura` es la hora del envío, no la del paso del auto. | Mostrarla como "visto aprox. HH:MM (envío)". Para elegir el registro "más reciente" de un auto: el mayor `tramo.orden`, luego el mayor `km_en_tramo` y, en caso de empate, el mayor `hora_captura`. | [x] confirmada |
| 2 | **Estado del tramo** (por iniciar / en curso / finalizado). Solo existe `hora_inicio_prevista`. | Agregar a `tramos` la columna `estado` (`por_iniciar` / `en_curso` / `finalizado`), que el administrador cambia a mano. Si nadie la cambia, se deriva de la hora prevista. | [x] confirmada |
| 3 | **Cuándo vence "En vivo ahora".** | TTL de 2 h desde el envío. El moderador puede cerrarlo antes. Se agrega la columna `en_vivo_hasta timestamptz`. | [x] confirmada |
| 4 | **Votos.** No se define si requieren Turnstile, si se pueden quitar ni cómo evitar el inflado. | Un voto por sesión anónima, se puede quitar, sin Turnstile. Se acepta el riesgo de inflado porque no hay premio en juego. Se agrega un límite de 60 votos por hora por usuario. | [x] confirmada |
| 5 | **Límite de frecuencia.** Abrir otra sesión anónima evade el límite por usuario. | Mantener 10 por hora por usuario y sumar 30 por hora por IP (hash de la IP en la Edge Function, sin guardar la IP en claro). Activar el captcha de Supabase en el inicio de sesión anónimo. | [x] confirmada |
| 6 | **Envío sin GPS.** | El punto se elige en el mapa del tramo. Se guarda `origen_ubicacion = 'manual'` y `precision_gps_m = null`, y el moderador ve la alerta "ubicación manual". | [x] confirmada |
| 7 | **Preselección del tramo más cercano.** | Se calcula en el cliente con los trazados públicos. La ubicación solo sale del dispositivo al confirmar el envío. | [x] confirmada |
| 8 | **`autos int[]` o tabla intermedia.** | Mantener `int[]` con índice GIN. La validación contra `inscritos` se hace en la Edge Function y en un trigger. Es más simple y alcanza para el volumen esperado. | [x] confirmada |
| 9 | **Eventos activos simultáneos.** | Solo uno. Se garantiza con un índice único parcial `WHERE activo`. | [x] confirmada |
| 10 | **Formato de los tramos.** | El administrador acepta GPX, KML y GeoJSON, y los parsea en el cliente con `@tmcw/togeojson`. Si hay varios segmentos, se unen en orden. En la vista previa, el administrador confirma la largada y puede invertir el sentido si hace falta. | [x] confirmada |

## Supuestos adicionales (confirmar o corregir)
- S1. El volumen esperado por fecha es de cientos de publicaciones, no miles, y de cientos a pocos miles de espectadores.
- S2. Los voluntarios moderan desde una notebook o tablet con teclado.
- S3. Las publicaciones del seed usan URL de videos reales y públicos (no hay derechos de autor en juego, solo enlaces).
- S4. Para los correos de enlace mágico se configura un SMTP gratuito (Brevo o Resend), porque el correo integrado de Supabase tiene un límite muy bajo.
- S5. Si la cuota de teselas no alcanza, se usa OpenFreeMap (sin clave) como proveedor de teselas en lugar de MapTiler o Stadia. Se valida en la Etapa 1.

**Estado:** las 10 dudas y los supuestos S1–S5 fueron confirmados con la propuesta por defecto el 2026-10-17. Los cambios ya se trasladaron a `especificacion-app-rally.md`.

## Salida de la etapa
Todas las filas quedan confirmadas o con una decisión alternativa escrita. Los cambios al modelo de datos (columnas nuevas en 2, 3, 5 y 6) se trasladan a `especificacion-app-rally.md`.

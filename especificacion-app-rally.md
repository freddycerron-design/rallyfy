# Especificación: Muro Rally — app web de publicaciones de aficionados

## 1. Contexto y objetivo

Construir una aplicación web progresiva (PWA), sin fines de lucro y de costo operativo casi cero, que reúne las publicaciones que los aficionados hacen en sus propias redes sociales (TikTok, YouTube) durante una fecha de un campeonato de rally, y las muestra **ordenadas por tramo, por punto del tramo (km) y por auto**, en un muro y en un mapa.

La app NO aloja video ni transmite. Solo guarda el enlace de la publicación y la muestra incrustada. Todo el contenido multimedia lo sirven las redes sociales.

**Restricción principal: costo.** Todo debe funcionar en planes gratuitos. No usar APIs pagas, ni SMS, ni servicios de IA, ni almacenamiento de archivos multimedia.

## 2. Alcance

### Incluido en el MVP
- Envío de publicaciones por parte del aficionado (enlace + tramo + autos + ubicación automática).
- Moderación manual por voluntarios (aprobar / rechazar / corregir).
- Muro por tramo, ordenable y filtrable.
- Mapa con el trazado de los tramos y pines de publicaciones.
- "Último visto" de cada auto (último km donde aparece en una publicación aprobada).
- Marca de "en vivo ahora" para aficionados que transmiten en TikTok o YouTube (solo enlace, sin incrustar).
- Votos de espectadores.
- Panel de administración para cargar evento, tramos e inscritos.

### Fuera de alcance
- Video propio, streaming, grabación o almacenamiento de archivos.
- Cálculo de tiempos o posición estimada en tiempo real.
- Recolección automática por hashtag o scraping de redes sociales.
- Apps nativas en tiendas.
- Instagram y Facebook (requieren app de Meta con revisión; dejar la arquitectura preparada para agregarlos después mediante una bandera de configuración, pero no implementarlos).

## 3. Stack técnico

| Capa | Tecnología |
|---|---|
| Frontend | Vite + React + TypeScript |
| Estilos | Tailwind CSS, diseño mobile-first |
| Mapa | MapLibre GL JS con teselas de un plan gratuito (MapTiler o Stadia; clave por variable de entorno) |
| PWA | vite-plugin-pwa (instalable, caché del app shell) |
| Backend | Supabase plan gratuito: Postgres + PostGIS, Auth, Row Level Security, Realtime, Edge Functions |
| Anti-spam | Cloudflare Turnstile (gratuito) en el formulario de envío |
| Hosting | Cloudflare Pages |
| Tareas programadas | GitHub Actions |

Idioma de toda la interfaz: español latinoamericano.

## 4. Roles y autenticación

- **Espectador:** no necesita cuenta para ver el muro y el mapa.
- **Aficionado (envía publicaciones y vota):** autenticación anónima de Supabase, sin fricción. Se le pide un alias público opcional. Turnstile obligatorio en cada envío.
- **Moderador:** login por enlace mágico de correo. El rol se asigna en la tabla `perfiles`.
- **Administrador:** igual que moderador, con rol `admin`.

Toda la autorización se aplica con Row Level Security, no solo en el frontend.

## 5. Modelo de datos (Postgres + PostGIS)

```
eventos
  id, nombre, fecha_inicio, fecha_fin, activo (bool), creado_en
  -- índice único parcial: solo un evento con activo = true

tramos
  id, evento_id, codigo (ej. "TC4"), nombre, orden,
  trazado geometry(LineString, 4326), longitud_km (calculada),
  hora_inicio_prevista,
  estado ('por_iniciar' | 'en_curso' | 'finalizado', manual por el admin;
          si no se cambia, se deriva de hora_inicio_prevista)

inscritos
  id, evento_id, numero (int), piloto, copiloto, auto, clase
  UNIQUE (evento_id, numero)

publicaciones
  id, evento_id, tramo_id, usuario_id,
  url_original, url_canonica (UNIQUE), plataforma ('tiktok' | 'youtube'),
  id_externo (id del video en la plataforma),
  es_en_vivo (bool),
  en_vivo_hasta timestamptz (creado_en + 2 h; el moderador puede adelantarlo),
  autos int[] (números de inscritos que aparecen; índice GIN),
  ubicacion geometry(Point, 4326), precision_gps_m (null si es manual),
  origen_ubicacion ('gps' | 'manual'),
  ip_hash (hash de la IP para límite de frecuencia; nunca la IP en claro),
  km_en_tramo (calculado con ST_LineLocatePoint * longitud_km),
  distancia_al_trazado_m (calculada),
  hora_captura (hora del dispositivo al enviar),
  estado ('pendiente' | 'aprobada' | 'rechazada'),
  motivo_rechazo, moderado_por, moderado_en,
  votos (int, contador), creado_en

votos
  publicacion_id, usuario_id, creado_en
  PRIMARY KEY (publicacion_id, usuario_id)

perfiles
  usuario_id, alias, rol ('aficionado' | 'moderador' | 'admin')
```

### Vistas
- `ultimo_visto_por_auto`: para cada inscrito, la publicación aprobada más avanzada donde aparece (mayor `tramo.orden`, luego mayor `km_en_tramo`, luego mayor `hora_captura`), con tramo, km y hora. La hora se muestra como "visto aprox. HH:MM (envío)", porque es la hora del envío y no la del paso.
- Todas las vistas públicas se crean con `security_invoker = true` o exponen solo columnas seguras.
- `muro_publico`: publicaciones aprobadas con datos del tramo, sin exponer `usuario_id` ni la ubicación exacta.

### Privacidad
La ubicación exacta del aficionado nunca se expone al público. Lo público es el **km sobre el trazado** y, para el pin del mapa, el punto proyectado sobre el trazado (no la coordenada original).

## 6. Reglas de negocio y validación

Al recibir un envío (Edge Function `enviar-publicacion`):

1. Validar token de Turnstile.
2. Validar que la URL sea de un dominio permitido: `tiktok.com`, `vm.tiktok.com`, `youtube.com`, `youtu.be`.
3. Resolver enlaces cortos (`vm.tiktok.com`, `youtu.be`) siguiendo la redirección en el servidor.
4. Normalizar a URL canónica y extraer `id_externo`. Si la URL canónica ya existe, devolver mensaje "Esta publicación ya fue enviada" sin crear duplicado.
5. Validar que el evento esté activo y el tramo pertenezca al evento.
6. Validar que los números de auto existan en `inscritos`.
7. Calcular `km_en_tramo` y `distancia_al_trazado_m`. Si la distancia supera 500 m, guardar igual pero marcar para el moderador como "lejos del trazado" (no rechazar automáticamente; puede ser un video tomado desde un mirador).
8. Límite de frecuencia: máximo 10 envíos por usuario por hora y 30 por IP (hasheada) por hora.
9. Estado inicial: `pendiente`.

Si el aficionado niega el permiso de ubicación, permitir el envío igual, pidiéndole que elija manualmente el punto en el mapa del tramo. Se guarda `origen_ubicacion = 'manual'` y el moderador ve la alerta "ubicación manual".

La preselección del tramo más cercano se calcula en el cliente con los trazados públicos. La ubicación solo se envía al servidor al confirmar.

**Votos:** un voto por usuario (sesión anónima) y por publicación, se puede quitar, sin Turnstile, con un máximo de 60 votos por usuario por hora.

**Autenticación anónima:** activar el captcha (Turnstile) de Supabase Auth en el inicio de sesión anónimo.

**Carga de tramos:** se aceptan GPX, KML y GeoJSON, parseados en el cliente. Si hay varios segmentos, se unen en orden. En la vista previa, el administrador confirma la largada (km 0) y puede invertir el sentido.

## 7. Pantallas

1. **Inicio:** evento activo, lista de tramos con cantidad de publicaciones y estado (por iniciar / en curso / finalizado), acceso destacado a "Enviar mi video".
2. **Muro del tramo:** tarjetas de publicaciones aprobadas. Orden seleccionable: por km (recorrido del tramo), por hora, por votos. Filtro por número de auto. Sección superior "En vivo ahora" si hay enlaces en vivo activos.
3. **Mapa:** trazado de los tramos, pines de publicaciones aprobadas (agrupados con clustering cuando se superponen), y un modo "Último visto" que muestra cada auto en su último km conocido con la hora. Tocar un pin abre la tarjeta de la publicación.
4. **Ficha del auto:** piloto, copiloto, auto, clase y todas sus publicaciones aprobadas en orden de tramo y km.
5. **Enviar publicación:** flujo de 3 pasos en una sola pantalla: (1) pegar enlace, con validación inmediata y vista previa; (2) elegir tramo (preseleccionar el más cercano según GPS) y números de auto con botones grandes; (3) confirmar. Opción "Estoy transmitiendo en vivo".
6. **Panel de moderación:** cola de pendientes, la más antigua primero, con vista previa incrustada, km, distancia al trazado y alertas. Acciones: aprobar, rechazar con motivo predefinido, corregir tramo o autos. Atajos de teclado (A = aprobar, R = rechazar). Actualización en tiempo real con Supabase Realtime.
7. **Administración:** crear y activar evento; crear tramos subiendo un archivo GPX o KML por tramo; importar inscritos desde CSV (`numero,piloto,copiloto,auto,clase`); gestionar moderadores.

## 8. Incrustación de videos

- **YouTube:** iframe de `youtube-nocookie.com/embed/{id}`.
- **TikTok:** reproductor de incrustación oficial de TikTok usando el `id_externo`; si falla, usar el endpoint oEmbed público de TikTok.
- **Carga diferida obligatoria:** en el muro, mostrar solo una miniatura con botón de reproducir; el iframe se carga recién al tocar. Esto es crítico para el consumo de datos móviles y el rendimiento.
- Los enlaces "en vivo" no se incrustan: se muestran como tarjeta que abre la red social. Aparecen en "En vivo ahora" mientras `en_vivo_hasta > now()`.

## 9. Tiempo real

Suscripción de Supabase Realtime a los cambios de estado de `publicaciones` para que el muro, el mapa y el panel de moderación se actualicen sin recargar. Mantener las suscripciones al mínimo necesario para no exceder el plan gratuito.

## 10. Requisitos no funcionales

- Mobile-first: la mayoría de usuarios estará en el borde del camino con señal débil.
- PWA instalable con caché del app shell; mostrar un aviso claro cuando no haya conexión.
- Accesible: contraste adecuado, botones grandes, navegable por teclado en el panel de moderación.
- Sin costos variables: no usar servicios pagos de ningún tipo.

## 11. Operación

- **Evitar la pausa de Supabase:** el plan gratuito pausa proyectos inactivos por una semana. Crear un workflow de GitHub Actions que haga una consulta liviana a la API dos veces por semana.
- **README** con: creación del proyecto Supabase, activación de PostGIS, aplicación de migraciones, variables de entorno, configuración de Turnstile, despliegue en Cloudflare Pages y checklist previo a cada fecha de rally.
- **Datos de prueba (seed):** un evento de ejemplo con 2 tramos reales en formato GeoJSON, 15 inscritos y publicaciones de ejemplo en distintos estados.

## 12. Plan de construcción por fases

Construir en este orden, verificando cada fase antes de pasar a la siguiente:

1. Proyecto base, migraciones SQL, políticas RLS, seed.
2. Administración: evento, carga de tramos GPX/KML, importación de inscritos.
3. Envío de publicaciones con Edge Function y todas las validaciones.
4. Panel de moderación con tiempo real.
5. Muro del tramo y ficha del auto.
6. Mapa con pines, clustering y "último visto".
7. Votos y sección "En vivo ahora".
8. PWA, workflow de mantenimiento y README de despliegue.

## 13. Criterios de aceptación

- Un aficionado puede enviar un enlace de TikTok o YouTube desde el celular en menos de 30 segundos.
- Un enlace duplicado no genera una segunda publicación.
- Una publicación no aparece en el muro ni en el mapa hasta ser aprobada.
- El muro ordenado por km muestra las publicaciones en el orden del recorrido del tramo.
- El mapa nunca muestra la coordenada exacta del aficionado.
- Un usuario anónimo no puede aprobar publicaciones ni leer datos privados, aunque llame directamente a la API.
- La aplicación completa opera en los planes gratuitos de Supabase, Cloudflare y del proveedor de teselas.

## 14. Instrucciones para el desarrollo

- Antes de empezar, revisa esta especificación y lista las dudas o supuestos que necesites confirmar.
- Escribe pruebas para las funciones de validación y normalización de URLs, y para las políticas RLS.
- Si alguna funcionalidad requiere un servicio de pago para funcionar, detente y propón una alternativa gratuita antes de implementarla.

import { analizarUrl, ErrorUrl, type UrlAnalizada } from '@shared/urls.ts'
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'
import { type ControlTurnstile, Turnstile } from '@/components/Turnstile'
import { Aviso, Boton, Campo, Cargando, Tarjeta } from '@/components/ui'
import { useEventoActivo, useInscritosPublicos, useTramosPublicos } from '@/lib/consultasPublicas'
import { mensajeError } from '@/lib/errores'
import { type Coordenada, ordenarPorCercania } from '@/lib/geo'
import { useSesion } from '@/lib/sesion'
import { supabase } from '@/lib/supabase'
import { useUbicacion } from '@/lib/useUbicacion'
import {
  aliasRecordado,
  ErrorEnvio,
  guardarAlias,
  type RespuestaEnvio,
  useEnviarPublicacion,
} from './api'
import { SeccionUbicacionTramo } from './SeccionUbicacionTramo'
import { SelectorAutos } from './SelectorAutos'
import { VistaPreviaEnlace } from './VistaPreviaEnlace'

export function PaginaEnvio() {
  const evento = useEventoActivo()

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Enviar mi video</h1>
        {evento.data && <p className="text-gray-600">{evento.data.nombre}</p>}
      </header>
      {evento.isPending ? (
        <Cargando />
      ) : evento.isError ? (
        <Aviso tipo="error">{mensajeError(evento.error)}</Aviso>
      ) : !evento.data ? (
        <p className="text-gray-600">Ahora no hay una fecha en curso. ¡Vuelve el día del rally!</p>
      ) : (
        <FormularioEnvio eventoId={evento.data.id} />
      )}
    </section>
  )
}

function FormularioEnvio({ eventoId }: { eventoId: string }) {
  const tramos = useTramosPublicos(eventoId)
  const inscritos = useInscritosPublicos(eventoId)
  const ubicacion = useUbicacion()
  const sesion = useSesion()
  const envio = useEnviarPublicacion()

  // Paso 1: enlace
  const [texto, setTexto] = useState('')
  const [enlace, setEnlace] = useState<UrlAnalizada | null>(null)
  const [errorEnlace, setErrorEnlace] = useState<string | null>(null)

  // Paso 2: ubicación, tramo y autos
  const [tramoElegido, setTramoElegido] = useState<string | null>(null)
  const [manualElegido, setManualElegido] = useState(false)
  const [puntoManual, setPuntoManual] = useState<Coordenada | null>(null)
  const [autos, setAutos] = useState<number[]>([])

  // Paso 3: confirmación
  const [enVivo, setEnVivo] = useState(false)
  const [alias, setAlias] = useState(aliasRecordado.leer)
  const [resultado, setResultado] = useState<RespuestaEnvio | null>(null)

  // Anti-spam: un token para crear la sesión anónima y uno nuevo por cada envío.
  const turnstile = useRef<ControlTurnstile>(null)
  const [token, setToken] = useState<string | null>(null)
  const [errorVerificacion, setErrorVerificacion] = useState<string | null>(null)
  const creandoSesion = useRef(false)

  useEffect(() => {
    if (sesion !== null || !token || creandoSesion.current) return
    creandoSesion.current = true
    supabase.auth
      .signInAnonymously({ options: { captchaToken: token } })
      .then(({ error }) => {
        if (error) setErrorVerificacion(mensajeError(error))
      })
      .finally(() => {
        creandoSesion.current = false
        turnstile.current?.reiniciar()
      })
  }, [sesion, token])

  const sinGps = ['denegada', 'no_disponible', 'no_soportada'].includes(ubicacion.estado)
  const modoManual = sinGps || manualElegido
  const gps = ubicacion.estado === 'ok' ? ubicacion : null

  const tramoCercano = useMemo(
    () =>
      gps && tramos.data?.length
        ? ordenarPorCercania(gps.punto, tramos.data, (t) => t.trazado_geojson.coordinates)[0]
            ?.elemento.id
        : undefined,
    [gps, tramos.data],
  )
  const tramoId = tramoElegido ?? tramoCercano ?? null
  const punto = modoManual ? puntoManual : (gps?.punto ?? null)
  const esTransmision = enlace?.tipo === 'video' && enlace.esEnVivo

  function cambiarTexto(valor: string) {
    setTexto(valor)
    setResultado(null)
    envio.reset()
    if (!valor.trim()) {
      setEnlace(null)
      setErrorEnlace(null)
      return
    }
    try {
      setEnlace(analizarUrl(valor))
      setErrorEnlace(null)
    } catch (e) {
      setEnlace(null)
      setErrorEnlace(e instanceof ErrorUrl ? e.message : 'Enlace inválido.')
    }
  }

  async function pegar() {
    try {
      cambiarTexto(await navigator.clipboard.readText())
    } catch {
      // sin permiso de portapapeles: se pega a mano
    }
  }

  const faltante = !enlace
    ? 'Pega el enlace de tu video.'
    : !tramoId
      ? 'Elige el tramo.'
      : !punto
        ? 'Marca en el mapa dónde estás.'
        : !sesion || !token
          ? 'Verificando que no eres un robot…'
          : null

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    if (faltante || !sesion || !token || !tramoId || !punto) return
    const tokenUsado = token
    turnstile.current?.reiniciar()

    const aliasLimpio = alias.trim()
    aliasRecordado.guardar(aliasLimpio)
    if (aliasLimpio.length >= 2) await guardarAlias(sesion.user.id, aliasLimpio).catch(() => {})

    envio.mutate(
      {
        url: texto,
        eventoId,
        tramoId,
        autos,
        ubicacion: {
          lon: punto[0],
          lat: punto[1],
          precisionM: modoManual ? null : (gps?.precisionM ?? null),
          origen: modoManual ? 'manual' : 'gps',
        },
        horaCaptura: new Date().toISOString(),
        esEnVivo: esTransmision || enVivo,
        turnstileToken: tokenUsado,
      },
      { onSuccess: setResultado },
    )
  }

  function enviarOtro() {
    setResultado(null)
    envio.reset()
    setTexto('')
    setEnlace(null)
    setAutos([])
    setEnVivo(false)
  }

  if (resultado) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">¡Gracias!</h2>
        <Aviso tipo="exito">{resultado.mensaje}</Aviso>
        {resultado.codigo === 'creada' && (
          <p className="text-gray-700">
            Un moderador la revisará en unos minutos.
            {resultado.kmEnTramo != null &&
              ` La ubicamos en el km ${Number(resultado.kmEnTramo).toFixed(1)} del tramo.`}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Boton onClick={enviarOtro}>Enviar otro video</Boton>
          {tramoId && (
            <Link
              to={`/tramo/${tramoId}`}
              className="inline-flex min-h-11 items-center rounded-lg border border-gray-300 bg-white px-4 font-medium"
            >
              Ver el muro del tramo
            </Link>
          )}
        </div>
      </div>
    )
  }

  const errorEnvio = envio.error instanceof ErrorEnvio ? envio.error.respuesta : null

  return (
    <form onSubmit={enviar} className="space-y-6" noValidate>
      <Paso numero={1} titulo="Pega el enlace de TikTok o YouTube">
        <div className="flex gap-2">
          <div className="flex-1">
            <Campo
              etiqueta="Enlace"
              type="url"
              inputMode="url"
              autoComplete="off"
              placeholder="https://vm.tiktok.com/…"
              value={texto}
              onChange={(e) => cambiarTexto(e.target.value)}
              aria-invalid={!!errorEnlace}
            />
          </div>
          {'clipboard' in navigator && (
            <Boton variante="secundario" className="self-end" onClick={pegar}>
              Pegar
            </Boton>
          )}
        </div>
        {errorEnlace && <Aviso tipo="error">{errorEnlace}</Aviso>}
        {enlace && <VistaPreviaEnlace enlace={enlace} />}
      </Paso>

      <Paso numero={2} titulo="¿Dónde estás y qué autos aparecen?">
        {tramos.isPending ? (
          <Cargando />
        ) : tramos.isError ? (
          <Aviso tipo="error">{mensajeError(tramos.error)}</Aviso>
        ) : (
          <SeccionUbicacionTramo
            tramos={tramos.data}
            ubicacion={ubicacion}
            tramoId={tramoId}
            alElegirTramo={(id) => {
              setTramoElegido(id)
              setPuntoManual(null)
            }}
            modoManual={modoManual}
            alCambiarModoManual={setManualElegido}
            puntoManual={puntoManual}
            alElegirPunto={setPuntoManual}
          />
        )}
        {inscritos.data && (
          <SelectorAutos inscritos={inscritos.data} seleccionados={autos} alCambiar={setAutos} />
        )}
      </Paso>

      <Paso numero={3} titulo="Confirma y envía">
        <label className="flex min-h-11 items-center gap-3">
          <input
            type="checkbox"
            className="size-5 accent-marca-oscuro"
            checked={esTransmision || enVivo}
            disabled={esTransmision}
            onChange={(e) => setEnVivo(e.target.checked)}
          />
          <span>Estoy transmitiendo en vivo</span>
        </label>
        <Campo
          etiqueta="Tu alias (opcional)"
          maxLength={30}
          placeholder="Así aparecerás en el muro"
          value={alias}
          onChange={(e) => setAlias(e.target.value)}
        />

        <Turnstile ref={turnstile} alCambiarToken={setToken} alFallarCarga={setErrorVerificacion} />
        {errorVerificacion && <Aviso tipo="error">{errorVerificacion}</Aviso>}
        {errorEnvio && <Aviso tipo="error">{errorEnvio.mensaje}</Aviso>}

        <Boton
          type="submit"
          className="min-h-14 w-full text-lg"
          disabled={!!faltante || envio.isPending}
        >
          {envio.isPending ? 'Enviando…' : 'Enviar'}
        </Boton>
        {faltante && !envio.isPending && (
          <p className="text-center text-sm text-gray-600" aria-live="polite">
            {faltante}
          </p>
        )}
      </Paso>
    </form>
  )
}

function Paso({
  numero,
  titulo,
  children,
}: {
  numero: number
  titulo: string
  children: ReactNode
}) {
  return (
    <Tarjeta className="space-y-3">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <span
          aria-hidden
          className="flex size-7 items-center justify-center rounded-full bg-tinta text-sm text-white"
        >
          {numero}
        </span>
        {titulo}
      </h2>
      {children}
    </Tarjeta>
  )
}

import { type Ref, useEffect, useImperativeHandle, useRef } from 'react'
import { env } from '@/lib/env'

type OpcionesWidget = {
  sitekey: string
  callback: (token: string) => void
  'expired-callback'?: () => void
  'error-callback'?: () => void
  language?: string
  appearance?: 'always' | 'execute' | 'interaction-only'
}

type ApiTurnstile = {
  render: (el: HTMLElement, opciones: OpcionesWidget) => string
  reset: (id: string) => void
  remove: (id: string) => void
}

declare global {
  interface Window {
    turnstile?: ApiTurnstile
  }
}

const URL_SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
let cargaScript: Promise<ApiTurnstile> | null = null

function cargarTurnstile(): Promise<ApiTurnstile> {
  if (window.turnstile) return Promise.resolve(window.turnstile)
  cargaScript ??= new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = URL_SCRIPT
    script.async = true
    script.onload = () =>
      window.turnstile ? resolve(window.turnstile) : reject(new Error('Turnstile no cargó'))
    script.onerror = () => {
      cargaScript = null
      reject(new Error('No se pudo cargar la verificación anti-spam'))
    }
    document.head.appendChild(script)
  })
  return cargaScript
}

export type ControlTurnstile = { reiniciar: () => void }

type Props = {
  /** Recibe cada token nuevo, o null si venció o falló. Cada token sirve una sola vez. */
  alCambiarToken: (token: string | null) => void
  alFallarCarga?: (mensaje: string) => void
  ref?: Ref<ControlTurnstile>
}

/**
 * Widget de Cloudflare Turnstile. En modo "interaction-only" solo se ve si Cloudflare
 * necesita que la persona haga clic; casi siempre se resuelve solo.
 */
export function Turnstile({ alCambiarToken, alFallarCarga, ref }: Props) {
  const contenedor = useRef<HTMLDivElement>(null)
  const widget = useRef<string | null>(null)
  const callbacks = useRef({ alCambiarToken, alFallarCarga })
  useEffect(() => {
    callbacks.current = { alCambiarToken, alFallarCarga }
  })

  useImperativeHandle(ref, () => ({
    reiniciar: () => {
      callbacks.current.alCambiarToken(null)
      if (widget.current && window.turnstile) window.turnstile.reset(widget.current)
    },
  }))

  useEffect(() => {
    let cancelado = false
    cargarTurnstile()
      .then((api) => {
        if (cancelado || !contenedor.current) return
        widget.current = api.render(contenedor.current, {
          sitekey: env.turnstileSiteKey,
          language: 'es',
          appearance: 'interaction-only',
          callback: (token) => callbacks.current.alCambiarToken(token),
          'expired-callback': () => callbacks.current.alCambiarToken(null),
          'error-callback': () => callbacks.current.alCambiarToken(null),
        })
      })
      .catch((e: Error) => callbacks.current.alFallarCarga?.(e.message))
    return () => {
      cancelado = true
      if (widget.current && window.turnstile) window.turnstile.remove(widget.current)
      widget.current = null
    }
  }, [])

  return <div ref={contenedor} className="min-h-0" />
}

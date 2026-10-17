import type { UrlAnalizada } from '@shared/urls.ts'

/** Usuario de TikTok (`@fan`) a partir de la URL canónica. */
const usuarioTiktok = (url: string) => url.match(/tiktok\.com\/(@[^/]+)/)?.[1] ?? ''

export function VistaPreviaEnlace({ enlace }: { enlace: UrlAnalizada }) {
  if (enlace.tipo === 'corto') {
    return (
      <Ficha icono="🔗" titulo="Enlace corto de TikTok">
        Lo verificamos al enviar.
      </Ficha>
    )
  }

  if (enlace.plataforma === 'youtube') {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-2">
        <img
          src={`https://i.ytimg.com/vi/${enlace.idExterno}/mqdefault.jpg`}
          alt=""
          width={120}
          height={68}
          className="h-[68px] w-[120px] shrink-0 rounded bg-gray-200 object-cover"
          loading="lazy"
        />
        <div>
          <p className="font-medium">
            {enlace.esEnVivo ? 'Transmisión de YouTube' : 'Video de YouTube'}
          </p>
          <p className="text-sm text-green-700">✓ Enlace válido</p>
        </div>
      </div>
    )
  }

  const usuario = usuarioTiktok(enlace.urlCanonica)
  return (
    <Ficha
      icono="♪"
      titulo={enlace.esEnVivo ? `En vivo de ${usuario}` : `Video de TikTok · ${usuario}`}
    >
      <span className="text-green-700">✓ Enlace válido</span>
    </Ficha>
  )
}

function Ficha({
  icono,
  titulo,
  children,
}: {
  icono: string
  titulo: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-3">
      <span
        aria-hidden
        className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-tinta text-xl text-white"
      >
        {icono}
      </span>
      <div className="min-w-0">
        <p className="truncate font-medium">{titulo}</p>
        <p className="text-sm text-gray-600">{children}</p>
      </div>
    </div>
  )
}

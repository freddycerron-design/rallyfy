import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
} from 'react'
import { useId } from 'react'

type VarianteBoton = 'primario' | 'secundario' | 'peligro' | 'exito'

const estilosBoton: Record<VarianteBoton, string> = {
  primario: 'bg-tinta text-white hover:bg-gray-800 disabled:bg-gray-400',
  secundario: 'border border-gray-300 bg-white text-tinta hover:bg-gray-50 disabled:text-gray-400',
  peligro: 'border border-red-300 bg-white text-red-700 hover:bg-red-50 disabled:text-red-300',
  exito: 'bg-green-700 text-white hover:bg-green-800 disabled:bg-gray-400',
}

export function Boton({
  variante = 'primario',
  className = '',
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: VarianteBoton }) {
  return (
    <button
      type={type}
      className={`inline-flex min-h-11 items-center justify-center rounded-lg px-4 font-medium transition-colors disabled:cursor-not-allowed ${estilosBoton[variante]} ${className}`}
      {...props}
    />
  )
}

const estiloControl =
  'min-h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-base focus:border-marca-oscuro focus:ring-2 focus:ring-marca/40 focus:outline-none'

export function Campo({
  etiqueta,
  ayuda,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { etiqueta: string; ayuda?: string }) {
  const id = useId()
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-gray-700">
        {etiqueta}
      </label>
      <input id={id} className={estiloControl} {...props} />
      {ayuda && <p className="mt-1 text-sm text-gray-500">{ayuda}</p>}
    </div>
  )
}

export function Selector({
  etiqueta,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { etiqueta: string; children: ReactNode }) {
  const id = useId()
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-gray-700">
        {etiqueta}
      </label>
      <select id={id} className={estiloControl} {...props}>
        {children}
      </select>
    </div>
  )
}

type TipoAviso = 'error' | 'info' | 'exito' | 'advertencia'

const estilosAviso: Record<TipoAviso, string> = {
  error: 'border-red-200 bg-red-50 text-red-800',
  info: 'border-blue-200 bg-blue-50 text-blue-800',
  exito: 'border-green-200 bg-green-50 text-green-800',
  advertencia: 'border-amber-200 bg-amber-50 text-amber-900',
}

export function Aviso({ tipo = 'info', children }: { tipo?: TipoAviso; children: ReactNode }) {
  return (
    <div
      role={tipo === 'error' ? 'alert' : 'status'}
      className={`rounded-lg border px-3 py-2 text-sm ${estilosAviso[tipo]}`}
    >
      {children}
    </div>
  )
}

export function Cargando({ texto = 'Cargando…' }: { texto?: string }) {
  return (
    <p role="status" className="py-6 text-center text-gray-500">
      {texto}
    </p>
  )
}

export function Tarjeta({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-gray-200 bg-white p-4 ${className}`}>{children}</div>
  )
}

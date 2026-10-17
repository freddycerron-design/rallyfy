import { useState } from 'react'
import { Aviso, Boton, Campo, Cargando, Tarjeta } from '@/components/ui'
import { mensajeError } from '@/lib/errores'
import { useEliminarInscrito, useImportarInscritos, useInscritos } from '../api'
import { parsearInscritosCsv, type ResultadoCsv } from './csvInscritos'

export function SeccionInscritos({ eventoId }: { eventoId: string }) {
  const inscritos = useInscritos(eventoId)
  const eliminar = useEliminarInscrito(eventoId)

  return (
    <div className="space-y-4">
      <ImportarCsv eventoId={eventoId} />

      <h2 className="text-lg font-semibold">
        Inscritos{inscritos.data ? ` (${inscritos.data.length})` : ''}
      </h2>
      {inscritos.isPending && <Cargando />}
      {inscritos.isError && <Aviso tipo="error">{mensajeError(inscritos.error)}</Aviso>}
      {eliminar.isError && <Aviso tipo="error">{mensajeError(eliminar.error)}</Aviso>}
      {inscritos.data?.length === 0 && (
        <p className="text-gray-600">Todavía no hay inscritos. Importa un CSV.</p>
      )}
      {!!inscritos.data?.length && (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="px-3 py-2">N.º</th>
                <th className="px-3 py-2">Piloto / Copiloto</th>
                <th className="px-3 py-2">Auto</th>
                <th className="px-3 py-2">Clase</th>
                <th className="px-3 py-2">
                  <span className="sr-only">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {inscritos.data.map((i) => (
                <tr key={i.id}>
                  <td className="px-3 py-2 font-semibold">{i.numero}</td>
                  <td className="px-3 py-2">
                    {i.piloto}
                    {i.copiloto && <span className="block text-gray-500">{i.copiloto}</span>}
                  </td>
                  <td className="px-3 py-2">{i.auto}</td>
                  <td className="px-3 py-2">{i.clase}</td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      className="min-h-11 px-2 text-red-700 underline disabled:text-gray-400"
                      disabled={eliminar.isPending}
                      onClick={() => {
                        if (confirm(`¿Quitar al auto ${i.numero}?`)) eliminar.mutate(i.id)
                      }}
                    >
                      Quitar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function ImportarCsv({ eventoId }: { eventoId: string }) {
  const importar = useImportarInscritos(eventoId)
  const [resultado, setResultado] = useState<ResultadoCsv | null>(null)
  const [claveArchivo, setClaveArchivo] = useState(0)

  async function leer(archivo: File | undefined) {
    importar.reset()
    setResultado(archivo ? parsearInscritosCsv(await archivo.text()) : null)
  }

  return (
    <Tarjeta className="space-y-3">
      <h2 className="text-lg font-semibold">Importar desde CSV</h2>
      <p className="text-sm text-gray-600">
        Columnas: <code>numero,piloto,copiloto,auto,clase</code>. Si un número ya existe, se
        actualizan sus datos; los que no vienen en el archivo no se borran.
      </p>
      <Campo
        key={claveArchivo}
        etiqueta="Archivo CSV"
        type="file"
        accept=".csv,text/csv"
        className="block w-full text-base file:mr-3 file:min-h-11 file:rounded-lg file:border-0 file:bg-gray-100 file:px-4 file:font-medium"
        onChange={(e) => leer(e.target.files?.[0])}
      />

      {resultado && (
        <>
          <p className="text-sm">
            <strong>{resultado.validos.length}</strong> filas válidas
            {resultado.errores.length > 0 && (
              <>
                , <strong className="text-red-700">{resultado.errores.length}</strong> con errores
              </>
            )}
            .
          </p>
          {resultado.errores.length > 0 && (
            <Aviso tipo="error">
              <ul className="list-inside list-disc">
                {resultado.errores.slice(0, 20).map((e) => (
                  <li key={`${e.fila}-${e.mensaje}`}>
                    Fila {e.fila}: {e.mensaje}
                  </li>
                ))}
                {resultado.errores.length > 20 && <li>… y {resultado.errores.length - 20} más</li>}
              </ul>
            </Aviso>
          )}
          {importar.isError && <Aviso tipo="error">{mensajeError(importar.error)}</Aviso>}
          <Boton
            disabled={resultado.validos.length === 0 || importar.isPending}
            onClick={() =>
              importar.mutate(resultado.validos, {
                onSuccess: () => {
                  setResultado(null)
                  setClaveArchivo((k) => k + 1)
                },
              })
            }
          >
            {importar.isPending ? 'Importando…' : `Importar ${resultado.validos.length} inscritos`}
          </Boton>
        </>
      )}
      {importar.isSuccess && <Aviso tipo="exito">Inscritos importados.</Aviso>}
    </Tarjeta>
  )
}

// Valida migraciones, seed y pruebas pgTAP sin Docker, sobre PGlite (Postgres en WASM)
// con PostGIS y una emulación mínima de Supabase (supabase-minimo.sql).
//
// Uso: npm run db:validar
//
// No reemplaza a `supabase test db` (que corre en la CI contra el Postgres real de
// Supabase): sirve para iterar rápido en local. El stub de pgTAP cubre solo las
// funciones que usan las pruebas (plan, ok, is, lives_ok, throws_ok, is_empty, finish).
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PGlite } from '@electric-sql/pglite'
import { postgis } from '@electric-sql/pglite-postgis'

const raiz = process.argv[2] ?? fileURLToPath(new URL('../..', import.meta.url))
const leer = (p) => readFileSync(p, 'utf8')
const db = await PGlite.create({ extensions: { postgis } })
let fallas = 0

async function aplicar(nombre, sql) {
  try {
    await db.exec(sql)
    console.log(`✓ ${nombre}`)
  } catch (e) {
    fallas++
    console.log(`✗ ${nombre}\n   ${e.message}${e.position ? ` (posición ${e.position})` : ''}`)
    try {
      await db.exec('rollback')
    } catch {
      // sin transacción abierta
    }
  }
}

await aplicar('emulación de Supabase', leer(new URL('./supabase-minimo.sql', import.meta.url)))
const dirMig = join(raiz, 'supabase/migrations')
for (const f of readdirSync(dirMig)
  .filter((f) => f.endsWith('.sql'))
  .sort()) {
  await aplicar(`migración ${f}`, leer(join(dirMig, f)))
}
await aplicar('seed', leer(join(raiz, 'supabase/seed.sql')))

try {
  const r = await db.query(`
    select (select count(*) from eventos) eventos, (select count(*) from tramos) tramos,
           (select count(*) from inscritos) inscritos, (select count(*) from publicaciones) pubs,
           (select count(*) from muro_publico) muro, (select count(*) from ultimo_visto_por_auto) ultimo,
           (select count(*) from publicaciones where lejos_del_trazado) lejos,
           (select count(*) from muro_publico where en_vivo_ahora) en_vivo,
           (select string_agg(codigo || '=' || longitud_km || 'km', ', ') from tramos) longitudes,
           (select sum(votos) from publicaciones) votos,
           (select string_agg(rol::text, ',' order by rol) from perfiles) roles`)
  console.log('  seed:', JSON.stringify(r.rows[0]))
} catch (e) {
  fallas++
  console.log('✗ resumen del seed:', e.message)
}

const dirTests = join(raiz, 'supabase/tests')
for (const f of readdirSync(dirTests)
  .filter((f) => f.endsWith('.sql'))
  .sort()) {
  const sql = leer(join(dirTests, f)).replace(/^create extension if not exists pgtap.*$/m, '')
  try {
    const res = await db.exec(sql)
    const lineas = res.flatMap((x) => x.rows.map((row) => row.finish)).filter(Boolean)
    const malas = lineas.filter((l) => l.startsWith('not ok'))
    const planLinea = lineas.find((l) => l.startsWith('# plan')) ?? '# plan ?, ejecutadas ?'
    const [, plan, ejec] = planLinea.match(/plan (\S+), ejecutadas (\S+)/)
    const okPlan = plan === ejec
    if (malas.length || !okPlan) fallas++
    console.log(
      `${malas.length || !okPlan ? '✗' : '✓'} ${f}: ${lineas.length - 1 - malas.length}/${ejec} ok · ${planLinea}`,
    )
    malas.forEach((l) => console.log('   ' + l))
  } catch (e) {
    fallas++
    console.log(`✗ ${f}\n   ${e.message}`)
    try {
      await db.exec('rollback')
    } catch {
      // sin transacción abierta
    }
  }
}
console.log(fallas ? `\n${fallas} problema(s)` : '\nTodo OK')
process.exit(fallas ? 1 : 0)

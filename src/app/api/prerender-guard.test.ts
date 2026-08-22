import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

/**
 * Guard estructural contra el prerender silencioso de route handlers.
 *
 * Next prerenderiza en el build cualquier handler que **no reciba `req`**: sin request no hay
 * nada dinámico que mirar, así que lo ejecuta al compilar y sirve ese resultado para siempre.
 * En una ruta que consulta la DB eso significa dos cosas, las dos silenciosas:
 *
 * 1. Devuelve el snapshot del momento del deploy — `/api/items/descripciones` ofrecía los
 *    conceptos congelados y uno creado después no aparecía hasta el próximo deploy.
 * 2. Rompe cualquier build sin `DATABASE_URL` — que es el de preview en Vercel, donde el
 *    check venía en rojo desde hacía varios PRs.
 *
 * Nada en el type-check ni en los tests de la propia route lo detecta: compila, pasa, y falla
 * en producción devolviendo datos viejos. Por eso el chequeo es acá y no en cada route.
 *
 * Next sólo prerenderiza cuando `GET` es el **único** método exportado: un `POST`/`PUT`/
 * `DELETE` en el mismo archivo ya vuelve dinámica a toda la route. De ahí la regla que se
 * chequea acá: **route de sólo `GET`, con `GET` sin `req` ⇒ tiene que declarar `dynamic`**.
 * Todo lo demás Next ya lo sirve en runtime por su cuenta.
 */

const API_DIR = join(process.cwd(), 'src', 'app', 'api')

/** Todos los `route.ts` bajo `src/app/api`, recursivo. */
function routeFiles(dir: string): string[] {
  return readdirSync(dir).flatMap(entry => {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) return routeFiles(full)
    return entry === 'route.ts' ? [full] : []
  })
}

const METODO = /export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s*\(/g
/** `export async function GET()` — paréntesis vacíos = no recibe `req`. */
const GET_SIN_REQ = /export\s+(?:async\s+)?function\s+GET\s*\(\s*\)/

/** Los métodos HTTP que exporta el archivo. */
function metodos(src: string): string[] {
  return [...src.matchAll(METODO)].map(m => m[1])
}

describe('routes de sólo GET sin `req` declaran `dynamic`', () => {
  const archivos = routeFiles(API_DIR)

  it('encuentra las routes del proyecto (el recorrido no quedó vacío)', () => {
    expect(archivos.length).toBeGreaterThan(40)
  })

  it.each(archivos.map(f => [f.slice(process.cwd().length + 1).replace(/\\/g, '/'), f]))(
    '%s',
    (_nombre, full) => {
      const src = readFileSync(full, 'utf8')
      const exportados = metodos(src)
      const soloGet = exportados.length > 0 && exportados.every(m => m === 'GET')
      if (!soloGet || !GET_SIN_REQ.test(src)) return
      expect(src).toMatch(/export\s+const\s+dynamic\s*=/)
    },
  )
})

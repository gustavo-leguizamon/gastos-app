/**
 * Pasa los artículos de la lista de compras que están en un **múltiplo** (kg, l, m) a su unidad
 * chica (g, ml, mm): desde ahora las cantidades se registran siempre en g/ml/mm/un y el kg/l/m se
 * elige en pantalla al cargar (`aCantidadBase` en `src/lib/lista-compras-compute.ts`).
 *
 *   node scripts/migrar-lista-compras-a-unidades.js            # dry-run: sólo muestra qué haría
 *   node scripts/migrar-lista-compras-a-unidades.js --apply    # escribe en la DB
 *
 * Por cada artículo cuya unidad es kg/l/m (por nombre, mismos alias que `esUnidadMultiplo`):
 *   1. lo apunta a la unidad con `subunidadDe` = ese múltiplo (kg → g, l → ml, m → mm) y le deja
 *      `mostrarEnMultiplo` en true, para que se siga viendo en la unidad de antes. Si no existe, aborta.
 *   2. en todas sus líneas: `cantidad` y `cantidadComprada` × 1000, `precioUnitario` ÷ 1000.
 *   3. en todas sus compras: `cantidad` × 1000, `precioUnitario` ÷ 1000.
 * Lo pagado (cantidad × precio) no cambia. Después borra las unidades kg/l/m que quedaron sin
 * artículos, para que no se vuelvan a elegir (la API ya no deja crearlas).
 *
 * Idempotente: una segunda corrida no encuentra artículos en kg/l/m. Todo en una transacción.
 * Ojo: la DB es una sola para todos los ambientes — correrlo **después** de desplegar el código
 * que carga en kg/l desde la pantalla, o producción seguiría mostrando "1 kg" donde ahora hay 1000 g.
 */
const { PrismaClient } = require('@prisma/client')

const APPLY = process.argv.includes('--apply')
const prisma = new PrismaClient()
const FACTOR = 1000

/** Copia de `esUnidadMultiplo` (el script es JS y no importa el TS). */
const MULTIPLOS = {
  kg: 'kg', kgs: 'kg', kilo: 'kg', kilos: 'kg', kilogramo: 'kg', kilogramos: 'kg',
  l: 'l', lt: 'l', lts: 'l', litro: 'l', litros: 'l',
  m: 'm', mt: 'm', mts: 'm', metro: 'm', metros: 'm',
}
const esMultiplo = (nombre) =>
  MULTIPLOS[nombre.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\./g, '').trim().toLowerCase()] ?? null

const r6 = (n) => Math.round(n * 1e6) / 1e6

;(async () => {
  const unidades = await prisma.unidad.findMany()
  const multiplos = unidades.filter((u) => esMultiplo(u.nombre))
  if (multiplos.length === 0) return console.log('No hay unidades kg/l/m: nada que migrar.')

  const destinoDe = new Map()
  for (const u of multiplos) {
    const base = esMultiplo(u.nombre)
    const destino = unidades.find((d) => d.subunidadDe === base)
    if (!destino) throw new Error(`No hay una unidad con equivalencia "${base}" (g/ml/mm) para migrar "${u.nombre}".`)
    destinoDe.set(u.id, destino)
  }

  const articulos = await prisma.articulo.findMany({
    where: { unidadId: { in: multiplos.map((u) => u.id) } },
    include: { unidad: true, items: { include: { compras: true } } },
    orderBy: { nombre: 'asc' },
  })

  const ops = []
  for (const a of articulos) {
    const destino = destinoDe.get(a.unidadId)
    console.log(`${a.nombre}: ${a.unidad.nombre} → ${destino.nombre}, se sigue viendo en ${a.unidad.nombre} (${a.items.length} línea(s))`)
    ops.push(prisma.articulo.update({ where: { id: a.id }, data: { unidadId: destino.id, mostrarEnMultiplo: true } }))
    for (const l of a.items) {
      const data = {
        cantidad: r6(l.cantidad * FACTOR),
        cantidadComprada: r6(l.cantidadComprada * FACTOR),
        precioUnitario: l.precioUnitario == null ? null : l.precioUnitario / FACTOR,
      }
      console.log(
        `  ${String(l.mes).padStart(2, '0')}/${l.anio}: necesito ${l.cantidad} → ${data.cantidad}, llevo ${l.cantidadComprada} → ${data.cantidadComprada}, precio ${l.precioUnitario} → ${data.precioUnitario}`,
      )
      ops.push(prisma.listaCompraItem.update({ where: { id: l.id }, data }))
      for (const c of l.compras) {
        ops.push(prisma.listaCompraCompra.update({
          where: { id: c.id },
          data: { cantidad: r6(c.cantidad * FACTOR), precioUnitario: c.precioUnitario == null ? null : c.precioUnitario / FACTOR },
        }))
      }
      if (l.compras.length) console.log(`    + ${l.compras.length} compra(s)`)
    }
  }

  // Las kg/l/m quedan sin artículos (los de arriba se mueven): se borran para que no se vuelvan a elegir.
  for (const u of multiplos) {
    console.log(`Borrar la unidad "${u.nombre}"`)
    ops.push(prisma.unidad.delete({ where: { id: u.id } }))
  }

  if (!APPLY) {
    console.log('\nDry-run: no se escribió nada. Correr con --apply para guardar.')
    return
  }
  await prisma.$transaction(ops)
  console.log(`\nListo: ${articulos.length} artículo(s) migrados y ${multiplos.length} unidad(es) borradas.`)
})()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())

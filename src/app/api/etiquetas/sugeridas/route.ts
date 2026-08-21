import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import {
  computeSugerencias, MIN_CATEGORIAS_TRANSVERSAL,
  type ModoRegla, type ReglaEtiqueta, type UsoEtiqueta,
} from '@/lib/etiquetas-sugeridas'

// El handler no recibe `req` ni lee headers, así que Next lo prerenderiza en el build y
// devolvería para siempre el mapa que existía al compilar: las etiquetas usadas después no se
// ofrecerían nunca y el ABM parecería no guardar nada. Es todo el sentido de la feature.
export const dynamic = 'force-dynamic'

// GET /api/etiquetas/sugeridas — qué etiquetas ofrecer según la categoría, derivado del
// histórico. Ver `src/lib/etiquetas-sugeridas.ts` para el por qué del enfoque.
//
// Devuelve el mapa completo (todas las categorías) y no las de una categoría puntual: el form
// lo pide una vez junto con el resto de los catálogos, y cambiar la categoría no dispara otro
// fetch ni deja el dropdown en loading. El payload son ids, así que pesa nada.
export async function GET() {
  const [gastos, items, reglas] = await Promise.all([
    // Los gastos de resumen de tarjeta se excluyen igual que en reportes: son contenedores, la
    // clasificación real vive en sus sub-items (que sí entran por la query de abajo).
    prisma.gasto.findMany({
      where: { esTarjeta: false },
      select: { categoriaId: true, etiquetas: { select: { id: true } } },
    }),
    prisma.gastoItem.findMany({
      select: { categoriaId: true, etiquetas: { select: { id: true } } },
    }),
    // Excepciones manuales. Normalmente no hay ninguna: la lista base sale del histórico.
    prisma.categoriaEtiquetaRegla.findMany({
      orderBy: { id: 'asc' },
      select: { categoriaId: true, etiquetaId: true, modo: true },
    }),
  ])

  // Un pago propagado a tarjeta cuenta dos veces (el gasto original y el sub-item espejo). No
  // se descuenta a propósito: duplica el peso de un par (etiqueta, categoría) que igual existe,
  // y no cambia *qué* etiquetas son relevantes para la categoría.
  const usos: UsoEtiqueta[] = [...gastos, ...items].flatMap(fila =>
    fila.etiquetas.map(e => ({ etiquetaId: e.id, categoriaId: fila.categoriaId })),
  )

  const reglasResponse: ReglaEtiqueta[] = reglas.map(r => ({
    categoria_id: r.categoriaId,
    etiqueta_id: r.etiquetaId,
    modo: r.modo as ModoRegla,
  }))

  return NextResponse.json(computeSugerencias(usos, MIN_CATEGORIAS_TRANSVERSAL, reglasResponse))
}

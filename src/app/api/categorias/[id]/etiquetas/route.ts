import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { parseReglasBody, type ReglaEtiqueta, type ModoRegla } from '@/lib/etiquetas-sugeridas'

// Excepciones manuales de qué etiquetas ofrece el form para una categoría. La lista base se
// deriva del histórico (`src/lib/etiquetas-sugeridas.ts`); acá sólo se guarda lo que hay que
// corregir a mano. Lo esperable es que una categoría no tenga ninguna fila.

const mapear = (reglas: { categoriaId: number; etiquetaId: number; modo: string }[]): ReglaEtiqueta[] =>
  reglas.map(r => ({ categoria_id: r.categoriaId, etiqueta_id: r.etiquetaId, modo: r.modo as ModoRegla }))

// GET /api/categorias/[id]/etiquetas — las reglas de esta categoría.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const categoriaId = Number(params.id)
  if (!Number.isInteger(categoriaId) || categoriaId <= 0) {
    return NextResponse.json({ error: 'Id inválido' }, { status: 400 })
  }
  const reglas = await prisma.categoriaEtiquetaRegla.findMany({
    where: { categoriaId },
    orderBy: { id: 'asc' },
    select: { categoriaId: true, etiquetaId: true, modo: true },
  })
  return NextResponse.json(mapear(reglas))
}

/**
 * PUT /api/categorias/[id]/etiquetas — reemplaza **todas** las reglas de la categoría con
 * `{ fijar: number[], excluir: number[] }`.
 *
 * Es un reemplazo y no un alta/baja por par porque el ABM edita una categoría entera en un
 * diálogo: mandar el estado final evita tener que diffear en el cliente y hace que reintentar
 * el guardado sea idempotente. Listas vacías = borrar las reglas y volver a lo derivado.
 */
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const categoriaId = Number(params.id)
  if (!Number.isInteger(categoriaId) || categoriaId <= 0) {
    return NextResponse.json({ error: 'Id inválido' }, { status: 400 })
  }

  const parsed = parseReglasBody(await req.json())
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })

  const categoria = await prisma.categoria.findUnique({ where: { id: categoriaId }, select: { id: true } })
  if (!categoria) return NextResponse.json({ error: 'Categoría no encontrada' }, { status: 404 })

  // Las etiquetas se validan acá y no contra el FK: un id inexistente saldría como 500 y no dice
  // qué pasó. Además el borrado ya se ejecutó cuando el create falla dentro de la transacción.
  const ids = [...parsed.fijar, ...parsed.excluir]
  if (ids.length > 0) {
    const existentes = await prisma.etiqueta.count({ where: { id: { in: ids } } })
    if (existentes !== ids.length) {
      return NextResponse.json({ error: 'Alguna etiqueta no existe' }, { status: 404 })
    }
  }

  const filas = [
    ...parsed.fijar.map(etiquetaId => ({ categoriaId, etiquetaId, modo: 'fijar' })),
    ...parsed.excluir.map(etiquetaId => ({ categoriaId, etiquetaId, modo: 'excluir' })),
  ]

  await prisma.$transaction([
    prisma.categoriaEtiquetaRegla.deleteMany({ where: { categoriaId } }),
    ...(filas.length > 0 ? [prisma.categoriaEtiquetaRegla.createMany({ data: filas })] : []),
  ])

  return NextResponse.json(mapear(filas))
}

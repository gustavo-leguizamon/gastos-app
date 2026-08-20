import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { resolveEtiqueta } from '@/lib/clasificadores'

// Etiquetas: corte transversal (M2M) de gastos/ítems. CRUD espejo de /api/categorias.
// GET /api/etiquetas — lista de etiquetas con su conteo de uso (gastos + sub-items).
export async function GET() {
  const etiquetas = await prisma.etiqueta.findMany({
    orderBy: { nombre: 'asc' },
    include: { _count: { select: { gastos: true, items: true } } },
  })
  const data = etiquetas.map(e => ({ id: e.id, nombre: e.nombre, uso: e._count.gastos + e._count.items }))
  return NextResponse.json(data)
}

// POST /api/etiquetas — find-or-create case-insensitive, espejo de /api/categorias.
export async function POST(req: NextRequest) {
  const { nombre } = await req.json()
  try {
    const id = await resolveEtiqueta(prisma, nombre ?? '')
    const etiqueta = await prisma.etiqueta.findUnique({ where: { id } })
    return NextResponse.json(etiqueta, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Error interno' }, { status: 400 })
  }
}

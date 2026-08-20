import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { resolveCategoria } from '@/lib/clasificadores'

// GET /api/categorias — lista de categorías con su conteo de uso (gastos + sub-items).
export async function GET() {
  const categorias = await prisma.categoria.findMany({
    orderBy: { nombre: 'asc' },
    include: { _count: { select: { gastos: true, items: true } } },
  })
  const data = categorias.map(c => ({ id: c.id, nombre: c.nombre, uso: c._count.gastos + c._count.items }))
  return NextResponse.json(data)
}

// POST /api/categorias — alta por nombre, con find-or-create case-insensitive. Si ya existe
// una categoría equivalente devuelve ESA en vez de crear un duplicado: el alta inline desde
// los selects del form hacía muy fácil terminar con "Comida" y "comida " partiendo el reporte.
export async function POST(req: NextRequest) {
  const { nombre } = await req.json()
  try {
    const id = await resolveCategoria(prisma, nombre ?? '')
    const categoria = await prisma.categoria.findUnique({ where: { id } })
    return NextResponse.json(categoria, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Error interno' }, { status: 400 })
  }
}

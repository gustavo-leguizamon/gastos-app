import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { normalizeNombre } from '@/lib/conceptos'

// GET /api/conceptos — lista de conceptos con su conteo de uso (gastos + sub-items).
export async function GET() {
  const conceptos = await prisma.concepto.findMany({
    include: { _count: { select: { gastos: true, items: true } } },
  })
  const data = conceptos
    .map(c => ({ id: c.id, nombre: c.nombre, uso: c._count.gastos + c._count.items }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }))
  return NextResponse.json(data)
}

// POST /api/conceptos — crea un concepto (o devuelve el existente si ya hay uno con ese nombre).
export async function POST(req: NextRequest) {
  const body = await req.json()
  const nombre = normalizeNombre(body.nombre ?? '')
  if (!nombre) return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 })

  const existente = await prisma.concepto.findFirst({
    where: { nombre: { equals: nombre, mode: 'insensitive' } },
  })
  if (existente) return NextResponse.json(existente, { status: 200 })

  const creado = await prisma.concepto.create({ data: { nombre } })
  return NextResponse.json(creado, { status: 201 })
}

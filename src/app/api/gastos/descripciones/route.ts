import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// Devuelve la unión de descripciones distintas de gastos y sub-items (todos los meses).
// Se usa para el autocompletado en GastoForm y GastoItemDialog.
export async function GET() {
  const [gastos, items] = await Promise.all([
    prisma.gasto.findMany({ select: { descripcion: true }, distinct: ['descripcion'] }),
    prisma.gastoItem.findMany({ select: { descripcion: true }, distinct: ['descripcion'] }),
  ])
  const set = new Set<string>()
  for (const g of gastos) if (g.descripcion) set.add(g.descripcion)
  for (const i of items) if (i.descripcion) set.add(i.descripcion)
  return NextResponse.json([...set].sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' })))
}

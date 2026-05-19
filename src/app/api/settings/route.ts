import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

const DEFAULTS = {
  estimMesesAtras: 2,
  estimMissingBehavior: 'zero' as 'zero' | 'average_found',
  estimIncluirCuotasVigentes: true,
  estimExcluirUltimaCuota: true,
}

function toResponse(s: any) {
  return {
    estim_meses_atras: s.estimMesesAtras,
    estim_missing_behavior: s.estimMissingBehavior,
    estim_incluir_cuotas_vigentes: s.estimIncluirCuotasVigentes,
    estim_excluir_ultima_cuota: s.estimExcluirUltimaCuota,
  }
}

export async function GET() {
  const s = await prisma.settings.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, ...DEFAULTS },
  })
  return NextResponse.json(toResponse(s))
}

export async function PUT(req: NextRequest) {
  const body = await req.json()
  const data: any = {}
  if (body.estim_meses_atras !== undefined) {
    const n = Number(body.estim_meses_atras)
    if (Number.isInteger(n) && n >= 0 && n <= 12) data.estimMesesAtras = n
  }
  if (body.estim_missing_behavior !== undefined) {
    if (body.estim_missing_behavior === 'zero' || body.estim_missing_behavior === 'average_found') {
      data.estimMissingBehavior = body.estim_missing_behavior
    }
  }
  if (body.estim_incluir_cuotas_vigentes !== undefined) {
    data.estimIncluirCuotasVigentes = !!body.estim_incluir_cuotas_vigentes
  }
  if (body.estim_excluir_ultima_cuota !== undefined) {
    data.estimExcluirUltimaCuota = !!body.estim_excluir_ultima_cuota
  }
  const s = await prisma.settings.upsert({
    where: { id: 1 },
    update: data,
    create: { id: 1, ...DEFAULTS, ...data },
  })
  return NextResponse.json(toResponse(s))
}

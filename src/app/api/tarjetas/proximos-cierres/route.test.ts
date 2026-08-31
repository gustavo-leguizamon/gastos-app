import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: { tarjeta: { findMany: vi.fn() } },
}))

import { GET } from './route'
import { prisma } from '@/lib/db'

const mp = prisma as any

const req = (qs: string) => ({ url: `http://localhost:3002/api/tarjetas/proximos-cierres?${qs}` }) as any

function tarjeta(id: number, nombre: string, cierres: any[] = []) {
  return { id, nombre, banco: 'Galicia', marca: 'visa', bancoLogo: 'galicia', bancoIcono: null, cierres }
}

const cierre = (fechaCierre: string | null, fechaProximoCierre: string | null) => ({
  fechaCierre, fechaVencimiento: null, fechaProximoCierre,
})

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/tarjetas/proximos-cierres', () => {
  it('trae los cierres del período consultado', async () => {
    mp.tarjeta.findMany.mockResolvedValue([])
    await GET(req('mes=8&anio=2026&today=2026-08-31'))
    expect(mp.tarjeta.findMany).toHaveBeenCalledWith({
      include: { cierres: { where: { mes: 8, anio: 2026 } } },
    })
  })

  it('devuelve las tarjetas ya cerradas y las abiertas, con días y progreso', async () => {
    mp.tarjeta.findMany.mockResolvedValue([
      tarjeta(1, 'Visa Galicia', [cierre('2026-08-02', '2026-09-01')]),
      tarjeta(2, 'Macro', [cierre('2026-08-01', '2026-08-21')]),
    ])

    const res = await GET(req('mes=8&anio=2026&today=2026-08-31'))
    const data = await res.json()

    expect(data.map((t: any) => [t.nombre, t.estado, t.dias_para_cierre])).toEqual([
      ['Macro', 'cerrado', -10],
      ['Visa Galicia', 'abierto', 1],
    ])
    expect(data[1].progreso).toBeCloseTo(29 / 30)
    expect(data[1].fecha_proximo_cierre).toBe('2026-09-01')
  })

  it('incluye las tarjetas sin cierre cargado del período, al final', async () => {
    mp.tarjeta.findMany.mockResolvedValue([
      tarjeta(1, 'Sin cierre'),
      tarjeta(2, 'Con cierre', [cierre('2026-08-01', '2026-09-01')]),
    ])

    const data = await (await GET(req('mes=8&anio=2026&today=2026-08-31'))).json()

    expect(data.map((t: any) => t.nombre)).toEqual(['Con cierre', 'Sin cierre'])
    expect(data[1]).toMatchObject({
      estado: 'sin_fecha',
      dias_para_cierre: null,
      progreso: null,
      fecha_cierre: null,
      fecha_proximo_cierre: null,
    })
  })

  it('desempata por nombre', async () => {
    mp.tarjeta.findMany.mockResolvedValue([
      tarjeta(1, 'Zeta', [cierre('2026-08-01', '2026-09-01')]),
      tarjeta(2, 'Alfa', [cierre('2026-08-01', '2026-09-01')]),
    ])
    const data = await (await GET(req('mes=8&anio=2026&today=2026-08-31'))).json()
    expect(data.map((t: any) => t.nombre)).toEqual(['Alfa', 'Zeta'])
  })

  it('sin params no toca la DB', async () => {
    const res = await GET(req('mes=8&anio=2026'))
    expect(await res.json()).toEqual([])
    expect(mp.tarjeta.findMany).not.toHaveBeenCalled()
  })
})

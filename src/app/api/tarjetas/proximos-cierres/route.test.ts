import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: { tarjeta: { findMany: vi.fn() } },
}))

import { GET } from './route'
import { prisma } from '@/lib/db'

const mp = prisma as any

const req = (qs: string) => ({ url: `http://localhost:3002/api/tarjetas/proximos-cierres?${qs}` }) as any

function tarjeta(id: number, nombre: string, cierres: any[] = [], baja: [number, number] | null = null) {
  return {
    id, nombre, banco: 'Galicia', marca: 'visa', bancoLogo: 'galicia', bancoIcono: null, cierres,
    bajaMes: baja?.[0] ?? null, bajaAnio: baja?.[1] ?? null,
  }
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

  it('ordena la que está por cerrar por su propia fechaCierre, no al final', async () => {
    mp.tarjeta.findMany.mockResolvedValue([
      tarjeta(1, 'Sin ninguna fecha'),
      tarjeta(2, 'Abierta', [cierre('2026-08-01', '2026-09-20')]),
      tarjeta(3, 'Por cerrar', [cierre('2026-09-05', null)]),
      tarjeta(4, 'Cerrada', [cierre('2026-08-01', '2026-08-21')]),
    ])

    const data = await (await GET(req('mes=8&anio=2026&today=2026-09-03'))).json()

    expect(data.map((t: any) => [t.nombre, t.estado])).toEqual([
      ['Cerrada', 'cerrado'],
      ['Por cerrar', 'por_cerrar'],
      ['Abierta', 'abierto'],
      ['Sin ninguna fecha', 'sin_fecha'],
    ])
    expect(data[1]).toMatchObject({ dias_para_cierre: 2, fecha_proximo_cierre: null })
    expect(data[1].progreso).toBeCloseTo(29 / 31)
  })

  it('desempata por nombre', async () => {
    mp.tarjeta.findMany.mockResolvedValue([
      tarjeta(1, 'Zeta', [cierre('2026-08-01', '2026-09-01')]),
      tarjeta(2, 'Alfa', [cierre('2026-08-01', '2026-09-01')]),
    ])
    const data = await (await GET(req('mes=8&anio=2026&today=2026-08-31'))).json()
    expect(data.map((t: any) => t.nombre)).toEqual(['Alfa', 'Zeta'])
  })

  it('ordena la que está por cerrar por su fechaCierre aunque tenga próximo cierre cargado', async () => {
    // El caso real: Sabrina cierra el 06/09 y su próximo cierre es el 06/10. Ordenarla por el
    // próximo la mandaba al fondo (detrás de las que cierran en semanas) justo cuando cierra.
    mp.tarjeta.findMany.mockResolvedValue([
      tarjeta(1, 'Santander', [cierre('2026-08-05', '2026-10-01')]),
      tarjeta(2, 'Sabrina', [cierre('2026-09-06', '2026-10-06')]),
      tarjeta(3, 'Macro USD', [cierre('2026-08-24', '2026-09-24')]),
    ])

    const data = await (await GET(req('mes=9&anio=2026&today=2026-09-04'))).json()

    expect(data.map((t: any) => [t.nombre, t.estado, t.dias_para_cierre])).toEqual([
      ['Sabrina', 'por_cerrar', 2],
      ['Macro USD', 'abierto', 20],
      ['Santander', 'abierto', 27],
    ])
    expect(data[0].progreso).toBeCloseTo(29 / 31)
  })

  it('excluye las tarjetas dadas de baja en el período, pero no las de meses anteriores', async () => {
    const filas = [
      tarjeta(1, 'Vigente', [cierre('2026-08-01', '2026-09-01')]),
      tarjeta(2, 'De baja', [cierre('2026-08-01', '2026-09-01')], [8, 2026]),
    ]
    mp.tarjeta.findMany.mockResolvedValue(filas)

    const agosto = await (await GET(req('mes=8&anio=2026&today=2026-08-31'))).json()
    expect(agosto.map((t: any) => t.nombre)).toEqual(['Vigente'])

    // Julio es anterior a la baja: ahí la tarjeta se usaba y tiene que seguir a la vista.
    mp.tarjeta.findMany.mockResolvedValue(filas)
    const julio = await (await GET(req('mes=7&anio=2026&today=2026-07-31'))).json()
    expect(julio.map((t: any) => t.nombre)).toEqual(['De baja', 'Vigente'])
  })

  it('sin params no toca la DB', async () => {
    const res = await GET(req('mes=8&anio=2026'))
    expect(await res.json()).toEqual([])
    expect(mp.tarjeta.findMany).not.toHaveBeenCalled()
  })
})

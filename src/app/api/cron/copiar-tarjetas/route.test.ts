import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    tarjetaCierre: { findMany: vi.fn(), update: vi.fn() },
    gasto: { findMany: vi.fn() },
  },
}))

vi.mock('@/lib/copiar-gasto', () => ({ copiarGasto: vi.fn() }))

import { GET } from './route'
import { prisma } from '@/lib/db'
import { copiarGasto } from '@/lib/copiar-gasto'

const mp = prisma as any
const mockCopiar = copiarGasto as unknown as ReturnType<typeof vi.fn>

const SECRET = 'test-secret'
const HOY = '2026-11-18'

function req(qs = `today=${HOY}`, auth: string | null = `Bearer ${SECRET}`) {
  return {
    url: `http://localhost/api/cron/copiar-tarjetas${qs ? `?${qs}` : ''}`,
    headers: { get: (k: string) => (k.toLowerCase() === 'authorization' ? auth : null) },
  } as any
}

function cierre(over: Record<string, any> = {}) {
  return {
    id: 10,
    tarjetaId: 3,
    mes: 11,
    anio: 2026,
    fechaCierre: '2026-11-17',
    autoCopiadoAt: null,
    tarjeta: { id: 3, nombre: 'Visa', bajaMes: null, bajaAnio: null },
    ...over,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.CRON_SECRET = SECRET
  mp.tarjetaCierre.findMany.mockResolvedValue([])
  mp.tarjetaCierre.update.mockResolvedValue({})
  mp.gasto.findMany.mockResolvedValue([])
  mockCopiar.mockResolvedValue({ status: 'created', gasto_id: 99, added_items: 2 })
})

afterEach(() => {
  delete process.env.CRON_SECRET
})

describe('GET /api/cron/copiar-tarjetas', () => {
  it('401 sin el secreto y 500 si no está configurado', async () => {
    expect((await GET(req(undefined, 'Bearer otro'))).status).toBe(401)
    delete process.env.CRON_SECRET
    expect((await GET(req())).status).toBe(500)
    expect(mp.tarjetaCierre.findMany).not.toHaveBeenCalled()
  })

  it('400 con today inválido', async () => {
    expect((await GET(req('today=18/11/2026'))).status).toBe(400)
  })

  it('busca sólo cierres no copiados dentro de la ventana y ya pasados', async () => {
    await GET(req())
    expect(mp.tarjetaCierre.findMany.mock.calls[0][0].where).toEqual({
      autoCopiadoAt: null,
      fechaCierre: { gte: '2026-11-08', lt: HOY },
    })
  })

  it('copia cada resumen del período al mes siguiente y marca el cierre', async () => {
    mp.tarjetaCierre.findMany.mockResolvedValue([cierre()])
    mp.gasto.findMany.mockResolvedValue([{ id: 7 }, { id: 8 }])

    const res = await GET(req())
    const body = await res.json()

    expect(mp.gasto.findMany.mock.calls[0][0].where).toEqual({ esTarjeta: true, tarjetaId: 3, mes: 11, anio: 2026 })
    expect(mockCopiar.mock.calls).toEqual([[7, 12, 2026], [8, 12, 2026]])
    expect(mp.tarjetaCierre.update).toHaveBeenCalledWith({
      where: { id: 10 },
      data: { autoCopiadoAt: expect.any(Date) },
    })
    expect(body.copiados).toBe(1)
    expect(body.resultados[0]).toMatchObject({ estado: 'copiado', gastos: 2, sub_items: 4, destino: { mes: 12, anio: 2026 } })
  })

  it('diciembre se copia a enero del año siguiente', async () => {
    mp.tarjetaCierre.findMany.mockResolvedValue([cierre({ mes: 12, fechaCierre: '2026-11-17' })])
    mp.gasto.findMany.mockResolvedValue([{ id: 7 }])
    await GET(req())
    expect(mockCopiar).toHaveBeenCalledWith(7, 1, 2027)
  })

  it('sin resumen cargado no copia ni marca (se reintenta mañana)', async () => {
    mp.tarjetaCierre.findMany.mockResolvedValue([cierre()])
    const body = await (await GET(req())).json()
    expect(mockCopiar).not.toHaveBeenCalled()
    expect(mp.tarjetaCierre.update).not.toHaveBeenCalled()
    expect(body.resultados[0].estado).toBe('sin_resumen')
  })

  it('no copia el día del cierre ni los ya copiados', async () => {
    mp.tarjetaCierre.findMany.mockResolvedValue([
      cierre({ fechaCierre: HOY }),
      cierre({ id: 11, autoCopiadoAt: new Date() }),
    ])
    const body = await (await GET(req())).json()
    expect(mp.gasto.findMany).not.toHaveBeenCalled()
    expect(body.resultados).toEqual([])
  })

  it('no copia una tarjeta dada de baja desde el mes destino', async () => {
    mp.tarjetaCierre.findMany.mockResolvedValue([
      cierre({ tarjeta: { id: 3, nombre: 'Visa', bajaMes: 12, bajaAnio: 2026 } }),
    ])
    const body = await (await GET(req())).json()
    expect(mockCopiar).not.toHaveBeenCalled()
    expect(body.resultados[0].estado).toBe('tarjeta_de_baja')
  })

  it('dry=1 no copia ni marca', async () => {
    mp.tarjetaCierre.findMany.mockResolvedValue([cierre()])
    mp.gasto.findMany.mockResolvedValue([{ id: 7 }])
    const body = await (await GET(req(`today=${HOY}&dry=1`))).json()
    expect(mockCopiar).not.toHaveBeenCalled()
    expect(mp.tarjetaCierre.update).not.toHaveBeenCalled()
    expect(body.dry).toBe(true)
    expect(body.resultados[0].estado).toBe('dry')
  })

  it('si la copia falla no marca el cierre y sigue con los demás', async () => {
    mp.tarjetaCierre.findMany.mockResolvedValue([cierre(), cierre({ id: 11, tarjetaId: 4 })])
    mp.gasto.findMany.mockResolvedValue([{ id: 7 }])
    mockCopiar.mockRejectedValueOnce(new Error('boom'))
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const body = await (await GET(req())).json()

    expect(body.resultados.map((r: any) => r.estado)).toEqual(['error', 'copiado'])
    expect(mp.tarjetaCierre.update).toHaveBeenCalledTimes(1)
    expect(mp.tarjetaCierre.update.mock.calls[0][0].where).toEqual({ id: 11 })
    errSpy.mockRestore()
  })
})

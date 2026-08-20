import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    tarjeta: { findUnique: vi.fn() },
    tarjetaCierre: { create: vi.fn() },
  },
}))

import { POST } from './route'
import { prisma } from '@/lib/db'

const mp = prisma as any

const ctx = (id: string) => ({ params: { id } })

beforeEach(() => {
  vi.clearAllMocks()
  mp.tarjetaCierre.create.mockImplementation(async ({ data }: any) => ({
    id: 99, ...data, createdAt: new Date(), updatedAt: new Date(),
  }))
})

describe('POST /api/tarjetas/[id]/cierres/generar', () => {
  it('crea el cierre del período siguiente al último cargado', async () => {
    mp.tarjeta.findUnique.mockResolvedValue({
      id: 1,
      cierres: [
        { mes: 5, anio: 2026, fechaCierre: '2026-05-20', fechaVencimiento: '2026-06-05', fechaProximoCierre: '2026-06-20' },
        { mes: 6, anio: 2026, fechaCierre: '2026-06-20', fechaVencimiento: '2026-07-05', fechaProximoCierre: '2026-07-20' },
      ],
    })

    const res = await POST({} as any, ctx('1'))

    expect(res.status).toBe(201)
    expect(mp.tarjetaCierre.create).toHaveBeenCalledWith({
      data: {
        tarjetaId: 1,
        mes: 7,
        anio: 2026,
        fechaCierre: '2026-07-20',
        fechaVencimiento: '2026-08-05',
        fechaProximoCierre: '2026-08-20',
      },
    })
  })

  it('parte del último aunque venga desordenado', async () => {
    mp.tarjeta.findUnique.mockResolvedValue({
      id: 1,
      cierres: [
        { mes: 6, anio: 2026, fechaCierre: '2026-06-20', fechaVencimiento: '2026-07-05', fechaProximoCierre: '2026-07-20' },
        { mes: 1, anio: 2026, fechaCierre: '2026-01-20', fechaVencimiento: '2026-02-05', fechaProximoCierre: '2026-02-20' },
      ],
    })
    await POST({} as any, ctx('1'))
    expect(mp.tarjetaCierre.create.mock.calls[0][0].data.mes).toBe(7)
  })

  it('devuelve 409 si la tarjeta no tiene ningún cierre', async () => {
    mp.tarjeta.findUnique.mockResolvedValue({ id: 1, cierres: [] })
    const res = await POST({} as any, ctx('1'))
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: expect.stringContaining('a mano') })
    expect(mp.tarjetaCierre.create).not.toHaveBeenCalled()
  })

  it('devuelve 409 si el siguiente ya estaba cargado (unique)', async () => {
    mp.tarjeta.findUnique.mockResolvedValue({
      id: 1,
      cierres: [{ mes: 6, anio: 2026, fechaCierre: '2026-06-20', fechaVencimiento: '2026-07-05', fechaProximoCierre: '2026-07-20' }],
    })
    mp.tarjetaCierre.create.mockRejectedValue(Object.assign(new Error('dup'), { code: 'P2002' }))
    const res = await POST({} as any, ctx('1'))
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: expect.stringContaining('7/2026') })
  })

  it('devuelve 404 si la tarjeta no existe', async () => {
    mp.tarjeta.findUnique.mockResolvedValue(null)
    expect((await POST({} as any, ctx('9'))).status).toBe(404)
  })

  it('devuelve 400 con id inválido, sin leer la DB', async () => {
    expect((await POST({} as any, ctx('x'))).status).toBe(400)
    expect(mp.tarjeta.findUnique).not.toHaveBeenCalled()
  })
})

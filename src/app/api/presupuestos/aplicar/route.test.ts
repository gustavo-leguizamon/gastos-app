import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    categoria: { findMany: vi.fn() },
    objetivoAhorro: { upsert: vi.fn() },
    presupuesto: { deleteMany: vi.fn(), createMany: vi.fn() },
    $transaction: vi.fn(),
  },
}))

import { POST } from './route'
import { prisma } from '@/lib/db'

const mp = prisma as any

const body = (b: any) => ({ json: async () => b }) as any

const ok = {
  mes: 6,
  anio: 2026,
  base: 'caja',
  objetivo: 50000,
  ingresos_esperados: 200000,
  meses_historico: 6,
  filas: [
    { categoria_id: 7, monto: 100000, fijado: true },
    { categoria_id: 9, monto: 50000 },
  ],
}

beforeEach(() => {
  vi.clearAllMocks()
  mp.categoria.findMany.mockResolvedValue([{ id: 7 }, { id: 9 }])
  mp.objetivoAhorro.upsert.mockReturnValue('upsert-objetivo')
  mp.presupuesto.deleteMany.mockReturnValue('delete-topes')
  mp.presupuesto.createMany.mockReturnValue('create-topes')
  mp.$transaction.mockResolvedValue([])
})

describe('POST /api/presupuestos/aplicar', () => {
  it('400 con body inválido, sin tocar la DB', async () => {
    for (const b of [{}, { ...ok, filas: [] }, { ...ok, objetivo: -1 }, { ...ok, filas: [{ categoria_id: 7, monto: -1 }] }]) {
      expect((await POST(body(b))).status).toBe(400)
    }
    expect(mp.categoria.findMany).not.toHaveBeenCalled()
    expect(mp.$transaction).not.toHaveBeenCalled()
  })

  it('404 si alguna categoría no existe, sin escribir nada', async () => {
    mp.categoria.findMany.mockResolvedValue([{ id: 7 }])
    expect((await POST(body(ok))).status).toBe(404)
    expect(mp.$transaction).not.toHaveBeenCalled()
  })

  it('guarda el objetivo con los supuestos con los que se generó', async () => {
    await POST(body(ok))

    const arg = mp.objetivoAhorro.upsert.mock.calls[0][0]
    expect(arg.where).toEqual({ mes_anio: { mes: 6, anio: 2026 } })
    expect(arg.create).toEqual({
      mes: 6,
      anio: 2026,
      monto: 50000,
      ingresosEsperados: 200000,
      base: 'caja',
      mesesHistorico: 6,
    })
    expect(arg.update).toEqual({
      monto: 50000,
      ingresosEsperados: 200000,
      base: 'caja',
      mesesHistorico: 6,
    })
  })

  it('reemplaza los topes del período en una sola transacción', async () => {
    await POST(body(ok))

    expect(mp.presupuesto.deleteMany).toHaveBeenCalledWith({ where: { mes: 6, anio: 2026 } })
    expect(mp.presupuesto.createMany).toHaveBeenCalledWith({
      data: [
        { categoriaId: 7, mes: 6, anio: 2026, monto: 100000, fijado: true },
        { categoriaId: 9, mes: 6, anio: 2026, monto: 50000, fijado: false },
      ],
    })
    // Borrar y crear tienen que ir juntos: a mitad de camino el mes quedaría sin topes.
    expect(mp.$transaction).toHaveBeenCalledWith(['upsert-objetivo', 'delete-topes', 'create-topes'])
  })

  it('acepta un tope en 0 (distinto de no tener tope)', async () => {
    mp.categoria.findMany.mockResolvedValue([{ id: 7 }])
    const res = await POST(body({ ...ok, filas: [{ categoria_id: 7, monto: 0 }] }))
    expect(res.status).toBe(200)
    expect(mp.presupuesto.createMany.mock.calls[0][0].data[0].monto).toBe(0)
  })

  it('una base desconocida cae a devengado', async () => {
    await POST(body({ ...ok, base: 'otra' }))
    expect(mp.objetivoAhorro.upsert.mock.calls[0][0].create.base).toBe('devengado')
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: { tarjeta: { findMany: vi.fn(), create: vi.fn() } },
}))

import { GET, POST } from './route'
import { prisma } from '@/lib/db'

const mp = prisma as any

const req = (qs = '') => ({ url: `http://localhost:3002/api/tarjetas${qs ? `?${qs}` : ''}` }) as any
const post = (body: unknown) => ({ json: async () => body }) as any

function fila(id: number, nombre: string, bajaMes: number | null = null, bajaAnio: number | null = null) {
  return {
    id, nombre, banco: 'Galicia', marca: 'visa', bancoLogo: 'galicia', bancoIcono: null,
    bajaMes, bajaAnio, cierres: [],
  }
}

beforeEach(() => { vi.clearAllMocks() })

describe('GET /api/tarjetas', () => {
  it('expone el período de baja en snake_case', async () => {
    mp.tarjeta.findMany.mockResolvedValue([fila(1, 'Visa', 8, 2026), fila(2, 'Master')])

    const data = await (await GET(req())).json()

    expect(data.map((t: any) => [t.nombre, t.baja_mes, t.baja_anio])).toEqual([
      ['Visa', 8, 2026],
      ['Master', null, null],
    ])
  })

  it('sin período devuelve todas, dadas de baja incluidas', async () => {
    // /configuracion tiene que poder revertir la baja y /reportes no puede perder el histórico.
    mp.tarjeta.findMany.mockResolvedValue([fila(1, 'Vieja', 1, 2020), fila(2, 'Actual')])

    const data = await (await GET(req())).json()

    expect(data.map((t: any) => t.nombre)).toEqual(['Vieja', 'Actual'])
  })

  it('con mes y anio recorta a las vigentes en ese período', async () => {
    mp.tarjeta.findMany.mockResolvedValue([fila(1, 'Vieja', 8, 2026), fila(2, 'Actual')])

    expect((await (await GET(req('mes=9&anio=2026'))).json()).map((t: any) => t.nombre)).toEqual(['Actual'])
    // El mes anterior a la baja la sigue mostrando: ahí sí se usaba.
    expect((await (await GET(req('mes=7&anio=2026'))).json()).map((t: any) => t.nombre)).toEqual(['Vieja', 'Actual'])
  })

  it('un período incompleto no filtra nada', async () => {
    mp.tarjeta.findMany.mockResolvedValue([fila(1, 'Vieja', 8, 2026), fila(2, 'Actual')])

    expect((await (await GET(req('mes=9'))).json())).toHaveLength(2)
    expect((await (await GET(req('anio=2026'))).json())).toHaveLength(2)
  })
})

describe('POST /api/tarjetas', () => {
  it('guarda el período de baja del alta', async () => {
    mp.tarjeta.create.mockResolvedValue({ ...fila(1, 'Vieja', 8, 2026) })

    await POST(post({ nombre: 'Vieja', baja_mes: 8, baja_anio: 2026 }))

    expect(mp.tarjeta.create.mock.calls[0][0].data).toMatchObject({ bajaMes: 8, bajaAnio: 2026 })
  })

  it('sin baja en el body la tarjeta nace activa', async () => {
    mp.tarjeta.create.mockResolvedValue({ ...fila(1, 'Nueva') })

    const res = await POST(post({ nombre: 'Nueva' }))

    expect(mp.tarjeta.create.mock.calls[0][0].data).toMatchObject({ bajaMes: null, bajaAnio: null })
    expect(await res.json()).toMatchObject({ baja_mes: null, baja_anio: null })
  })

  it('un período de baja a medias no se persiste a medias', async () => {
    mp.tarjeta.create.mockResolvedValue({ ...fila(1, 'Nueva') })

    await POST(post({ nombre: 'Nueva', baja_mes: 8 }))

    expect(mp.tarjeta.create.mock.calls[0][0].data).toMatchObject({ bajaMes: null, bajaAnio: null })
  })
})

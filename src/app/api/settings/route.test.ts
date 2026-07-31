import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    settings: { upsert: vi.fn() },
    casa: { findUnique: vi.fn() },
  },
}))

import { GET, PUT } from './route'
import { prisma } from '@/lib/db'

const mp = prisma as any

const row = {
  estimMesesAtras: 2,
  estimMissingBehavior: 'zero',
  estimIncluirCuotasVigentes: true,
  estimExcluirUltimaCuota: true,
  casaDefaultId: null,
}

const req = (body: any) => ({ json: async () => body }) as any

beforeEach(() => {
  vi.clearAllMocks()
  mp.settings.upsert.mockResolvedValue(row)
})

describe('GET /api/settings', () => {
  it('expone casa_default_id en snake_case', async () => {
    mp.settings.upsert.mockResolvedValue({ ...row, casaDefaultId: 3 })
    const res = await GET()
    expect(await res.json()).toMatchObject({ casa_default_id: 3 })
  })

  it('devuelve null cuando no hay casa por defecto', async () => {
    const res = await GET()
    expect((await res.json()).casa_default_id).toBeNull()
  })
})

describe('PUT /api/settings — casa_default_id', () => {
  it('guarda la casa cuando existe', async () => {
    mp.casa.findUnique.mockResolvedValue({ id: 3 })
    await PUT(req({ casa_default_id: 3 }))
    expect(mp.settings.upsert.mock.calls[0][0].update).toEqual({ casaDefaultId: 3 })
  })

  it('acepta null para limpiar el default sin consultar casas', async () => {
    await PUT(req({ casa_default_id: null }))
    expect(mp.settings.upsert.mock.calls[0][0].update).toEqual({ casaDefaultId: null })
    expect(mp.casa.findUnique).not.toHaveBeenCalled()
  })

  it('ignora una casa inexistente en vez de dejar el form apuntando a nada', async () => {
    mp.casa.findUnique.mockResolvedValue(null)
    await PUT(req({ casa_default_id: 999 }))
    expect(mp.settings.upsert.mock.calls[0][0].update).toEqual({})
  })

  it('ignora valores no enteros o <= 0', async () => {
    for (const v of ['abc', 0, -2, 1.5]) {
      vi.clearAllMocks()
      mp.settings.upsert.mockResolvedValue(row)
      await PUT(req({ casa_default_id: v }))
      expect(mp.settings.upsert.mock.calls[0][0].update).toEqual({})
      expect(mp.casa.findUnique).not.toHaveBeenCalled()
    }
  })

  it('no toca casaDefaultId si la clave no viene en el body', async () => {
    await PUT(req({ estim_meses_atras: 4 }))
    expect(mp.settings.upsert.mock.calls[0][0].update).toEqual({ estimMesesAtras: 4 })
  })
})

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    gasto: { findMany: vi.fn() },
    pushSubscription: { findMany: vi.fn(), deleteMany: vi.fn() },
  },
}))

vi.mock('@/lib/push', () => ({
  sendPushToAll: vi.fn(),
  vapidConfigured: vi.fn(() => true),
}))

import { GET } from './route'
import { prisma } from '@/lib/db'
import { sendPushToAll, vapidConfigured } from '@/lib/push'

const mp = prisma as any
const mockSend = sendPushToAll as unknown as ReturnType<typeof vi.fn>
const mockVapid = vapidConfigured as unknown as ReturnType<typeof vi.fn>

const SECRET = 'test-secret'
const HOY = '2026-08-14'

function req(qs = '', auth: string | null = `Bearer ${SECRET}`) {
  return {
    url: `http://localhost/api/cron/vencimientos${qs ? `?${qs}` : ''}`,
    headers: { get: (k: string) => (k.toLowerCase() === 'authorization' ? auth : null) },
  } as any
}

/** Gasto crudo de Prisma tal como lo espera `toGastoResponse`. */
function rawGasto(over: Record<string, any> = {}) {
  return {
    id: 1,
    casaId: 1,
    casa: { nombre: 'Casa' },
    conceptoId: 1,
    concepto: { id: 1, nombre: 'Luz' },
    fechaVencimiento: HOY,
    tipoPago: 'D',
    monedaId: 1,
    tipoCambio: 1,
    totalMoneda: 1000,
    confirmado: true,
    esTarjeta: false,
    categoriaId: null,
    categoria: null,
    etiquetas: [],
    pagos: [],
    items: [],
    mes: 8,
    anio: 2026,
    ...over,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.CRON_SECRET = SECRET
  mockVapid.mockReturnValue(true)
  mp.gasto.findMany.mockResolvedValue([])
  mp.pushSubscription.findMany.mockResolvedValue([])
  mp.pushSubscription.deleteMany.mockResolvedValue({ count: 0 })
  mockSend.mockResolvedValue([])
})

afterEach(() => {
  delete process.env.CRON_SECRET
})

describe('GET /api/cron/vencimientos', () => {
  it('rechaza sin el Bearer del CRON_SECRET', async () => {
    const res = await GET(req('', null))
    expect(res.status).toBe(401)
    expect(mp.gasto.findMany).not.toHaveBeenCalled()
  })

  it('rechaza con un secreto equivocado', async () => {
    const res = await GET(req('', 'Bearer otro'))
    expect(res.status).toBe(401)
  })

  it('falla si el server no tiene CRON_SECRET configurado', async () => {
    delete process.env.CRON_SECRET
    const res = await GET(req())
    expect(res.status).toBe(500)
  })

  it('rechaza un today con formato inválido', async () => {
    const res = await GET(req('today=14-08-2026'))
    expect(res.status).toBe(400)
    expect(mp.gasto.findMany).not.toHaveBeenCalled()
  })

  it('consulta el mes/año de la fecha resuelta y también el mes anterior', async () => {
    await GET(req(`today=${HOY}`))
    expect(mp.gasto.findMany.mock.calls[0][0].where).toEqual({
      OR: [{ mes: 8, anio: 2026 }, { mes: 7, anio: 2026 }],
    })
  })

  it('el mes anterior cruza el año en enero', async () => {
    await GET(req('today=2026-01-15'))
    expect(mp.gasto.findMany.mock.calls[0][0].where).toEqual({
      OR: [{ mes: 1, anio: 2026 }, { mes: 12, anio: 2025 }],
    })
  })

  it('sin vencimientos no manda push', async () => {
    mp.gasto.findMany.mockResolvedValue([rawGasto({ fechaVencimiento: '2026-08-20' })])
    const res = await GET(req(`today=${HOY}`))
    expect(await res.json()).toEqual({ ok: true, today: HOY, vencimientos: 0, vencidos: 0, enviadas: 0 })
    expect(mockSend).not.toHaveBeenCalled()
    expect(mp.pushSubscription.findMany).not.toHaveBeenCalled()
  })

  it('un gasto atrasado e impago dispara el push aunque no venza nada hoy', async () => {
    mp.gasto.findMany.mockResolvedValue([rawGasto({ fechaVencimiento: '2026-08-10' })])
    const res = await GET(req(`today=${HOY}&dry=1`))
    const body = await res.json()
    expect(body.vencimientos).toBe(1)
    expect(body.vencidos).toBe(1)
    expect(body.payload.title).toContain('Vencido hace 4 días')
  })

  it('manda el push con el payload de los vencimientos del día', async () => {
    mp.gasto.findMany.mockResolvedValue([rawGasto()])
    mp.pushSubscription.findMany.mockResolvedValue([
      { endpoint: 'e1', p256dh: 'p', auth: 'a' },
    ])
    mockSend.mockResolvedValue([{ endpoint: 'e1', ok: true, gone: false }])

    const res = await GET(req(`today=${HOY}`))
    const body = await res.json()

    expect(body).toMatchObject({ ok: true, today: HOY, vencimientos: 1, enviadas: 1, eliminadas: 0 })
    const [subs, payload] = mockSend.mock.calls[0]
    expect(subs).toEqual([{ endpoint: 'e1', p256dh: 'p', auth: 'a' }])
    expect(payload.title).toBe('Vence hoy: Luz')
    expect(payload.url).toBe('/gastos')
  })

  it('borra las suscripciones que el push service reporta muertas', async () => {
    mp.gasto.findMany.mockResolvedValue([rawGasto()])
    mp.pushSubscription.findMany.mockResolvedValue([
      { endpoint: 'viva', p256dh: 'p', auth: 'a' },
      { endpoint: 'muerta', p256dh: 'p', auth: 'a' },
    ])
    mockSend.mockResolvedValue([
      { endpoint: 'viva', ok: true, gone: false },
      { endpoint: 'muerta', ok: false, gone: true, statusCode: 410 },
    ])

    const res = await GET(req(`today=${HOY}`))
    expect(mp.pushSubscription.deleteMany).toHaveBeenCalledWith({ where: { endpoint: { in: ['muerta'] } } })
    expect(await res.json()).toMatchObject({ enviadas: 1, eliminadas: 1 })
  })

  it('con dry=1 devuelve el payload sin mandar nada', async () => {
    mp.gasto.findMany.mockResolvedValue([rawGasto()])
    const res = await GET(req(`today=${HOY}&dry=1`))
    const body = await res.json()

    expect(body).toMatchObject({ ok: true, dry: true, vencimientos: 1 })
    expect(body.payload.title).toBe('Vence hoy: Luz')
    expect(mockSend).not.toHaveBeenCalled()
    expect(mp.pushSubscription.findMany).not.toHaveBeenCalled()
  })

  it('falla si faltan las claves VAPID y hay algo para avisar', async () => {
    mockVapid.mockReturnValue(false)
    mp.gasto.findMany.mockResolvedValue([rawGasto()])
    const res = await GET(req(`today=${HOY}`))
    expect(res.status).toBe(500)
    expect(mockSend).not.toHaveBeenCalled()
  })
})

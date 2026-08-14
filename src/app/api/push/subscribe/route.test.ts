import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    pushSubscription: { upsert: vi.fn(), deleteMany: vi.fn(), count: vi.fn() },
  },
}))

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))

import { GET, POST, DELETE } from './route'
import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth'

const mp = prisma as any
const mockSession = getServerSession as unknown as ReturnType<typeof vi.fn>

const SUB = { endpoint: 'https://push.example/abc', p256dh: 'PPP', auth: 'AAA' }

function req(body: unknown, userAgent: string | null = 'Firefox') {
  return {
    json: async () => body,
    headers: { get: (k: string) => (k.toLowerCase() === 'user-agent' ? userAgent : null) },
  } as any
}

beforeEach(() => {
  vi.clearAllMocks()
  mockSession.mockResolvedValue({ user: { email: 'Gustavo@Example.com' } })
  mp.pushSubscription.upsert.mockResolvedValue({})
  mp.pushSubscription.deleteMany.mockResolvedValue({ count: 1 })
  mp.pushSubscription.count.mockResolvedValue(2)
})

describe('POST /api/push/subscribe', () => {
  it('guarda la suscripción con el email normalizado a lowercase', async () => {
    const res = await POST(req(SUB))
    expect(res.status).toBe(201)
    expect(mp.pushSubscription.upsert).toHaveBeenCalledWith({
      where: { endpoint: SUB.endpoint },
      create: { email: 'gustavo@example.com', endpoint: SUB.endpoint, p256dh: 'PPP', auth: 'AAA', userAgent: 'Firefox' },
      update: { email: 'gustavo@example.com', p256dh: 'PPP', auth: 'AAA', userAgent: 'Firefox' },
    })
  })

  it('rechaza sin sesión', async () => {
    mockSession.mockResolvedValue(null)
    const res = await POST(req(SUB))
    expect(res.status).toBe(401)
    expect(mp.pushSubscription.upsert).not.toHaveBeenCalled()
  })

  it('rechaza un body incompleto', async () => {
    const res = await POST(req({ endpoint: SUB.endpoint, p256dh: 'PPP' }))
    expect(res.status).toBe(400)
    expect(mp.pushSubscription.upsert).not.toHaveBeenCalled()
  })

  it('rechaza campos que no son strings', async () => {
    const res = await POST(req({ endpoint: 1, p256dh: 'PPP', auth: 'AAA' }))
    expect(res.status).toBe(400)
  })
})

describe('DELETE /api/push/subscribe', () => {
  it('borra sólo la suscripción de ese endpoint y de ese usuario', async () => {
    const res = await DELETE(req({ endpoint: SUB.endpoint }))
    expect(res.status).toBe(200)
    expect(mp.pushSubscription.deleteMany).toHaveBeenCalledWith({
      where: { endpoint: SUB.endpoint, email: 'gustavo@example.com' },
    })
    expect(await res.json()).toEqual({ ok: true, deleted: 1 })
  })

  it('rechaza sin endpoint', async () => {
    const res = await DELETE(req({}))
    expect(res.status).toBe(400)
    expect(mp.pushSubscription.deleteMany).not.toHaveBeenCalled()
  })
})

describe('GET /api/push/subscribe', () => {
  it('cuenta las suscripciones del usuario', async () => {
    const res = await GET()
    expect(mp.pushSubscription.count).toHaveBeenCalledWith({ where: { email: 'gustavo@example.com' } })
    expect(await res.json()).toEqual({ subscriptions: 2 })
  })

  it('rechaza sin sesión', async () => {
    mockSession.mockResolvedValue(null)
    const res = await GET()
    expect(res.status).toBe(401)
  })
})

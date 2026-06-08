import { describe, it, expect, vi, beforeEach } from 'vitest'
import { normalizeNombre, resolveConcepto } from './conceptos'

describe('normalizeNombre', () => {
  it('hace trim de los bordes', () => {
    expect(normalizeNombre('  Netflix  ')).toBe('Netflix')
  })

  it('colapsa espacios internos a uno solo', () => {
    expect(normalizeNombre('Netflix   HBO')).toBe('Netflix HBO')
  })

  it('preserva el casing (el match case-insensitive es a nivel query)', () => {
    expect(normalizeNombre('netFLIX')).toBe('netFLIX')
  })

  it('colapsa tabs y saltos de línea', () => {
    expect(normalizeNombre('a\t\nb')).toBe('a b')
  })
})

describe('resolveConcepto', () => {
  let db: any
  beforeEach(() => {
    db = { concepto: { findFirst: vi.fn(), create: vi.fn() } }
  })

  it('devuelve el id del concepto existente sin crear', async () => {
    db.concepto.findFirst.mockResolvedValue({ id: 7 })
    const id = await resolveConcepto(db, '  Netflix ')
    expect(id).toBe(7)
    expect(db.concepto.findFirst).toHaveBeenCalledWith({
      where: { nombre: { equals: 'Netflix', mode: 'insensitive' } },
      select: { id: true },
    })
    expect(db.concepto.create).not.toHaveBeenCalled()
  })

  it('crea el concepto (normalizado) cuando no existe', async () => {
    db.concepto.findFirst.mockResolvedValue(null)
    db.concepto.create.mockResolvedValue({ id: 42 })
    const id = await resolveConcepto(db, 'Luz   eléctrica')
    expect(id).toBe(42)
    expect(db.concepto.create).toHaveBeenCalledWith({ data: { nombre: 'Luz eléctrica' }, select: { id: true } })
  })

  it('reintenta el find ante carrera de unicidad (P2002)', async () => {
    db.concepto.findFirst
      .mockResolvedValueOnce(null)       // primer find: no existe
      .mockResolvedValueOnce({ id: 99 }) // reintento tras P2002: lo creó otro request
    db.concepto.create.mockRejectedValue({ code: 'P2002' })
    const id = await resolveConcepto(db, 'Internet')
    expect(id).toBe(99)
  })

  it('lanza si el nombre queda vacío tras normalizar', async () => {
    await expect(resolveConcepto(db, '   ')).rejects.toThrow()
  })
})

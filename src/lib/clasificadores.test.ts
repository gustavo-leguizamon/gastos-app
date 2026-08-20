import { describe, it, expect, vi } from 'vitest'
import { resolveCategoria, resolveEtiqueta, resolveClasificador, parseMergeBody } from './clasificadores'

/** Delegate de Prisma falso con una tabla en memoria (match case-insensitive). */
function fakeDelegate(filas: { id: number; nombre: string }[] = []): any {
  let seq = filas.reduce((m, f) => Math.max(m, f.id), 0)
  return {
    filas,
    findFirst: vi.fn(async ({ where }: any) => {
      const buscado = where.nombre.equals.toLowerCase()
      return filas.find(f => f.nombre.toLowerCase() === buscado) ?? null
    }),
    create: vi.fn(async ({ data }: any) => {
      const fila = { id: ++seq, nombre: data.nombre }
      filas.push(fila)
      return fila
    }),
  }
}

describe('resolveClasificador', () => {
  it('devuelve el id existente sin crear nada', async () => {
    const d = fakeDelegate([{ id: 7, nombre: 'Comida' }])
    expect(await resolveClasificador(d, 'Comida', 'categoría')).toBe(7)
    expect(d.create).not.toHaveBeenCalled()
  })

  it('matchea sin importar mayúsculas ni espacios de sobra', async () => {
    const d = fakeDelegate([{ id: 7, nombre: 'Comida' }])
    expect(await resolveClasificador(d, '  comida  ', 'categoría')).toBe(7)
    expect(await resolveClasificador(d, 'COMIDA', 'categoría')).toBe(7)
    expect(d.create).not.toHaveBeenCalled()
  })

  it('colapsa espacios internos antes de comparar', async () => {
    const d = fakeDelegate([{ id: 7, nombre: 'Comida afuera' }])
    expect(await resolveClasificador(d, 'Comida    afuera', 'categoría')).toBe(7)
    expect(d.create).not.toHaveBeenCalled()
  })

  it('crea cuando no existe, guardando el nombre normalizado', async () => {
    const d = fakeDelegate([])
    const id = await resolveClasificador(d, '  Transporte  público ', 'categoría')
    expect(d.create).toHaveBeenCalledWith({ data: { nombre: 'Transporte público' }, select: { id: true } })
    expect(d.filas.find((f: any) => f.id === id)!.nombre).toBe('Transporte público')
  })

  it('preserva el casing que tipeó el usuario al crear', async () => {
    const d = fakeDelegate([])
    await resolveClasificador(d, 'ObraS SocialeS', 'categoría')
    expect(d.filas[0].nombre).toBe('ObraS SocialeS')
  })

  it('rechaza un nombre vacío', async () => {
    const d = fakeDelegate([])
    await expect(resolveClasificador(d, '   ', 'categoría')).rejects.toThrow(/no puede estar vacío/)
    await expect(resolveClasificador(d, '', 'etiqueta')).rejects.toThrow(/etiqueta/)
  })

  it('ante la carrera de dos altas simultáneas (P2002) reintenta el find', async () => {
    const d = fakeDelegate([])
    d.create = vi.fn(async () => { throw Object.assign(new Error('dup'), { code: 'P2002' }) })
    d.findFirst = vi.fn()
      .mockResolvedValueOnce(null)          // primer find: no existía
      .mockResolvedValueOnce({ id: 42 })    // tras el P2002: la creó el otro request
    expect(await resolveClasificador(d, 'Comida', 'categoría')).toBe(42)
  })

  it('propaga cualquier otro error del create', async () => {
    const d = fakeDelegate([])
    d.create = vi.fn(async () => { throw new Error('DB caída') })
    await expect(resolveClasificador(d, 'Comida', 'categoría')).rejects.toThrow('DB caída')
  })
})

describe('resolveCategoria / resolveEtiqueta', () => {
  it('cada uno usa su propio delegate', async () => {
    const categoria = fakeDelegate([{ id: 1, nombre: 'Comida' }])
    const etiqueta = fakeDelegate([{ id: 2, nombre: 'Viaje' }])
    const db = { categoria, etiqueta }

    expect(await resolveCategoria(db, 'comida')).toBe(1)
    expect(await resolveEtiqueta(db, 'viaje')).toBe(2)
    expect(categoria.findFirst).toHaveBeenCalledTimes(1)
    expect(etiqueta.findFirst).toHaveBeenCalledTimes(1)
  })
})

describe('parseMergeBody', () => {
  it('acepta dos ids válidos', () => {
    expect(parseMergeBody({ source_id: 1, target_id: 2 })).toEqual({ ok: true, sourceId: 1, targetId: 2 })
  })

  it('coerciona strings numéricos', () => {
    expect(parseMergeBody({ source_id: '3', target_id: '4' })).toEqual({ ok: true, sourceId: 3, targetId: 4 })
  })

  it('rechaza ids faltantes, cero, negativos o no enteros', () => {
    for (const body of [
      {},
      { source_id: 1 },
      { target_id: 2 },
      { source_id: 0, target_id: 2 },
      { source_id: -1, target_id: 2 },
      { source_id: 1.5, target_id: 2 },
      { source_id: 'x', target_id: 2 },
      null,
    ]) {
      expect(parseMergeBody(body).ok).toBe(false)
    }
  })

  it('rechaza fusionar algo consigo mismo', () => {
    const r = parseMergeBody({ source_id: 5, target_id: 5 })
    expect(r.ok).toBe(false)
    expect((r as any).error).toMatch(/consigo mismo/)
  })
})

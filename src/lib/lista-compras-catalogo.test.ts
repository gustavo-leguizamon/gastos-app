import { describe, it, expect, vi, beforeEach } from 'vitest'
import { actualizarUnidad, borrarCatalogo, renombrarCatalogo } from './lista-compras-catalogo'

const model = {
  findUnique: vi.fn(),
  findFirst: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('renombrarCatalogo', () => {
  it('404 si no existe, sin actualizar', async () => {
    model.findUnique.mockResolvedValue(null)
    expect((await renombrarCatalogo(model, 1, 'kg')).status).toBe(404)
    expect(model.update).not.toHaveBeenCalled()
  })

  it('409 si OTRA fila ya tiene ese nombre (sin distinguir mayúsculas)', async () => {
    model.findUnique.mockResolvedValue({ id: 1, nombre: 'kilo' })
    model.findFirst.mockResolvedValue({ id: 2, nombre: 'kg' })
    const r = await renombrarCatalogo(model, 1, 'KG')
    expect(r.status).toBe(409)
    expect(model.findFirst.mock.calls[0][0].where).toEqual({
      nombre: { equals: 'KG', mode: 'insensitive' },
      NOT: { id: 1 },
    })
    expect(model.update).not.toHaveBeenCalled()
  })

  it('permite corregir el casing de la propia fila (la excluye del chequeo)', async () => {
    model.findUnique.mockResolvedValue({ id: 1, nombre: 'kg' })
    model.findFirst.mockResolvedValue(null)
    model.update.mockResolvedValue({ id: 1, nombre: 'Kg' })
    const r = await renombrarCatalogo(model, 1, ' Kg ')
    expect(r).toEqual({ status: 200, body: { id: 1, nombre: 'Kg' } })
    expect(model.update).toHaveBeenCalledWith({ where: { id: 1 }, data: { nombre: 'Kg' } })
  })

  it('409 ante una carrera (P2002) en el update', async () => {
    model.findUnique.mockResolvedValue({ id: 1, nombre: 'a' })
    model.findFirst.mockResolvedValue(null)
    model.update.mockRejectedValue({ code: 'P2002' })
    expect((await renombrarCatalogo(model, 1, 'b')).status).toBe(409)
  })

  it('relanza los errores que no son de unicidad', async () => {
    model.findUnique.mockResolvedValue({ id: 1, nombre: 'a' })
    model.findFirst.mockResolvedValue(null)
    model.update.mockRejectedValue(new Error('db caída'))
    await expect(renombrarCatalogo(model, 1, 'b')).rejects.toThrow('db caída')
  })
})

describe('actualizarUnidad', () => {
  it('404 si no existe, sin tocar nada', async () => {
    model.findUnique.mockResolvedValue(null)
    expect((await actualizarUnidad(model, 1, { subunidadDe: 'kg' })).status).toBe(404)
    expect(model.update).not.toHaveBeenCalled()
  })

  it('fija la equivalencia sin tocar el nombre', async () => {
    model.findUnique.mockResolvedValue({ id: 1, nombre: 'g', subunidadDe: null })
    model.update.mockResolvedValue({ id: 1, nombre: 'g', subunidadDe: 'kg' })
    const r = await actualizarUnidad(model, 1, { subunidadDe: 'kg' })
    expect(model.update).toHaveBeenCalledWith({ where: { id: 1 }, data: { subunidadDe: 'kg' } })
    expect(r).toEqual({ status: 200, body: { id: 1, nombre: 'g', subunidad_de: 'kg' } })
  })

  it('quitar la equivalencia (null) también se guarda', async () => {
    model.findUnique.mockResolvedValue({ id: 1, nombre: 'g', subunidadDe: 'kg' })
    model.update.mockResolvedValue({ id: 1, nombre: 'g', subunidadDe: null })
    await actualizarUnidad(model, 1, { subunidadDe: null })
    expect(model.update).toHaveBeenCalledWith({ where: { id: 1 }, data: { subunidadDe: null } })
  })

  it('sólo renombrar conserva la equivalencia que ya tenía', async () => {
    model.findUnique.mockResolvedValue({ id: 1, nombre: 'g', subunidadDe: 'kg' })
    model.findFirst.mockResolvedValue(null)
    model.update.mockResolvedValue({ id: 1, nombre: 'gramos', subunidadDe: 'kg' })
    const r = await actualizarUnidad(model, 1, { nombre: 'gramos' })
    expect(r).toEqual({ status: 200, body: { id: 1, nombre: 'gramos', subunidad_de: 'kg' } })
    expect(model.update).toHaveBeenCalledTimes(1)
  })

  it('si el nombre choca (409) no guarda la equivalencia', async () => {
    model.findUnique.mockResolvedValue({ id: 1, nombre: 'a', subunidadDe: null })
    model.findFirst.mockResolvedValue({ id: 2, nombre: 'g' })
    const r = await actualizarUnidad(model, 1, { nombre: 'g', subunidadDe: 'kg' })
    expect(r.status).toBe(409)
    expect(model.update).not.toHaveBeenCalled()
  })
})

describe('borrarCatalogo', () => {
  it('404 si no existe', async () => {
    model.findUnique.mockResolvedValue(null)
    expect((await borrarCatalogo(model, 1)).status).toBe(404)
    expect(model.delete).not.toHaveBeenCalled()
  })

  it('409 con la cantidad si algún artículo la usa, sin borrar', async () => {
    model.findUnique.mockResolvedValue({ id: 1, _count: { articulos: 3 } })
    const r = await borrarCatalogo(model, 1)
    expect(r.status).toBe(409)
    expect(r.body.uso).toBe(3)
    expect(String(r.body.error)).toContain('3 artículos')
    expect(model.delete).not.toHaveBeenCalled()
  })

  it('singular cuando la usa un solo artículo', async () => {
    model.findUnique.mockResolvedValue({ id: 1, _count: { articulos: 1 } })
    expect(String((await borrarCatalogo(model, 1)).body.error)).toContain('la usa 1 artículo')
  })

  it('borra si no tiene uso', async () => {
    model.findUnique.mockResolvedValue({ id: 1, _count: { articulos: 0 } })
    const r = await borrarCatalogo(model, 1)
    expect(r).toEqual({ status: 200, body: { ok: true } })
    expect(model.delete).toHaveBeenCalledWith({ where: { id: 1 } })
  })
})

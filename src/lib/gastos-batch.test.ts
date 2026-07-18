import { describe, it, expect } from 'vitest'
import { parseCategoriaBatch, parseEtiquetaBatch } from './gastos-batch'

describe('parseCategoriaBatch', () => {
  it('parsea un body válido y deduplica gasto_ids', () => {
    const out = parseCategoriaBatch({ gasto_ids: [3, 1, 3, 2], categoria_id: 7, action: 'add' })
    expect(out).toEqual({ gasto_ids: [3, 1, 2], categoria_id: 7, action: 'add' })
  })

  it('acepta action remove', () => {
    const out = parseCategoriaBatch({ gasto_ids: [5], categoria_id: 2, action: 'remove' })
    expect(out.action).toBe('remove')
  })

  it('coerce strings numéricos a number', () => {
    const out = parseCategoriaBatch({ gasto_ids: ['4', '5'], categoria_id: '9', action: 'add' })
    expect(out.gasto_ids).toEqual([4, 5])
    expect(out.categoria_id).toBe(9)
  })

  it('rechaza action inválida', () => {
    expect(() => parseCategoriaBatch({ gasto_ids: [1], categoria_id: 1, action: 'x' })).toThrow(/action/)
    expect(() => parseCategoriaBatch({ gasto_ids: [1], categoria_id: 1 })).toThrow(/action/)
  })

  it('rechaza categoria_id inválido', () => {
    expect(() => parseCategoriaBatch({ gasto_ids: [1], categoria_id: 0, action: 'add' })).toThrow(/categoria_id/)
    expect(() => parseCategoriaBatch({ gasto_ids: [1], categoria_id: 'abc', action: 'add' })).toThrow(/categoria_id/)
  })

  it('rechaza gasto_ids vacío o no-array', () => {
    expect(() => parseCategoriaBatch({ gasto_ids: [], categoria_id: 1, action: 'add' })).toThrow(/gasto_ids/)
    expect(() => parseCategoriaBatch({ gasto_ids: 'nope', categoria_id: 1, action: 'add' })).toThrow(/gasto_ids/)
  })

  it('rechaza gasto_ids con un id inválido', () => {
    expect(() => parseCategoriaBatch({ gasto_ids: [1, -2], categoria_id: 1, action: 'add' })).toThrow(/id inválido/)
    expect(() => parseCategoriaBatch({ gasto_ids: [1, 'x'], categoria_id: 1, action: 'add' })).toThrow(/id inválido/)
  })
})

describe('parseEtiquetaBatch', () => {
  it('parsea un body válido y deduplica gasto_ids', () => {
    const out = parseEtiquetaBatch({ gasto_ids: [3, 1, 3, 2], etiqueta_id: 8, action: 'add' })
    expect(out).toEqual({ gasto_ids: [3, 1, 2], etiqueta_id: 8, action: 'add' })
  })

  it('acepta action remove y coerce strings', () => {
    const out = parseEtiquetaBatch({ gasto_ids: ['4'], etiqueta_id: '9', action: 'remove' })
    expect(out).toEqual({ gasto_ids: [4], etiqueta_id: 9, action: 'remove' })
  })

  it('rechaza etiqueta_id inválido', () => {
    expect(() => parseEtiquetaBatch({ gasto_ids: [1], etiqueta_id: 0, action: 'add' })).toThrow(/etiqueta_id/)
    expect(() => parseEtiquetaBatch({ gasto_ids: [1], etiqueta_id: 'abc', action: 'add' })).toThrow(/etiqueta_id/)
  })

  it('rechaza action y gasto_ids inválidos', () => {
    expect(() => parseEtiquetaBatch({ gasto_ids: [1], etiqueta_id: 1, action: 'x' })).toThrow(/action/)
    expect(() => parseEtiquetaBatch({ gasto_ids: [], etiqueta_id: 1, action: 'add' })).toThrow(/gasto_ids/)
  })
})

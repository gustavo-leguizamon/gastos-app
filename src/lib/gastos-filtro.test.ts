import { describe, it, expect } from 'vitest'
import { matchBusqueda, type GastoBuscable } from './gastos-filtro'

function gasto(over: Partial<GastoBuscable> = {}): GastoBuscable {
  return {
    descripcion: 'Luz',
    notas: null,
    categoria: null,
    etiquetas: [],
    items: [],
    ...over,
  }
}

describe('matchBusqueda', () => {
  it('sin búsqueda pasa todo', () => {
    expect(matchBusqueda(gasto(), '')).toBe(true)
    expect(matchBusqueda(gasto(), '   ')).toBe(true)
  })

  it('matchea la descripción del gasto sin importar mayúsculas', () => {
    expect(matchBusqueda(gasto({ descripcion: 'Netflix' }), 'netf')).toBe(true)
    expect(matchBusqueda(gasto({ descripcion: 'netflix' }), 'NETF')).toBe(true)
  })

  it('ignora espacios alrededor de la búsqueda', () => {
    expect(matchBusqueda(gasto({ descripcion: 'Netflix' }), '  netflix  ')).toBe(true)
  })

  it('no matchea lo que no está', () => {
    expect(matchBusqueda(gasto({ descripcion: 'Luz' }), 'gas')).toBe(false)
  })

  it('matchea la categoría y las etiquetas del gasto', () => {
    expect(matchBusqueda(gasto({ categoria: { nombre: 'Servicios' } }), 'servi')).toBe(true)
    expect(matchBusqueda(gasto({ etiquetas: [{ nombre: 'Deducible' }] }), 'deduc')).toBe(true)
  })

  it('matchea las notas del gasto', () => {
    expect(matchBusqueda(gasto({ notas: 'Pagado con transferencia del BNA' }), 'bna')).toBe(true)
  })

  it('notas en null o vacías no rompen', () => {
    expect(matchBusqueda(gasto({ notas: null }), 'algo')).toBe(false)
    expect(matchBusqueda(gasto({ notas: '' }), 'algo')).toBe(false)
    expect(matchBusqueda(gasto({ notas: undefined }), 'algo')).toBe(false)
  })

  it('matchea la descripción de un sub-ítem y devuelve el gasto padre', () => {
    const resumen = gasto({
      descripcion: 'Visa',
      items: [{ descripcion: 'Netflix' }, { descripcion: 'Spotify' }],
    })
    expect(matchBusqueda(resumen, 'netflix')).toBe(true)
    expect(matchBusqueda(resumen, 'spotify')).toBe(true)
    expect(matchBusqueda(resumen, 'disney')).toBe(false)
  })

  it('matchea la categoría y las etiquetas de un sub-ítem', () => {
    const resumen = gasto({
      descripcion: 'Visa',
      items: [{ descripcion: 'Consumo', categoria: { nombre: 'Streaming' }, etiquetas: [{ nombre: 'Viaje' }] }],
    })
    expect(matchBusqueda(resumen, 'streaming')).toBe(true)
    expect(matchBusqueda(resumen, 'viaje')).toBe(true)
  })

  it('listas nulas o ausentes no rompen', () => {
    expect(matchBusqueda(gasto({ items: null, etiquetas: null }), 'x')).toBe(false)
    expect(matchBusqueda({ descripcion: 'Luz' }, 'luz')).toBe(true)
    expect(matchBusqueda({ descripcion: 'Luz' }, 'gas')).toBe(false)
  })
})

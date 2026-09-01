import { describe, it, expect } from 'vitest'
import { matchBusqueda, matchSubitem, type GastoBuscable, type SubitemFiltrable } from './gastos-filtro'

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

describe('matchSubitem', () => {
  function item(over: Partial<SubitemFiltrable> = {}): SubitemFiltrable {
    return { descripcion: 'Netflix', verificado: false, categoria: null, etiquetas: [], ...over }
  }

  it("'todos' no filtra por la marca", () => {
    expect(matchSubitem(item({ verificado: true }), '', 'todos')).toBe(true)
    expect(matchSubitem(item({ verificado: false }), '', 'todos')).toBe(true)
  })

  it("'verificados' deja sólo los marcados", () => {
    expect(matchSubitem(item({ verificado: true }), '', 'verificados')).toBe(true)
    expect(matchSubitem(item({ verificado: false }), '', 'verificados')).toBe(false)
  })

  it("'pendientes' deja sólo los no marcados", () => {
    expect(matchSubitem(item({ verificado: false }), '', 'pendientes')).toBe(true)
    expect(matchSubitem(item({ verificado: true }), '', 'pendientes')).toBe(false)
  })

  it('sin marca (ausente o null) cuenta como pendiente', () => {
    expect(matchSubitem({ descripcion: 'Netflix' }, '', 'pendientes')).toBe(true)
    expect(matchSubitem({ descripcion: 'Netflix' }, '', 'verificados')).toBe(false)
    expect(matchSubitem(item({ verificado: null }), '', 'pendientes')).toBe(true)
  })

  it('la marca y la búsqueda se combinan (AND)', () => {
    const verificado = item({ descripcion: 'Netflix', verificado: true })
    expect(matchSubitem(verificado, 'netflix', 'verificados')).toBe(true)
    expect(matchSubitem(verificado, 'spotify', 'verificados')).toBe(false)
    expect(matchSubitem(verificado, 'netflix', 'pendientes')).toBe(false)
  })

  it('busca en descripción, categoría y etiquetas del sub-ítem', () => {
    const i = item({ descripcion: 'Consumo', categoria: { nombre: 'Streaming' }, etiquetas: [{ nombre: 'Viaje' }] })
    expect(matchSubitem(i, 'consumo')).toBe(true)
    expect(matchSubitem(i, 'streaming')).toBe(true)
    expect(matchSubitem(i, 'viaje')).toBe(true)
    expect(matchSubitem(i, 'disney')).toBe(false)
  })

  it('búsqueda vacía o en blanco no filtra, y las listas nulas no rompen', () => {
    expect(matchSubitem(item(), '   ')).toBe(true)
    expect(matchSubitem({ descripcion: 'Netflix', etiquetas: null, categoria: null }, 'zzz')).toBe(false)
  })
})

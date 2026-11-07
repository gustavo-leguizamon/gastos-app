import { describe, it, expect } from 'vitest'
import {
  ultimosDeArticulo,
  precargaCompra,
  parseItemBody,
  parseItemPatch,
  parseCopiarBody,
  parseNombreCatalogo,
  esCompleto,
  estadoCantidad,
  normalizarBusqueda,
  coincideBusqueda,
  coincideEstado,
  contarPorEstado,
  parseColapsados,
  precioUnitarioDeEntrada,
  entradaDePrecio,
  fechaValida,
  parseCompraBody,
  resumenCompras,
  importesLinea,
  toCompraResponse,
  pasoLlevo,
  ajustarLlevo,
  parseSubunidadDe,
  inferirSubunidad,
  aPrecioBase,
  desdePrecioBase,
  parseUnidadPatch,
  resolverPatchComprado,
  referenciaDe,
  variacionPrecio,
  toItemResponse,
  totalesLista,
  aCantidadBase,
  desdeCantidadBase,
  textoAlCambiarUnidad,
  esUnidadMultiplo,
  errorMultiplo,
} from './lista-compras-compute'

describe('parseItemBody', () => {
  const ok = { nombre: '  Leche   entera ', unidad_id: 1, mes: 11, anio: 2026 }

  it('normaliza el nombre y aplica defaults (cantidad 1, sin rubro ni precio)', () => {
    expect(parseItemBody(ok)).toEqual({
      nombre: 'Leche entera', unidadId: 1, rubroId: null, cantidad: 1, precioUnitario: null, mes: 11, anio: 2026, mostrarEnMultiplo: false,
    })
  })

  it('mostrar_en_multiplo: sólo boolean (para el artículo nuevo); sin él, false', () => {
    expect(parseItemBody({ ...ok, mostrar_en_multiplo: true })?.mostrarEnMultiplo).toBe(true)
    expect(parseItemBody({ ...ok, mostrar_en_multiplo: 'si' })).toBeNull()
  })

  it('acepta precio 0 (distinto de sin precio) y rubro', () => {
    const r = parseItemBody({ ...ok, cantidad: 2.5, precio_unitario: 0, unidad_id: 3, rubro_id: 5 })
    expect(r).toMatchObject({ cantidad: 2.5, precioUnitario: 0, unidadId: 3, rubroId: 5 })
  })

  it.each([
    [{ ...ok, nombre: '   ' }],
    [{ ...ok, mes: 13 }],
    [{ ...ok, anio: 'x' }],
    [{ ...ok, cantidad: 0 }],
    [{ ...ok, cantidad: -1 }],
    [{ ...ok, precio_unitario: -5 }],
    [{ ...ok, precio_unitario: 'abc' }],
    [{ ...ok, unidad_id: undefined }], // la unidad se elige de la tabla: es obligatoria
    [{ ...ok, unidad_id: 'kg' }],
    [{ ...ok, unidad_id: 0 }],
    [{ ...ok, rubro_id: 'x' }],
    [null],
  ])('rechaza %j', (body) => {
    expect(parseItemBody(body)).toBeNull()
  })
})

describe('parseItemPatch', () => {
  it('sólo incluye las claves que vienen', () => {
    expect(parseItemPatch({ comprado: true })).toEqual({ comprado: true })
  })

  it('cantidad_comprada acepta 0 y decimales, rechaza negativos y no numéricos', () => {
    expect(parseItemPatch({ cantidad_comprada: 0 })).toEqual({ cantidadComprada: 0 })
    expect(parseItemPatch({ cantidad_comprada: 1.5 })).toEqual({ cantidadComprada: 1.5 })
    expect(parseItemPatch({ cantidad_comprada: -1 })).toBeNull()
    expect(parseItemPatch({ cantidad_comprada: 'x' })).toBeNull()
  })

  it('precio_unitario null borra el precio (≠ no mandarlo)', () => {
    expect(parseItemPatch({ precio_unitario: null })).toEqual({ precioUnitario: null })
    expect(parseItemPatch({ precio_unitario: 120 })).toEqual({ precioUnitario: 120 })
  })

  it('unidad_id y rubro_id son ids; rubro_id null quita el rubro', () => {
    expect(parseItemPatch({ unidad_id: 2 })).toEqual({ unidadId: 2 })
    expect(parseItemPatch({ rubro_id: 4 })).toEqual({ rubroId: 4 })
    expect(parseItemPatch({ rubro_id: null })).toEqual({ rubroId: null })
  })

  it('mostrar_en_multiplo es la preferencia del artículo (sólo boolean)', () => {
    expect(parseItemPatch({ mostrar_en_multiplo: true })).toEqual({ mostrarEnMultiplo: true })
    expect(parseItemPatch({ mostrar_en_multiplo: false })).toEqual({ mostrarEnMultiplo: false })
    expect(parseItemPatch({ mostrar_en_multiplo: 1 })).toBeNull()
  })

  it('nombre se normaliza; vacío o no-string es inválido', () => {
    expect(parseItemPatch({ nombre: '  Leche   descremada ' })).toEqual({ nombre: 'Leche descremada' })
    expect(parseItemPatch({ nombre: '   ' })).toBeNull()
    expect(parseItemPatch({ nombre: 3 })).toBeNull()
  })

  it.each([[{}], [{ cantidad: 0 }], [{ comprado: 'si' }], [{ unidad_id: null }], [{ unidad_id: 'kg' }], [{ rubro_id: 'x' }], [{ rubro_id: 0 }], [{ precio_unitario: -1 }], [null]])(
    'rechaza %j',
    (body) => expect(parseItemPatch(body)).toBeNull(),
  )
})

describe('parseNombreCatalogo', () => {
  it('normaliza el nombre', () => {
    expect(parseNombreCatalogo({ nombre: '  Frutas   y verduras ' })).toBe('Frutas y verduras')
  })
  it.each([[{ nombre: '   ' }], [{ nombre: 3 }], [{}], [null]])('rechaza %j', (b) => {
    expect(parseNombreCatalogo(b)).toBeNull()
  })
})

describe('parseSubunidadDe', () => {
  it('acepta kg y l; vacío/null = sin equivalencia; otra cosa es inválida', () => {
    expect(parseSubunidadDe('kg')).toBe('kg')
    expect(parseSubunidadDe('l')).toBe('l')
    expect(parseSubunidadDe(null)).toBeNull()
    expect(parseSubunidadDe('')).toBeNull()
    expect(parseSubunidadDe(undefined)).toBeNull()
    expect(parseSubunidadDe('g')).toBeUndefined()
    expect(parseSubunidadDe('KG')).toBeUndefined()
  })
})

describe('inferirSubunidad', () => {
  it.each([['g'], ['gr'], ['Grs'], ['gramos'], ['Gramo'], [' g. ']])('%s → kg', (n) => {
    expect(inferirSubunidad(n)).toBe('kg')
  })
  it.each([['ml'], ['ML'], ['cc'], ['mililitros'], ['Mililitro']])('%s → l', (n) => {
    expect(inferirSubunidad(n)).toBe('l')
  })
  it.each([['kg'], ['l'], ['un'], ['pack'], ['gramola'], ['']])('%s → sin equivalencia', (n) => {
    expect(inferirSubunidad(n)).toBeNull()
  })
})

describe('aPrecioBase / desdePrecioBase', () => {
  it('g/ml: el precio por kg/litro es mil veces el de la unidad', () => {
    expect(aPrecioBase(4, 'kg')).toBe(4000)
    expect(desdePrecioBase(4000, 'kg')).toBe(4)
    expect(desdePrecioBase(2500, 'l')).toBe(2.5)
  })

  it('sin equivalencia no convierte', () => {
    expect(aPrecioBase(150, null)).toBe(150)
    expect(desdePrecioBase(150, null)).toBe(150)
  })

  it('no arrastra ruido de float al mostrar (3999.99 por kg)', () => {
    expect(aPrecioBase(desdePrecioBase(3999.99, 'kg'), 'kg')).toBe(3999.99)
  })

  it('el total sigue siendo cantidad × precio por unidad: 500 g a $4000/kg = $2000', () => {
    const porGramo = desdePrecioBase(4000, 'kg')
    expect(500 * porGramo).toBe(2000)
  })
})

describe('parseUnidadPatch', () => {
  it('nombre y/o subunidad_de', () => {
    expect(parseUnidadPatch({ nombre: '  gramos ' })).toEqual({ nombre: 'gramos' })
    expect(parseUnidadPatch({ subunidad_de: 'kg' })).toEqual({ subunidadDe: 'kg' })
    expect(parseUnidadPatch({ subunidad_de: null })).toEqual({ subunidadDe: null })
    expect(parseUnidadPatch({ nombre: 'g', subunidad_de: 'kg' })).toEqual({ nombre: 'g', subunidadDe: 'kg' })
  })
  it.each([[{}], [{ nombre: '  ' }], [{ subunidad_de: 'g' }], [null]])('rechaza %j', (b) => {
    expect(parseUnidadPatch(b)).toBeNull()
  })
})

describe('pasoLlevo / ajustarLlevo (botones +/−)', () => {
  it('el paso es 1, o 100 si la unidad es g/ml', () => {
    expect(pasoLlevo(null)).toBe(1)
    expect(pasoLlevo('kg')).toBe(100)
    expect(pasoLlevo('l')).toBe(100)
  })

  it('suma y resta un paso', () => {
    expect(ajustarLlevo(2, 1, null)).toBe(3)
    expect(ajustarLlevo(2, -1, null)).toBe(1)
    expect(ajustarLlevo(250, 1, 'kg')).toBe(350)
  })

  it('nunca baja de 0', () => {
    expect(ajustarLlevo(0, -1, null)).toBe(0)
    expect(ajustarLlevo(0.5, -1, null)).toBe(0)
    expect(ajustarLlevo(50, -1, 'kg')).toBe(0)
  })

  it('conserva los decimales que ya había y no arrastra ruido de float', () => {
    expect(ajustarLlevo(1.5, 1, null)).toBe(2.5)
    expect(ajustarLlevo(0.1 + 0.2, 1, null)).toBe(1.3)
  })
})

describe('fechaValida', () => {
  it('acepta fechas reales YYYY-MM-DD', () => {
    expect(fechaValida('2026-11-03')).toBe(true)
    expect(fechaValida('2028-02-29')).toBe(true) // bisiesto
  })
  it.each([['2026-02-30'], ['2026-13-01'], ['2027-02-29'], ['03/11/2026'], ['2026-1-3'], [''], [20261103], [null]])('rechaza %s', (f) => {
    expect(fechaValida(f)).toBe(false)
  })
})

describe('parseCompraBody', () => {
  const ok = { cantidad: 2, precio_unitario: 1000, fecha: '2026-11-03' }

  it('mapea a camelCase', () => {
    expect(parseCompraBody(ok)).toEqual({ cantidad: 2, precioUnitario: 1000, fecha: '2026-11-03' })
  })
  it('el precio es opcional (null/ausente/vacío = sin anotar); 0 es un precio válido', () => {
    expect(parseCompraBody({ ...ok, precio_unitario: null })?.precioUnitario).toBeNull()
    expect(parseCompraBody({ cantidad: 1, fecha: '2026-11-03' })?.precioUnitario).toBeNull()
    expect(parseCompraBody({ ...ok, precio_unitario: '' })?.precioUnitario).toBeNull()
    expect(parseCompraBody({ ...ok, precio_unitario: 0 })?.precioUnitario).toBe(0)
  })
  it.each([
    [{ ...ok, cantidad: 0 }],
    [{ ...ok, cantidad: -1 }],
    [{ ...ok, cantidad: 'x' }],
    [{ ...ok, precio_unitario: -5 }],
    [{ ...ok, precio_unitario: 'abc' }],
    [{ ...ok, fecha: undefined }], // la fecha local la manda el cliente: obligatoria
    [{ ...ok, fecha: '2026-02-30' }],
    [null],
  ])('rechaza %j', (b) => {
    expect(parseCompraBody(b)).toBeNull()
  })
})

describe('toCompraResponse', () => {
  it('snake_case y sin precio = null', () => {
    expect(toCompraResponse({ id: 1, itemId: 9, cantidad: 3, precioUnitario: undefined, fecha: '2026-11-03', createdAt: new Date() }))
      .toEqual({ id: 1, cantidad: 3, precio_unitario: null, fecha: '2026-11-03' })
  })
})

describe('resumenCompras (promedio ponderado)', () => {
  it('suma lo llevado y pondera el precio por cantidad: 2 kg a 1000 + 3 kg a 1100 = 1060', () => {
    const r = resumenCompras([{ cantidad: 2, precioUnitario: 1000 }, { cantidad: 3, precioUnitario: 1100 }])
    expect(r.cantidadComprada).toBe(5)
    expect(r.precioPromedio).toBeCloseTo(1060)
  })

  it('cantidad × promedio coincide con lo realmente pagado (el gastado no se desvía)', () => {
    const compras = [{ cantidad: 2, precioUnitario: 1000 }, { cantidad: 3, precioUnitario: 1100 }]
    const r = resumenCompras(compras)
    expect(r.cantidadComprada * (r.precioPromedio as number)).toBeCloseTo(2 * 1000 + 3 * 1100)
  })

  it('no es el promedio simple: pesa más la compra grande', () => {
    const r = resumenCompras([{ cantidad: 1, precioUnitario: 1000 }, { cantidad: 9, precioUnitario: 2000 }])
    expect(r.precioPromedio).toBeCloseTo(1900) // simple daría 1500
  })

  it('las compras sin precio suman cantidad pero no entran al promedio', () => {
    const r = resumenCompras([{ cantidad: 2, precioUnitario: 1000 }, { cantidad: 3, precioUnitario: null }])
    expect(r.cantidadComprada).toBe(5)
    expect(r.precioPromedio).toBe(1000)
  })

  it('sin ningún precio el promedio es null (la línea conserva el suyo)', () => {
    expect(resumenCompras([{ cantidad: 2, precioUnitario: null }]).precioPromedio).toBeNull()
  })

  it('sin compras: 0 llevado y sin promedio', () => {
    expect(resumenCompras([])).toEqual({ cantidadComprada: 0, precioPromedio: null })
  })

  it('una compra con precio 0 suma cantidad pero no entra al promedio', () => {
    const r = resumenCompras([{ cantidad: 1, precioUnitario: 0 }, { cantidad: 3, precioUnitario: 100 }])
    expect(r.cantidadComprada).toBe(4)
    expect(r.precioPromedio).toBe(100)
  })

  it('si todas las compras están en 0, no hay promedio (la línea conserva su precio)', () => {
    expect(resumenCompras([{ cantidad: 2, precioUnitario: 0 }]).precioPromedio).toBeNull()
  })

  it('no arrastra ruido de float en lo llevado', () => {
    expect(resumenCompras([{ cantidad: 0.1, precioUnitario: 1 }, { cantidad: 0.2, precioUnitario: 1 }]).cantidadComprada).toBe(0.3)
  })
})

describe('precioUnitarioDeEntrada (unitario vs. total pagado)', () => {
  it('total pagado en gramos: 500 g por $2.000 → $4 por g = $4.000 por kg', () => {
    const porGramo = precioUnitarioDeEntrada('total', 2000, 500, 'kg')
    expect(porGramo).toBe(4)
    expect(aPrecioBase(porGramo as number, 'kg')).toBe(4000)
  })

  it('lo mismo con mililitros: 250 ml por $1.500 → $6 por ml = $6.000 por litro', () => {
    const porMl = precioUnitarioDeEntrada('total', 1500, 250, 'l')
    expect(porMl).toBe(6)
    expect(aPrecioBase(porMl as number, 'l')).toBe(6000)
  })

  it('un total que no divide redondo no pierde precisión: 333 g por $1.000', () => {
    const porGramo = precioUnitarioDeEntrada('total', 1000, 333, 'kg') as number
    expect(aPrecioBase(porGramo, 'kg')).toBeCloseTo(3003.003003, 5)
    expect(333 * porGramo).toBeCloseTo(1000) // el gastado vuelve a ser lo pagado
  })

  it('total pagado en una unidad sin equivalencia: 3 un por $900 → $300 c/u', () => {
    expect(precioUnitarioDeEntrada('total', 900, 3, null)).toBe(300)
  })

  it('unitario por kg/litro se convierte a precio por g/ml; sin equivalencia queda igual', () => {
    expect(precioUnitarioDeEntrada('unitario', 4000, 500, 'kg')).toBe(4)
    expect(precioUnitarioDeEntrada('unitario', 150, 2, null)).toBe(150)
  })

  it('el modo unitario no depende de la cantidad', () => {
    expect(precioUnitarioDeEntrada('unitario', 4000, null, 'kg')).toBe(4)
  })

  it('total sin cantidad válida no se puede calcular (null, nunca Infinity)', () => {
    expect(precioUnitarioDeEntrada('total', 2000, null, 'kg')).toBeNull()
    expect(precioUnitarioDeEntrada('total', 2000, 0, 'kg')).toBeNull()
    expect(precioUnitarioDeEntrada('total', 2000, -5, 'kg')).toBeNull()
  })

  it('un total de 0 es válido (regalo): precio 0', () => {
    expect(precioUnitarioDeEntrada('total', 0, 500, 'kg')).toBe(0)
  })
})

describe('entradaDePrecio (inversa, para no perder el número al cambiar de modo)', () => {
  it('unitario: por kg/litro si la unidad es g/ml', () => {
    expect(entradaDePrecio('unitario', 4, 500, 'kg')).toBe(4000)
    expect(entradaDePrecio('unitario', 150, 2, null)).toBe(150)
  })

  it('total: precio por unidad × cantidad, a centavos', () => {
    expect(entradaDePrecio('total', 4, 500, 'kg')).toBe(2000)
    expect(entradaDePrecio('total', 1000 / 333, 333, 'kg')).toBe(1000)
  })

  it('total sin cantidad válida → null', () => {
    expect(entradaDePrecio('total', 4, null, 'kg')).toBeNull()
    expect(entradaDePrecio('total', 4, 0, 'kg')).toBeNull()
  })

  it('ida y vuelta unitario → total → unitario conserva el precio', () => {
    const unit = precioUnitarioDeEntrada('unitario', 4000, 500, 'kg') as number
    const total = entradaDePrecio('total', unit, 500, 'kg') as number
    expect(precioUnitarioDeEntrada('total', total, 500, 'kg')).toBeCloseTo(unit)
  })
})

describe('parseColapsados (lo guardado en el navegador)', () => {
  it('lee un array de nombres', () => {
    expect(parseColapsados('["Almacén","Sin rubro"]')).toEqual(['Almacén', 'Sin rubro'])
  })
  it('descarta lo que no es texto', () => {
    expect(parseColapsados('["Almacén", 3, null, {"a":1}]')).toEqual(['Almacén'])
  })
  it.each([[null], [''], ['no es json'], ['{"a":1}'], ['3'], ['null']])('%s → []', (raw) => {
    expect(parseColapsados(raw)).toEqual([])
  })
})

describe('normalizarBusqueda', () => {
  it('minúsculas, sin acentos y espacios colapsados', () => {
    expect(normalizarBusqueda('  CAFÉ   Molido ')).toBe('cafe molido')
    expect(normalizarBusqueda('Limón')).toBe('limon')
    expect(normalizarBusqueda('Añejo')).toBe('anejo') // la ñ se descompone: se busca igual con n
  })
})

describe('coincideEstado / contarPorEstado (filtro por estado)', () => {
  const sinCompras = { cantidad: 2, cantidad_comprada: 0 }
  const parcial = { cantidad: 2, cantidad_comprada: 1 }
  const justa = { cantidad: 0.3, cantidad_comprada: 0.1 + 0.2 } // ruido de float: cuenta como justa
  const deMas = { cantidad: 2, cantidad_comprada: 3 }
  const todas = [sinCompras, parcial, justa, deMas]

  it('todos: entra cualquier línea', () => {
    expect(todas.every((i) => coincideEstado(i, 'todos'))).toBe(true)
  })

  it('faltan: sin compras y por debajo de lo pedido', () => {
    expect(todas.filter((i) => coincideEstado(i, 'faltan'))).toEqual([sinCompras, parcial])
  })

  it('realizadas: lo pedido justo y también lo comprado de más', () => {
    expect(todas.filter((i) => coincideEstado(i, 'realizadas'))).toEqual([justa, deMas])
  })

  it('de más: sólo las que se pasaron de lo pedido', () => {
    expect(todas.filter((i) => coincideEstado(i, 'de_mas'))).toEqual([deMas])
  })

  it('faltan y realizadas cubren toda la lista sin solaparse', () => {
    for (const i of todas) expect(coincideEstado(i, 'faltan')).toBe(!coincideEstado(i, 'realizadas'))
  })

  it('cuenta las líneas de cada filtro', () => {
    expect(contarPorEstado(todas)).toEqual({ todos: 4, faltan: 2, realizadas: 2, de_mas: 1 })
    expect(contarPorEstado([])).toEqual({ todos: 0, faltan: 0, realizadas: 0, de_mas: 0 })
  })
})

describe('coincideBusqueda (buscador de la lista)', () => {
  const yerba = { nombre: 'Yerba mate', rubro: 'Almacén' }
  const sinRubro = { nombre: 'Pilas AA', rubro: null }

  it('texto vacío o sólo espacios: coincide todo', () => {
    expect(coincideBusqueda(yerba, '')).toBe(true)
    expect(coincideBusqueda(yerba, '   ')).toBe(true)
  })

  it('busca parte del nombre, sin importar mayúsculas ni acentos', () => {
    expect(coincideBusqueda(yerba, 'yer')).toBe(true)
    expect(coincideBusqueda(yerba, 'MATE')).toBe(true)
    expect(coincideBusqueda({ nombre: 'Café', rubro: null }, 'cafe')).toBe(true)
    expect(coincideBusqueda({ nombre: 'Cafe', rubro: null }, 'café')).toBe(true)
  })

  it('también busca en el rubro', () => {
    expect(coincideBusqueda(yerba, 'almacen')).toBe(true)
  })

  it('todas las palabras tienen que estar, en cualquier orden', () => {
    expect(coincideBusqueda(yerba, 'mate yerba')).toBe(true)
    expect(coincideBusqueda(yerba, 'alm yer')).toBe(true)
    expect(coincideBusqueda(yerba, 'yerba cafe')).toBe(false)
  })

  it('no coincide si no está', () => {
    expect(coincideBusqueda(yerba, 'leche')).toBe(false)
  })

  it('un artículo sin rubro no falla y no coincide por "null"', () => {
    expect(coincideBusqueda(sinRubro, 'pilas')).toBe(true)
    expect(coincideBusqueda(sinRubro, 'null')).toBe(false)
  })
})

describe('estadoCantidad (lo llevado vs. lo pedido)', () => {
  it('sin nada llevado no es alerta: está pendiente', () => {
    expect(estadoCantidad(5, 0)).toBe('sin_compras')
  })
  it('por debajo: algo llevado pero menos de lo pedido (cualquier diferencia)', () => {
    expect(estadoCantidad(5, 1)).toBe('por_debajo')
    expect(estadoCantidad(5, 4.9)).toBe('por_debajo')
  })
  it('completo: justo lo pedido', () => {
    expect(estadoCantidad(5, 5)).toBe('completo')
  })
  it('por encima: cualquier cantidad de más, por poca que sea', () => {
    expect(estadoCantidad(5, 5.1)).toBe('por_encima')
    expect(estadoCantidad(5, 6)).toBe('por_encima')
  })
  it('tolera el error de float: 0.1 + 0.2 es justo 0.3, no "de más"', () => {
    expect(estadoCantidad(0.3, 0.1 + 0.2)).toBe('completo')
  })
  it('en gramos: 500 pedidos, 650 llevados → de más', () => {
    expect(estadoCantidad(500, 650)).toBe('por_encima')
  })
})

describe('esCompleto', () => {
  it('completo cuando lo llevado alcanza o supera lo pedido', () => {
    expect(esCompleto(3, 3)).toBe(true)
    expect(esCompleto(3, 4)).toBe(true)
    expect(esCompleto(3, 2.9)).toBe(false)
    expect(esCompleto(3, 0)).toBe(false)
  })

  it('tolera el error de float (0.1 + 0.2 vs 0.3)', () => {
    expect(esCompleto(0.3, 0.1 + 0.2)).toBe(true)
  })
})

describe('resolverPatchComprado', () => {
  it('comprado:true = llevo todo (la cantidad actual)', () => {
    expect(resolverPatchComprado({ comprado: true }, 4)).toEqual({ cantidadComprada: 4 })
  })

  it('comprado:true junto con una cantidad nueva usa la nueva', () => {
    expect(resolverPatchComprado({ comprado: true, cantidad: 6 }, 4)).toEqual({ cantidad: 6, cantidadComprada: 6 })
  })

  it('comprado:false = nada', () => {
    expect(resolverPatchComprado({ comprado: false }, 4)).toEqual({ cantidadComprada: 0 })
  })

  it('una cantidad_comprada explícita gana sobre el atajo', () => {
    expect(resolverPatchComprado({ comprado: true, cantidadComprada: 1 }, 4)).toEqual({ cantidadComprada: 1 })
  })

  it('sin atajo no inventa cantidadComprada', () => {
    expect(resolverPatchComprado({ cantidad: 5 }, 4)).toEqual({ cantidad: 5 })
  })

  it('nunca devuelve la clave comprado', () => {
    expect('comprado' in resolverPatchComprado({ comprado: true }, 1)).toBe(false)
  })
})

describe('parseCopiarBody', () => {
  it('valida mes y año', () => {
    expect(parseCopiarBody({ mes: 3, anio: 2026 })).toEqual({ mes: 3, anio: 2026 })
    expect(parseCopiarBody({ mes: 0, anio: 2026 })).toBeNull()
    expect(parseCopiarBody({})).toBeNull()
  })
})

describe('referenciaDe', () => {
  const f = (mes: number, anio: number, precioUnitario: number | null, cantidad = 1) => ({ mes, anio, precioUnitario, cantidad })

  it('toma la compra con precio más reciente anterior al período', () => {
    const r = referenciaDe([f(8, 2026, 100), f(10, 2026, 130, 3), f(9, 2026, 110)], { mes: 11, anio: 2026 })
    expect(r).toEqual({ precio_unitario: 130, cantidad: 3, mes: 10, anio: 2026 })
  })

  it('cruza el año y no pierde la referencia si se salteó un mes', () => {
    expect(referenciaDe([f(12, 2025, 90)], { mes: 2, anio: 2026 })?.precio_unitario).toBe(90)
  })

  it('ignora filas sin precio, del propio mes y posteriores', () => {
    const r = referenciaDe([f(10, 2026, null), f(11, 2026, 200), f(12, 2026, 300), f(7, 2026, 80)], { mes: 11, anio: 2026 })
    expect(r?.precio_unitario).toBe(80)
  })

  it('un precio en 0 cuenta como referencia', () => {
    expect(referenciaDe([f(10, 2026, 0)], { mes: 11, anio: 2026 })?.precio_unitario).toBe(0)
  })

  it('null sin historial', () => {
    expect(referenciaDe([], { mes: 11, anio: 2026 })).toBeNull()
  })
})

describe('variacionPrecio', () => {
  it('porcentaje contra la referencia', () => {
    expect(variacionPrecio(110, 100)).toBeCloseTo(10)
    expect(variacionPrecio(90, 100)).toBeCloseTo(-10)
  })
  it('null si falta un dato o la referencia es 0', () => {
    expect(variacionPrecio(null, 100)).toBeNull()
    expect(variacionPrecio(100, null)).toBeNull()
    expect(variacionPrecio(100, 0)).toBeNull()
  })
})

describe('toItemResponse', () => {
  const row = {
    id: 1, articuloId: 7, mes: 11, anio: 2026, cantidad: 3, precioUnitario: 150, cantidadComprada: 3,
    articulo: { nombre: 'Yerba', unidadId: 3, unidad: { id: 3, nombre: 'kg', subunidadDe: null }, rubroId: null, rubro: null },
  }

  it('mapea a snake_case y deriva el total', () => {
    expect(toItemResponse(row, null)).toEqual({
      id: 1, articulo_id: 7, nombre: 'Yerba', unidad_id: 3, unidad: 'kg', subunidad_de: null, mostrar_en_multiplo: false, rubro_id: null, rubro: null, mes: 11, anio: 2026,
      cantidad: 3, precio_unitario: 150, cantidad_comprada: 3, faltante: 0, exceso: 0, estado_cantidad: 'completo', comprado: true,
      total: 450, total_llevado: 450, compras: [], referencia: null,
    })
  })

  it('incluye las compras registradas, ya mapeadas', () => {
    const r = toItemResponse({ ...row, compras: [{ id: 4, itemId: 1, cantidad: 2, precioUnitario: 100, fecha: '2026-11-03', createdAt: new Date() }] }, null)
    expect(r.compras).toEqual([{ id: 4, cantidad: 2, precio_unitario: 100, fecha: '2026-11-03' }])
  })

  it('compra parcial: no está completo, calcula lo que falta y lo gastado hasta ahora', () => {
    const r = toItemResponse({ ...row, cantidadComprada: 1 }, null)
    expect(r).toMatchObject({ cantidad_comprada: 1, faltante: 2, comprado: false, total: 450, total_llevado: 150 })
  })

  it('comprar de más: completo, faltante nunca negativo y el exceso se informa', () => {
    expect(toItemResponse({ ...row, cantidadComprada: 5 }, null)).toMatchObject({ comprado: true, faltante: 0, exceso: 2, estado_cantidad: 'por_encima' })
  })

  it('compra parcial: por debajo y sin exceso', () => {
    expect(toItemResponse({ ...row, cantidadComprada: 1 }, null)).toMatchObject({ exceso: 0, estado_cantidad: 'por_debajo' })
  })

  it('sin nada comprado: sin_compras (pendiente, no alerta)', () => {
    expect(toItemResponse({ ...row, cantidadComprada: 0 }, null)).toMatchObject({ exceso: 0, estado_cantidad: 'sin_compras' })
  })

  it('con unidad g/ml expone la equivalencia para cargar el precio por kg/litro', () => {
    const r = toItemResponse({ ...row, articulo: { ...row.articulo, unidad: { id: 5, nombre: 'g', subunidadDe: 'kg' } } }, null)
    expect(r.subunidad_de).toBe('kg')
  })

  it('expone el nombre y el id del rubro cuando lo tiene', () => {
    const r = toItemResponse({ ...row, articulo: { ...row.articulo, rubroId: 2, rubro: { id: 2, nombre: 'Almacén' } } }, null)
    expect(r).toMatchObject({ rubro_id: 2, rubro: 'Almacén' })
  })

  it('sin precio el total es null (no 0)', () => {
    const r = toItemResponse({ ...row, precioUnitario: null }, null)
    expect(r.total).toBeNull()
    expect(r.total_llevado).toBeNull()
  })

  it('con compras, lo llevado es lo pagado en ellas y el total suma lo que falta al promedio', () => {
    const compras = [
      { id: 1, cantidad: 400, precioUnitario: 7.525, fecha: '2026-11-03' },
      { id: 2, cantidad: 400, precioUnitario: 0, fecha: '2026-11-03' },
      { id: 3, cantidad: 600, precioUnitario: 7.09375, fecha: '2026-11-03' },
    ]
    const r = toItemResponse({ ...row, cantidad: 2500, cantidadComprada: 1400, precioUnitario: 7.26625, compras }, null)
    expect(r.total_llevado).toBeCloseTo(7266.25)
    expect(r.total).toBeCloseTo(7266.25 + 1100 * 7.26625)
  })
})

describe('importesLinea', () => {
  const c = (cantidad: number, precioUnitario: number | null) => ({ cantidad, precioUnitario })

  it('sin compras: llevado × precio y cantidad × precio', () => {
    expect(importesLinea({ cantidad: 3, cantidadComprada: 1, precioUnitario: 100 })).toEqual({ total: 300, totalLlevado: 100 })
    expect(importesLinea({ cantidad: 3, cantidadComprada: 1, precioUnitario: null })).toEqual({ total: null, totalLlevado: null })
  })

  it('una compra a $0 cuesta 0: lo gastado no se infla al promedio', () => {
    // promedio sin el 0 = 100; llevado × promedio daría 200, pero se pagó 100
    expect(importesLinea({ cantidad: 2, cantidadComprada: 2, precioUnitario: 100, compras: [c(1, 100), c(1, 0)] }))
      .toEqual({ total: 100, totalLlevado: 100 })
  })

  it('lo que falta se estima al precio de la línea', () => {
    expect(importesLinea({ cantidad: 5, cantidadComprada: 2, precioUnitario: 100, compras: [c(1, 100), c(1, 0)] }))
      .toEqual({ total: 400, totalLlevado: 100 })
  })

  it('comprar de más no baja el total por debajo de lo pagado', () => {
    expect(importesLinea({ cantidad: 1, cantidadComprada: 3, precioUnitario: 100, compras: [c(3, 100)] }))
      .toEqual({ total: 300, totalLlevado: 300 })
  })

  it('compras sin precio se valorizan al precio de la línea; sin él, no se sabe', () => {
    expect(importesLinea({ cantidad: 2, cantidadComprada: 2, precioUnitario: 100, compras: [c(1, 100), c(1, null)] }))
      .toEqual({ total: 200, totalLlevado: 200 })
    expect(importesLinea({ cantidad: 2, cantidadComprada: 2, precioUnitario: null, compras: [c(2, null)] }))
      .toEqual({ total: null, totalLlevado: null })
  })

  it('todo a $0 sin precio en la línea: gastó 0 (dato real) y sin faltante el total es 0', () => {
    expect(importesLinea({ cantidad: 1, cantidadComprada: 1, precioUnitario: null, compras: [c(1, 0)] }))
      .toEqual({ total: 0, totalLlevado: 0 })
  })
})

describe('totalesLista', () => {
  const ref = (p: number) => ({ precio_unitario: p, cantidad: 1, mes: 10, anio: 2026 })

  it('estimado usa el precio del mes o, sin él, la referencia; gastado = lo llevado × precio', () => {
    const t = totalesLista([
      { cantidad: 2, cantidad_comprada: 2, precio_unitario: 100, referencia: ref(80) },   // completo: gastó 200, estima 200
      { cantidad: 3, cantidad_comprada: 0, precio_unitario: null, referencia: ref(50) }, // estima 150 (referencia), nada gastado
      { cantidad: 1, cantidad_comprada: 0, precio_unitario: null, referencia: null },    // sin dato
    ])
    expect(t).toEqual({ items: 3, comprados: 1, parciales: 0, excedidos: 0, pendientes: 2, gastado: 200, estimado: 350, sin_precio: 1 })
  })

  it('compras parciales: cuentan como en curso y gastan sólo lo llevado', () => {
    const t = totalesLista([
      { cantidad: 10, cantidad_comprada: 4, precio_unitario: 100, referencia: null }, // gastó 400 de 1000
      { cantidad: 2, cantidad_comprada: 2, precio_unitario: 50, referencia: null },   // completo, gastó 100
    ])
    expect(t).toMatchObject({ comprados: 1, parciales: 1, pendientes: 1, gastado: 500, estimado: 1100 })
  })

  it('un precio sin nada comprado todavía no suma a lo gastado', () => {
    const t = totalesLista([{ cantidad: 2, cantidad_comprada: 0, precio_unitario: 100, referencia: null }])
    expect(t).toMatchObject({ gastado: 0, estimado: 200 })
  })

  it('cuenta los excedidos (se llevó más de lo pedido) aparte de los parciales', () => {
    const t = totalesLista([
      { cantidad: 2, cantidad_comprada: 3, precio_unitario: 100, referencia: null }, // de más
      { cantidad: 2, cantidad_comprada: 2, precio_unitario: 100, referencia: null }, // justo
      { cantidad: 4, cantidad_comprada: 1, precio_unitario: 100, referencia: null }, // por debajo
      { cantidad: 1, cantidad_comprada: 0, precio_unitario: 100, referencia: null }, // sin empezar
    ])
    expect(t).toMatchObject({ comprados: 2, parciales: 1, excedidos: 1, pendientes: 2 })
  })

  it('si la línea trae sus importes, gastado y estimado salen de ellos (lo pagado de verdad)', () => {
    const t = totalesLista([
      { cantidad: 2, cantidad_comprada: 2, precio_unitario: 100, referencia: null, total: 100, total_llevado: 100 }, // una de las dos fue gratis
      { cantidad: 3, cantidad_comprada: 0, precio_unitario: null, referencia: ref(50), total: null, total_llevado: null },
    ])
    expect(t).toMatchObject({ gastado: 100, estimado: 250, sin_precio: 0 })
  })

  it('lista vacía', () => {
    expect(totalesLista([])).toEqual({ items: 0, comprados: 0, parciales: 0, excedidos: 0, pendientes: 0, gastado: 0, estimado: 0, sin_precio: 0 })
  })
})

describe('ultimosDeArticulo', () => {
  it('toma la cantidad de la línea más reciente y el último precio que haya tenido', () => {
    expect(ultimosDeArticulo([
      { cantidad: 3, precioUnitario: null },
      { cantidad: 2, precioUnitario: 150 },
      { cantidad: 1, precioUnitario: 100 },
    ])).toEqual({ cantidad: 3, precio: 150 })
  })
  it('sin líneas, todo null; un precio en 0 cuenta', () => {
    expect(ultimosDeArticulo([])).toEqual({ cantidad: null, precio: null })
    expect(ultimosDeArticulo([{ cantidad: 1, precioUnitario: 0 }]).precio).toBe(0)
  })
})

describe('cantidades en la unidad del artículo (g/ml)', () => {
  it('aCantidadBase: kg/l se registran ×1000, sin ruido de float', () => {
    expect(aCantidadBase(1, true)).toBe(1000)
    expect(aCantidadBase(1.1, true)).toBe(1100)
    expect(aCantidadBase(0.25, true)).toBe(250)
    expect(aCantidadBase(250, false)).toBe(250)
  })

  it('desdeCantidadBase: lo guardado en g se ve en kg', () => {
    expect(desdeCantidadBase(2500, true)).toBe(2.5)
    expect(desdeCantidadBase(1100, true)).toBe(1.1)
    expect(desdeCantidadBase(2500, false)).toBe(2500)
  })

  it('textoAlCambiarUnidad convierte lo que todavía es la referencia', () => {
    expect(textoAlCambiarUnidad('2500', false, true, 2500)).toBe('2.5')
    expect(textoAlCambiarUnidad('2,5', true, false, 2500)).toBe('2500')
  })

  it('textoAlCambiarUnidad conserva un número ya tipeado (pasa a significar kg)', () => {
    expect(textoAlCambiarUnidad('1', false, true, 2500)).toBe('1')
    expect(textoAlCambiarUnidad('1', false, true, null)).toBe('1')
    expect(textoAlCambiarUnidad('', false, true, 2500)).toBe('')
    expect(textoAlCambiarUnidad('abc', false, true, 2500)).toBe('abc')
  })

  it('esUnidadMultiplo reconoce kg y litros (sin acentos, mayúsculas ni puntos)', () => {
    for (const n of ['kg', 'Kg.', 'kilo', 'Kilogramos']) expect(esUnidadMultiplo(n)).toBe('kg')
    for (const n of ['l', 'L', 'lt', 'Litros']) expect(esUnidadMultiplo(n)).toBe('l')
    for (const n of ['m', 'Mts.', 'metro', 'Metros']) expect(esUnidadMultiplo(n)).toBe('m')
    for (const n of ['g', 'ml', 'mm', 'un', 'pack']) expect(esUnidadMultiplo(n)).toBeNull()
  })
})

describe('metros / milímetros', () => {
  it('mm se registra y m se elige al cargar: 1,5 m → 1500 mm', () => {
    expect(inferirSubunidad('mm')).toBe('m')
    expect(inferirSubunidad('Milímetros')).toBe('m')
    expect(parseSubunidadDe('m')).toBe('m')
    expect(aCantidadBase(1.5, true)).toBe(1500)
  })

  it('el precio se ve por metro: $19,05/m guardado como $0,01905/mm', () => {
    expect(aPrecioBase(0.01905, 'm')).toBeCloseTo(19.05)
    expect(desdePrecioBase(19.05, 'm')).toBeCloseTo(0.01905)
  })

  it('una unidad "m" se rechaza pidiendo mm', () => {
    expect(errorMultiplo('m')).toContain('"mm"')
    expect(errorMultiplo('kg')).toContain('"g"')
    expect(errorMultiplo('l')).toContain('"ml"')
  })
})

describe('precargaCompra', () => {
  const linea = { faltante: 3, cantidad: 5, precio_unitario: 1000, referencia: { precio_unitario: 900 } }
  const art = { ultima_cantidad: 4, ultimo_precio: 800 }

  it('con línea en el mes: lo que falta y el precio del mes', () => {
    expect(precargaCompra(linea, art)).toEqual({ cantidad: 3, precio_unitario: 1000 })
  })

  it('línea ya completa: ofrece lo pedido, no 0', () => {
    expect(precargaCompra({ ...linea, faltante: 0 }, art).cantidad).toBe(5)
  })

  it('línea sin precio: cae a la referencia y después al último precio del artículo', () => {
    expect(precargaCompra({ ...linea, precio_unitario: null }, art).precio_unitario).toBe(900)
    expect(precargaCompra({ ...linea, precio_unitario: null, referencia: null }, art).precio_unitario).toBe(800)
    expect(precargaCompra({ ...linea, precio_unitario: null, referencia: null }, null).precio_unitario).toBeNull()
  })

  it('sin línea: la última cantidad y el último precio del artículo', () => {
    expect(precargaCompra(null, art)).toEqual({ cantidad: 4, precio_unitario: 800 })
    expect(precargaCompra(null, { ultima_cantidad: null, ultimo_precio: null })).toEqual({ cantidad: null, precio_unitario: null })
    expect(precargaCompra(null, null)).toEqual({ cantidad: null, precio_unitario: null })
  })
})

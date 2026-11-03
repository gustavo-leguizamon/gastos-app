import { describe, it, expect } from 'vitest'
import {
  parseItemBody,
  parseItemPatch,
  parseCopiarBody,
  parseNombreCatalogo,
  esCompleto,
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
} from './lista-compras-compute'

describe('parseItemBody', () => {
  const ok = { nombre: '  Leche   entera ', unidad_id: 1, mes: 11, anio: 2026 }

  it('normaliza el nombre y aplica defaults (cantidad 1, sin rubro ni precio)', () => {
    expect(parseItemBody(ok)).toEqual({
      nombre: 'Leche entera', unidadId: 1, rubroId: null, cantidad: 1, precioUnitario: null, mes: 11, anio: 2026,
    })
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
      id: 1, articulo_id: 7, nombre: 'Yerba', unidad_id: 3, unidad: 'kg', subunidad_de: null, rubro_id: null, rubro: null, mes: 11, anio: 2026,
      cantidad: 3, precio_unitario: 150, cantidad_comprada: 3, faltante: 0, comprado: true,
      total: 450, total_llevado: 450, referencia: null,
    })
  })

  it('compra parcial: no está completo, calcula lo que falta y lo gastado hasta ahora', () => {
    const r = toItemResponse({ ...row, cantidadComprada: 1 }, null)
    expect(r).toMatchObject({ cantidad_comprada: 1, faltante: 2, comprado: false, total: 450, total_llevado: 150 })
  })

  it('comprar de más: completo y faltante nunca negativo', () => {
    expect(toItemResponse({ ...row, cantidadComprada: 5 }, null)).toMatchObject({ comprado: true, faltante: 0 })
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
})

describe('totalesLista', () => {
  const ref = (p: number) => ({ precio_unitario: p, cantidad: 1, mes: 10, anio: 2026 })

  it('estimado usa el precio del mes o, sin él, la referencia; gastado = lo llevado × precio', () => {
    const t = totalesLista([
      { cantidad: 2, cantidad_comprada: 2, precio_unitario: 100, referencia: ref(80) },   // completo: gastó 200, estima 200
      { cantidad: 3, cantidad_comprada: 0, precio_unitario: null, referencia: ref(50) }, // estima 150 (referencia), nada gastado
      { cantidad: 1, cantidad_comprada: 0, precio_unitario: null, referencia: null },    // sin dato
    ])
    expect(t).toEqual({ items: 3, comprados: 1, parciales: 0, pendientes: 2, gastado: 200, estimado: 350, sin_precio: 1 })
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

  it('lista vacía', () => {
    expect(totalesLista([])).toEqual({ items: 0, comprados: 0, parciales: 0, pendientes: 0, gastado: 0, estimado: 0, sin_precio: 0 })
  })
})

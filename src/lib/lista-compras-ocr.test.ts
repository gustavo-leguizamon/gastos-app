import { describe, expect, it } from 'vitest'
import { fechaDeTicket, parseImporte, parseLineasOcr, precioDeTicket, resolverUnidad } from './lista-compras-ocr'

const UNIDADES = ['un', 'kg', 'g', 'l', 'ml', 'Paquete']

describe('parseImporte', () => {
  it('entiende coma decimal con puntos de miles y punto decimal', () => {
    expect(parseImporte('1.234,50')).toBe(1234.5)
    expect(parseImporte('500,00')).toBe(500)
    expect(parseImporte('12.50')).toBe(12.5)
  })
  it('rechaza lo que no es un importe', () => {
    expect(parseImporte('abc')).toBeNull()
    expect(parseImporte('1234')).toBeNull()
  })
})

describe('resolverUnidad', () => {
  it('resuelve sinónimos a la unidad existente', () => {
    expect(resolverUnidad('Kgs.', UNIDADES)).toBe('kg')
    expect(resolverUnidad('litros', UNIDADES)).toBe('l')
    expect(resolverUnidad('gr', UNIDADES)).toBe('g')
  })
  it('acepta unidades propias por nombre y devuelve null si no existe', () => {
    expect(resolverUnidad('paquete', UNIDADES)).toBe('Paquete')
    expect(resolverUnidad('kg', ['un'])).toBeNull()
  })
})

describe('parseLineasOcr — lista escrita', () => {
  it('cantidad y unidad al comienzo', () => {
    expect(parseLineasOcr('2 kg manzanas\n500 g queso\n3 leches', UNIDADES)).toEqual([
      { nombre: 'Manzanas', cantidad: 2, unidad: 'kg', total: null },
      { nombre: 'Queso', cantidad: 500, unidad: 'g', total: null },
      { nombre: 'Leches', cantidad: 3, unidad: null, total: null },
    ])
  })

  it('cantidad pegada a la unidad y con "de"', () => {
    expect(parseLineasOcr('2kg manzanas\n1,5 l de aceite', UNIDADES)).toEqual([
      { nombre: 'Manzanas', cantidad: 2, unidad: 'kg', total: null },
      { nombre: 'Aceite', cantidad: 1.5, unidad: 'l', total: null },
    ])
  })

  it('cantidad al final: "manzanas 2 kg", "leche x2"', () => {
    expect(parseLineasOcr('manzanas 2 kg\nleche x2\nyerba x 3', UNIDADES)).toEqual([
      { nombre: 'Manzanas', cantidad: 2, unidad: 'kg', total: null },
      { nombre: 'Leche', cantidad: 2, unidad: null, total: null },
      { nombre: 'Yerba', cantidad: 3, unidad: null, total: null },
    ])
  })

  it('sin cantidad es 1; ignora viñetas y numeración', () => {
    expect(parseLineasOcr('- pan\n• queso\n1) yerba\n2. azucar', UNIDADES).map((c) => [c.nombre, c.cantidad])).toEqual([
      ['Pan', 1], ['Queso', 1], ['Yerba', 1], ['Azucar', 1],
    ])
  })

  it('fracciones y unidad que no existe en la tabla', () => {
    expect(parseLineasOcr('1/2 kg pan', UNIDADES)[0]).toMatchObject({ nombre: 'Pan', cantidad: 0.5, unidad: 'kg' })
    expect(parseLineasOcr('2 kg harina', ['un'])[0]).toMatchObject({ nombre: 'Harina', cantidad: 2, unidad: null })
  })

  it('un nombre que empieza como una unidad no se confunde con ella', () => {
    expect(parseLineasOcr('2 uvas', UNIDADES)[0]).toMatchObject({ nombre: 'Uvas', cantidad: 2, unidad: null })
  })

  it('suma los repetidos sin distinguir mayúsculas ni acentos', () => {
    expect(parseLineasOcr('2 leche\nLECHE\n1 Léche', UNIDADES)).toEqual([
      { nombre: 'Leche', cantidad: 4, unidad: null, total: null },
    ])
  })

  it('descarta líneas vacías o sin letras', () => {
    expect(parseLineasOcr('\n   \n12345\n--\n', UNIDADES)).toEqual([])
  })
})

describe('parseLineasOcr — ticket', () => {
  it('toma el importe final como total y no confunde el tamaño del producto con la cantidad', () => {
    expect(parseLineasOcr('LECHE ENTERA 1L   1.234,50\nGALLETITAS 3 EN 1 2.100,00', UNIDADES)).toEqual([
      { nombre: 'Leche entera 1l', cantidad: 1, unidad: null, total: 1234.5 },
      { nombre: 'Galletitas 3 en 1', cantidad: 1, unidad: null, total: 2100 },
    ])
  })

  it('cantidad explícita "2 x" y código de barras al comienzo', () => {
    expect(parseLineasOcr('2 x CAFE MOLIDO 6.000,00\n7791234567890 YERBA MATE 3.500,00', UNIDADES)).toEqual([
      { nombre: 'Cafe molido', cantidad: 2, unidad: null, total: 6000 },
      { nombre: 'Yerba mate', cantidad: 1, unidad: null, total: 3500 },
    ])
  })

  it('descarta totales, CUIT, forma de pago y similares', () => {
    const texto = [
      'SUPERMERCADO EL SOL',
      'CUIT 30-12345678-9',
      'FECHA 03/11/2026',
      'PAN LACTAL 1.500,00',
      'SUBTOTAL 1.500,00',
      'TOTAL 1.500,00',
      'EFECTIVO 2.000,00',
      'VUELTO 500,00',
      'GRACIAS POR SU COMPRA',
    ].join('\n')
    expect(parseLineasOcr(texto, UNIDADES).map((c) => c.nombre)).toContain('Pan lactal')
    expect(parseLineasOcr(texto, UNIDADES).map((c) => c.nombre)).not.toContain('Total')
    expect(parseLineasOcr(texto, UNIDADES).find((c) => c.nombre === 'Pan lactal')?.total).toBe(1500)
    expect(parseLineasOcr(texto, UNIDADES).some((c) => /efectivo|vuelto|cuit|gracias/i.test(c.nombre))).toBe(false)
  })

  it('suma los importes de un artículo repetido', () => {
    expect(parseLineasOcr('PAN 1.000,00\nPAN 1.000,00', UNIDADES)).toEqual([
      { nombre: 'Pan', cantidad: 2, unidad: null, total: 2000 },
    ])
  })
})

describe('fechaDeTicket', () => {
  const HOY = '2026-11-03'
  it('lee dd/mm/aaaa, dd-mm-aa y dd.mm.aaaa', () => {
    expect(fechaDeTicket('FECHA 28/10/2026 HORA 10:15', HOY)).toBe('2026-10-28')
    expect(fechaDeTicket('2-11-26', HOY)).toBe('2026-11-02')
    expect(fechaDeTicket('01.11.2026', HOY)).toBe('2026-11-01')
  })
  it('salta las inválidas y las futuras, y devuelve null si no queda ninguna', () => {
    expect(fechaDeTicket('31/02/2026 y 15/10/2026', HOY)).toBe('2026-10-15')
    expect(fechaDeTicket('15/12/2026', HOY)).toBeNull()
    expect(fechaDeTicket('sin fecha 1.234,50', HOY)).toBeNull()
  })
})

describe('precioDeTicket', () => {
  it('divide el total por la cantidad y redondea a centavos', () => {
    expect(precioDeTicket(6000, 2)).toBe(3000)
    expect(precioDeTicket(100, 3)).toBe(33.33)
  })
  it('null sin importe o con cantidad inválida', () => {
    expect(precioDeTicket(null, 2)).toBeNull()
    expect(precioDeTicket(100, 0)).toBeNull()
  })
})

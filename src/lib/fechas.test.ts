import { describe, it, expect } from 'vitest'
import { shiftMonth, mesesPrevios, resolvePeriodoTarjeta, resolvePeriodoTarjetaByCierres, fechaEnTimeZone, diasEntre, TZ_ARGENTINA } from './fechas'

describe('mesesPrevios', () => {
  it('devuelve los meses anteriores, del más viejo al más reciente', () => {
    expect(mesesPrevios(6, 2026, 3)).toEqual([
      { mes: 3, anio: 2026 },
      { mes: 4, anio: 2026 },
      { mes: 5, anio: 2026 },
    ])
  })

  it('no incluye el mes de referencia', () => {
    expect(mesesPrevios(6, 2026, 3)).not.toContainEqual({ mes: 6, anio: 2026 })
  })

  it('cruza el cambio de año', () => {
    expect(mesesPrevios(2, 2026, 3)).toEqual([
      { mes: 11, anio: 2025 },
      { mes: 12, anio: 2025 },
      { mes: 1, anio: 2026 },
    ])
  })

  it('sin meses pedidos la ventana es vacía', () => {
    expect(mesesPrevios(6, 2026, 0)).toEqual([])
    expect(mesesPrevios(6, 2026, -1)).toEqual([])
  })
})

describe('fechaEnTimeZone', () => {
  it('formatea como YYYY-MM-DD', () => {
    expect(fechaEnTimeZone(new Date('2026-08-14T14:00:00Z'))).toBe('2026-08-14')
  })

  it('usa el día de Argentina, no el de UTC', () => {
    // 01:30 UTC del 15 es todavía el 14 a las 22:30 en Argentina (UTC-3).
    expect(fechaEnTimeZone(new Date('2026-08-15T01:30:00Z'), TZ_ARGENTINA)).toBe('2026-08-14')
  })

  it('el cron de las 11:00 UTC cae en el mismo día en Argentina', () => {
    expect(fechaEnTimeZone(new Date('2026-08-14T11:00:00Z'))).toBe('2026-08-14')
  })

  it('respeta un timezone explícito', () => {
    expect(fechaEnTimeZone(new Date('2026-08-14T23:00:00Z'), 'UTC')).toBe('2026-08-14')
    expect(fechaEnTimeZone(new Date('2026-08-14T23:00:00Z'), 'Asia/Tokyo')).toBe('2026-08-15')
  })
})

describe('shiftMonth', () => {
  it('avanza dentro del mismo año', () => {
    expect(shiftMonth(6, 2026, 1)).toEqual({ mes: 7, anio: 2026 })
    expect(shiftMonth(6, 2026, 2)).toEqual({ mes: 8, anio: 2026 })
  })

  it('hace wraparound de diciembre al año siguiente', () => {
    expect(shiftMonth(12, 2026, 1)).toEqual({ mes: 1, anio: 2027 })
    expect(shiftMonth(11, 2026, 2)).toEqual({ mes: 1, anio: 2027 })
    expect(shiftMonth(12, 2026, 2)).toEqual({ mes: 2, anio: 2027 })
  })

  it('retrocede con n negativo cruzando el año', () => {
    expect(shiftMonth(1, 2026, -1)).toEqual({ mes: 12, anio: 2025 })
    expect(shiftMonth(2, 2026, -3)).toEqual({ mes: 11, anio: 2025 })
  })

  it('n = 0 devuelve el mismo par', () => {
    expect(shiftMonth(5, 2026, 0)).toEqual({ mes: 5, anio: 2026 })
  })

  it('salta varios años', () => {
    expect(shiftMonth(6, 2026, 24)).toEqual({ mes: 6, anio: 2028 })
  })
})

describe('resolvePeriodoTarjeta', () => {
  // Tarjeta que cierra el día 2.
  it('pago con día posterior al cierre → resumen del mes siguiente', () => {
    // 25-jun (día 25 > 2) → julio
    expect(resolvePeriodoTarjeta('2026-06-25', 2)).toEqual({ mes: 7, anio: 2026 })
  })

  it('pago con día anterior al cierre → resumen del propio mes del pago', () => {
    // 01-jul (día 1 < 2) → julio (el bug que se corrige: antes caía en agosto)
    expect(resolvePeriodoTarjeta('2026-07-01', 2)).toEqual({ mes: 7, anio: 2026 })
  })

  it('pago justo el día de cierre → mismo mes (se incluye el día de cierre)', () => {
    expect(resolvePeriodoTarjeta('2026-07-02', 2)).toEqual({ mes: 7, anio: 2026 })
  })

  it('hace wraparound de año cuando el pago es posterior al cierre en diciembre', () => {
    // 20-dic (día 20 > 2) → enero del año siguiente
    expect(resolvePeriodoTarjeta('2026-12-20', 2)).toEqual({ mes: 1, anio: 2027 })
  })

  it('no depende del mes fuente: 25-jun y 01-jul con cierre día 2 caen ambos en julio', () => {
    expect(resolvePeriodoTarjeta('2026-06-25', 2)).toEqual(resolvePeriodoTarjeta('2026-07-01', 2))
  })
})

describe('resolvePeriodoTarjetaByCierres', () => {
  // Escenario real (Visa Galicia): el resumen de junio cierra el 28/05 y el próximo
  // cierre es el 02/07; el de julio cierra el 02/07.
  const visa = [
    { mes: 5, anio: 2026, fechaCierre: '2026-04-30' },
    { mes: 6, anio: 2026, fechaCierre: '2026-05-28' },
    { mes: 7, anio: 2026, fechaCierre: '2026-07-02' },
  ]

  it('pago posterior al cierre del resumen de junio (28/05) cae en el resumen que cierra después (julio)', () => {
    // 26-jun: primer cierre >= 26/06 es 02/07 → resumen de julio (NO junio, como daba el heurístico por día)
    expect(resolvePeriodoTarjetaByCierres('2026-06-26', visa)).toEqual({ mes: 7, anio: 2026 })
  })

  it('pago anterior al cierre de junio (28/05) cae en el resumen de junio', () => {
    // 20-may: primer cierre >= 20/05 es 28/05 → resumen de junio
    expect(resolvePeriodoTarjetaByCierres('2026-05-20', visa)).toEqual({ mes: 6, anio: 2026 })
  })

  it('pago justo el día del cierre cae en ese resumen (cierre inclusivo)', () => {
    // 02-jul == fechaCierre de julio → resumen de julio
    expect(resolvePeriodoTarjetaByCierres('2026-07-02', visa)).toEqual({ mes: 7, anio: 2026 })
  })

  it('pago anterior a todos los cierres cae en el resumen que cierra primero', () => {
    // 10-abr: primer cierre >= 10/04 es 30/04 → resumen de mayo
    expect(resolvePeriodoTarjetaByCierres('2026-04-10', visa)).toEqual({ mes: 5, anio: 2026 })
  })

  it('devuelve null cuando no hay ningún fechaCierre configurado', () => {
    expect(resolvePeriodoTarjetaByCierres('2026-06-26', [])).toBeNull()
    expect(resolvePeriodoTarjetaByCierres('2026-06-26', [{ mes: 6, anio: 2026, fechaCierre: null }])).toBeNull()
  })

  it('fallback: pago posterior a todos los cierres conocidos usa el día del último cierre', () => {
    // Solo hay cierres hasta el 02/07 (día 2). Pago 20-ago (día 20 > 2) → proyecta a septiembre.
    expect(resolvePeriodoTarjetaByCierres('2026-08-20', visa)).toEqual({ mes: 9, anio: 2026 })
  })

  it('ignora el orden de entrada de los cierres (los ordena por fecha)', () => {
    const desordenado = [visa[2], visa[0], visa[1]]
    expect(resolvePeriodoTarjetaByCierres('2026-06-26', desordenado)).toEqual({ mes: 7, anio: 2026 })
  })
})

describe('diasEntre', () => {
  it('cuenta los días entre dos fechas del mismo mes', () => {
    expect(diasEntre('2026-08-10', '2026-08-14')).toBe(4)
  })

  it('la misma fecha da 0', () => {
    expect(diasEntre('2026-08-14', '2026-08-14')).toBe(0)
  })

  it('es negativo si `hasta` es anterior', () => {
    expect(diasEntre('2026-08-14', '2026-08-10')).toBe(-4)
  })

  it('cruza meses y años', () => {
    expect(diasEntre('2026-07-30', '2026-08-02')).toBe(3)
    expect(diasEntre('2025-12-30', '2026-01-02')).toBe(3)
  })

  it('cuenta el 29 de febrero de un año bisiesto', () => {
    expect(diasEntre('2024-02-28', '2024-03-01')).toBe(2)
    expect(diasEntre('2026-02-28', '2026-03-01')).toBe(1)
  })

  it('no se corre por el cambio de horario de verano', () => {
    // Marzo/noviembre son los meses donde otros timezones cambian de hora: si la fecha se
    // construyera como local, alguna de estas diferencias daría 0.958 o 1.04 días.
    expect(diasEntre('2026-03-08', '2026-03-09')).toBe(1)
    expect(diasEntre('2026-11-01', '2026-11-02')).toBe(1)
  })

  it('devuelve null con formato o rangos inválidos', () => {
    expect(diasEntre('14/08/2026', '2026-08-14')).toBeNull()
    expect(diasEntre('2026-08-14', '')).toBeNull()
    expect(diasEntre('2026-13-01', '2026-08-14')).toBeNull()
    expect(diasEntre('2026-08-00', '2026-08-14')).toBeNull()
  })
})

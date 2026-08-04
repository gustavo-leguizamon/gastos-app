import { describe, it, expect } from 'vitest'
import {
  ICONO_MAX_PX,
  MAX_FILE_BYTES,
  validateIconoFile,
  computeFitSize,
  dataUriBytes,
  isIconoDataUri,
} from './imagen-icono'

describe('validateIconoFile', () => {
  it('acepta los formatos soportados dentro del tope de tamaño', () => {
    expect(validateIconoFile({ type: 'image/png', size: 1024 })).toBeNull()
    expect(validateIconoFile({ type: 'image/jpeg', size: 1024 })).toBeNull()
    expect(validateIconoFile({ type: 'image/webp', size: 1024 })).toBeNull()
    expect(validateIconoFile({ type: 'image/gif', size: 1024 })).toBeNull()
    expect(validateIconoFile({ type: 'image/svg+xml', size: 1024 })).toBeNull()
  })

  it('rechaza formatos no soportados', () => {
    expect(validateIconoFile({ type: 'application/pdf', size: 1024 })).toMatch(/Formato/)
    expect(validateIconoFile({ type: 'image/tiff', size: 1024 })).toMatch(/Formato/)
    expect(validateIconoFile({ type: '', size: 1024 })).toMatch(/Formato/)
  })

  it('rechaza archivos que superan el máximo', () => {
    expect(validateIconoFile({ type: 'image/png', size: MAX_FILE_BYTES + 1 })).toMatch(/supera/)
    expect(validateIconoFile({ type: 'image/png', size: MAX_FILE_BYTES })).toBeNull()
  })

  it('rechaza la ausencia de archivo', () => {
    expect(validateIconoFile(null)).toMatch(/No se seleccionó/)
    expect(validateIconoFile(undefined)).toMatch(/No se seleccionó/)
  })
})

describe('computeFitSize', () => {
  it('escala el lado mayor a ICONO_MAX_PX manteniendo la relación de aspecto', () => {
    expect(computeFitSize(400, 200)).toEqual({ width: ICONO_MAX_PX, height: ICONO_MAX_PX / 2 })
    expect(computeFitSize(200, 400)).toEqual({ width: ICONO_MAX_PX / 2, height: ICONO_MAX_PX })
    expect(computeFitSize(500, 500)).toEqual({ width: ICONO_MAX_PX, height: ICONO_MAX_PX })
  })

  it('no agranda imágenes más chicas que el máximo', () => {
    expect(computeFitSize(40, 20)).toEqual({ width: 40, height: 20 })
  })

  it('nunca devuelve un lado en 0', () => {
    expect(computeFitSize(1000, 3)).toEqual({ width: ICONO_MAX_PX, height: 1 })
  })

  it('cae al cuadrado máximo con dimensiones inválidas', () => {
    expect(computeFitSize(0, 0)).toEqual({ width: ICONO_MAX_PX, height: ICONO_MAX_PX })
    expect(computeFitSize(NaN, 100)).toEqual({ width: ICONO_MAX_PX, height: ICONO_MAX_PX })
  })

  it('respeta un máximo explícito', () => {
    expect(computeFitSize(400, 400, 32)).toEqual({ width: 32, height: 32 })
  })
})

describe('dataUriBytes', () => {
  it('calcula los bytes del payload base64 descontando el padding', () => {
    // 'AAAA' → 3 bytes; 'AAA=' → 2 bytes; 'AA==' → 1 byte.
    expect(dataUriBytes('data:image/png;base64,AAAA')).toBe(3)
    expect(dataUriBytes('data:image/png;base64,AAA=')).toBe(2)
    expect(dataUriBytes('data:image/png;base64,AA==')).toBe(1)
  })
})

describe('isIconoDataUri', () => {
  it('acepta data URIs de imagen en base64', () => {
    expect(isIconoDataUri('data:image/png;base64,AAAA')).toBe(true)
    expect(isIconoDataUri('data:image/svg+xml;base64,AAAA')).toBe(true)
  })

  it('rechaza cualquier otra cosa', () => {
    expect(isIconoDataUri('https://banco.com/logo.png')).toBe(false)
    expect(isIconoDataUri('data:text/html;base64,AAAA')).toBe(false)
    expect(isIconoDataUri('data:image/png,AAAA')).toBe(false)
    expect(isIconoDataUri('')).toBe(false)
    expect(isIconoDataUri(null)).toBe(false)
    expect(isIconoDataUri(undefined)).toBe(false)
  })
})

import { describe, expect, it } from 'vitest'
import { mejorCoincidencia } from './lista-compras-match'

const ART = [
  { id: 1, nombre: 'Azúcar' },
  { id: 2, nombre: 'Afeitadora' },
  { id: 3, nombre: 'Leche' },
  { id: 4, nombre: 'Leche descremada' },
  { id: 5, nombre: 'Yerba mate' },
  { id: 6, nombre: 'Papel higiénico' },
]

describe('mejorCoincidencia', () => {
  it('encuentra el artículo propio dentro de una descripción larga', () => {
    expect(mejorCoincidencia('Afeitadora Gillette Prestoarba3 2 Unidades La', ART)?.id).toBe(2)
  })

  it('tolera las letras que confunde el OCR', () => {
    expect(mejorCoincidencia('MEX Anicar Blanco Ledesma Refinado Superior kg E', ART)?.id).toBe(1)
  })

  it('ignora acentos, mayúsculas y plurales', () => {
    expect(mejorCoincidencia('AZUCAR LEDESMA 1KG', ART)?.id).toBe(1)
    expect(mejorCoincidencia('leches la serenisima', ART)?.id).toBe(3)
  })

  it('exige todas las palabras de un artículo de varias, y prefiere el más específico', () => {
    expect(mejorCoincidencia('LECHE DESCREMADA SANCOR 1L', ART)?.id).toBe(4)
    expect(mejorCoincidencia('LECHE ENTERA SANCOR 1L', ART)?.id).toBe(3)
    // Sólo una de las dos palabras de "Yerba mate" no alcanza.
    expect(mejorCoincidencia('MATE COCIDO TARAGUI', ART)).toBeNull()
  })

  it('devuelve null si nada se parece o no hay palabras útiles', () => {
    expect(mejorCoincidencia('Desodorante Rexona 150 ml', ART)).toBeNull()
    expect(mejorCoincidencia('12 34 -', ART)).toBeNull()
    expect(mejorCoincidencia('Leche', [])).toBeNull()
  })

  it('las palabras cortas no coinciden por parecido', () => {
    expect(mejorCoincidencia('Lache entera', [{ id: 9, nombre: 'Lote' }])).toBeNull()
  })
})

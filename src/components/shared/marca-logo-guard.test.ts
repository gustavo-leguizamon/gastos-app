import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join, relative, sep } from 'path'

/**
 * Guard estructural: la marca de una tarjeta (Visa, Mastercard…) se dibuja **sólo** con
 * `MarcaLogo`. Pasó más de una vez que un lugar nuevo usara otro formato (íconos
 * monocromos de `react-icons`, un SVG copiado con otros colores) y quedara distinto al
 * resto. Con un solo componente, un cambio de estilo aplica en toda la app.
 *
 * Qué se prohíbe fuera de `MarcaLogo.tsx` / `src/lib/marcas.ts`:
 * - los íconos de tarjeta de `react-icons` (`FaCc*`, `SiVisa`, `SiMastercard`…);
 * - hardcodear los colores de fondo de las marcas (señal de un logo copiado a mano).
 */

const SRC = join(process.cwd(), 'src')
const PERMITIDOS = new Set([
  join('components', 'shared', 'MarcaLogo.tsx'),
  join('lib', 'marcas.ts'),
  join('lib', 'marcas.test.ts'),
  join('components', 'shared', 'marca-logo-guard.test.ts'),
])

function archivos(dir: string): string[] {
  return readdirSync(dir).flatMap(entry => {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) return archivos(full)
    return /\.(tsx?|jsx?)$/.test(entry) ? [full] : []
  })
}

const ICONOS_MARCA = /\b(FaCc\w+|FaCcVisa|SiVisa|SiMastercard|SiAmericanexpress|SiDinersclub|SiDiscover|SiJcb)\b/
// Fondos de los logos de marca (Visa, Amex, Diners, Cabal). El resto se comparte con otros usos legítimos.
const COLORES_MARCA = /#(1a1f71|2e77bb|0079be|0a5e2a)\b/i

describe('marca de tarjeta: sólo MarcaLogo', () => {
  const candidatos = archivos(SRC).filter(f => !PERMITIDOS.has(relative(SRC, f).split('/').join(sep)))

  it('nadie usa íconos de tarjeta de react-icons', () => {
    const malos = candidatos.filter(f => ICONOS_MARCA.test(readFileSync(f, 'utf8')))
    expect(malos.map(f => relative(SRC, f))).toEqual([])
  })

  it('nadie hardcodea los colores de las marcas (usar MarcaLogo / marcaColor)', () => {
    const malos = candidatos.filter(f => COLORES_MARCA.test(readFileSync(f, 'utf8')))
    expect(malos.map(f => relative(SRC, f))).toEqual([])
  })
})

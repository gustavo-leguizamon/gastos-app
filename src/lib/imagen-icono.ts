// Carga de iconos de banco: el usuario sube una imagen, se redimensiona en el
// cliente y se guarda como data URI en `Tarjeta.bancoIcono` (no hay storage de
// archivos en el proyecto). Los helpers puros de acá están testeados en
// `imagen-icono.test.ts`; `fileToIconoDataUri` usa APIs del browser.

/** Lado máximo del icono ya redimensionado (px). Se muestra a 18–28px. */
export const ICONO_MAX_PX = 96

/** Tope del archivo original que aceptamos leer (4 MB). */
export const MAX_FILE_BYTES = 4 * 1024 * 1024

/** Tope del data URI resultante (~120 KB), para no inflar la fila de Tarjeta. */
export const MAX_DATA_URI_BYTES = 120 * 1024

const TIPOS_ACEPTADOS = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml']

export interface ArchivoIcono {
  type: string
  size: number
}

/**
 * Valida el archivo elegido antes de leerlo. Devuelve el mensaje de error a
 * mostrar, o `null` si está OK.
 */
export function validateIconoFile(file: ArchivoIcono | null | undefined): string | null {
  if (!file) return 'No se seleccionó ningún archivo'
  if (!TIPOS_ACEPTADOS.includes(file.type)) return 'Formato no soportado (usá PNG, JPG, WEBP, GIF o SVG)'
  if (file.size > MAX_FILE_BYTES) return `La imagen supera el máximo de ${Math.round(MAX_FILE_BYTES / 1024 / 1024)} MB`
  return null
}

/**
 * Escala (w, h) para que el lado mayor sea `max`, manteniendo la relación de
 * aspecto. Nunca agranda una imagen más chica que `max` ni devuelve 0.
 */
export function computeFitSize(w: number, h: number, max = ICONO_MAX_PX): { width: number; height: number } {
  if (!(w > 0) || !(h > 0)) return { width: max, height: max }
  const ratio = Math.min(1, max / Math.max(w, h))
  return {
    width: Math.max(1, Math.round(w * ratio)),
    height: Math.max(1, Math.round(h * ratio)),
  }
}

/** Bytes aproximados que ocupa el payload base64 de un data URI. */
export function dataUriBytes(dataUri: string): number {
  const base64 = dataUri.slice(dataUri.indexOf(',') + 1)
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0
  return Math.max(0, Math.floor((base64.length * 3) / 4) - padding)
}

/** `true` si el string parece un data URI de imagen (lo que persistimos). */
export function isIconoDataUri(value: string | null | undefined): boolean {
  return typeof value === 'string' && /^data:image\/[a-z0-9.+-]+;base64,/i.test(value)
}

/**
 * Lee el archivo, lo redimensiona a `ICONO_MAX_PX` en un canvas y devuelve el
 * data URI PNG. Los SVG se guardan tal cual (son vectoriales, no hace falta
 * rasterizarlos). Rechaza si el resultado excede `MAX_DATA_URI_BYTES`.
 * Solo corre en el browser.
 */
export function fileToIconoDataUri(file: File): Promise<string> {
  const error = validateIconoFile(file)
  if (error) return Promise.reject(new Error(error))

  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('No se pudo leer la imagen'))
    reader.onload = () => {
      const original = String(reader.result)

      const finish = (dataUri: string) => {
        if (dataUriBytes(dataUri) > MAX_DATA_URI_BYTES) {
          reject(new Error('La imagen es demasiado pesada incluso redimensionada — probá con un PNG más simple'))
          return
        }
        resolve(dataUri)
      }

      if (file.type === 'image/svg+xml') {
        finish(original)
        return
      }

      const img = new Image()
      img.onerror = () => reject(new Error('El archivo no es una imagen válida'))
      img.onload = () => {
        const { width, height } = computeFitSize(img.naturalWidth, img.naturalHeight)
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('No se pudo procesar la imagen'))
          return
        }
        ctx.drawImage(img, 0, 0, width, height)
        finish(canvas.toDataURL('image/png'))
      }
      img.src = original
    }
    reader.readAsDataURL(file)
  })
}

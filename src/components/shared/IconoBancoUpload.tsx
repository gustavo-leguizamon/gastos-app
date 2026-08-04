'use client'

import { useRef, useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import UploadIcon from '@mui/icons-material/Upload'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import BancoLogo from './BancoLogo'
import { fileToIconoDataUri } from '@/lib/imagen-icono'

interface Props {
  /** Data URI actual (`banco_icono`) o `null`. */
  value: string | null
  onChange: (dataUri: string | null) => void
  /** Slug y texto del banco, para previsualizar el fallback cuando no hay imagen. */
  bancoLogo?: string | null
  bancoTexto?: string | null
}

/**
 * Subida del icono del banco: elige un archivo, lo redimensiona en el cliente
 * (`fileToIconoDataUri`) y devuelve el data URI por `onChange`. Mientras no haya
 * imagen, el preview muestra el badge de la lista fija (o nada si no resuelve).
 */
export default function IconoBancoUpload({ value, onChange, bancoLogo, bancoTexto }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)

  const handleFile = async (file: File | undefined) => {
    if (!file) return
    setError(null)
    try {
      onChange(await fileToIconoDataUri(file))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar la imagen')
    }
    // Permite volver a elegir el mismo archivo después de un error o un borrado.
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box
          sx={{
            width: 40,
            height: 40,
            border: '1px dashed',
            borderColor: 'divider',
            borderRadius: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <BancoLogo banco={bancoLogo} icono={value} bancoTexto={bancoTexto} size={28} />
        </Box>
        <Button size="small" variant="outlined" startIcon={<UploadIcon />} onClick={() => inputRef.current?.click()}>
          {value ? 'Cambiar icono' : 'Subir icono'}
        </Button>
        {value && (
          <Tooltip title="Quitar el icono subido (vuelve al de la lista)">
            <IconButton size="small" onClick={() => { setError(null); onChange(null) }}>
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
          hidden
          onChange={e => handleFile(e.target.files?.[0])}
        />
      </Box>
      <Typography variant="caption" color={error ? 'error' : 'text.secondary'} sx={{ display: 'block', mt: 0.5 }}>
        {error ?? 'PNG, JPG, WEBP, GIF o SVG. Se redimensiona a 96px; si no subís nada se usa el icono de la lista.'}
      </Typography>
    </Box>
  )
}

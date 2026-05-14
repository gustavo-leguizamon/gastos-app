import { create } from 'zustand'
import type { Gasto, FiltrosGastos } from '@/lib/types'

interface GastosStore {
  filtros: FiltrosGastos
  setFiltros: (f: Partial<FiltrosGastos>) => void
  dialogOpen: boolean
  gastoEditando: Gasto | null
  openDialog: (gasto?: Gasto) => void
  closeDialog: () => void
  refreshKey: number
  triggerRefresh: () => void
  resumenRefreshKey: number
  triggerResumenRefresh: () => void
}

const now = new Date()

export const useGastosStore = create<GastosStore>((set) => ({
  filtros: {
    mes: now.getMonth() + 1,
    anio: now.getFullYear(),
    casa_id: null,
    tipo_pago: null,
  },
  setFiltros: (f) => set((s) => ({ filtros: { ...s.filtros, ...f } })),

  dialogOpen: false,
  gastoEditando: null,
  openDialog: (gasto) => set({ dialogOpen: true, gastoEditando: gasto ?? null }),
  closeDialog: () => set({ dialogOpen: false, gastoEditando: null }),

  refreshKey: 0,
  triggerRefresh: () => set((s) => ({ refreshKey: s.refreshKey + 1, resumenRefreshKey: s.resumenRefreshKey + 1 })),
  resumenRefreshKey: 0,
  triggerResumenRefresh: () => set((s) => ({ resumenRefreshKey: s.resumenRefreshKey + 1 })),
}))

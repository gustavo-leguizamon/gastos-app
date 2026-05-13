import type { Metadata } from 'next'
import Providers from './providers'
import AppLayout from '@/components/layout/AppLayout'

export const metadata: Metadata = {
  title: 'Gastos App',
  description: 'Administrador de gastos multi-moneda',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <Providers>
          <AppLayout>{children}</AppLayout>
        </Providers>
      </body>
    </html>
  )
}

import type { Metadata } from 'next'
import Providers from './providers'
import AppLayout from '@/components/layout/AppLayout'
import ServiceWorkerRegister from '@/components/layout/ServiceWorkerRegister'

export const metadata: Metadata = {
  title: 'Gastos App',
  description: 'Administrador de gastos multi-moneda',
  manifest: '/manifest.json',
  themeColor: '#1976d2',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Gastos',
  },
  icons: {
    icon: '/icon-192.png',
    apple: '/icon-192.png',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <Providers>
          <AppLayout>{children}</AppLayout>
        </Providers>
        <ServiceWorkerRegister />
      </body>
    </html>
  )
}

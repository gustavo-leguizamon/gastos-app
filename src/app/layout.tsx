import type { Metadata, Viewport } from 'next'
import Providers from './providers'
import AppLayout from '@/components/layout/AppLayout'
import ServiceWorkerRegister from '@/components/layout/ServiceWorkerRegister'

export const metadata: Metadata = {
  title: 'Gastos App',
  description: 'Administrador de gastos multi-moneda',
  manifest: '/manifest.json',
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

export const viewport: Viewport = {
  themeColor: '#1976d2',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
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

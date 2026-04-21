import type { Metadata, Viewport } from 'next'
import './globals.css'
import AppThemeProvider from '@/theme/AppThemeProvider'

export const metadata: Metadata = {
  title: 'LeefKompas',
  description: 'Rustig dashboard voor gezin, werk, geld en planning',
  icons: {
    icon: '/icon.svg',
    apple: '/icon.svg',
  },
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl">
      <body>
        <AppThemeProvider>
          {children}
        </AppThemeProvider>
      </body>
    </html>
  )
}

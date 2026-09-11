import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import './globals.css'
import { PwaRegister } from '@/components/pwa-register'

const appIcon = 'https://ij78z9ah.ap-southeast.insforge.app/api/storage/buckets/uploads/objects/9990425d-bbf4-4fe8-a070-59559b4a50c7%2F1789130180555-5ae41b03-3959-4c50-b0da-140d752032a8.png?v=60925c43a7203c27d3d0edcd8bbc239f'

export const metadata: Metadata = {
  title: 'Smart Switch',
  description: 'Live IoT control center for Smart Switch devices.',

  icons: {
    icon: appIcon,
    apple: appIcon,
  },
}

export const viewport: Viewport = {
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: 'black' },
    { media: '(prefers-color-scheme: dark)', color: 'black' },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="bg-background">
      <body className="antialiased">
        <PwaRegister />
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}

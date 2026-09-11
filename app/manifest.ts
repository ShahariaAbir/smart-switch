import type { MetadataRoute } from 'next'

const appIcon =
  'https://ij78z9ah.ap-southeast.insforge.app/api/storage/buckets/uploads/objects/9990425d-bbf4-4fe8-a070-59559b4a50c7%2F1789130180555-5ae41b03-3959-4c50-b0da-140d752032a8.png?v=60925c43a7203c27d3d0edcd8bbc239f'

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Smart Switch',
    short_name: 'Smart Switch',
    description: 'Live IoT control center for Smart Switch devices.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait-primary',
    background_color: '#000000',
    theme_color: '#000000',
    icons: [
      { src: appIcon, sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
      { src: appIcon, sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
    ],
  }
}

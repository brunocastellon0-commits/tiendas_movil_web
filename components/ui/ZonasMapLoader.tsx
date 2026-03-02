'use client'

import dynamic from 'next/dynamic'
import { Loader2 } from 'lucide-react'

const ZonasMapInner = dynamic(() => import('./ZonasMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-gray-100 flex items-center justify-center text-gray-400">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
        <p className="font-semibold text-gray-600">Cargando mapa...</p>
      </div>
    </div>
  )
})

type ZonaMarker = {
  id: string
  latitude: number
  longitude: number
  label: string
  color: string
  isPending: boolean
  isSaving: boolean
  isSaved: boolean
}

export default function ZonasMapLoader({
  markers,
  onMapClick,
}: {
  markers: ZonaMarker[]
  onMapClick: (lat: number, lng: number) => void
}) {
  return <ZonasMapInner markers={markers} onMapClick={onMapClick} />
}

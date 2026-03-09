'use client'

import dynamic from 'next/dynamic'
import { Loader2 } from 'lucide-react'

const MapComponent = dynamic(() => import('./LeafletMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[620px] bg-gray-100 rounded-2xl flex items-center justify-center text-gray-400">
      <div className="flex flex-col items-center gap-2">
        <Loader2 className="w-8 h-8 animate-spin text-green-600" />
        <p>Cargando mapa...</p>
      </div>
    </div>
  )
})

export default function MapLoader(props: {
  employees: any[]
  selectedEmployeeId?: string | null
  visits?: any[]
  pedidos?: any[]
  routePoints?: any[]
  onVisitClick?: (visit: any) => void
  onPedidoClick?: (pedido: any) => void
  onRoutePointClick?: (point: any) => void
  creatingRoutePoint?: boolean
  onNewRoutePoint?: (lat: number, lng: number) => void
  clients?: { id: string; name: string; code: string }[]
  onAssignClient?: (pointId: string, clientId: string) => void
}) {
  return <MapComponent {...props} />
}
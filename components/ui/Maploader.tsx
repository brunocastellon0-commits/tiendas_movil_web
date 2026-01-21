'use client'

import dynamic from 'next/dynamic'
import { Loader2 } from 'lucide-react'

export default function MapLoader({ employees, selectedEmployeeId, visits = [], onVisitClick }: { 
  employees: any[], 
  selectedEmployeeId?: string | null,
  visits?: any[],
  onVisitClick?: (visit: any) => void
}) {
  const MapComponent = dynamic(() => import('./LeafletMap'), { 
    ssr: false,
    loading: () => (
      <div className="w-full h-[600px] bg-gray-100 rounded-2xl flex items-center justify-center text-gray-400">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="w-8 h-8 animate-spin text-green-600" />
          <p>Cargando mapa...</p>
        </div>
      </div>
    )
  })

  return <MapComponent employees={employees} selectedEmployeeId={selectedEmployeeId} visits={visits} onVisitClick={onVisitClick} />
}
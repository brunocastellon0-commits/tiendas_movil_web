'use client'

import { memo, useEffect, useRef, useMemo } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'

// Tipo de dato
type EmployeeLocation = {
  id: string
  full_name: string
  latitude: number
  longitude: number
  job_title: string
  last_update: string
  gps_trust_score?: number | null
  is_active?: boolean
}

// Componente para controlar el mapa desde fuera
function MapController({ selectedEmployeeId, employees }: { selectedEmployeeId: string | null, employees: EmployeeLocation[] }) {
  const map = useMap()
  
  useEffect(() => {
    if (selectedEmployeeId) {
      const employee = employees.find(e => e.id === selectedEmployeeId)
      if (employee) {
        map.flyTo([employee.latitude, employee.longitude], 16, {
          duration: 1.5
        })
      }
    }
  }, [selectedEmployeeId, employees, map])
  
  return null
}

// --- FUNCIÓN PARA CREAR EL GLOBITO PERSONALIZADO ---
const createCustomIcon = (fullName: string) => {
  const initial = fullName.charAt(0).toUpperCase()
  
  return L.divIcon({
    className: 'custom-icon',
    html: `
      <div class="relative group transform transition-transform hover:scale-110">
        <div class="w-10 h-10 bg-white rounded-full border-2 border-green-600 shadow-lg flex items-center justify-center bg-gradient-to-br from-green-100 to-emerald-100">
          <span class="text-green-700 font-bold text-sm">${initial}</span>
        </div>
        <div class="absolute -bottom-1 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-green-600"></div>
      </div>
    `,
    iconSize: [40, 48],
    iconAnchor: [20, 48],
    popupAnchor: [0, -48]
  })
}

function LeafletMap({ employees, selectedEmployeeId, visits = [], onVisitClick }: { 
  employees: EmployeeLocation[], 
  selectedEmployeeId?: string | null,
  visits?: any[],
  onVisitClick?: (visit: any) => void
}) {
  // Coordenadas por defecto (Cochabamba, Bolivia)
  const centerPosition: [number, number] = employees.length > 0 
    ? [employees[0].latitude, employees[0].longitude]
    : [-17.3935, -66.1570]

  // Refs para los marcadores
  const markerRefs = useRef<{ [key: string]: L.Marker }>({})

  // Abrir popup cuando se selecciona un empleado
  useEffect(() => {
    if (selectedEmployeeId && markerRefs.current[selectedEmployeeId]) {
      markerRefs.current[selectedEmployeeId].openPopup()
    }
  }, [selectedEmployeeId])

  // Procesar visitas para extraer coordenadas
  const processedVisits = useMemo(() => {
    return visits.map(visit => {
      let latitude = null
      let longitude = null
      
      if (visit.check_out_location) {
        const location = visit.check_out_location
        
        // WKB Hexadecimal
        if (typeof location === 'string' && location.length > 20 && /^[0-9A-F]+$/i.test(location)) {
          const coords = parseWKBHex(location)
          if (coords) {
            latitude = coords.latitude
            longitude = coords.longitude
          }
        }
        // GeoJSON Object
        else if (typeof location === 'object' && location.type === 'Point' && Array.isArray(location.coordinates)) {
          longitude = location.coordinates[0]
          latitude = location.coordinates[1]
        }
        // WKT String
        else if (typeof location === 'string' && location.includes('POINT(')) {
          const match = location.match(/POINT\(([^ ]+) ([^ ]+)\)/)
          if (match) {
            longitude = parseFloat(match[1])
            latitude = parseFloat(match[2])
          }
        }
      }
      
      return {
        ...visit,
        latitude,
        longitude
      }
    }).filter(v => v.latitude && v.longitude && !isNaN(v.latitude) && !isNaN(v.longitude))
  }, [visits])

  // Función para crear iconos de visitas según outcome
  const createVisitIcon = (outcome: string) => {
    let bgColor = ''
    let borderColor = ''
    let iconSvg = ''
    
    switch (outcome) {
      case 'sale':
        bgColor = 'bg-green-500'
        borderColor = 'border-green-600'
        iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>`
        break
      case 'no_sale':
        bgColor = 'bg-yellow-500'
        borderColor = 'border-yellow-600'
        iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`
        break
      case 'store_closed':
        bgColor = 'bg-red-500'
        borderColor = 'border-red-600'
        iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>`
        break
      default:
        bgColor = 'bg-gray-500'
        borderColor = 'border-gray-600'
        iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle></svg>`
    }
    
    return L.divIcon({
      className: 'custom-visit-icon',
      html: `
        <div class="relative group transform transition-transform hover:scale-110">
          <div class="w-12 h-12 ${bgColor} rounded-full border-3 ${borderColor} shadow-lg flex items-center justify-center">
            ${iconSvg}
          </div>
          <div class="absolute -bottom-1 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] ${borderColor.replace('border-', 'border-t-')}"></div>
        </div>
      `,
      iconSize: [48, 56],
      iconAnchor: [24, 56],
      popupAnchor: [0, -56]
    })
  }

  const getOutcomeLabel = (outcome: string) => {
    switch (outcome) {
      case 'sale': return 'Venta Exitosa'
      case 'no_sale': return 'Sin Venta'
      case 'store_closed': return 'Tienda Cerrada'
      default: return outcome
    }
  }

  const getOutcomeColor = (outcome: string) => {
    switch (outcome) {
      case 'sale': return 'text-green-700 bg-green-100'
      case 'no_sale': return 'text-yellow-700 bg-yellow-100'
      case 'store_closed': return 'text-red-700 bg-red-100'
      default: return 'text-gray-700 bg-gray-100'
    }
  }

  // Función auxiliar para parsear WKB
  function parseWKBHex(wkbHex: string): { latitude: number; longitude: number } | null {
    try {
      const coordsStart = 18
      const xHex = wkbHex.slice(coordsStart, coordsStart + 16)
      const yHex = wkbHex.slice(coordsStart + 16, coordsStart + 32)
      
      const hexToDouble = (hex: string): number => {
        const bytes = new Uint8Array(8)
        for (let i = 0; i < 8; i++) {
          bytes[i] = parseInt(hex.substr(i * 2, 2), 16)
        }
        const view = new DataView(bytes.buffer)
        return view.getFloat64(0, true)
      }
      
      const longitude = hexToDouble(xHex)
      const latitude = hexToDouble(yHex)
      
      return { latitude, longitude }
    } catch (error) {
      return null
    }
  }

  return (
    <div className="w-full h-[600px] rounded-2xl overflow-hidden shadow-lg border border-gray-200 z-0">
      <MapContainer 
        center={centerPosition} 
        zoom={13} 
        scrollWheelZoom={true} 
        style={{ height: "100%", width: "100%" }}
      >
        {/* Controlador del mapa */}
        <MapController selectedEmployeeId={selectedEmployeeId || null} employees={employees} />
        
        {/* CAPA DE MAPA (OpenStreetMap) */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* MARCADORES DE EMPLEADOS */}
        {employees.map((emp) => {
          // Color basado en GPS Score
          const score = emp.gps_trust_score ?? 100
          let statusColor = 'green'
          if (score < 70) statusColor = 'red'
          else if (score < 90) statusColor = 'yellow'

          const borderColorClass = score < 70 
            ? 'border-red-600' 
            : score < 90 
              ? 'border-yellow-500' 
              : 'border-green-600'

          const bgColorClass = score < 70
             ? 'from-red-100 to-orange-100'
             : score < 90
               ? 'from-yellow-100 to-amber-100'
               : 'from-green-100 to-emerald-100'

          const iconHtml = `
            <div class="relative group transform transition-transform hover:scale-110">
              <div class="w-10 h-10 bg-white rounded-full border-2 ${borderColorClass} shadow-lg flex items-center justify-center bg-gradient-to-br ${bgColorClass}">
                <span class="${score < 70 ? 'text-red-700' : score < 90 ? 'text-yellow-700' : 'text-green-700'} font-bold text-sm">${emp.full_name.charAt(0).toUpperCase()}</span>
              </div>
              <div class="absolute -bottom-1 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-${statusColor === 'green' ? 'green-600' : statusColor === 'red' ? 'red-600' : 'yellow-500'}"></div>
            </div>
          `

          const icon = L.divIcon({
            className: 'custom-icon',
            html: iconHtml,
            iconSize: [40, 48],
            iconAnchor: [20, 48],
            popupAnchor: [0, -48]
          })

          return (
            <Marker 
              key={emp.id} 
              position={[emp.latitude, emp.longitude]}
              icon={icon}
              ref={(ref) => {
                if (ref) {
                  markerRefs.current[emp.id] = ref
                }
              }}
            >
              <Popup className="custom-popup">
                <div className="min-w-[200px] p-2">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-bold text-gray-900 text-base">{emp.full_name}</h3>
                      <span className="inline-block px-2 py-0.5 bg-gray-100 text-gray-600 text-[10px] rounded-full font-medium">
                        {emp.job_title || 'Empleado'}
                      </span>
                    </div>
                    <div className={`px-2 py-1 rounded-lg flex flex-col items-center ${score < 70 ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                       <span className="text-[10px] font-bold uppercase">GPS Score</span>
                       <span className="font-black text-sm">{score}%</span>
                    </div>
                  </div>
                  
                  <div className="text-xs text-gray-500 border-t pt-2 mt-2 space-y-1">
                    <div className="flex justify-between">
                      <span className="font-medium">Estado:</span>
                      <span className={`font-bold ${emp.is_active ? 'text-green-600' : 'text-gray-400'}`}>
                        {emp.is_active ? '● En línea' : '○ Desconectado'}
                      </span>
                    </div>
                    <p className="font-mono text-[10px]">
                      {emp.latitude.toFixed(6)}, {emp.longitude.toFixed(6)}
                    </p>
                    <p className="mt-1 flex items-center gap-1">
                      <span>🕒</span> {emp.last_update}
                    </p>
                  </div>
                </div>
              </Popup>
            </Marker>
          )
        })}

        {/* Marcadores de Visitas */}
        {processedVisits.map((visit: any) => (
          <Marker 
            key={visit.id} 
            position={[visit.latitude, visit.longitude]}
            icon={createVisitIcon(visit.outcome)}
          >
            <Popup className="custom-popup">
              <div className="min-w-[220px] p-2">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-bold text-gray-900 text-base">
                      {visit.clients?.name || 'Cliente'}
                    </h3>
                    {visit.clients?.legacy_id && (
                      <p className="text-xs text-gray-500">Cod: {visit.clients.legacy_id}</p>
                    )}
                  </div>
                  <span className={`px-2 py-1 rounded-lg text-xs font-bold ${getOutcomeColor(visit.outcome)}`}>
                    {getOutcomeLabel(visit.outcome)}
                  </span>
                </div>
                
                <div className="space-y-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-600">Vendedor:</span>
                    <span className="text-gray-900">{visit.employees?.full_name || 'N/A'}</span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-600">Fecha:</span>
                    <span className="text-gray-900">
                      {new Date(visit.start_time).toLocaleDateString('es-BO', { 
                        day: '2-digit', 
                        month: 'short', 
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>
                  
                  {visit.notes && (
                    <div className="pt-2 border-t border-gray-200">
                      <p className="font-medium text-gray-600 mb-1">Notas:</p>
                      <p className="text-gray-900 text-xs">{visit.notes}</p>
                    </div>
                  )}
                  
                  <div className="pt-2 border-t border-gray-200">
                    <p className="font-mono text-[10px] text-gray-500">
                      {visit.latitude.toFixed(6)}, {visit.longitude.toFixed(6)}
                    </p>
                  </div>
                  
                  {onVisitClick && (
                    <div className="pt-3 border-t border-gray-200 mt-2">
                      <button
                        onClick={() => onVisitClick(visit)}
                        className="w-full px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-semibold transition-all shadow-md"
                      >
                        Ver Detalles Completos
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  )
}

// Memoize the component to prevent unnecessary re-renders
export default memo(LeafletMap, (prevProps, nextProps) => {
  // Re-render if selectedEmployeeId changed
  if (prevProps.selectedEmployeeId !== nextProps.selectedEmployeeId) return false
  
  // Only re-render if the number of employees changed or employee IDs changed
  if (prevProps.employees.length !== nextProps.employees.length) return false
  
  // Check if employee IDs are the same
  const prevIds = prevProps.employees.map(e => e.id).join(',')
  const nextIds = nextProps.employees.map(e => e.id).join(',')
  
  return prevIds === nextIds
})

LeafletMap.displayName = 'LeafletMap'
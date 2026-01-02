'use client'

import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
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

export default function LeafletMap({ employees }: { employees: EmployeeLocation[] }) {
  // Coordenadas por defecto (Cochabamba, Bolivia)
  const centerPosition: [number, number] = employees.length > 0 
    ? [employees[0].latitude, employees[0].longitude]
    : [-17.3935, -66.1570]

  console.log('🗺️ LeafletMap rendering with', employees.length, 'employees')
  employees.forEach(emp => {
    console.log(`   📍 ${emp.full_name}: [${emp.latitude}, ${emp.longitude}]`)
  })

  return (
    <div className="w-full h-[600px] rounded-2xl overflow-hidden shadow-lg border border-gray-200 z-0">
      <MapContainer 
        center={centerPosition} 
        zoom={13} 
        scrollWheelZoom={true} 
        style={{ height: "100%", width: "100%" }}
      >
        {/* CAPA DE MAPA (OpenStreetMap) */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* MARCADORES DE EMPLEADOS */}
        {employees.map((emp) => (
          <Marker 
            key={emp.id} 
            position={[emp.latitude, emp.longitude]}
            icon={createCustomIcon(emp.full_name)}
          >
            <Popup className="custom-popup">
              <div className="min-w-[180px] p-2">
                <h3 className="font-bold text-gray-900 text-base mb-2">{emp.full_name}</h3>
                <span className="inline-block px-3 py-1 bg-green-100 text-green-700 text-xs rounded-full font-semibold mb-2">
                  {emp.job_title || 'Empleado'}
                </span>
                <div className="text-xs text-gray-500 border-t pt-2 mt-2">
                  <p className="font-medium">📍 Coordenadas:</p>
                  <p className="font-mono text-[10px]">
                    Lat: {emp.latitude.toFixed(6)}<br/>
                    Lon: {emp.longitude.toFixed(6)}
                  </p>
                  <p className="mt-1">🕐 {emp.last_update}</p>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  )
}
'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/utils/supabase/client'
import MapLoader from '@/components/ui/Maploader' 
import { RefreshCw, Map as MapIcon, Loader2, Users } from 'lucide-react'

type EmployeeLocation = {
  id: string
  full_name: string
  latitude: number
  longitude: number
  job_title: string
  created_at?: string
}

// Función para decodificar WKB hexadecimal de PostGIS
function parseWKBHex(wkbHex: string): { latitude: number; longitude: number } | null {
  try {
    // WKB Point format: tipo (4 bytes) + SRID (4 bytes) + X (8 bytes) + Y (8 bytes)
    // Saltamos los primeros 18 caracteres (9 bytes) para llegar a las coordenadas
    // Byte order (1) + Type (4) + SRID (4) = 9 bytes = 18 chars hex
    
    const coordsStart = 18
    const xHex = wkbHex.slice(coordsStart, coordsStart + 16)
    const yHex = wkbHex.slice(coordsStart + 16, coordsStart + 32)
    
    // Convertir hex a double (little-endian)
    const hexToDouble = (hex: string): number => {
      const bytes = new Uint8Array(8)
      for (let i = 0; i < 8; i++) {
        bytes[i] = parseInt(hex.substr(i * 2, 2), 16)
      }
      const view = new DataView(bytes.buffer)
      return view.getFloat64(0, true) // true = little-endian
    }
    
    const longitude = hexToDouble(xHex)
    const latitude = hexToDouble(yHex)
    
    return { latitude, longitude }
  } catch (error) {
    console.error('Error parsing WKB hex:', error)
    return null
  }
}

export default function EmployeesMapPage() {
  const supabase = createClient()
  const [locations, setLocations] = useState<EmployeeLocation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchLocations = async () => {
    try {
      setLoading(true)
      setError(null)
      
      // Obtener empleados con ubicación GPS
      const { data, error: fetchError } = await supabase
        .from('employees')
        .select('id, full_name, location, job_title, created_at')
        .not('location', 'is', null)
        .order('created_at', { ascending: false })

      if (fetchError) throw fetchError

      if (data) {
        // Procesar datos: extraer lat/lon del campo location
        const processedData = data.map(emp => {
          let latitude = null
          let longitude = null
          
          if (emp.location) {
            // 1. WKB Hexadecimal (PostGIS Binary Format)
            if (typeof emp.location === 'string' && emp.location.length > 20 && /^[0-9A-F]+$/i.test(emp.location)) {
              const coords = parseWKBHex(emp.location)
              if (coords) {
                latitude = coords.latitude
                longitude = coords.longitude
              }
            }
            // 2. GeoJSON Object
            else if (typeof emp.location === 'object' && emp.location.type === 'Point' && Array.isArray(emp.location.coordinates)) {
              longitude = emp.location.coordinates[0]
              latitude = emp.location.coordinates[1]
            }
            // 3. WKT String "POINT(lon lat)"
            else if (typeof emp.location === 'string' && emp.location.includes('POINT(')) {
              const match = emp.location.match(/POINT\(([^ ]+) ([^ ]+)\)/)
              if (match) {
                longitude = parseFloat(match[1])
                latitude = parseFloat(match[2])
              }
            }
          }

          return {
            id: emp.id,
            full_name: emp.full_name,
            latitude: latitude!,
            longitude: longitude!,
            job_title: emp.job_title,
            created_at: emp.created_at
          }
        }).filter(emp => {
          const isValid = emp.latitude !== null && emp.longitude !== null && !isNaN(emp.latitude) && !isNaN(emp.longitude)
          return isValid
        })

        setLocations(processedData)
      }

    } catch (err: any) {
      console.error('❌ Error cargando ubicaciones:', err)
      setError(err.message || 'Error al cargar ubicaciones')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLocations()
    
    // Auto-refresh cada 60 segundos (optimizado para mejor rendimiento)
    const interval = setInterval(fetchLocations, 60000)
    return () => clearInterval(interval)
  }, [])

  // Formatear tiempo relativo
  const getRelativeTime = (timestamp?: string) => {
    if (!timestamp) return 'Sin actualizar'
    
    const now = new Date()
    const updatedAt = new Date(timestamp)
    const diffMs = now.getTime() - updatedAt.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    
    if (diffMins < 1) return 'Ahora mismo'
    if (diffMins < 60) return `Hace ${diffMins} min`
    
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `Hace ${diffHours}h`
    
    return updatedAt.toLocaleDateString()
  }

  // Filtrar solo empleados con coordenadas válidas para el mapa (memoizado)
  const validLocations = useMemo(() => 
    locations.filter(emp => 
      emp.latitude !== null && 
      emp.longitude !== null &&
      !isNaN(emp.latitude) &&
      !isNaN(emp.longitude)
    ),
    [locations]
  )

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 p-4 sm:p-6 lg:p-8">
      
      {/* Patrón de rombos */}
      <div className="fixed inset-0 z-0 pointer-events-none opacity-35" 
           style={{backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 35px, rgba(16, 185, 129, 0.25) 35px, rgba(16, 185, 129, 0.25) 39px), repeating-linear-gradient(-45deg, transparent, transparent 35px, rgba(16, 185, 129, 0.25) 35px, rgba(16, 185, 129, 0.25) 39px)`}}></div>
      <div className="fixed inset-0 z-0 pointer-events-none opacity-25" 
           style={{backgroundImage: `radial-gradient(circle at 2px 2px, rgba(20, 184, 166, 0.12) 1px, transparent 1px)`, backgroundSize: '48px 48px'}}></div>
      <div className="fixed inset-0 z-0 bg-gradient-to-b from-white/40 via-transparent to-transparent pointer-events-none"></div>
      
      {/* Círculos blur */}
      <div className="fixed -top-24 -left-24 w-96 h-96 bg-green-200/30 rounded-full blur-3xl z-0 pointer-events-none"></div>
      <div className="fixed top-32 left-32 w-64 h-64 bg-emerald-300/20 rounded-full blur-2xl z-0 pointer-events-none"></div>
      <div className="fixed -top-32 -right-32 w-[500px] h-[500px] bg-teal-200/25 rounded-full blur-3xl z-0 pointer-events-none"></div>
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-emerald-100/20 rounded-full blur-3xl z-0 pointer-events-none"></div>
      <div className="fixed -bottom-40 -left-20 w-[450px] h-[450px] bg-green-300/25 rounded-full blur-3xl z-0 pointer-events-none"></div>
      <div className="fixed -bottom-20 -right-40 w-80 h-80 bg-emerald-200/30 rounded-full blur-3xl z-0 pointer-events-none"></div>
      
      {/* Figuras geométricas */}
      <div className="fixed top-20 right-1/4 w-20 h-20 border-3 border-emerald-500/40 rounded-xl rotate-12 z-0 pointer-events-none shadow-lg shadow-emerald-500/10"></div>
      <div className="fixed top-32 right-1/3 w-14 h-14 bg-green-400/15 rounded-lg -rotate-6 z-0 pointer-events-none"></div>
      <div className="fixed top-40 left-1/4 w-16 h-16 border-3 border-teal-500/35 rounded-full z-0 pointer-events-none shadow-lg shadow-teal-500/10"></div>
      <div className="fixed top-56 left-1/3 w-12 h-12 bg-emerald-300/20 rotate-45 z-0 pointer-events-none"></div>
      <div className="fixed top-1/2 left-16 w-24 h-24 border-3 border-green-500/40 rotate-45 z-0 pointer-events-none shadow-lg shadow-green-500/10"></div>
      <div className="fixed top-1/2 left-32 w-10 h-10 bg-teal-400/20 rounded-lg -rotate-12 z-0 pointer-events-none"></div>
      <div className="fixed top-1/3 right-20 w-18 h-18 border-3 border-emerald-600/35 rounded-2xl rotate-45 z-0 pointer-events-none shadow-lg shadow-emerald-600/10"></div>
      <div className="fixed top-2/3 right-32 w-22 h-22 border-3 border-green-400/40 rotate-12 rounded-lg z-0 pointer-events-none"></div>
      <div className="fixed bottom-1/3 left-20 w-16 h-16 border-3 border-teal-600/40 rounded-full z-0 pointer-events-none shadow-lg shadow-teal-600/10"></div>
      <div className="fixed bottom-1/4 left-40 w-14 h-14 bg-green-300/20 rounded-xl rotate-45 z-0 pointer-events-none"></div>
      <div className="fixed bottom-20 right-1/4 w-20 h-20 border-3 border-emerald-500/45 rounded-lg -rotate-12 z-0 pointer-events-none shadow-lg shadow-emerald-500/10"></div>
      <div className="fixed bottom-32 right-1/3 w-12 h-12 bg-teal-400/25 rotate-6 z-0 pointer-events-none"></div>
      
      <div className="relative z-10 space-y-6">
      
      {/* HEADER - Diseño vibrante */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl shadow-lg border-2 border-green-100">
        <div>
          <h1 className="text-3xl md:text-4xl font-black bg-gradient-to-r from-green-600 via-green-500 to-emerald-500 bg-clip-text text-transparent flex items-center gap-4">
            <div className="p-4 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl shadow-xl">
              <MapIcon className="w-7 h-7 text-white" />
            </div>
            Rastreo de Personal
          </h1>
          <p className="text-gray-600 text-sm mt-2 font-medium">Monitoreo GPS en tiempo real de tu equipo</p>
        </div>
        <button 
          onClick={fetchLocations} 
          disabled={loading}
          className={`flex items-center gap-3 px-8 py-4 rounded-2xl font-bold text-sm transition-all shadow-xl ${
            loading 
              ? 'bg-gray-400 cursor-not-allowed text-white'
              : 'bg-gradient-to-r from-green-500 via-green-600 to-emerald-600 hover:from-green-600 hover:via-green-700 hover:to-emerald-700 text-white shadow-green-900/30 hover:shadow-2xl hover:scale-105'
          }`}
        >
          <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Actualizando...' : 'Actualizar Ubicaciones'}
        </button>
      </div>

      {/* KPI Card - Diseño vibrante */}
      <div className="group relative bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-600 p-6 rounded-3xl shadow-xl hover:shadow-2xl transition-all duration-300 border-2 border-blue-400 hover:scale-105">
        <div className="absolute inset-0 bg-white/10 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
        <div className="relative">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/20 backdrop-blur-sm rounded-2xl shadow-lg">
                <Users className="w-7 h-7 text-white" />
              </div>
              <div>
                <p className="text-sm text-blue-50 font-semibold">Personal en Ruta</p>
                <h3 className="text-4xl font-black text-white">{validLocations.length}</h3>
              </div>
            </div>
            <span className="text-xs font-bold bg-white text-blue-600 px-4 py-1.5 rounded-full shadow-md">
              CON GPS ACTIVO
            </span>
          </div>
        </div>
      </div>

      {/* Error Message - Mejorado */}
      {error && (
        <div className="bg-red-50 border-2 border-red-300 text-red-700 p-5 rounded-2xl flex items-start gap-3 shadow-lg">
          <div className="text-2xl flex-shrink-0">⚠️</div>
          <div>
            <p className="font-bold text-base">Error al cargar ubicaciones</p>
            <p className="text-sm mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* Mapa - Diseño vibrante */}
      <div className="bg-white rounded-3xl shadow-2xl border-2 border-green-100 overflow-hidden">
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 px-6 py-5 border-b-2 border-green-200">
          <h2 className="text-xl font-black text-gray-900">Mapa de Ubicaciones</h2>
          <p className="text-sm text-gray-600 mt-1 font-medium">
            {validLocations.length > 0 
              ? `Mostrando ${validLocations.length} empleado${validLocations.length > 1 ? 's' : ''} en ruta`
              : 'Esperando ubicaciones GPS...'
            }
          </p>
        </div>
        
        <div className="p-6">
          <MapLoader employees={validLocations.map(emp => ({
            ...emp,
            latitude: emp.latitude!,
            longitude: emp.longitude!,
            last_update: getRelativeTime(emp.created_at)
          }))} />
        </div>
      </div>

      {/* Lista resumen - Tarjetas mejoradas */}
      {validLocations.length > 0 && (
        <div className="bg-white rounded-3xl shadow-2xl border-2 border-green-100 p-8">
          <h2 className="text-2xl font-black text-gray-900 mb-6">Personal en Tiempo Real</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {validLocations.map(emp => (
              <div 
                key={emp.id} 
                className="bg-gradient-to-br from-green-50 to-emerald-50 p-5 rounded-2xl border-2 border-green-200 flex items-center gap-4 hover:shadow-xl hover:border-green-400 hover:scale-105 transition-all duration-300 cursor-pointer shadow-md"
              >
                <div className="relative">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-400 to-indigo-500 overflow-hidden border-2 border-white shadow-lg">
                    <div className="w-full h-full flex items-center justify-center text-white font-black text-xl">
                      {emp.full_name.charAt(0)}
                    </div>
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-white rounded-full animate-pulse"></div>
                </div>
                <div className="flex-1">
                   <h4 className="font-black text-gray-900 text-sm">{emp.full_name}</h4>
                   <p className="text-xs text-gray-600 font-medium">{emp.job_title}</p>
                   <p className="text-xs text-green-600 font-black mt-1">
                     {getRelativeTime(emp.created_at)}
                   </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      </div>
    </div>
  )
}

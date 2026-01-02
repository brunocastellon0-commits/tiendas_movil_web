'use client'

import { useState, useEffect } from 'react'
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
      
      console.log('🔍 Fetching employee locations...')
      
      // Obtener empleados con ubicación GPS
      const { data, error: fetchError } = await supabase
        .from('employees')
        .select('id, full_name, location, job_title, created_at')
        .not('location', 'is', null)
        .order('created_at', { ascending: false })

      console.log('📡 Supabase Response:', { data, error: fetchError })

      if (fetchError) throw fetchError

      if (data) {
        console.log(`✅ Found ${data.length} employees with location field`)
        
        // Procesar datos: extraer lat/lon del campo location
        const processedData = data.map(emp => {
          console.log('🔧 Processing employee:', emp.full_name)
          console.log('   Raw location:', emp.location)
          console.log('   Location type:', typeof emp.location)
          
          let latitude = null
          let longitude = null
          
          if (emp.location) {
            // 1. WKB Hexadecimal (PostGIS Binary Format)
            if (typeof emp.location === 'string' && emp.location.length > 20 && /^[0-9A-F]+$/i.test(emp.location)) {
              console.log('   📦 Detected WKB hex format')
              const coords = parseWKBHex(emp.location)
              if (coords) {
                latitude = coords.latitude
                longitude = coords.longitude
                console.log('   ✓ Parsed from WKB hex:', { latitude, longitude })
              }
            }
            // 2. GeoJSON Object
            else if (typeof emp.location === 'object' && emp.location.type === 'Point' && Array.isArray(emp.location.coordinates)) {
              console.log('   📦 Detected GeoJSON format')
              longitude = emp.location.coordinates[0]
              latitude = emp.location.coordinates[1]
              console.log('   ✓ Extracted from GeoJSON:', { longitude, latitude })
            }
            // 3. WKT String "POINT(lon lat)"
            else if (typeof emp.location === 'string' && emp.location.includes('POINT(')) {
              console.log('   📦 Detected WKT string format')
              const match = emp.location.match(/POINT\(([^ ]+) ([^ ]+)\)/)
              if (match) {
                longitude = parseFloat(match[1])
                latitude = parseFloat(match[2])
                console.log('   ✓ Parsed from WKT:', { latitude, longitude })
              }
            }
            else {
              console.log('   ⚠️ Unexpected location format')
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
          if (!isValid) {
            console.log('   ❌ Filtered out (invalid coordinates):', emp.full_name)
          } else {
            console.log('   ✅ Valid location:', emp.full_name, { lat: emp.latitude, lon: emp.longitude })
          }
          return isValid
        })

        console.log(`🎯 Final processed locations: ${processedData.length}`)
        console.log('Locations:', processedData)
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
    
    // Auto-refresh cada 30 segundos
    const interval = setInterval(fetchLocations, 30000)
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

  // Filtrar solo empleados con coordenadas válidas para el mapa
  const validLocations = locations.filter(emp => 
    emp.latitude !== null && 
    emp.longitude !== null &&
    !isNaN(emp.latitude) &&
    !isNaN(emp.longitude)
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6 space-y-8">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent flex items-center gap-3">
            <div className="p-3 bg-green-600 rounded-xl shadow-lg">
              <MapIcon className="w-6 h-6 text-white" />
            </div>
            Rastreo de Personal
          </h1>
          <p className="text-gray-600 text-sm mt-2">Monitoreo GPS en tiempo real de tu equipo</p>
        </div>
        <button 
          onClick={fetchLocations} 
          disabled={loading}
          className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition-all shadow-lg ${
            loading 
              ? 'bg-gray-400 cursor-not-allowed text-white'
              : 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white shadow-green-900/20 hover:shadow-xl'
          }`}
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Actualizando...' : 'Actualizar Ubicaciones'}
        </button>
      </div>

      {/* KPI Card */}
      <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-6 rounded-2xl shadow-lg text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-blue-100">Personal en Ruta</p>
              <h3 className="text-3xl font-bold">{validLocations.length}</h3>
            </div>
          </div>
          <span className="text-xs font-semibold bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full">
            CON GPS ACTIVO
          </span>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl flex items-start gap-3">
          <div className="w-5 h-5 flex-shrink-0">⚠️</div>
          <div>
            <p className="font-semibold">Error al cargar ubicaciones</p>
            <p className="text-sm mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Mapa */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
        <div className="bg-gradient-to-r from-gray-50 to-slate-50 px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-900">Mapa de Ubicaciones</h2>
          <p className="text-sm text-gray-600 mt-0.5">
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

      {/* Lista resumen */}
      {validLocations.length > 0 && (
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Personal en Tiempo Real</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {validLocations.map(emp => (
              <div 
                key={emp.id} 
                className="bg-gradient-to-br from-gray-50 to-slate-50 p-4 rounded-xl border-2 border-gray-200 flex items-center gap-3 hover:shadow-md hover:border-green-300 transition-all cursor-pointer"
              >
                <div className="relative">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 overflow-hidden border-2 border-white shadow-sm">
                    <div className="w-full h-full flex items-center justify-center text-blue-700 font-bold text-lg">
                      {emp.full_name.charAt(0)}
                    </div>
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-white rounded-full"></div>
                </div>
                <div className="flex-1">
                   <h4 className="font-bold text-gray-900 text-sm">{emp.full_name}</h4>
                   <p className="text-xs text-gray-500">{emp.job_title}</p>
                   <p className="text-xs text-green-600 font-medium mt-0.5">
                     {getRelativeTime(emp.created_at)}
                   </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  )
}
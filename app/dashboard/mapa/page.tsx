'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/utils/supabase/client'
import MapLoader from '@/components/ui/Maploader' 
import { RefreshCw, Map as MapIcon, Loader2, Users, MapPin, Navigation, Filter, X, Clock } from 'lucide-react'
import { shareMyLocation } from '@/services/locationService'

type EmployeeLocation = {
  id: string
  full_name: string
  latitude: number
  longitude: number
  job_title: string
  created_at?: string
  gps_trust_score?: number
  is_active?: boolean
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
  const [visits, setVisits] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null)
  const [currentEmployeeId, setCurrentEmployeeId] = useState<string | null>(null)
  const [sharingLocation, setSharingLocation] = useState(false)
  const [shareSuccess, setShareSuccess] = useState(false)
  const [shareError, setShareError] = useState<string | null>(null)
  
  // Estados para filtros de visitas
  const [employees, setEmployees] = useState<Array<{id: string, full_name: string}>>([])
  const [selectedVisitEmployee, setSelectedVisitEmployee] = useState<string>('ALL')
  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Últimos 7 días
    end: new Date().toISOString().split('T')[0]
  })
  
  // Estados para modal de detalle de visita
  const [selectedVisit, setSelectedVisit] = useState<any | null>(null)
  const [showVisitModal, setShowVisitModal] = useState(false)

  // Obtener el ID del empleado actual (usuario logueado)
  useEffect(() => {
    const getCurrentEmployee = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        // Buscar el empleado por email
        const { data: employee } = await supabase
          .from('employees')
          .select('id')
          .eq('email', user.email)
          .single()
        
        if (employee) {
          setCurrentEmployeeId(employee.id)
        }
      }
    }
    getCurrentEmployee()
  }, [])

  // Cargar lista de empleados para el filtro
  useEffect(() => {
    const fetchEmployees = async () => {
      const { data } = await supabase
        .from('employees')
        .select('id, full_name')
        .order('full_name')
      
      if (data) setEmployees(data)
    }
    fetchEmployees()
  }, [])

  // Función para compartir ubicación actual
  const handleShareLocation = async () => {
    if (!currentEmployeeId) {
      setShareError('No se pudo identificar al empleado actual')
      return
    }

    setSharingLocation(true)
    setShareError(null)
    setShareSuccess(false)

    const result = await shareMyLocation(currentEmployeeId)

    if (result.success) {
      setShareSuccess(true)
      // Recargar ubicaciones después de 1 segundo
      setTimeout(() => {
        fetchLocations()
        setShareSuccess(false)
      }, 1000)
    } else {
      setShareError(result.error || 'Error al compartir ubicación')
    }

    setSharingLocation(false)
  }

  const fetchLocations = async () => {
    try {
      setLoading(true)
      setError(null)
      
      // 1. Obtener empleados base
      const { data: employeesData, error: empError } = await supabase
        .from('employees')
        .select('id, full_name, location, job_title, created_at, gps_trust_score')
        .not('location', 'is', null)
        .order('created_at', { ascending: false })

      if (empError) throw empError

      // 2. Intentar obtener historial reciente para "ubicación real"
      // Si la tabla no existe o falla, fallaremos silenciosamente y usaremos location de employees
      let recentHistory: any[] = []
      try {
        const { data: historyData } = await supabase
          .from('location_history')
          .select('employee_id, location, created_at')
          .order('created_at', { ascending: false })
          .limit(2000) // Traemos suficientes registros recientes
        
        if (historyData) recentHistory = historyData
      } catch (err) {
        console.warn('No se pudo cargar location_history, usando datos base:', err)
      }

      if (employeesData) {
        // Procesar datos: Unir empleados con su última ubicación conocida
        const processedData = employeesData.map(emp => {
          // Buscar la ubicación más reciente en el historial
          const latestUpdate = recentHistory.find((h: any) => h.employee_id === emp.id)
          
          // Origen de datos: History (Prioridad) > Employee Table (Fallback)
          const locationSource = latestUpdate || emp
          const rawLocation = locationSource.location
          const timestamp = latestUpdate ? latestUpdate.created_at : emp.created_at // Si es fallback, fecha de creación (no ideal, pero fallback)
          
          let latitude = null
          let longitude = null
          
          if (rawLocation) {
            // 1. WKB Hexadecimal (PostGIS Binary Format)
            if (typeof rawLocation === 'string' && rawLocation.length > 20 && /^[0-9A-F]+$/i.test(rawLocation)) {
              const coords = parseWKBHex(rawLocation)
              if (coords) {
                latitude = coords.latitude
                longitude = coords.longitude
              }
            }
            // 2. GeoJSON Object
            else if (typeof rawLocation === 'object' && rawLocation.type === 'Point' && Array.isArray(rawLocation.coordinates)) {
              longitude = rawLocation.coordinates[0]
              latitude = rawLocation.coordinates[1]
            }
            // 3. WKT String "POINT(lon lat)"
            else if (typeof rawLocation === 'string' && rawLocation.includes('POINT(')) {
              const match = rawLocation.match(/POINT\(([^ ]+) ([^ ]+)\)/)
              if (match) {
                longitude = parseFloat(match[1])
                latitude = parseFloat(match[2])
              }
            }
          }

          // Determinar si está "Activo" (location actualizada hace menos de 1 hora)
          const updateTime = new Date(timestamp).getTime()
          const now = new Date().getTime()
          const is_active = (now - updateTime) < (60 * 60 * 1000) && !!latestUpdate // Solo si viene del historial reciente

          return {
            id: emp.id,
            full_name: emp.full_name,
            latitude: latitude!,
            longitude: longitude!,
            job_title: emp.job_title,
            created_at: timestamp, // Usamos la fecha del update como "created_at/last_update" para visualización
            gps_trust_score: emp.gps_trust_score,
            is_active
          }
        }).filter(emp => {
          const isValid = emp.latitude !== null && emp.longitude !== null && !isNaN(emp.latitude) && !isNaN(emp.longitude)
          return isValid
        })

        setLocations(processedData)
      }

      // 3. Cargar visitas con ubicación (con filtros)
      try {
        let visitsQuery = supabase
          .from('visits')
          .select(`
            *,
            clients:client_id (name, legacy_id),
            employees:seller_id (full_name)
          `)
          .not('check_out_location', 'is', null)
          .gte('start_time', `${dateRange.start}T00:00:00`)
          .lte('start_time', `${dateRange.end}T23:59:59`)
          .order('start_time', { ascending: false })
          .limit(500)
        
        // Filtrar por empleado si no es "ALL"
        if (selectedVisitEmployee !== 'ALL') {
          visitsQuery = visitsQuery.eq('seller_id', selectedVisitEmployee)
        }
        
        const { data: visitsData } = await visitsQuery
        
        if (visitsData) setVisits(visitsData)
      } catch (err) {
        console.warn('No se pudieron cargar visitas:', err)
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
  }, [selectedVisitEmployee, dateRange])

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
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Botón Compartir Mi Ubicación */}
          <button 
            onClick={handleShareLocation} 
            disabled={sharingLocation || !currentEmployeeId}
            className={`flex items-center gap-3 px-6 py-4 rounded-2xl font-bold text-sm transition-all shadow-xl ${
              sharingLocation || !currentEmployeeId
                ? 'bg-gray-400 cursor-not-allowed text-white'
                : shareSuccess
                  ? 'bg-gradient-to-r from-green-500 to-green-600 text-white'
                  : 'bg-gradient-to-r from-blue-500 via-blue-600 to-indigo-600 hover:from-blue-600 hover:via-blue-700 hover:to-indigo-700 text-white shadow-blue-900/30 hover:shadow-2xl hover:scale-105'
            }`}
          >
            {sharingLocation ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Compartiendo...
              </>
            ) : shareSuccess ? (
              <>
                <Navigation className="w-5 h-5" />
                ¡Ubicación Compartida!
              </>
            ) : (
              <>
                <MapPin className="w-5 h-5" />
                Compartir Mi Ubicación
              </>
            )}
          </button>

          {/* Botón Actualizar Ubicaciones */}
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
      </div>

      {/* Mensaje de éxito/error al compartir ubicación */}
      {shareSuccess && (
        <div className="bg-green-50 border-2 border-green-300 text-green-700 p-5 rounded-2xl flex items-start gap-3 shadow-lg animate-pulse">
          <div className="text-2xl flex-shrink-0">✅</div>
          <div>
            <p className="font-bold text-base">¡Ubicación compartida exitosamente!</p>
            <p className="text-sm mt-1">Tu posición GPS ha sido actualizada en el mapa.</p>
          </div>
        </div>
      )}

      {shareError && (
        <div className="bg-red-50 border-2 border-red-300 text-red-700 p-5 rounded-2xl flex items-start gap-3 shadow-lg">
          <div className="text-2xl flex-shrink-0">⚠️</div>
          <div>
            <p className="font-bold text-base">Error al compartir ubicación</p>
            <p className="text-sm mt-1">{shareError}</p>
          </div>
        </div>
      )}

      {/* Filtros de Visitas */}
      <div className="bg-white p-6 rounded-3xl shadow-lg border-2 border-green-100">
        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Filter className="w-5 h-5 text-green-600" />
          Filtros de Visitas
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Filtro por Empleado */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Vendedor
            </label>
            <select
              value={selectedVisitEmployee}
              onChange={(e) => setSelectedVisitEmployee(e.target.value)}
              className="w-full px-4 py-3 text-gray-900 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
            >
              <option value="ALL">Todos los Vendedores</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.full_name}</option>
              ))}
            </select>
          </div>

          {/* Fecha Inicio */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Fecha Inicio
            </label>
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
              className="w-full px-4 py-3 text-gray-900 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
            />
          </div>

          {/* Fecha Fin */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Fecha Fin
            </label>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
              className="w-full px-4 py-3 text-gray-900 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
            />
          </div>
        </div>
        
        {/* Información de resultados */}
        <div className="mt-4 flex items-center justify-between text-sm">
          <p className="text-gray-600">
            Mostrando <span className="font-bold text-green-600">{visits.length}</span> visitas
          </p>
          <button
            onClick={() => {
              setSelectedVisitEmployee('ALL')
              setDateRange({
                start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                end: new Date().toISOString().split('T')[0]
              })
            }}
            className="text-green-600 hover:text-green-700 font-semibold hover:underline"
          >
            Limpiar Filtros
          </button>
        </div>
      </div>

      {/* KPI Card - Diseño vibrante */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                TOTAL
              </span>
            </div>
          </div>
        </div>

        <div className="group relative bg-gradient-to-br from-green-500 via-green-600 to-emerald-600 p-6 rounded-3xl shadow-xl hover:shadow-2xl transition-all duration-300 border-2 border-green-400 hover:scale-105">
          <div className="absolute inset-0 bg-white/10 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
          <div className="relative">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-white/20 backdrop-blur-sm rounded-2xl shadow-lg">
                  <div className="relative">
                     <MapIcon className="w-7 h-7 text-white" />
                     <span className="absolute -top-1 -right-1 flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-red-400"></span>
                    </span>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-green-50 font-semibold">En Línea Ahora</p>
                  <h3 className="text-4xl font-black text-white">
                    {validLocations.filter(e => e.is_active).length}
                  </h3>
                </div>
              </div>
              <span className="text-xs font-bold bg-white text-green-600 px-4 py-1.5 rounded-full shadow-md">
                ACTIVOS ({'<'} 1h)
              </span>
            </div>
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
          <MapLoader 
            selectedEmployeeId={selectedEmployeeId}
            visits={visits}
            onVisitClick={(visit) => {
              setSelectedVisit(visit)
              setShowVisitModal(true)
            }}
            employees={validLocations.map(emp => ({
              ...emp,
              latitude: emp.latitude!,
              longitude: emp.longitude!,
              last_update: getRelativeTime(emp.created_at),
              gps_trust_score: emp.gps_trust_score,
              is_active: emp.is_active
            }))} 
          />
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
                onClick={() => setSelectedEmployeeId(emp.id)}
                className={`bg-white p-5 rounded-2xl border-2 flex items-center gap-4 hover:shadow-xl hover:scale-105 transition-all duration-300 cursor-pointer shadow-md ${
                  emp.is_active ? 'border-green-200 bg-gradient-to-br from-green-50 to-emerald-50' : 'border-gray-200 bg-gray-50'
                } ${selectedEmployeeId === emp.id ? 'ring-4 ring-blue-400 border-blue-400' : ''}`}
              >
                <div className="relative">
                  <div className={`w-14 h-14 rounded-2xl overflow-hidden border-2 shadow-lg flex items-center justify-center font-black text-xl ${
                    (emp.gps_trust_score || 100) < 70 
                    ? 'bg-red-500 border-red-300 text-white' 
                    : 'bg-gradient-to-br from-blue-400 to-indigo-500 border-white text-white'
                  }`}>
                    {emp.full_name.charAt(0)}
                  </div>
                  <div className={`absolute -bottom-1 -right-1 w-4 h-4 border-2 border-white rounded-full ${
                    emp.is_active ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
                  }`}></div>
                </div>
                <div className="flex-1">
                   <div className="flex justify-between items-start">
                     <h4 className="font-black text-gray-900 text-sm">{emp.full_name}</h4>
                     {emp.gps_trust_score !== undefined && (
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          emp.gps_trust_score < 70 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                        }`}>
                          {emp.gps_trust_score}%
                        </span>
                     )}
                   </div>
                   <p className="text-xs text-gray-600 font-medium">{emp.job_title}</p>
                   <p className={`text-xs font-black mt-1 ${emp.is_active ? 'text-green-600' : 'text-gray-500'}`}>
                     {getRelativeTime(emp.created_at)}
                   </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL DE DETALLE DE VISITA */}
      {showVisitModal && selectedVisit && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto my-8">
            {/* Header del Modal */}
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 px-8 py-6 border-b border-gray-200 rounded-t-3xl sticky top-0 z-10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-xl shadow-lg ${
                    selectedVisit.outcome === 'sale' ? 'bg-green-600' :
                    selectedVisit.outcome === 'no_sale' ? 'bg-yellow-600' :
                    'bg-red-600'
                  }`}>
                    <MapPin className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">Detalle de Visita</h2>
                    <p className="text-sm text-gray-600 mt-0.5">
                      {selectedVisit.clients?.name || 'Cliente'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowVisitModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-all"
                >
                  <X className="w-6 h-6 text-gray-600" />
                </button>
              </div>
            </div>

            {/* Contenido del Modal */}
            <div className="p-8 space-y-6">
              {/* Resultado de la Visita */}
              <div className="bg-gradient-to-r from-gray-50 to-slate-50 rounded-2xl p-6 border border-gray-200">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Resultado de la Visita</h3>
                <div className="flex items-center gap-4">
                  <span className={`px-6 py-3 rounded-xl text-base font-bold ${
                    selectedVisit.outcome === 'sale' ? 'bg-green-100 text-green-700' :
                    selectedVisit.outcome === 'no_sale' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {selectedVisit.outcome === 'sale' ? '✓ Venta Exitosa' :
                     selectedVisit.outcome === 'no_sale' ? '✗ Sin Venta' :
                     '🔒 Tienda Cerrada'}
                  </span>
                </div>
              </div>

              {/* Información General */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Cliente */}
                <div className="bg-white rounded-2xl p-6 border-2 border-gray-200">
                  <h4 className="text-sm font-bold text-gray-500 uppercase mb-3">Cliente</h4>
                  <p className="text-xl font-bold text-gray-900">{selectedVisit.clients?.name || 'N/A'}</p>
                  {selectedVisit.clients?.legacy_id && (
                    <p className="text-sm text-gray-600 mt-1">Código: {selectedVisit.clients.legacy_id}</p>
                  )}
                </div>

                {/* Vendedor */}
                <div className="bg-white rounded-2xl p-6 border-2 border-gray-200">
                  <h4 className="text-sm font-bold text-gray-500 uppercase mb-3">Vendedor</h4>
                  <p className="text-xl font-bold text-gray-900">{selectedVisit.employees?.full_name || 'N/A'}</p>
                </div>
              </div>

              {/* Información de Tiempo */}
              <div className="bg-blue-50 rounded-2xl p-6 border-2 border-blue-200">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-blue-600" />
                  Información de Tiempo
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Hora de Inicio</p>
                    <p className="text-base font-bold text-gray-900">
                      {selectedVisit.start_time ? new Date(selectedVisit.start_time).toLocaleString('es-BO') : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Hora de Salida</p>
                    <p className="text-base font-bold text-gray-900">
                      {selectedVisit.end_time ? new Date(selectedVisit.end_time).toLocaleString('es-BO') : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Duración</p>
                    <p className="text-base font-bold text-gray-900">
                      {selectedVisit.duration_seconds 
                        ? `${Math.floor(selectedVisit.duration_seconds / 60)} min ${selectedVisit.duration_seconds % 60} seg`
                        : 'N/A'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Información GPS */}
              <div className="bg-purple-50 rounded-2xl p-6 border-2 border-purple-200">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Navigation className="w-5 h-5 text-purple-600" />
                  Datos GPS
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Ubicación Check-In</p>
                    <p className="text-xs font-mono text-gray-900">
                      {selectedVisit.check_in_location ? 'Registrada' : 'No disponible'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Ubicación Check-Out</p>
                    <p className="text-xs font-mono text-gray-900">
                      {selectedVisit.latitude && selectedVisit.longitude
                        ? `${selectedVisit.latitude.toFixed(6)}, ${selectedVisit.longitude.toFixed(6)}`
                        : 'No disponible'}
                    </p>
                  </div>
                  {selectedVisit.gps_accuracy_meters && (
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Precisión GPS</p>
                      <p className="text-base font-bold text-gray-900">{selectedVisit.gps_accuracy_meters.toFixed(2)} metros</p>
                    </div>
                  )}
                  {selectedVisit.speed && (
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Velocidad</p>
                      <p className="text-base font-bold text-gray-900">{selectedVisit.speed.toFixed(2)} m/s</p>
                    </div>
                  )}
                  {selectedVisit.heading !== null && selectedVisit.heading !== undefined && (
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Dirección</p>
                      <p className="text-base font-bold text-gray-900">{selectedVisit.heading}°</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Notas */}
              {selectedVisit.notes && (
                <div className="bg-yellow-50 rounded-2xl p-6 border-2 border-yellow-200">
                  <h3 className="text-lg font-bold text-gray-900 mb-3">Notas de la Visita</h3>
                  <p className="text-gray-900">{selectedVisit.notes}</p>
                </div>
              )}

              {/* Información Adicional */}
              <div className="bg-gray-50 rounded-2xl p-6 border border-gray-200">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Información Adicional</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600">ID de Visita:</p>
                    <p className="font-mono text-gray-900 text-xs">{selectedVisit.id}</p>
                  </div>
                  {selectedVisit.created_at && (
                    <div>
                      <p className="text-gray-600">Registrado en Sistema:</p>
                      <p className="text-gray-900">{new Date(selectedVisit.created_at).toLocaleString('es-BO')}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Botón Cerrar */}
              <div className="flex justify-end pt-4">
                <button
                  onClick={() => setShowVisitModal(false)}
                  className="px-8 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl hover:from-green-700 hover:to-emerald-700 font-semibold shadow-lg transition-all"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      </div>
    </div>
  )
}

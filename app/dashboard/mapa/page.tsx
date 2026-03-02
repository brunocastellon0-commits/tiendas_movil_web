'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/utils/supabase/client'
import MapLoader from '@/components/ui/Maploader'
import {
  RefreshCw, Map as MapIcon, Loader2, Users, MapPin, Navigation,
  Filter, X, Clock, Plus, ShoppingCart, Route, Check, AlertCircle
} from 'lucide-react'
import { shareMyLocation } from '@/services/locationService'

// ─── TIPOS ──────────────────────────────────────────────────────────────────
type EmployeeLocation = {
  id: string; full_name: string; latitude: number; longitude: number
  job_title: string; created_at?: string; gps_trust_score?: number; is_active?: boolean
}

type RoutePoint = {
  id: string; latitude: number; longitude: number; label: string; color: string
  client_id: string | null; client_name?: string | null
  vendor_id: string | null; vendor_name?: string | null; zona_id?: string | null
}

type PedidoMarker = {
  id: string; latitude: number; longitude: number; cliente_nombre: string
  total_venta: number; fecha: string; empleado_nombre: string
  estado: string; numero_documento: string
}

// ─── PARSER WKB/GeoJSON ──────────────────────────────────────────────────────
function parseWKBHex(wkbHex: string): { latitude: number; longitude: number } | null {
  try {
    const coordsStart = 18
    const xHex = wkbHex.slice(coordsStart, coordsStart + 16)
    const yHex = wkbHex.slice(coordsStart + 16, coordsStart + 32)
    const hexToDouble = (hex: string) => {
      const bytes = new Uint8Array(8)
      for (let i = 0; i < 8; i++) bytes[i] = parseInt(hex.substr(i * 2, 2), 16)
      return new DataView(bytes.buffer).getFloat64(0, true)
    }
    return { longitude: hexToDouble(xHex), latitude: hexToDouble(yHex) }
  } catch { return null }
}

function parseLocation(loc: any): { latitude: number | null; longitude: number | null } {
  if (!loc) return { latitude: null, longitude: null }
  if (typeof loc === 'string' && loc.length > 20 && /^[0-9A-F]+$/i.test(loc)) {
    const r = parseWKBHex(loc)
    return r ?? { latitude: null, longitude: null }
  }
  if (typeof loc === 'object' && loc.type === 'Point' && Array.isArray(loc.coordinates))
    return { longitude: loc.coordinates[0], latitude: loc.coordinates[1] }
  if (typeof loc === 'string' && loc.includes('POINT(')) {
    const m = loc.match(/POINT\(([^ ]+) ([^ ]+)\)/)
    if (m) return { longitude: parseFloat(m[1]), latitude: parseFloat(m[2]) }
  }
  return { latitude: null, longitude: null }
}

// ─── COMPONENTE PRINCIPAL ────────────────────────────────────────────────────
export default function EmployeesMapPage() {
  const supabase = createClient()

  // Estados principales
  const [locations, setLocations] = useState<EmployeeLocation[]>([])
  const [visits, setVisits] = useState<any[]>([])
  const [pedidos, setPedidos] = useState<PedidoMarker[]>([])
  const [routePoints, setRoutePoints] = useState<RoutePoint[]>([])
  const [clients, setClients] = useState<{ id: string; name: string; code: string }[]>([])
  const [employees, setEmployees] = useState<Array<{ id: string; full_name: string }>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Estados de UI
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null)
  const [currentEmployeeId, setCurrentEmployeeId] = useState<string | null>(null)
  const [sharingLocation, setSharingLocation] = useState(false)
  const [shareSuccess, setShareSuccess] = useState(false)
  const [shareError, setShareError] = useState<string | null>(null)

  // Filtros
  const [selectedVisitEmployee, setSelectedVisitEmployee] = useState<string>('ALL')
  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  })

  // Capas activas
  const [showVisits, setShowVisits] = useState(true)
  const [showPedidos, setShowPedidos] = useState(true)
  const [showRoutePoints, setShowRoutePoints] = useState(true)
  const [showEmployees, setShowEmployees] = useState(true)

  // Modal visita
  const [selectedVisit, setSelectedVisit] = useState<any | null>(null)
  const [showVisitModal, setShowVisitModal] = useState(false)

  // Modo creación de puntos de ruta
  const [creatingRoutePoint, setCreatingRoutePoint] = useState(false)
  const [newPoint, setNewPoint] = useState<{ lat: number; lng: number } | null>(null)
  const [newPointLabel, setNewPointLabel] = useState('')
  const [newPointVendorId, setNewPointVendorId] = useState('')
  const [savingPoint, setSavingPoint] = useState(false)

  // ── Obtener empleado actual
  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: emp } = await supabase.from('employees').select('id').eq('email', user.email).single()
      if (emp) setCurrentEmployeeId(emp.id)
    }
    init()
  }, [])

  // ── Cargar empleados (para filtros)
  useEffect(() => {
    supabase.from('employees').select('id, full_name').order('full_name')
      .then(({ data }) => { if (data) setEmployees(data) })
  }, [])

  // ── Cargar clientes (para asignación a puntos de ruta)
  useEffect(() => {
    supabase.from('clients').select('id, name, code').eq('status', 'Vigente').order('name').limit(500)
      .then(({ data }) => { if (data) setClients(data as any) })
  }, [])

  // ── Cargar puntos de ruta
  const fetchRoutePoints = async () => {
    const query = supabase
      .from('route_points')
      .select(`
        id, latitude, longitude, label, color, vendor_id, zona_id,
        client_id,
        clients:client_id (name),
        employees:vendor_id (full_name)
      `)
      .order('created_at', { ascending: false })

    if (selectedVisitEmployee !== 'ALL') {
      query.eq('vendor_id', selectedVisitEmployee)
    }

    const { data } = await query
    if (data) {
      setRoutePoints(data.map((rp: any) => ({
        ...rp,
        client_name: rp.clients?.name || null,
        vendor_name: rp.employees?.full_name || null,
      })))
    }
  }

  // ── Cargar datos del mapa
  const fetchLocations = async () => {
    try {
      setLoading(true)
      setError(null)

      // 1. Empleados con ubicación
      const { data: empData, error: empErr } = await supabase
        .from('employees')
        .select('id, full_name, location, job_title, created_at, gps_trust_score')
        .not('location', 'is', null)
        .order('created_at', { ascending: false })
      if (empErr) throw empErr

      let recentHistory: any[] = []
      try {
        const { data: hist } = await supabase
          .from('location_history')
          .select('employee_id, location, created_at')
          .order('created_at', { ascending: false })
          .limit(2000)
        if (hist) recentHistory = hist
      } catch { /* silencioso */ }

      if (empData) {
        const processed = empData.map(emp => {
          const latestUpdate = recentHistory.find(h => h.employee_id === emp.id)
          const locationSource = latestUpdate || emp
          const { latitude, longitude } = parseLocation(locationSource.location)
          const timestamp = latestUpdate ? latestUpdate.created_at : emp.created_at
          const is_active = !!latestUpdate && (Date.now() - new Date(timestamp).getTime()) < 3600000
          return { id: emp.id, full_name: emp.full_name, latitude: latitude!, longitude: longitude!, job_title: emp.job_title, created_at: timestamp, gps_trust_score: emp.gps_trust_score, is_active }
        }).filter(e => e.latitude && e.longitude && !isNaN(e.latitude) && !isNaN(e.longitude))
        setLocations(processed)
      }

      // 2. Visitas con ubicación
      try {
        let q = supabase.from('visits')
          .select('*, clients:client_id (name, legacy_id), employees:seller_id (full_name)')
          .not('check_out_location', 'is', null)
          .gte('start_time', `${dateRange.start}T00:00:00`)
          .lte('start_time', `${dateRange.end}T23:59:59`)
          .order('start_time', { ascending: false }).limit(500)
        if (selectedVisitEmployee !== 'ALL') q = q.eq('seller_id', selectedVisitEmployee)
        const { data: vData } = await q
        if (vData) setVisits(vData)
      } catch { /* silencioso */ }

      // 3. Pedidos con ubicación GPS del preventista
      try {
        let q = supabase.from('pedidos')
          .select(`
            id, numero_documento, fecha_pedido, total_venta, estado, empleado_id,
            ubicacion_venta,
            clients:clients_id (name),
            employees:empleado_id (full_name)
          `)
          .not('ubicacion_venta', 'is', null)
          .gte('fecha_pedido', dateRange.start)
          .lte('fecha_pedido', dateRange.end)
          .order('fecha_pedido', { ascending: false }).limit(200)
        if (selectedVisitEmployee !== 'ALL') q = q.eq('empleado_id', selectedVisitEmployee)
        const { data: pData } = await q
        if (pData) {
          const markers: PedidoMarker[] = []
          for (const p of pData) {
            const { latitude, longitude } = parseLocation((p as any).ubicacion_venta)
            if (latitude && longitude && !isNaN(latitude) && !isNaN(longitude)) {
              markers.push({
                id: p.id,
                latitude, longitude,
                cliente_nombre: (p as any).clients?.name || 'Sin cliente',
                total_venta: p.total_venta || 0,
                fecha: new Date(p.fecha_pedido).toLocaleDateString('es-BO'),
                empleado_nombre: (p as any).employees?.full_name || 'Sin empleado',
                estado: p.estado || 'Pendiente',
                numero_documento: p.numero_documento || p.id.slice(0, 8)
              })
            }
          }
          setPedidos(markers)
        }
      } catch (e) { console.warn('No se pudieron cargar pedidos con ubicación:', e) }

      // 4. Puntos de ruta
      await fetchRoutePoints()

    } catch (err: any) {
      setError(err.message || 'Error al cargar datos del mapa')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLocations()
    const interval = setInterval(fetchLocations, 30000)
    return () => clearInterval(interval)
  }, [selectedVisitEmployee, dateRange])

  // ── Compartir ubicación
  const handleShareLocation = async () => {
    if (!currentEmployeeId) { setShareError('No se pudo identificar al empleado actual'); return }
    setSharingLocation(true); setShareError(null); setShareSuccess(false)
    const result = await shareMyLocation(currentEmployeeId)
    if (result.success) { setShareSuccess(true); setTimeout(() => { fetchLocations(); setShareSuccess(false) }, 1000) }
    else setShareError(result.error || 'Error al compartir ubicación')
    setSharingLocation(false)
  }

  // ── Crear punto de ruta
  const handleNewRoutePoint = (lat: number, lng: number) => {
    setNewPoint({ lat, lng })
    setCreatingRoutePoint(false) // desactivar modo al seleccionar punto
  }

  const handleSaveRoutePoint = async () => {
    if (!newPoint) return
    setSavingPoint(true)
    try {
      const { data, error } = await supabase.from('route_points').insert({
        latitude: newPoint.lat,
        longitude: newPoint.lng,
        label: newPointLabel || `Punto ${new Date().toLocaleTimeString('es-BO')}`,
        color: '#6366f1',
        vendor_id: newPointVendorId || currentEmployeeId || null,
        client_id: null,
      }).select().single()

      if (error) throw error

      setNewPoint(null); setNewPointLabel(''); setNewPointVendorId('')
      await fetchRoutePoints()
    } catch (err: any) {
      alert('Error al guardar punto: ' + err.message)
    } finally {
      setSavingPoint(false)
    }
  }

  // ── Asignar cliente a punto de ruta
  const handleAssignClient = async (pointId: string, clientId: string) => {
    const client = clients.find(c => c.id === clientId)
    const { error } = await supabase
      .from('route_points')
      .update({ client_id: clientId, label: client?.name || 'Cliente' })
      .eq('id', pointId)

    if (!error) await fetchRoutePoints()
    else alert('Error al asignar cliente: ' + error.message)
  }

  // ── Helpers
  const getRelativeTime = (ts?: string) => {
    if (!ts) return 'Sin actualizar'
    const diffMins = Math.floor((Date.now() - new Date(ts).getTime()) / 60000)
    if (diffMins < 1) return 'Ahora mismo'
    if (diffMins < 60) return `Hace ${diffMins} min`
    const h = Math.floor(diffMins / 60)
    if (h < 24) return `Hace ${h}h`
    return new Date(ts).toLocaleDateString()
  }

  const validLocations = useMemo(() =>
    locations.filter(e => e.latitude && e.longitude && !isNaN(e.latitude) && !isNaN(e.longitude)),
    [locations]
  )

  // ── Datos filtrados para el mapa según capas activas
  const mapEmployees = showEmployees ? validLocations.map(emp => ({
    ...emp, latitude: emp.latitude!, longitude: emp.longitude!,
    last_update: getRelativeTime(emp.created_at)
  })) : []

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 p-4 sm:p-6 lg:p-8">
      {/* Fondo */}
      <div className="fixed inset-0 z-0 pointer-events-none opacity-30" style={{ backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 35px, rgba(16,185,129,0.2) 35px, rgba(16,185,129,0.2) 39px)` }} />
      <div className="fixed inset-0 z-0 pointer-events-none opacity-20" style={{ backgroundImage: `radial-gradient(circle at 2px 2px, rgba(20,184,166,0.12) 1px, transparent 1px)`, backgroundSize: '48px 48px' }} />

      <div className="relative z-10 space-y-6">

        {/* ── HEADER ── */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl shadow-lg border-2 border-green-100">
          <div>
            <h1 className="text-3xl md:text-4xl font-black bg-gradient-to-r from-green-600 via-green-500 to-emerald-500 bg-clip-text text-transparent flex items-center gap-4">
              <div className="p-4 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl shadow-xl">
                <MapIcon className="w-7 h-7 text-white" />
              </div>
              Mapa de Rutas
            </h1>
            <p className="text-gray-600 text-sm mt-2 font-medium">
              Empleados GPS · Visitas · Pedidos · Puntos de Ruta
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <button onClick={handleShareLocation} disabled={sharingLocation || !currentEmployeeId}
              className={`flex items-center gap-2 px-5 py-3 rounded-2xl font-bold text-sm transition-all shadow-lg ${sharingLocation || !currentEmployeeId ? 'bg-gray-400 cursor-not-allowed text-white' : shareSuccess ? 'bg-green-500 text-white' : 'bg-gradient-to-r from-blue-500 to-indigo-600 hover:scale-105 text-white'}`}>
              {sharingLocation ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
              {sharingLocation ? 'Compartiendo...' : shareSuccess ? '✓ Compartido' : 'Mi Ubicación'}
            </button>
            <button onClick={fetchLocations} disabled={loading}
              className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-bold text-sm transition-all shadow-lg ${loading ? 'bg-gray-400 cursor-not-allowed text-white' : 'bg-gradient-to-r from-green-500 to-emerald-600 hover:scale-105 text-white'}`}>
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              {loading ? 'Cargando...' : 'Actualizar'}
            </button>
          </div>
        </div>

        {shareError && (
          <div className="bg-red-50 border-2 border-red-300 text-red-700 p-4 rounded-2xl flex items-center gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            {shareError}
          </div>
        )}

        {/* ── FILTROS ── */}
        <div className="bg-white p-6 rounded-3xl shadow-lg border-2 border-green-100">
          <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Filter className="w-5 h-5 text-green-600" />
            Filtros y Capas del Mapa
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Preventista</label>
              <select value={selectedVisitEmployee} onChange={e => setSelectedVisitEmployee(e.target.value)}
                className="w-full px-4 py-3 text-gray-900 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500">
                <option value="ALL">Todos los Vendedores</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.full_name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Fecha Inicio</label>
              <input type="date" value={dateRange.start} onChange={e => setDateRange({ ...dateRange, start: e.target.value })}
                className="w-full px-4 py-3 text-gray-900 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Fecha Fin</label>
              <input type="date" value={dateRange.end} onChange={e => setDateRange({ ...dateRange, end: e.target.value })}
                className="w-full px-4 py-3 text-gray-900 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
          </div>

          {/* Toggle de capas */}
          <div className="flex flex-wrap gap-3">
            {[
              { key: 'emp', label: `👤 Empleados (${validLocations.length})`, state: showEmployees, set: setShowEmployees, color: 'green' },
              { key: 'vis', label: `📍 Visitas (${visits.length})`, state: showVisits, set: setShowVisits, color: 'yellow' },
              { key: 'ped', label: `🛒 Pedidos (${pedidos.length})`, state: showPedidos, set: setShowPedidos, color: 'blue' },
              { key: 'rp', label: `🗺️ Puntos de Ruta (${routePoints.length})`, state: showRoutePoints, set: setShowRoutePoints, color: 'purple' },
            ].map(layer => (
              <button key={layer.key} onClick={() => layer.set(!layer.state)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold border-2 transition-all ${layer.state ? 'bg-gray-900 text-white border-gray-800' : 'bg-white text-gray-500 border-gray-200'}`}>
                {layer.state ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                {layer.label}
              </button>
            ))}
            <button onClick={() => setSelectedVisitEmployee('ALL')} className="ml-auto text-sm text-green-600 hover:underline font-semibold">
              Limpiar Filtros
            </button>
          </div>
        </div>

        {/* ── BARRA DE CREAR PUNTO DE RUTA ── */}
        <div className={`bg-white p-5 rounded-3xl shadow-lg border-2 transition-all ${creatingRoutePoint ? 'border-indigo-400 bg-indigo-50' : 'border-green-100'}`}>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-indigo-100 rounded-2xl">
                <Route className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900">Puntos de Ruta</h3>
                <p className="text-xs text-gray-500">Crea puntos en el mapa para planificar rutas, luego asigna clientes</p>
              </div>
            </div>
            <button
              onClick={() => { setCreatingRoutePoint(!creatingRoutePoint); setNewPoint(null) }}
              className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-bold text-sm transition-all shadow-lg ${creatingRoutePoint
                  ? 'bg-red-500 hover:bg-red-600 text-white'
                  : 'bg-gradient-to-r from-indigo-500 to-purple-600 hover:scale-105 text-white'
                }`}
            >
              {creatingRoutePoint ? (<><X className="w-4 h-4" /> Cancelar</>) : (<><Plus className="w-4 h-4" /> Nuevo Punto</>)}
            </button>
          </div>

          {/* Modal rápido para guardar punto */}
          {newPoint && (
            <div className="mt-4 p-4 bg-indigo-50 border-2 border-indigo-200 rounded-2xl animate-pulse-once">
              <p className="text-sm font-bold text-indigo-700 mb-3">
                📍 Punto seleccionado: <span className="font-mono">{newPoint.lat.toFixed(5)}, {newPoint.lng.toFixed(5)}</span>
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                <input
                  type="text"
                  placeholder="Etiqueta del punto (ej: Zona Norte, Stop 3...)"
                  value={newPointLabel}
                  onChange={e => setNewPointLabel(e.target.value)}
                  className="px-4 py-2 border-2 border-indigo-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
                <select
                  value={newPointVendorId}
                  onChange={e => setNewPointVendorId(e.target.value)}
                  className="px-4 py-2 border-2 border-indigo-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                >
                  <option value="">Asignar a preventista (opcional)</option>
                  {employees.map(e => <option key={e.id} value={e.id}>{e.full_name}</option>)}
                </select>
              </div>
              <div className="flex gap-3">
                <button onClick={handleSaveRoutePoint} disabled={savingPoint}
                  className="flex items-center gap-2 px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm transition-all shadow-md disabled:opacity-50">
                  {savingPoint ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  {savingPoint ? 'Guardando...' : 'Guardar Punto'}
                </button>
                <button onClick={() => setNewPoint(null)} className="px-5 py-2 border-2 border-gray-200 text-gray-600 rounded-xl font-bold text-sm hover:bg-gray-50 transition-all">
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── KPIs ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Empleados en Ruta', value: validLocations.length, icon: '👤', color: 'from-blue-500 to-indigo-600' },
            { label: 'En Línea Ahora', value: validLocations.filter(e => e.is_active).length, icon: '🟢', color: 'from-green-500 to-emerald-600' },
            { label: 'Visitas Registradas', value: visits.length, icon: '📍', color: 'from-yellow-500 to-orange-500' },
            { label: 'Pedidos en Mapa', value: pedidos.length, icon: '🛒', color: 'from-purple-500 to-pink-500' },
          ].map((kpi, i) => (
            <div key={i} className={`bg-gradient-to-br ${kpi.color} p-5 rounded-3xl shadow-xl border-2 border-white/20 hover:scale-105 transition-all`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-2xl">{kpi.icon}</span>
              </div>
              <p className="text-3xl font-black text-white">{kpi.value}</p>
              <p className="text-xs text-white/80 font-semibold mt-1">{kpi.label}</p>
            </div>
          ))}
        </div>

        {error && (
          <div className="bg-red-50 border-2 border-red-300 text-red-700 p-4 rounded-2xl flex items-center gap-3">
            <AlertCircle className="w-5 h-5" />
            {error}
          </div>
        )}

        {/* ── MAPA ── */}
        <div className="bg-white rounded-3xl shadow-2xl border-2 border-green-100 overflow-hidden">
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 px-6 py-4 border-b-2 border-green-200">
            <h2 className="text-xl font-black text-gray-900">Mapa Interactivo</h2>
            <p className="text-sm text-gray-600 mt-0.5 font-medium">
              {validLocations.length > 0 ? `${validLocations.length} empleados · ${visits.length} visitas · ${pedidos.length} pedidos · ${routePoints.length} puntos` : 'Esperando datos GPS...'}
              {creatingRoutePoint && <span className="ml-3 text-indigo-600 font-bold animate-pulse">🎯 Haz clic en el mapa para colocar un punto</span>}
            </p>
          </div>
          <div className="p-4">
            <MapLoader
              employees={mapEmployees}
              selectedEmployeeId={selectedEmployeeId}
              visits={showVisits ? visits : []}
              pedidos={showPedidos ? pedidos : []}
              routePoints={showRoutePoints ? routePoints : []}
              onVisitClick={(v) => { setSelectedVisit(v); setShowVisitModal(true) }}
              creatingRoutePoint={creatingRoutePoint}
              onNewRoutePoint={handleNewRoutePoint}
              clients={clients}
              onAssignClient={handleAssignClient}
            />
          </div>
        </div>

        {/* ── LISTA DE EMPLEADOS ── */}
        {validLocations.length > 0 && (
          <div className="bg-white rounded-3xl shadow-2xl border-2 border-green-100 p-6">
            <h2 className="text-xl font-black text-gray-900 mb-5">Personal en Tiempo Real</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {validLocations.map(emp => (
                <div key={emp.id} onClick={() => setSelectedEmployeeId(emp.id)}
                  className={`p-4 rounded-2xl border-2 flex items-center gap-3 hover:shadow-lg hover:scale-105 transition-all cursor-pointer ${emp.is_active ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'} ${selectedEmployeeId === emp.id ? 'ring-4 ring-blue-400 border-blue-400' : ''}`}>
                  <div className="relative">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg shadow-md ${(emp.gps_trust_score || 100) < 70 ? 'bg-red-500 text-white' : 'bg-gradient-to-br from-blue-400 to-indigo-500 text-white'}`}>
                      {emp.full_name.charAt(0)}
                    </div>
                    <div className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 border-2 border-white rounded-full ${emp.is_active ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-900 text-sm truncate">{emp.full_name}</p>
                    <p className="text-xs text-gray-500">{emp.job_title}</p>
                    <p className={`text-xs font-bold ${emp.is_active ? 'text-green-600' : 'text-gray-400'}`}>
                      {getRelativeTime(emp.created_at)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── LISTA PUNTOS DE RUTA ── */}
        {routePoints.length > 0 && (
          <div className="bg-white rounded-3xl shadow-2xl border-2 border-indigo-100 p-6">
            <h2 className="text-xl font-black text-gray-900 mb-5 flex items-center gap-2">
              <Route className="w-5 h-5 text-indigo-500" />
              Puntos de Ruta ({routePoints.length})
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {routePoints.map(rp => (
                <div key={rp.id} className={`p-4 rounded-2xl border-2 ${rp.client_id ? 'border-green-200 bg-green-50' : 'border-indigo-200 bg-indigo-50'}`}>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-bold text-gray-900 text-sm">{rp.client_id ? `🏪 ${rp.client_name}` : `📍 ${rp.label || 'Sin etiqueta'}`}</p>
                      {rp.vendor_name && <p className="text-xs text-gray-500 mt-0.5">👤 {rp.vendor_name}</p>}
                      <p className="text-xs font-mono text-gray-400 mt-1">{rp.latitude.toFixed(5)}, {rp.longitude.toFixed(5)}</p>
                    </div>
                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${rp.client_id ? 'bg-green-200 text-green-700' : 'bg-indigo-200 text-indigo-700'}`}>
                      {rp.client_id ? 'Asignado' : 'Libre'}
                    </span>
                  </div>
                  {!rp.client_id && (
                    <div className="mt-3 flex gap-2">
                      <select
                        id={`list-assign-${rp.id}`}
                        className="flex-1 px-3 py-1.5 text-xs border-2 border-indigo-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400"
                      >
                        <option value="">Asignar cliente...</option>
                        {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                      <button
                        onClick={() => {
                          const sel = document.getElementById(`list-assign-${rp.id}`) as HTMLSelectElement
                          if (sel?.value) handleAssignClient(rp.id, sel.value)
                        }}
                        className="px-3 py-1.5 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all"
                      >
                        Asignar
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* ── MODAL VISITA ── */}
      {showVisitModal && selectedVisit && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 px-6 py-5 border-b border-gray-200 rounded-t-3xl sticky top-0 z-10">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">Detalle de Visita</h2>
                <button onClick={() => setShowVisitModal(false)} className="p-2 hover:bg-gray-100 rounded-xl transition-all">
                  <X className="w-5 h-5 text-gray-600" />
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 p-4 rounded-2xl">
                  <p className="text-xs text-gray-500 mb-1">Cliente</p>
                  <p className="font-bold text-gray-900">{selectedVisit.clients?.name || 'N/A'}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-2xl">
                  <p className="text-xs text-gray-500 mb-1">Vendedor</p>
                  <p className="font-bold text-gray-900">{selectedVisit.employees?.full_name || 'N/A'}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-2xl">
                  <p className="text-xs text-gray-500 mb-1">Resultado</p>
                  <p className="font-bold">{selectedVisit.outcome === 'sale' ? '💰 Venta Exitosa' : selectedVisit.outcome === 'no_sale' ? '✗ Sin Venta' : '🔒 Tienda Cerrada'}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-2xl">
                  <p className="text-xs text-gray-500 mb-1">Fecha</p>
                  <p className="font-bold text-gray-900">{selectedVisit.start_time ? new Date(selectedVisit.start_time).toLocaleString('es-BO') : 'N/A'}</p>
                </div>
              </div>
              {selectedVisit.notes && (
                <div className="bg-yellow-50 border-2 border-yellow-200 p-4 rounded-2xl">
                  <p className="text-xs text-yellow-700 font-bold mb-1">Notas</p>
                  <p className="text-gray-900 text-sm">{selectedVisit.notes}</p>
                </div>
              )}
              <div className="flex justify-end">
                <button onClick={() => setShowVisitModal(false)} className="px-6 py-3 bg-green-600 text-white rounded-2xl font-bold hover:bg-green-700 transition-all">
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

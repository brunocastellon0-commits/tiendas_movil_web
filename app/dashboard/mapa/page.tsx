'use client'

import MapLoader from '@/components/ui/Maploader'
import { shareMyLocation } from '@/services/locationService'
import { createClient } from '@/utils/supabase/client'
import {
    AlertCircle,
    Bell,
    BellOff,
    Check,
    ChevronDown, ChevronUp,
    Eye,
    FileText,
    Loader2,
    Map as MapIcon,
    MapPin,
    Navigation,
    RefreshCw,
    Search,
    ShoppingBag,
    Users,
    Wifi,
    WifiOff,
    X
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

// ─── TIPOS ──────────────────────────────────────────────────────────────────
type EmployeeLocation = {
  id: string; full_name: string; latitude: number; longitude: number
  job_title: string; created_at?: string; gps_trust_score?: number; is_active?: boolean
}

type PedidoMarker = {
  id: string; latitude: number; longitude: number; cliente_nombre: string
  total_venta: number; fecha: string; empleado_nombre: string
  estado: string; numero_documento: string
}

type MapAlert = {
  id: string
  employee_id: string
  employee_name: string
  event_type: 'enabled' | 'disabled' | 'location_update'
  timestamp: string
  reason?: string | null
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
  if (typeof loc === 'string') {
    const m = loc.match(/POINT\s*\(\s*([\-\d.]+)\s+([\-\d.]+)\s*\)/i)
    if (m) return { longitude: parseFloat(m[1]), latitude: parseFloat(m[2]) }
  }
  return { latitude: null, longitude: null }
}

// ─── HELPERS ────────────────────────────────────────────────────────────────
function getAlertLabel(alert: MapAlert): { icon: React.ReactNode; text: string; color: string } {
  if (alert.event_type === 'enabled') return {
    icon: <Navigation className="w-3.5 h-3.5" />,
    text: `${alert.employee_name} activó el GPS`,
    color: 'bg-green-50 border-green-300 text-green-800'
  }
  if (alert.event_type === 'disabled') return {
    icon: <WifiOff className="w-3.5 h-3.5" />,
    text: `${alert.employee_name} desactivó el GPS${alert.reason ? ` (${alert.reason})` : ''}`,
    color: 'bg-red-50 border-red-300 text-red-800'
  }
  return {
    icon: <MapPin className="w-3.5 h-3.5" />,
    text: `${alert.employee_name} actualizó su ubicación`,
    color: 'bg-blue-50 border-blue-300 text-blue-800'
  }
}

function timeAgo(ts: string) {
  const diffMins = Math.floor((Date.now() - new Date(ts).getTime()) / 60000)
  if (diffMins < 1) return 'Ahora mismo'
  if (diffMins < 60) return `Hace ${diffMins} min`
  const h = Math.floor(diffMins / 60)
  if (h < 24) return `Hace ${h}h`
  return new Date(ts).toLocaleDateString()
}

// ─── COMPONENTE PRINCIPAL ────────────────────────────────────────────────────
export default function EmployeesMapPage() {
  const supabase = createClient()

  // ── Datos
  const [locations, setLocations] = useState<EmployeeLocation[]>([])
  const [pedidos, setPedidos] = useState<PedidoMarker[]>([])
  const [employees, setEmployees] = useState<{ id: string; full_name: string }[]>([])

  // ── Alertas en tiempo real
  const [alerts, setAlerts] = useState<MapAlert[]>([])
  const [showAlerts, setShowAlerts] = useState(true)
  const alertsRef = useRef<MapAlert[]>([])
  alertsRef.current = alerts

  // ── Carga
  const [loadingMap, setLoadingMap] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // ── UI
  const [currentEmployeeId, setCurrentEmployeeId] = useState<string | null>(null)
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null)
  const [sharingLocation, setSharingLocation] = useState(false)
  const [shareSuccess, setShareSuccess] = useState(false)
  const [shareError, setShareError] = useState<string | null>(null)

  // ── Filtros
  const [filterEmployee, setFilterEmployee] = useState<string>('ALL')

  // ── Capas del mapa
  const [showPedidos, setShowPedidos] = useState(true)
  const [showEmployees, setShowEmployees] = useState(true)
  const [showVisits, setShowVisits] = useState(true)

  // ── Paneles
  const [showEmployeeList, setShowEmployeeList] = useState(false)
  const [showPedidoList, setShowPedidoList] = useState(false)
  const PEDIDO_PAGE_SIZE = 20
  const [pedidoPage, setPedidoPage] = useState(1)

  // ── Modales
  const [selectedVisit, setSelectedVisit] = useState<any | null>(null)
  const [showVisitModal, setShowVisitModal] = useState(false)
  const [visits, setVisits] = useState<any[]>([])
  const [selectedPedido, setSelectedPedido] = useState<PedidoMarker | null>(null)
  const [showPedidoModal, setShowPedidoModal] = useState(false)

  // ─── INIT: empleado actual ──────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from('employees').select('id').eq('email', user.email!).single()
        .then(({ data }) => { if (data) setCurrentEmployeeId(data.id) })
    })
  }, [])

  // ─── Cargar catálogo de empleados ─────────────────────────────────────────
  useEffect(() => {
    supabase.from('employees').select('id, full_name').order('full_name')
      .then(({ data }) => { if (data) setEmployees(data) })
  }, [])

  // ─── Cargar mapa base ────────────────────────────────────────────────────
  const fetchMapBase = async () => {
    try {
      setLoadingMap(true)
      setError(null)

      // Empleados con ubicación
      const { data: empData } = await supabase
        .from('employees')
        .select('id, full_name, location, job_title, created_at, gps_trust_score')
        .not('location', 'is', null)
        .order('created_at', { ascending: false })

      let recentHistory: any[] = []
      try {
        const { data: hist } = await supabase
          .from('location_history')
          .select('employee_id, location, created_at')
          .order('created_at', { ascending: false })
          .limit(500)
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

      // Pedidos con ubicación
      try {
        let q = supabase.from('pedidos')
          .select(`id, numero_documento, fecha_pedido, total_venta, estado, empleado_id,
            ubicacion_venta, clients:clients_id (name), employees:empleado_id (full_name)`)
          .not('ubicacion_venta', 'is', null)
          .order('fecha_pedido', { ascending: false }).limit(100)
        if (filterEmployee !== 'ALL') q = q.eq('empleado_id', filterEmployee)
        const { data: pData } = await q
        if (pData) {
          const markers: PedidoMarker[] = []
          for (const p of pData) {
            const { latitude, longitude } = parseLocation((p as any).ubicacion_venta)
            if (latitude && longitude && !isNaN(latitude) && !isNaN(longitude)) {
              markers.push({
                id: p.id, latitude, longitude,
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
      } catch { /* silencioso */ }

      // Visitas
      try {
        let q = supabase.from('visits')
          .select('*, clients:client_id (name, legacy_id), employees:seller_id (full_name), check_in_location, check_out_location')
          .or('check_in_location.not.is.null,check_out_location.not.is.null')
          .neq('outcome', 'pending')
          .order('start_time', { ascending: false }).limit(200)
        if (filterEmployee !== 'ALL') q = q.eq('seller_id', filterEmployee)
        const { data: vData } = await q
        if (vData) setVisits(vData)
      } catch { /* silencioso */ }

    } catch (err: any) {
      setError(err.message || 'Error al cargar datos del mapa')
    } finally {
      setLoadingMap(false)
    }
  }

  useEffect(() => { fetchMapBase() }, [filterEmployee])

  // ─── Cargar alertas iniciales ────────────────────────────────────────────
  const loadInitialAlerts = async () => {
    try {
      const { data } = await supabase
        .from('location_events')
        .select('id, employee_id, event_type, reason, timestamp, employees:employee_id (full_name)')
        .order('timestamp', { ascending: false })
        .limit(20)
      if (data) {
        const mapped: MapAlert[] = data.map((e: any) => ({
          id: e.id,
          employee_id: e.employee_id,
          employee_name: e.employees?.full_name || 'Empleado',
          event_type: e.event_type as 'enabled' | 'disabled',
          timestamp: e.timestamp,
          reason: e.reason,
        }))
        setAlerts(mapped)
      }
    } catch { /* silencioso */ }
  }

  // ─── Suscripción Realtime a location_events ─────────────────────────────
  useEffect(() => {
    loadInitialAlerts()

    // Suscripción a nuevos eventos GPS
    const eventsChannel = supabase
      .channel('location-events-realtime')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'location_events'
      }, async (payload) => {
        const ev = payload.new as any
        // Fetch employee name
        const { data: emp } = await supabase
          .from('employees')
          .select('full_name')
          .eq('id', ev.employee_id)
          .single()
        const newAlert: MapAlert = {
          id: ev.id,
          employee_id: ev.employee_id,
          employee_name: emp?.full_name || 'Empleado',
          event_type: ev.event_type as 'enabled' | 'disabled',
          timestamp: ev.timestamp || ev.created_at,
          reason: ev.reason,
        }
        setAlerts(prev => [newAlert, ...prev].slice(0, 30))
      })
      .subscribe()

    // Suscripción a actualizaciones de ubicación (location_history)
    const histChannel = supabase
      .channel('location-history-realtime')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'location_history'
      }, async (payload) => {
        const ev = payload.new as any
        const { data: emp } = await supabase
          .from('employees')
          .select('full_name')
          .eq('id', ev.employee_id)
          .single()
        const locAlert: MapAlert = {
          id: ev.id,
          employee_id: ev.employee_id,
          employee_name: emp?.full_name || 'Empleado',
          event_type: 'location_update',
          timestamp: ev.timestamp || ev.created_at,
        }
        // Only add location_update alerts — avoid flood: skip if same employee updated < 2 min ago
        const recent = alertsRef.current.find(
          a => a.employee_id === ev.employee_id && a.event_type === 'location_update' &&
          (Date.now() - new Date(a.timestamp).getTime()) < 120000
        )
        if (!recent) {
          setAlerts(prev => [locAlert, ...prev].slice(0, 30))
        }
        // Also refresh map base to move the marker
        fetchMapBase()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(eventsChannel)
      supabase.removeChannel(histChannel)
    }
  }, [])

  // ─── Compartir ubicación ──────────────────────────────────────────────────
  const handleShareLocation = async () => {
    if (!currentEmployeeId) { setShareError('No se pudo identificar al empleado actual'); return }
    setSharingLocation(true); setShareError(null); setShareSuccess(false)
    const result = await shareMyLocation(currentEmployeeId)
    if (result.success) { setShareSuccess(true); setTimeout(() => { fetchMapBase(); setShareSuccess(false) }, 1000) }
    else setShareError(result.error || 'Error al compartir ubicación')
    setSharingLocation(false)
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────
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
  const mapEmployees = showEmployees ? validLocations.map(emp => ({
    ...emp, latitude: emp.latitude!, longitude: emp.longitude!,
    last_update: getRelativeTime(emp.created_at)
  })) : []

  // ─── UI ───────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 p-4 sm:p-6">
      <div className="fixed inset-0 z-0 pointer-events-none opacity-30" style={{ backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 35px, rgba(16,185,129,0.2) 35px, rgba(16,185,129,0.2) 39px)` }} />

      <div className="relative z-10 space-y-4">

        {/* ── HEADER ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-3xl shadow-lg border-2 border-green-100">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl shadow-xl">
              <MapIcon className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black bg-gradient-to-r from-green-600 to-emerald-500 bg-clip-text text-transparent">
                Mapa en Tiempo Real
              </h1>
              <p className="text-gray-500 text-xs font-medium">
                {validLocations.length} empleados · {pedidos.length} pedidos · {visits.length} visitas
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleShareLocation} disabled={sharingLocation || !currentEmployeeId}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-bold text-sm transition-all shadow ${sharingLocation || !currentEmployeeId ? 'bg-gray-300 cursor-not-allowed text-white' : shareSuccess ? 'bg-green-500 text-white' : 'bg-gradient-to-r from-blue-500 to-indigo-600 hover:scale-105 text-white'}`}>
              {sharingLocation ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
              {sharingLocation ? 'Compartiendo...' : shareSuccess ? '✓' : 'Mi Ubicación'}
            </button>
            <button onClick={fetchMapBase} disabled={loadingMap}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-bold text-sm transition-all shadow ${loadingMap ? 'bg-gray-300 cursor-not-allowed text-white' : 'bg-gradient-to-r from-green-500 to-emerald-600 hover:scale-105 text-white'}`}>
              <RefreshCw className={`w-4 h-4 ${loadingMap ? 'animate-spin' : ''}`} />
              {loadingMap ? 'Cargando...' : 'Actualizar'}
            </button>
          </div>
        </div>

        {shareError && (
          <div className="bg-red-50 border-2 border-red-300 text-red-700 p-3 rounded-2xl flex items-center gap-2 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {shareError}
          </div>
        )}

        {/* ── PANEL DE ALERTAS EN TIEMPO REAL ── */}
        <div className="bg-white rounded-3xl shadow-lg border-2 border-amber-100 overflow-hidden">
          <button
            onClick={() => setShowAlerts(!showAlerts)}
            className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-amber-50 transition-all"
          >
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-amber-100 rounded-xl">
                <Bell className="w-4 h-4 text-amber-600" />
              </div>
              <span className="font-black text-gray-900 text-sm">Alertas en Tiempo Real</span>
              {alerts.length > 0 && (
                <span className="bg-amber-500 text-white text-xs font-black px-2 py-0.5 rounded-full animate-pulse">
                  {alerts.length}
                </span>
              )}
              <span className="text-xs text-gray-400 font-medium">Actividad GPS de empleados</span>
            </div>
            {showAlerts ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
          </button>
          {showAlerts && (
            <div className="px-4 pb-4">
              {alerts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 gap-2 text-gray-400">
                  <BellOff className="w-8 h-8 opacity-40" />
                  <p className="text-sm font-medium">Sin actividad reciente</p>
                  <p className="text-xs">Las alertas aparecerán aquí cuando los empleados actualicen su GPS</p>
                </div>
              ) : (
                <div className="space-y-1.5 max-h-52 overflow-y-auto">
                  {alerts.map(alert => {
                    const { icon, text, color } = getAlertLabel(alert)
                    return (
                      <div key={alert.id} className={`flex items-start gap-2.5 px-3 py-2 rounded-xl border text-sm ${color}`}>
                        <div className="flex-shrink-0 mt-0.5">{icon}</div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold truncate">{text}</p>
                        </div>
                        <span className="text-[11px] font-medium opacity-60 flex-shrink-0 mt-0.5">{timeAgo(alert.timestamp)}</span>
                      </div>
                    )
                  })}
                </div>
              )}
              <div className="flex justify-end mt-2">
                <button
                  onClick={() => setAlerts([])}
                  className="text-xs text-gray-400 hover:text-red-500 font-bold transition-colors"
                >
                  Limpiar alertas
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── FILTROS ── */}
        <div className="bg-white p-4 rounded-3xl shadow-lg border-2 border-green-100">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            {/* Preventista */}
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1.5 flex items-center gap-1">
                <Users className="w-3.5 h-3.5" /> Preventista
              </label>
              <select value={filterEmployee} onChange={e => setFilterEmployee(e.target.value)}
                className="w-full px-3 py-2.5 text-sm text-gray-900 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 font-medium">
                <option value="ALL">Todos los Vendedores</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.full_name}</option>)}
              </select>
            </div>
          </div>

          {/* Capas del mapa */}
          <div className="flex flex-wrap gap-2 pt-3 border-t border-gray-100">
            <span className="text-xs font-bold text-gray-500 self-center mr-1">Capas:</span>
            {[
              { key: 'emp', label: `Empleados (${validLocations.length})`, state: showEmployees, set: setShowEmployees },
              { key: 'vis', label: `Visitas (${visits.length})`, state: showVisits, set: setShowVisits },
              { key: 'ped', label: `Pedidos (${pedidos.length})`, state: showPedidos, set: setShowPedidos },
            ].map(layer => (
              <button key={layer.key} onClick={() => layer.set(!layer.state)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border-2 transition-all ${layer.state ? 'bg-gray-900 text-white border-gray-800' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'}`}>
                {layer.state ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                {layer.label}
              </button>
            ))}
            {filterEmployee !== 'ALL' && (
              <button
                onClick={() => setFilterEmployee('ALL')}
                className="ml-auto text-xs text-red-500 hover:underline font-bold self-center"
              >
                ✕ Limpiar filtros
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border-2 border-red-300 text-red-700 p-3 rounded-2xl flex items-center gap-2 text-sm">
            <AlertCircle className="w-4 h-4" /> {error}
          </div>
        )}

        {/* ── MAPA ── */}
        <div className="bg-white rounded-3xl shadow-2xl border-2 border-green-100 overflow-hidden">
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 px-5 py-3 border-b-2 border-green-200 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-black text-gray-900">Mapa Interactivo</h2>
              <p className="text-xs text-gray-500 font-medium">
                {[
                showEmployees && `${validLocations.length} empleados`,
                showVisits && `${visits.length} visitas`,
                showPedidos && `${pedidos.length} pedidos`,
              ].filter(Boolean).join(' · ') || 'Sin filtros activos'}
              </p>
            </div>
          </div>
          <div className="p-3">
            <MapLoader
              employees={mapEmployees}
              selectedEmployeeId={selectedEmployeeId}
              visits={showVisits ? visits : []}
              pedidos={showPedidos ? pedidos : []}
              routePoints={[]}
              onVisitClick={(v) => { setSelectedVisit(v); setShowVisitModal(true) }}
              onPedidoClick={(p: PedidoMarker) => { setSelectedPedido(p); setShowPedidoModal(true) }}
              creatingRoutePoint={false}
              onNewRoutePoint={() => {}}
              clients={[]}
              onAssignClient={async () => {}}
            />
          </div>
        </div>

        {/* ── LISTA DE EMPLEADOS (colapsable) ── */}
        {validLocations.length > 0 && (
          <div className="bg-white rounded-3xl shadow border-2 border-green-100 overflow-hidden">
            <button
              onClick={() => setShowEmployeeList(!showEmployeeList)}
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-green-50 transition-all"
            >
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-green-600" />
                <span className="font-black text-gray-900 text-sm">Personal en Ruta</span>
                <span className="bg-green-100 text-green-700 text-xs font-black px-2 py-0.5 rounded-full">
                  {validLocations.filter(e => e.is_active).length} activos / {validLocations.length}
                </span>
              </div>
              {showEmployeeList ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
            </button>
            {showEmployeeList && (
              <div className="px-5 pb-5">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                  {validLocations.map(emp => (
                    <div key={emp.id} onClick={() => setSelectedEmployeeId(emp.id)}
                      className={`p-3 rounded-2xl border-2 flex items-center gap-2.5 hover:shadow cursor-pointer transition-all ${emp.is_active ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'} ${selectedEmployeeId === emp.id ? 'ring-2 ring-blue-400 border-blue-400' : ''}`}>
                      <div className="relative flex-shrink-0">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm shadow ${(emp.gps_trust_score || 100) < 70 ? 'bg-red-500 text-white' : 'bg-gradient-to-br from-blue-400 to-indigo-500 text-white'}`}>
                          {emp.full_name.charAt(0)}
                        </div>
                        <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 border-2 border-white rounded-full ${emp.is_active ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-gray-900 text-xs truncate">{emp.full_name}</p>
                        <p className={`text-[10px] font-bold ${emp.is_active ? 'text-green-600' : 'text-gray-400'}`}>
                          {getRelativeTime(emp.created_at)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── LISTA DE PEDIDOS (colapsable) ── */}
        {pedidos.length > 0 && (
          <div className="bg-white rounded-3xl shadow border-2 border-green-100 overflow-hidden">
            <button
              onClick={() => { setShowPedidoList(!showPedidoList); setPedidoPage(1) }}
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-green-50 transition-all"
            >
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-green-600" />
                <span className="font-black text-gray-900 text-sm">Pedidos en el Mapa</span>
                <span className="bg-green-100 text-green-700 text-xs font-black px-2 py-0.5 rounded-full">
                  {pedidos.length} pedidos
                </span>
              </div>
              {showPedidoList ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
            </button>
            {showPedidoList && (() => {
              const totalPedidoPages = Math.ceil(pedidos.length / PEDIDO_PAGE_SIZE)
              const paged = pedidos.slice((pedidoPage - 1) * PEDIDO_PAGE_SIZE, pedidoPage * PEDIDO_PAGE_SIZE)
              return (
                <div className="px-5 pb-5">
                  <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-gray-100 text-xs font-black text-gray-500 uppercase rounded-xl mb-2">
                    <div className="col-span-2"># Doc</div>
                    <div className="col-span-2">Fecha</div>
                    <div className="col-span-3">Cliente</div>
                    <div className="col-span-2">Vendedor</div>
                    <div className="col-span-2 text-right">Total</div>
                    <div className="col-span-1"></div>
                  </div>
                  <div className="space-y-1">
                    {paged.map(p => (
                      <div key={p.id}
                        onClick={() => { setSelectedPedido(p); setShowPedidoModal(true) }}
                        className="grid grid-cols-12 gap-2 px-3 py-2.5 bg-gray-50 hover:bg-green-50 rounded-xl border border-gray-200 cursor-pointer transition-all items-center text-sm">
                        <div className="col-span-2 font-black text-gray-700 text-xs">#{p.numero_documento}</div>
                        <div className="col-span-2 text-gray-500 text-xs">{p.fecha}</div>
                        <div className="col-span-3 font-semibold text-gray-800 truncate text-xs">{p.cliente_nombre}</div>
                        <div className="col-span-2 text-gray-500 truncate text-xs">{p.empleado_nombre}</div>
                        <div className="col-span-2 font-black text-green-700 text-right text-xs">
                          {new Intl.NumberFormat('es-BO', { style: 'currency', currency: 'BOB' }).format(p.total_venta)}
                        </div>
                        <div className="col-span-1 flex justify-end">
                          <Eye className="w-3.5 h-3.5 text-gray-400 hover:text-green-600" />
                        </div>
                      </div>
                    ))}
                  </div>
                  {totalPedidoPages > 1 && (
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                      <p className="text-xs text-gray-500">
                        {(pedidoPage - 1) * PEDIDO_PAGE_SIZE + 1}–{Math.min(pedidoPage * PEDIDO_PAGE_SIZE, pedidos.length)} de {pedidos.length}
                      </p>
                      <div className="flex gap-1">
                        <button onClick={() => setPedidoPage(p => Math.max(1, p - 1))} disabled={pedidoPage === 1}
                          className="px-3 py-1 text-xs border rounded-lg font-bold disabled:opacity-40 hover:bg-gray-100 transition-all">
                          ‹ Ant
                        </button>
                        <span className="px-3 py-1 text-xs bg-green-600 text-white rounded-lg font-black">{pedidoPage}/{totalPedidoPages}</span>
                        <button onClick={() => setPedidoPage(p => Math.min(totalPedidoPages, p + 1))} disabled={pedidoPage === totalPedidoPages}
                          className="px-3 py-1 text-xs border rounded-lg font-bold disabled:opacity-40 hover:bg-gray-100 transition-all">
                          Sig ›
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })()}
          </div>
        )}

      </div>

      {/* ── MODAL PEDIDO ── */}
      {showPedidoModal && selectedPedido && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full">
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 px-6 py-4 border-b border-gray-200 rounded-t-3xl flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-green-600" />
                <h2 className="text-lg font-bold text-gray-900">Pedido #{selectedPedido.numero_documento}</h2>
              </div>
              <button onClick={() => setShowPedidoModal(false)} className="p-2 hover:bg-gray-100 rounded-xl transition-all">
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 p-3 rounded-2xl col-span-2">
                  <p className="text-xs text-gray-500 mb-0.5">Cliente</p>
                  <p className="font-bold text-gray-900">{selectedPedido.cliente_nombre}</p>
                </div>
                <div className="bg-gray-50 p-3 rounded-2xl">
                  <p className="text-xs text-gray-500 mb-0.5">Vendedor</p>
                  <p className="font-bold text-gray-900 text-sm">{selectedPedido.empleado_nombre}</p>
                </div>
                <div className="bg-gray-50 p-3 rounded-2xl">
                  <p className="text-xs text-gray-500 mb-0.5">Fecha</p>
                  <p className="font-bold text-gray-900 text-sm">{selectedPedido.fecha}</p>
                </div>
                <div className="bg-green-50 border border-green-200 p-3 rounded-2xl">
                  <p className="text-xs text-gray-500 mb-0.5">Total</p>
                  <p className="font-black text-green-700 text-xl">
                    {new Intl.NumberFormat('es-BO', { style: 'currency', currency: 'BOB' }).format(selectedPedido.total_venta)}
                  </p>
                </div>
                <div className="bg-gray-50 p-3 rounded-2xl">
                  <p className="text-xs text-gray-500 mb-0.5">Estado</p>
                  <p className="font-bold text-sm">
                    {selectedPedido.estado === 'Pendiente' ? 'Pendiente'
                      : selectedPedido.estado === 'Aprobado' ? 'Aprobado'
                      : selectedPedido.estado === 'Entregado' ? 'Entregado'
                      : selectedPedido.estado === 'Completado' ? 'Completado'
                      : selectedPedido.estado}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 p-3 rounded-2xl text-xs text-blue-700">
                <FileText className="w-4 h-4 flex-shrink-0" />
                <span>Para ver el detalle completo, ve a <strong>Ventas</strong> y busca #{selectedPedido.numero_documento}</span>
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setShowPedidoModal(false)}
                  className="px-5 py-2.5 bg-green-600 text-white rounded-2xl font-bold text-sm hover:bg-green-700 transition-all">
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL VISITA ── */}
      {showVisitModal && selectedVisit && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 px-6 py-4 border-b border-gray-200 rounded-t-3xl sticky top-0">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-900">Detalle de Visita</h2>
                <button onClick={() => setShowVisitModal(false)} className="p-2 hover:bg-gray-100 rounded-xl transition-all">
                  <X className="w-5 h-5 text-gray-600" />
                </button>
              </div>
            </div>
            <div className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 p-3 rounded-2xl">
                  <p className="text-xs text-gray-500 mb-0.5">Cliente</p>
                  <p className="font-bold text-gray-900 text-sm">{selectedVisit.clients?.name || 'N/A'}</p>
                </div>
                <div className="bg-gray-50 p-3 rounded-2xl">
                  <p className="text-xs text-gray-500 mb-0.5">Vendedor</p>
                  <p className="font-bold text-gray-900 text-sm">{selectedVisit.employees?.full_name || 'N/A'}</p>
                </div>
                <div className="bg-gray-50 p-3 rounded-2xl">
                  <p className="text-xs text-gray-500 mb-0.5">Resultado</p>
                  <p className="font-bold text-sm">{selectedVisit.outcome === 'sale' ? 'Venta' : selectedVisit.outcome === 'no_sale' ? 'Sin Venta' : 'Cerrado'}</p>
                </div>
                <div className="bg-gray-50 p-3 rounded-2xl">
                  <p className="text-xs text-gray-500 mb-0.5">Fecha</p>
                  <p className="font-bold text-gray-900 text-sm">{selectedVisit.start_time ? new Date(selectedVisit.start_time).toLocaleString('es-BO') : 'N/A'}</p>
                </div>
                {selectedVisit.notes && (
                  <div className="bg-gray-50 p-3 rounded-2xl col-span-2">
                    <p className="text-xs text-gray-500 mb-0.5">Notas</p>
                    <p className="text-sm text-gray-800">{selectedVisit.notes}</p>
                  </div>
                )}
              </div>
              <div className="flex justify-end">
                <button onClick={() => setShowVisitModal(false)} className="px-5 py-2.5 bg-green-600 text-white rounded-2xl font-bold text-sm hover:bg-green-700">
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

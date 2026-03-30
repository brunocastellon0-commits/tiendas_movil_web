'use client'

import MapLoader from '@/components/ui/Maploader'
import { shareMyLocation } from '@/services/locationService'
import { createClient } from '@/utils/supabase/client'
import {
    AlertCircle,
    CalendarDays,
    Check,
    CheckCircle2,
    ChevronDown, ChevronUp,
    Loader2,
    Map as MapIcon,
    MapPin,
    Navigation,
    RefreshCw,
    Users,
    WifiOff,
    X,
    XCircle
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
function formatDuration(seconds: number): string {
  if (!seconds || seconds < 0) return '0 seg'
  if (seconds < 60) return `${seconds} seg`
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  if (m < 60) return s > 0 ? `${m} min ${s} seg` : `${m} min`
  const h = Math.floor(m / 60)
  const rem = m % 60
  return rem > 0 ? `${h}h ${rem} min` : `${h}h`
}

function outcomeLabel(outcome: string): { icon: React.ReactNode; label: string; color: string } {
  switch (outcome) {
    case 'sale': return { icon: <CheckCircle2 className="w-4 h-4" />, label: 'Venta', color: 'text-green-700 bg-green-50 border-green-200' }
    case 'no_sale': return { icon: <XCircle className="w-4 h-4" />, label: 'Sin Venta', color: 'text-red-700 bg-red-50 border-red-200' }
    default: return { icon: null, label: outcome || 'N/A', color: 'text-gray-700 bg-gray-50 border-gray-200' }
  }
}

// Default: today
function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

// ─── COMPONENTE PRINCIPAL ────────────────────────────────────────────────────
export default function EmployeesMapPage() {
  const supabase = createClient()

  // ── Datos
  const [locations, setLocations] = useState<EmployeeLocation[]>([])
  const [pedidos, setPedidos] = useState<PedidoMarker[]>([])
  const [employees, setEmployees] = useState<{ id: string; full_name: string }[]>([])

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
  const [filterDateFrom, setFilterDateFrom] = useState<string>(todayStr())
  const [filterDateTo, setFilterDateTo] = useState<string>(todayStr())

  // ── Capas del mapa
  const [showPedidos, setShowPedidos] = useState(true)
  const [showEmployees, setShowEmployees] = useState(true)
  const [showVisits, setShowVisits] = useState(true)

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

      // Pedidos con ubicación — filtro de fechas
      try {
        let q = supabase.from('pedidos')
          .select(`id, numero_documento, fecha_pedido, total_venta, estado, empleado_id,
            ubicacion_venta, clients:clients_id (name), employees:empleado_id (full_name)`)
          .not('ubicacion_venta', 'is', null)
          .gte('fecha_pedido', filterDateFrom)
          .lte('fecha_pedido', filterDateTo + 'T23:59:59')
          .order('fecha_pedido', { ascending: false }).limit(200)
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

      // Visitas — filtro de fechas
      try {
        let q = supabase.from('visits')
          .select('*, clients:client_id (name, legacy_id), employees:seller_id (full_name), check_in_location, check_out_location')
          .or('check_in_location.not.is.null,check_out_location.not.is.null')
          .neq('outcome', 'pending')
          .gte('start_time', filterDateFrom)
          .lte('start_time', filterDateTo + 'T23:59:59')
          .order('start_time', { ascending: false }).limit(500)
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

  useEffect(() => { fetchMapBase() }, [filterEmployee, filterDateFrom, filterDateTo])

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

  const hasActiveFilters = filterEmployee !== 'ALL' || filterDateFrom !== todayStr() || filterDateTo !== todayStr()

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
              {sharingLocation ? <Loader2 className="w-4 h-4 animate-spin" /> : shareSuccess ? <Check className="w-4 h-4" /> : <MapPin className="w-4 h-4" />}
              {sharingLocation ? 'Compartiendo...' : shareSuccess ? 'Listo' : 'Mi Ubicación'}
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

        {/* ── FILTROS ── */}
        <div className="bg-white p-4 rounded-3xl shadow-lg border-2 border-green-100">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
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

            {/* Fecha Desde */}
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1.5 flex items-center gap-1">
                <CalendarDays className="w-3.5 h-3.5" /> Desde
              </label>
              <input
                type="date"
                value={filterDateFrom}
                onChange={e => setFilterDateFrom(e.target.value)}
                max={filterDateTo}
                className="w-full px-3 py-2.5 text-sm text-gray-900 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 font-medium"
              />
            </div>

            {/* Fecha Hasta */}
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1.5 flex items-center gap-1">
                <CalendarDays className="w-3.5 h-3.5" /> Hasta
              </label>
              <input
                type="date"
                value={filterDateTo}
                onChange={e => setFilterDateTo(e.target.value)}
                min={filterDateFrom}
                className="w-full px-3 py-2.5 text-sm text-gray-900 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 font-medium"
              />
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
            {hasActiveFilters && (
              <button
                onClick={() => { setFilterEmployee('ALL'); setFilterDateFrom(todayStr()); setFilterDateTo(todayStr()) }}
                className="ml-auto flex items-center gap-1 text-xs text-red-500 hover:underline font-bold self-center"
              >
                <X className="w-3 h-3" /> Limpiar filtros
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

      </div>

      {/* ── MODAL PEDIDO ── */}
      {showPedidoModal && selectedPedido && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full">
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 px-6 py-4 border-b border-gray-200 rounded-t-3xl flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">Pedido #{selectedPedido.numero_documento}</h2>
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
                  <p className="font-bold text-sm">{selectedPedido.estado}</p>
                </div>
              </div>
              <div className="flex justify-end">
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

                {/* Cliente */}
                <div className="bg-gray-50 p-3 rounded-2xl col-span-2">
                  <p className="text-xs text-gray-500 mb-0.5">Cliente</p>
                  <p className="font-bold text-gray-900">{selectedVisit.clients?.name || 'N/A'}</p>
                  {selectedVisit.clients?.legacy_id && (
                    <p className="text-xs text-gray-400 mt-0.5">Código: {selectedVisit.clients.legacy_id}</p>
                  )}
                </div>

                {/* Vendedor */}
                <div className="bg-gray-50 p-3 rounded-2xl">
                  <p className="text-xs text-gray-500 mb-0.5">Vendedor</p>
                  <p className="font-bold text-gray-900 text-sm">{selectedVisit.employees?.full_name || 'N/A'}</p>
                </div>

                {/* Resultado */}
                {(() => { const ol = outcomeLabel(selectedVisit.outcome); return (
                  <div className={`p-3 rounded-2xl border ${ol.color}`}>
                    <p className="text-xs opacity-70 mb-0.5">Resultado</p>
                    <p className="font-bold text-sm flex items-center gap-1.5">{ol.icon}{ol.label}</p>
                  </div>
                ) })()}

                {/* Entrada */}
                <div className="bg-gray-50 p-3 rounded-2xl">
                  <p className="text-xs text-gray-500 mb-0.5">Check-In</p>
                  <p className="font-bold text-gray-900 text-sm">
                    {selectedVisit.start_time ? new Date(selectedVisit.start_time).toLocaleString('es-BO') : 'N/A'}
                  </p>
                </div>

                {/* Salida */}
                <div className="bg-gray-50 p-3 rounded-2xl">
                  <p className="text-xs text-gray-500 mb-0.5">Check-Out</p>
                  <p className="font-bold text-gray-900 text-sm">
                    {selectedVisit.end_time ? new Date(selectedVisit.end_time).toLocaleString('es-BO') : 'N/A'}
                  </p>
                </div>

                {/* Duración */}
                <div className="bg-blue-50 border border-blue-200 p-3 rounded-2xl">
                  <p className="text-xs text-blue-500 mb-0.5">Duración</p>
                  <p className="font-black text-blue-700 text-lg">
                    {selectedVisit.duration_seconds != null ? formatDuration(selectedVisit.duration_seconds) : 'N/A'}
                  </p>
                </div>

                {/* Precisión GPS */}
                <div className="bg-gray-50 p-3 rounded-2xl">
                  <p className="text-xs text-gray-500 mb-0.5">Precisión GPS</p>
                  <p className="font-bold text-gray-900 text-sm">
                    {selectedVisit.gps_accuracy_meters != null
                      ? `${parseFloat(selectedVisit.gps_accuracy_meters).toFixed(1)} m`
                      : 'N/A'}
                  </p>
                </div>

                {/* Notas */}
                {selectedVisit.notes && (
                  <div className="bg-amber-50 border border-amber-200 p-3 rounded-2xl col-span-2">
                    <p className="text-xs text-amber-600 mb-0.5">Notas</p>
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

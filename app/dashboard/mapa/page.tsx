'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/utils/supabase/client'
import MapLoader from '@/components/ui/Maploader'
import {
  RefreshCw, Map as MapIcon, Loader2, MapPin,
  X, Plus, Route, Check, AlertCircle, ChevronDown, ChevronUp, Users, Search
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

  // ── Datos
  const [locations, setLocations] = useState<EmployeeLocation[]>([])
  const [pedidos, setPedidos] = useState<PedidoMarker[]>([])
  const [routePoints, setRoutePoints] = useState<RoutePoint[]>([])
  const [clients, setClients] = useState<{ id: string; name: string; code: string }[]>([])
  const [employees, setEmployees] = useState<{ id: string; full_name: string }[]>([])
  const [zonas, setZonas] = useState<{ id: string; codigo_zona: string; name: string }[]>([])

  // ── Carga
  const [loadingMap, setLoadingMap] = useState(true)
  const [loadingPoints, setLoadingPoints] = useState(false)
  const [pointsLoaded, setPointsLoaded] = useState(false)   // ¿ya se cargaron puntos al menos una vez?
  const [error, setError] = useState<string | null>(null)

  // ── UI
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null)
  const [currentEmployeeId, setCurrentEmployeeId] = useState<string | null>(null)
  const [sharingLocation, setSharingLocation] = useState(false)
  const [shareSuccess, setShareSuccess] = useState(false)
  const [shareError, setShareError] = useState<string | null>(null)

  // ── Filtros (solo preventista + ruta)
  const [filterEmployee, setFilterEmployee] = useState<string>('ALL')
  const [filterZona, setFilterZona] = useState<string>('')   // '' = no seleccionado aún

  // ── Capas del mapa
  const [showPedidos, setShowPedidos] = useState(true)
  const [showRoutePoints, setShowRoutePoints] = useState(true)
  const [showEmployees, setShowEmployees] = useState(true)

  // ── Paneles desplegables
  const [showEmployeeList, setShowEmployeeList] = useState(false)
  const [showPointList, setShowPointList] = useState(false)

  // ── Crear punto de ruta
  const [creatingRoutePoint, setCreatingRoutePoint] = useState(false)
  const [newPoint, setNewPoint] = useState<{ lat: number; lng: number } | null>(null)
  const [newPointLabel, setNewPointLabel] = useState('')
  const [newPointVendorId, setNewPointVendorId] = useState('')
  const [savingPoint, setSavingPoint] = useState(false)

  // ── Modal visita
  const [selectedVisit, setSelectedVisit] = useState<any | null>(null)
  const [showVisitModal, setShowVisitModal] = useState(false)
  const [visits, setVisits] = useState<any[]>([])
  const [showVisits, setShowVisits] = useState(true)

  // ─── INIT: empleado actual ──────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from('employees').select('id').eq('email', user.email!).single()
        .then(({ data }) => { if (data) setCurrentEmployeeId(data.id) })
    })
  }, [])

  // ─── Cargar catálogos (zonas, empleados) ──────────────────────────────────
  useEffect(() => {
    supabase.from('zones').select('id, codigo_zona, name').order('codigo_zona')
      .then(({ data }) => { if (data) setZonas(data) })
    supabase.from('employees').select('id, full_name').order('full_name')
      .then(({ data }) => { if (data) setEmployees(data) })
    supabase.from('clients').select('id, name, code').eq('status', 'Vigente').order('name').limit(500)
      .then(({ data }) => { if (data) setClients(data as any) })
  }, [])

  // ─── Cargar mapa base (empleados GPS + pedidos) ────────────────────────────
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

      // Pedidos con ubicación — solo los filtrados por empleado
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
          .select('*, clients:client_id (name, legacy_id), employees:seller_id (full_name)')
          .not('check_out_location', 'is', null)
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

  // Carga inicial (solo mapa base, sin puntos)
  useEffect(() => {
    fetchMapBase()
  }, [filterEmployee])

  // ─── Cargar puntos de ruta (solo cuando el usuario elige una ruta) ─────────
  const fetchRoutePoints = async () => {
    if (!filterZona) return   // requiere ruta seleccionada
    setLoadingPoints(true)
    try {
      let q = supabase
        .from('route_points')
        .select(`id, latitude, longitude, label, color, vendor_id, zona_id, client_id,
          clients:client_id (name),
          employees:vendor_id (full_name)`)
        .eq('zona_id', filterZona)
        .order('created_at', { ascending: false })
        .limit(500)

      if (filterEmployee !== 'ALL') q = q.eq('vendor_id', filterEmployee)

      const { data } = await q
      if (data) {
        setRoutePoints(data.map((rp: any) => ({
          ...rp,
          client_name: rp.clients?.name || null,
          vendor_name: rp.employees?.full_name || null,
        })))
        setPointsLoaded(true)
      }
    } catch (e) {
      console.warn('Error cargando puntos de ruta:', e)
    } finally {
      setLoadingPoints(false)
    }
  }

  // ─── Compartir ubicación ──────────────────────────────────────────────────
  const handleShareLocation = async () => {
    if (!currentEmployeeId) { setShareError('No se pudo identificar al empleado actual'); return }
    setSharingLocation(true); setShareError(null); setShareSuccess(false)
    const result = await shareMyLocation(currentEmployeeId)
    if (result.success) { setShareSuccess(true); setTimeout(() => { fetchMapBase(); setShareSuccess(false) }, 1000) }
    else setShareError(result.error || 'Error al compartir ubicación')
    setSharingLocation(false)
  }

  // ─── Crear punto de ruta ──────────────────────────────────────────────────
  const handleNewRoutePoint = (lat: number, lng: number) => {
    setNewPoint({ lat, lng })
    setCreatingRoutePoint(false)
  }

  const handleSaveRoutePoint = async () => {
    if (!newPoint) return
    setSavingPoint(true)
    try {
      const { error } = await supabase.from('route_points').insert({
        latitude: newPoint.lat,
        longitude: newPoint.lng,
        label: newPointLabel || `Punto ${new Date().toLocaleTimeString('es-BO')}`,
        color: '#6366f1',
        vendor_id: newPointVendorId || currentEmployeeId || null,
        client_id: null,
        zona_id: filterZona || null,
      })
      if (error) throw error
      setNewPoint(null); setNewPointLabel(''); setNewPointVendorId('')
      if (filterZona) await fetchRoutePoints()
    } catch (err: any) {
      alert('Error al guardar punto: ' + err.message)
    } finally {
      setSavingPoint(false)
    }
  }

  const handleAssignClient = async (pointId: string, clientId: string) => {
    const client = clients.find(c => c.id === clientId)
    const { error } = await supabase
      .from('route_points')
      .update({ client_id: clientId, label: client?.name || 'Cliente' })
      .eq('id', pointId)
    if (!error) await fetchRoutePoints()
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

  const selectedZona = zonas.find(z => z.id === filterZona)

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
                Mapa de Rutas
              </h1>
              <p className="text-gray-500 text-xs font-medium">
                {validLocations.length} empleados · {pedidos.length} pedidos{pointsLoaded ? ` · ${routePoints.length} puntos de ruta` : ''}
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

        {/* ── FILTROS SIMPLIFICADOS ── */}
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

            {/* Ruta — selector + botón cargar */}
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1.5 flex items-center gap-1">
                <Route className="w-3.5 h-3.5" /> Ruta de Puntos
                <span className="text-amber-500 ml-1 text-[10px] font-black">▸ Selecciona para cargar puntos</span>
              </label>
              <div className="flex gap-2">
                <select
                  value={filterZona}
                  onChange={e => { setFilterZona(e.target.value); setRoutePoints([]); setPointsLoaded(false) }}
                  className={`flex-1 px-3 py-2.5 text-sm border-2 rounded-xl focus:outline-none focus:ring-2 transition-all font-medium ${
                    filterZona
                      ? 'border-purple-400 text-purple-900 bg-purple-50 focus:ring-purple-500'
                      : 'border-gray-200 text-gray-500 focus:ring-green-500'
                  }`}>
                  <option value="">— Seleccionar ruta —</option>
                  {zonas.map(z => (
                    <option key={z.id} value={z.id}>{z.codigo_zona} — {z.name}</option>
                  ))}
                </select>
                <button
                  onClick={fetchRoutePoints}
                  disabled={!filterZona || loadingPoints}
                  title={!filterZona ? 'Selecciona una ruta primero' : 'Cargar puntos de esta ruta'}
                  className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-bold text-sm transition-all shadow flex-shrink-0 ${
                    !filterZona ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    : loadingPoints ? 'bg-purple-400 text-white cursor-wait'
                    : 'bg-gradient-to-r from-purple-500 to-indigo-600 text-white hover:scale-105'
                  }`}>
                  {loadingPoints ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  {loadingPoints ? '...' : 'Cargar'}
                </button>
              </div>
              {filterZona && pointsLoaded && (
                <p className="text-xs text-purple-600 font-bold mt-1.5">
                  ✓ {routePoints.length} puntos cargados para {selectedZona?.codigo_zona}
                </p>
              )}
              {filterZona && !pointsLoaded && !loadingPoints && (
                <p className="text-xs text-amber-600 font-semibold mt-1.5">
                  ⚠ Presiona "Cargar" para ver los puntos de {selectedZona?.codigo_zona}
                </p>
              )}
            </div>
          </div>

          {/* Capas del mapa */}
          <div className="flex flex-wrap gap-2 pt-3 border-t border-gray-100">
            <span className="text-xs font-bold text-gray-500 self-center mr-1">Capas:</span>
            {[
              { key: 'emp', label: `👤 Empleados (${validLocations.length})`, state: showEmployees, set: setShowEmployees },
              { key: 'vis', label: `📍 Visitas (${visits.length})`, state: showVisits, set: setShowVisits },
              { key: 'ped', label: `🛒 Pedidos (${pedidos.length})`, state: showPedidos, set: setShowPedidos },
              { key: 'rp', label: `🗺️ Puntos${pointsLoaded ? ` (${routePoints.length})` : ''}`, state: showRoutePoints && pointsLoaded, set: (v: boolean) => { if (pointsLoaded) setShowRoutePoints(v) } },
            ].map(layer => (
              <button key={layer.key} onClick={() => layer.set(!layer.state)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border-2 transition-all ${layer.state ? 'bg-gray-900 text-white border-gray-800' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'}`}>
                {layer.state ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                {layer.label}
              </button>
            ))}
            {(filterEmployee !== 'ALL' || filterZona) && (
              <button
                onClick={() => { setFilterEmployee('ALL'); setFilterZona(''); setRoutePoints([]); setPointsLoaded(false) }}
                className="ml-auto text-xs text-red-500 hover:underline font-bold self-center">
                ✕ Limpiar filtros
              </button>
            )}
          </div>
        </div>

        {/* ── CREAR PUNTO DE RUTA (colapsado en sección pequeña) ── */}
        <div className={`bg-white rounded-3xl shadow border-2 transition-all ${creatingRoutePoint ? 'border-indigo-400 bg-indigo-50' : 'border-green-100'}`}>
          <div className="flex items-center justify-between px-5 py-3">
            <div className="flex items-center gap-2">
              <Route className="w-4 h-4 text-indigo-500" />
              <span className="font-bold text-gray-900 text-sm">Crear Punto de Ruta</span>
              {filterZona && <span className="text-xs bg-purple-100 text-purple-700 font-bold px-2 py-0.5 rounded-full">{selectedZona?.codigo_zona}</span>}
            </div>
            <button
              onClick={() => { setCreatingRoutePoint(!creatingRoutePoint); setNewPoint(null) }}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold text-sm transition-all ${creatingRoutePoint ? 'bg-red-500 text-white' : 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white hover:scale-105'} shadow`}>
              {creatingRoutePoint ? <><X className="w-3.5 h-3.5" /> Cancelar</> : <><Plus className="w-3.5 h-3.5" /> Nuevo</>}
            </button>
          </div>
          {newPoint && (
            <div className="px-5 pb-4 animate-pulse-once">
              <div className="p-4 bg-indigo-50 border-2 border-indigo-200 rounded-2xl">
                <p className="text-xs font-bold text-indigo-700 mb-3">📍 {newPoint.lat.toFixed(5)}, {newPoint.lng.toFixed(5)}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
                  <input type="text" placeholder="Etiqueta del punto..."
                    value={newPointLabel} onChange={e => setNewPointLabel(e.target.value)}
                    className="px-3 py-2 border-2 border-indigo-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                  <select value={newPointVendorId} onChange={e => setNewPointVendorId(e.target.value)}
                    className="px-3 py-2 border-2 border-indigo-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400">
                    <option value="">Preventista (opcional)</option>
                    {employees.map(e => <option key={e.id} value={e.id}>{e.full_name}</option>)}
                  </select>
                </div>
                <div className="flex gap-2">
                  <button onClick={handleSaveRoutePoint} disabled={savingPoint}
                    className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm shadow disabled:opacity-50">
                    {savingPoint ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    {savingPoint ? 'Guardando...' : 'Guardar'}
                  </button>
                  <button onClick={() => setNewPoint(null)} className="px-4 py-2 border-2 border-gray-200 text-gray-600 rounded-xl font-bold text-sm hover:bg-gray-50">
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          )}
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
                  showRoutePoints && pointsLoaded && `${routePoints.length} puntos${selectedZona ? ` (${selectedZona.codigo_zona})` : ''}`,
                ].filter(Boolean).join(' · ') || 'Sin filtros activos'}
                {creatingRoutePoint && <span className="ml-2 text-indigo-600 font-bold animate-pulse">🎯 Clic en mapa para colocar punto</span>}
              </p>
            </div>
            {!pointsLoaded && filterZona && (
              <div className="bg-amber-50 border border-amber-300 rounded-xl px-3 py-1.5">
                <p className="text-xs text-amber-700 font-bold">⚠ Presiona "Cargar" para ver puntos</p>
              </div>
            )}
          </div>
          <div className="p-3">
            <MapLoader
              employees={mapEmployees}
              selectedEmployeeId={selectedEmployeeId}
              visits={showVisits ? visits : []}
              pedidos={showPedidos ? pedidos : []}
              routePoints={showRoutePoints && pointsLoaded ? routePoints : []}
              onVisitClick={(v) => { setSelectedVisit(v); setShowVisitModal(true) }}
              creatingRoutePoint={creatingRoutePoint}
              onNewRoutePoint={handleNewRoutePoint}
              clients={clients}
              onAssignClient={handleAssignClient}
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

        {/* ── LISTA PUNTOS DE RUTA (colapsable) ── */}
        {pointsLoaded && (
          <div className="bg-white rounded-3xl shadow border-2 border-indigo-100 overflow-hidden">
            <button
              onClick={() => setShowPointList(!showPointList)}
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-indigo-50 transition-all"
            >
              <div className="flex items-center gap-2">
                <Route className="w-4 h-4 text-indigo-500" />
                <span className="font-black text-gray-900 text-sm">Puntos de Ruta</span>
                {selectedZona && (
                  <span className="bg-purple-100 text-purple-700 text-xs font-black px-2 py-0.5 rounded-full">
                    {selectedZona.codigo_zona}
                  </span>
                )}
                <span className="bg-indigo-100 text-indigo-700 text-xs font-black px-2 py-0.5 rounded-full">
                  {routePoints.length} puntos
                </span>
              </div>
              {showPointList ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
            </button>
            {showPointList && (
              <div className="px-5 pb-5">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                  {routePoints.map(rp => (
                    <div key={rp.id} className={`p-3 rounded-2xl border-2 ${rp.client_id ? 'border-green-200 bg-green-50' : 'border-indigo-100 bg-gray-50'}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-bold text-gray-900 text-xs truncate">
                            {rp.client_id ? `🏪 ${rp.client_name}` : `📍 ${rp.label || 'Sin etiqueta'}`}
                          </p>
                          {rp.vendor_name && <p className="text-[10px] text-gray-500">👤 {rp.vendor_name}</p>}
                          <p className="text-[10px] font-mono text-gray-400">{rp.latitude.toFixed(4)}, {rp.longitude.toFixed(4)}</p>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${rp.client_id ? 'bg-green-200 text-green-700' : 'bg-indigo-200 text-indigo-700'}`}>
                          {rp.client_id ? 'Asignado' : 'Libre'}
                        </span>
                      </div>
                      {!rp.client_id && (
                        <div className="mt-2 flex gap-1.5">
                          <select id={`list-assign-${rp.id}`}
                            className="flex-1 px-2 py-1 text-xs border-2 border-indigo-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-400">
                            <option value="">Asignar cliente...</option>
                            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </select>
                          <button
                            onClick={() => {
                              const sel = document.getElementById(`list-assign-${rp.id}`) as HTMLSelectElement
                              if (sel?.value) handleAssignClient(rp.id, sel.value)
                            }}
                            className="px-2.5 py-1 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700">
                            OK
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

      </div>

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
                  <p className="font-bold text-sm">{selectedVisit.outcome === 'sale' ? '💰 Venta' : selectedVisit.outcome === 'no_sale' ? '✗ Sin Venta' : '🔒 Cerrado'}</p>
                </div>
                <div className="bg-gray-50 p-3 rounded-2xl">
                  <p className="text-xs text-gray-500 mb-0.5">Fecha</p>
                  <p className="font-bold text-gray-900 text-sm">{selectedVisit.start_time ? new Date(selectedVisit.start_time).toLocaleString('es-BO') : 'N/A'}</p>
                </div>
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

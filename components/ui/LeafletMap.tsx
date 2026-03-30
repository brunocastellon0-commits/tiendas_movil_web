'use client'

import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { memo, useEffect, useMemo, useRef } from 'react'
import { MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet'

// ─── TIPOS ──────────────────────────────────────────────────────────────────
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

type RoutePoint = {
  id: string
  latitude: number
  longitude: number
  label: string
  color: string
  client_id: string | null
  client_name?: string | null
  vendor_id: string | null
  vendor_name?: string | null
  zona_id?: string | null
}

type PedidoMarker = {
  id: string
  latitude: number
  longitude: number
  cliente_nombre: string
  total_venta: number
  fecha: string
  empleado_nombre: string
  estado: string
  numero_documento: string
}

// ─── HELPERS WKB ────────────────────────────────────────────────────────────
function parseWKBHex(wkbHex: string): { latitude: number; longitude: number } | null {
  try {
    const coordsStart = 18
    const xHex = wkbHex.slice(coordsStart, coordsStart + 16)
    const yHex = wkbHex.slice(coordsStart + 16, coordsStart + 32)
    const hexToDouble = (hex: string): number => {
      const bytes = new Uint8Array(8)
      for (let i = 0; i < 8; i++) bytes[i] = parseInt(hex.substr(i * 2, 2), 16)
      return new DataView(bytes.buffer).getFloat64(0, true)
    }
    return { longitude: hexToDouble(xHex), latitude: hexToDouble(yHex) }
  } catch { return null }
}

function parseLocation(loc: any): { latitude: number; longitude: number } | null {
  if (!loc) return null
  if (typeof loc === 'string' && loc.length > 20 && /^[0-9A-F]+$/i.test(loc))
    return parseWKBHex(loc)
  if (typeof loc === 'object' && loc.type === 'Point' && Array.isArray(loc.coordinates))
    return { longitude: loc.coordinates[0], latitude: loc.coordinates[1] }
  if (typeof loc === 'string') {
    // ✅ Soporta: "POINT(...)", "SRID=4326;POINT(...)"
    const m = loc.match(/POINT\s*\(\s*([\-\d.]+)\s+([\-\d.]+)\s*\)/i)
    if (m) return { longitude: parseFloat(m[1]), latitude: parseFloat(m[2]) }
  }
  return null
}

// ─── CONTROLADOR DEL MAPA ───────────────────────────────────────────────────
function MapController({ selectedEmployeeId, employees }: { selectedEmployeeId: string | null, employees: EmployeeLocation[] }) {
  const map = useMap()
  useEffect(() => {
    if (selectedEmployeeId) {
      const emp = employees.find(e => e.id === selectedEmployeeId)
      if (emp) map.flyTo([emp.latitude, emp.longitude], 16, { duration: 1.5 })
    }
  }, [selectedEmployeeId, employees, map])
  return null
}

// ─── MODO CREAR PUNTO (click en mapa) ───────────────────────────────────────
function RoutePointCreator({ active, onPointCreated }: { active: boolean, onPointCreated: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      if (active) onPointCreated(e.latlng.lat, e.latlng.lng)
    }
  })
  return null
}

// ─── ICONOS ─────────────────────────────────────────────────────────────────
const createEmployeeIcon = (fullName: string, score: number, isActive: boolean) => {
  const initial = fullName.charAt(0).toUpperCase()
  const borderColor = score < 70 ? '#dc2626' : score < 90 ? '#d97706' : '#16a34a'
  const bgFrom = score < 70 ? '#fee2e2' : score < 90 ? '#fef3c7' : '#dcfce7'
  const textColor = score < 70 ? '#991b1b' : score < 90 ? '#92400e' : '#166534'
  const pulse = isActive ? `<div style="position:absolute;bottom:-2px;right:-2px;width:12px;height:12px;border-radius:50%;background:#22c55e;border:2px solid white;animation:pulse 2s infinite"></div>` : ''
  return L.divIcon({
    className: '',
    html: `<div style="position:relative">
      <div style="width:40px;height:40px;background:linear-gradient(135deg,${bgFrom},white);border-radius:50%;border:2.5px solid ${borderColor};box-shadow:0 4px 12px rgba(0,0,0,0.25);display:flex;align-items:center;justify-content:center">
        <span style="color:${textColor};font-weight:900;font-size:15px;font-family:sans-serif">${initial}</span>
      </div>
      <div style="position:absolute;bottom:-7px;left:50%;transform:translateX(-50%);width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:8px solid ${borderColor}"></div>
      ${pulse}
    </div>`,
    iconSize: [40, 48],
    iconAnchor: [20, 48],
    popupAnchor: [0, -50]
  })
}

const createVisitIcon = (outcome: string) => {
  // compatible con 'closed' (móvil) y 'store_closed' (legado)
  const normalizedOutcome = outcome === 'closed' ? 'store_closed' : outcome
  const colors: Record<string, [string, string]> = {
    sale:         ['#16a34a', '#bbf7d0'],
    no_sale:      ['#d97706', '#fef9c3'],
    store_closed: ['#dc2626', '#fee2e2'],
  }
  const [border, bg] = colors[normalizedOutcome] || ['#6b7280', '#f3f4f6']

  // Iconos SVG inline por outcome
  const svgIcons: Record<string, string> = {
    sale: `<svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
    no_sale: `<svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
    store_closed: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`,
  }
  const svg = svgIcons[normalizedOutcome] || `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`

  return L.divIcon({
    className: '',
    html: `<div style="position:relative">
      <div style="width:38px;height:38px;background:${bg};border-radius:50%;border:3px solid ${border};box-shadow:0 3px 10px rgba(0,0,0,0.2);display:flex;align-items:center;justify-content:center">${svg}</div>
      <div style="position:absolute;bottom:-7px;left:50%;transform:translateX(-50%);width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:7px solid ${border}"></div>
    </div>`,
    iconSize: [38, 46],
    iconAnchor: [19, 46],
    popupAnchor: [0, -48]
  })
}

const createRoutePointIcon = (color: string, hasClient: boolean, label: string) => {
  const c = color || (hasClient ? '#16a34a' : '#6366f1')
  // Punto pequeño estilo ZonasMap
  return L.divIcon({
    className: '',
    html: `
      <div style="position:relative;width:14px;height:14px">
        <div style="
          width:14px;height:14px;border-radius:50%;
          background:${c};
          border:2.5px solid white;
          box-shadow:0 2px 8px ${c}88, 0 0 0 1px ${c}44;
          display:flex;align-items:center;justify-content:center;
        ">
          ${hasClient ? `<div style="width:5px;height:5px;border-radius:50%;background:white;opacity:0.9"></div>` : ''}
        </div>
      </div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
    popupAnchor: [0, -10],
  })
}

// ─── COMPONENTE PRINCIPAL ────────────────────────────────────────────────────
function LeafletMap({
  employees,
  selectedEmployeeId,
  visits = [],
  pedidos = [],
  routePoints = [],
  onVisitClick,
  onPedidoClick,
  onRoutePointClick,
  creatingRoutePoint = false,
  onNewRoutePoint,
  clients = [],
  onAssignClient,
}: {
  employees: EmployeeLocation[]
  selectedEmployeeId?: string | null
  visits?: any[]
  pedidos?: PedidoMarker[]
  routePoints?: RoutePoint[]
  onVisitClick?: (visit: any) => void
  onPedidoClick?: (pedido: PedidoMarker) => void
  onRoutePointClick?: (point: RoutePoint) => void
  creatingRoutePoint?: boolean
  onNewRoutePoint?: (lat: number, lng: number) => void
  clients?: { id: string; name: string; code: string }[]
  onAssignClient?: (pointId: string, clientId: string) => void
}) {
  const centerPosition: [number, number] = employees.length > 0
    ? [employees[0].latitude, employees[0].longitude]
    : [-17.3935, -66.1570]

  const markerRefs = useRef<{ [key: string]: L.Marker }>({})

  useEffect(() => {
    if (selectedEmployeeId && markerRefs.current[selectedEmployeeId]) {
      markerRefs.current[selectedEmployeeId].openPopup()
    }
  }, [selectedEmployeeId])

  // Procesar visitas: usar check_in_location (al llegar) o check_out_location como fallback
  const processedVisits = useMemo(() =>
    visits.map(v => {
      // check_in_location = dónde estaba el vendedor al LLEGAR al cliente
      const loc = parseLocation(v.check_in_location) || parseLocation(v.check_out_location)
      if (!loc) return null
      return { ...v, latitude: loc.latitude, longitude: loc.longitude }
    }).filter((v): v is NonNullable<typeof v> => !!v && !isNaN(v.latitude) && !isNaN(v.longitude)),
    [visits]
  )

  const getOutcomeLabel = (o: string) => {
    const normalized = o === 'closed' ? 'store_closed' : o
    return ({ sale: 'Venta Exitosa', no_sale: 'Sin Venta', store_closed: 'Tienda Cerrada' })[normalized] || o
  }

  return (
    <div style={{ position: 'relative' }}>
      {/* Cursor crosshair si está en modo creación */}
      {creatingRoutePoint && (
        <div style={{
          position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
          zIndex: 1000, background: '#4f46e5', color: 'white', padding: '8px 18px',
          borderRadius: 20, fontSize: 13, fontWeight: 700, boxShadow: '0 4px 12px rgba(79,70,229,0.4)',
          pointerEvents: 'none'
        }}>
          Haz clic en el mapa para colocar un punto de ruta
        </div>
      )}

      <div className={`w-full h-[620px] rounded-2xl overflow-hidden shadow-lg border border-gray-200 z-0 ${creatingRoutePoint ? 'cursor-crosshair' : ''}`}>
        <MapContainer center={centerPosition} zoom={13} scrollWheelZoom style={{ height: '100%', width: '100%' }}>
          <MapController selectedEmployeeId={selectedEmployeeId || null} employees={employees} />
          <RoutePointCreator active={creatingRoutePoint} onPointCreated={(lat, lng) => onNewRoutePoint?.(lat, lng)} />

          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {/* ── MARCADORES DE EMPLEADOS ── */}
          {employees.map(emp => (
            <Marker
              key={emp.id}
              position={[emp.latitude, emp.longitude]}
              icon={createEmployeeIcon(emp.full_name, emp.gps_trust_score ?? 100, emp.is_active ?? false)}
              ref={ref => { if (ref) markerRefs.current[emp.id] = ref }}
            >
              <Popup>
                <div style={{ minWidth: 200, padding: 6 }}>
                  <div style={{ fontWeight: 900, fontSize: 15, marginBottom: 4 }}>{emp.full_name}</div>
                  <span style={{ fontSize: 11, background: '#f3f4f6', padding: '2px 8px', borderRadius: 20 }}>{emp.job_title}</span>
                  <div style={{ marginTop: 8, fontSize: 11, color: '#6b7280' }}>
                    <div>Estado: <b style={{ color: emp.is_active ? '#16a34a' : '#9ca3af' }}>{emp.is_active ? '● En línea' : '○ Desconectado'}</b></div>
                    <div>GPS Score: <b>{emp.gps_trust_score ?? 100}%</b></div>
                    <div style={{ fontFamily: 'monospace', fontSize: 10 }}>{emp.latitude.toFixed(6)}, {emp.longitude.toFixed(6)}</div>
                    <div>Actualizado: {emp.last_update}</div>
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}

          {/* ── MARCADORES DE VISITAS ── */}
          {processedVisits.map((visit: any) => (
            <Marker
              key={`visit-${visit.id}`}
              position={[visit.latitude, visit.longitude]}
              icon={createVisitIcon(visit.outcome)}
            >
              <Popup>
                <div style={{ minWidth: 220, padding: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <div>
                      <b style={{ fontSize: 14 }}>{visit.clients?.name || 'Visita'}</b>
                      {(visit.clients?.code || visit.clients?.legacy_id) && <div style={{ fontSize: 10, color: '#9ca3af' }}>Cód: {visit.clients.code || visit.clients.legacy_id}</div>}
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 8, background: visit.outcome === 'sale' ? '#dcfce7' : visit.outcome === 'no_sale' ? '#fef9c3' : '#fee2e2', color: visit.outcome === 'sale' ? '#166534' : visit.outcome === 'no_sale' ? '#713f12' : '#991b1b' }}>
                      {getOutcomeLabel(visit.outcome)}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: '#6b7280' }}>
                    <div>Vendedor: <b>{visit.employees?.full_name || 'N/A'}</b></div>
                    <div>Fecha: {new Date(visit.start_time).toLocaleString('es-BO', { dateStyle: 'short', timeStyle: 'short' })}</div>
                    {visit.notes && <div style={{ marginTop: 4, fontStyle: 'italic' }}>"{visit.notes}"</div>}
                  </div>
                  {onVisitClick && (
                    <button onClick={() => onVisitClick(visit)} style={{ marginTop: 8, width: '100%', padding: '6px 0', background: '#16a34a', color: 'white', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 11, cursor: 'pointer' }}>
                      Ver Detalles
                    </button>
                  )}
                </div>
              </Popup>
            </Marker>
          ))}

          {/* Pedidos: no se renderizan, solo visitas en el mapa */}

          {/* ── PUNTOS DE RUTA ── */}
          {routePoints.map(rp => (
            <Marker
              key={`rp-${rp.id}`}
              position={[rp.latitude, rp.longitude]}
              icon={createRoutePointIcon(rp.color, !!rp.client_id, rp.label)}
            >
              <Popup>
                <div style={{ minWidth: 230, padding: 6 }}>
                  <div style={{ fontWeight: 900, fontSize: 14, marginBottom: 4 }}>
                    {rp.client_id ? (rp.client_name || 'Cliente asignado') : 'Punto de Ruta'}
                  </div>
                  {rp.label && <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 6 }}>{rp.label}</div>}
                  {rp.vendor_name && <div style={{ fontSize: 11 }}>Preventista: <b>{rp.vendor_name}</b></div>}

                  {!rp.client_id && onAssignClient && clients.length > 0 && (
                    <div style={{ marginTop: 10 }}>
                      <p style={{ fontSize: 11, fontWeight: 700, color: '#4f46e5', marginBottom: 4 }}>Asignar Cliente:</p>
                      <select
                        id={`assign-client-${rp.id}`}
                        style={{ width: '100%', padding: '5px 8px', fontSize: 11, border: '2px solid #c7d2fe', borderRadius: 8, marginBottom: 6 }}
                      >
                        <option value="">-- Seleccionar --</option>
                        {clients.map(c => (
                          <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                        ))}
                      </select>
                      <button
                        onClick={() => {
                          const sel = document.getElementById(`assign-client-${rp.id}`) as HTMLSelectElement
                          if (sel?.value) onAssignClient(rp.id, sel.value)
                        }}
                        style={{ width: '100%', padding: '6px 0', background: '#4f46e5', color: 'white', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 11, cursor: 'pointer' }}
                      >
                        Asignar Cliente
                      </button>
                    </div>
                  )}

                  {rp.client_id && (
                    <div style={{ marginTop: 6, padding: '4px 8px', background: '#f0fdf4', borderRadius: 8, fontSize: 11, color: '#166534', fontWeight: 700 }}>
                      Cliente: {rp.client_name}
                    </div>
                  )}

                  {onRoutePointClick && (
                    <button onClick={() => onRoutePointClick(rp)} style={{ marginTop: 8, width: '100%', padding: '6px 0', background: '#6b7280', color: 'white', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 11, cursor: 'pointer' }}>
                      Gestionar Punto
                    </button>
                  )}
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  )
}

export default memo(LeafletMap, (prev, next) => {
  if (prev.selectedEmployeeId !== next.selectedEmployeeId) return false
  if (prev.creatingRoutePoint !== next.creatingRoutePoint) return false
  if (prev.employees.length !== next.employees.length) return false
  if ((prev.visits?.length ?? 0) !== (next.visits?.length ?? 0)) return false
  if ((prev.pedidos?.length ?? 0) !== (next.pedidos?.length ?? 0)) return false
  if ((prev.routePoints?.length ?? 0) !== (next.routePoints?.length ?? 0)) return false
  return true
})

LeafletMap.displayName = 'LeafletMap'
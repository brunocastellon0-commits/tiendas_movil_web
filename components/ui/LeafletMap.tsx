'use client'

import { memo, useEffect, useRef, useMemo, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'

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
  if (typeof loc === 'string' && loc.includes('POINT(')) {
    const m = loc.match(/POINT\(([^ ]+) ([^ ]+)\)/)
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
  const colors: Record<string, [string, string]> = {
    sale: ['#16a34a', '#bbf7d0'],
    no_sale: ['#d97706', '#fef9c3'],
    store_closed: ['#dc2626', '#fee2e2'],
  }
  const [border, bg] = colors[outcome] || ['#6b7280', '#f3f4f6']
  const symbols: Record<string, string> = {
    sale: '💰', no_sale: '✗', store_closed: '🔒'
  }
  const sym = symbols[outcome] || '?'
  return L.divIcon({
    className: '',
    html: `<div style="position:relative">
      <div style="width:38px;height:38px;background:${bg};border-radius:50%;border:3px solid ${border};box-shadow:0 3px 10px rgba(0,0,0,0.2);display:flex;align-items:center;justify-content:center;font-size:15px">${sym}</div>
      <div style="position:absolute;bottom:-7px;left:50%;transform:translateX(-50%);width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:7px solid ${border}"></div>
    </div>`,
    iconSize: [38, 46],
    iconAnchor: [19, 46],
    popupAnchor: [0, -48]
  })
}

const createPedidoIcon = (estado: string, empleadoInicial: string) => {
  const isCompleted = estado === 'Completado' || estado === 'Entregado'
  const bg = isCompleted ? '#1d4ed8' : '#6d28d9'
  const light = isCompleted ? '#dbeafe' : '#ede9fe'
  return L.divIcon({
    className: '',
    html: `<div style="position:relative">
      <div style="width:38px;height:38px;background:${light};border-radius:50%;border:3px solid ${bg};box-shadow:0 3px 10px rgba(0,0,0,0.2);display:flex;align-items:center;justify-content:center">
        <span style="color:${bg};font-weight:900;font-size:13px;font-family:sans-serif">${empleadoInicial}</span>
      </div>
      <div style="position:absolute;-top:-4px;left:50%;transform:translateX(-50%) translateY(-50%);font-size:10px">🛒</div>
      <div style="position:absolute;bottom:-7px;left:50%;transform:translateX(-50%);width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:7px solid ${bg}"></div>
    </div>`,
    iconSize: [38, 46],
    iconAnchor: [19, 46],
    popupAnchor: [0, -48]
  })
}

const createRoutePointIcon = (color: string, hasClient: boolean, label: string) => {
  const borderColor = hasClient ? '#16a34a' : '#6366f1'
  const bg = hasClient ? '#f0fdf4' : '#eef2ff'
  return L.divIcon({
    className: '',
    html: `<div style="position:relative">
      <div style="width:36px;height:36px;background:${bg};border-radius:8px;border:3px solid ${borderColor};box-shadow:0 3px 10px rgba(0,0,0,0.2);display:flex;align-items:center;justify-content:center;transform:rotate(45deg)">
        <span style="transform:rotate(-45deg);font-size:12px">${hasClient ? '🏪' : '📍'}</span>
      </div>
      <div style="position:absolute;bottom:-7px;left:50%;transform:translateX(-50%);width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:7px solid ${borderColor}"></div>
      ${label ? `<div style="position:absolute;top:-22px;left:50%;transform:translateX(-50%);background:${borderColor};color:white;font-size:9px;font-weight:bold;padding:2px 5px;border-radius:4px;white-space:nowrap;max-width:80px;overflow:hidden;text-overflow:ellipsis">${label}</div>` : ''}
    </div>`,
    iconSize: [36, 44],
    iconAnchor: [18, 44],
    popupAnchor: [0, -46]
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

  // Procesar visitas
  const processedVisits = useMemo(() =>
    visits.map(v => ({ ...v, ...parseLocation(v.check_out_location) }))
      .filter(v => v.latitude && v.longitude && !isNaN(v.latitude) && !isNaN(v.longitude)),
    [visits]
  )

  const getOutcomeLabel = (o: string) =>
    ({ sale: '💰 Venta Exitosa', no_sale: '✗ Sin Venta', store_closed: '🔒 Tienda Cerrada' })[o] || o

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
          📍 Haz clic en el mapa para colocar un punto de ruta
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
                    <div>🕒 {emp.last_update}</div>
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
                      {visit.clients?.legacy_id && <div style={{ fontSize: 10, color: '#9ca3af' }}>Cód: {visit.clients.legacy_id}</div>}
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

          {/* ── MARCADORES DE PEDIDOS ── */}
          {pedidos.map(p => (
            <Marker
              key={`pedido-${p.id}`}
              position={[p.latitude, p.longitude]}
              icon={createPedidoIcon(p.estado, p.empleado_nombre.charAt(0))}
            >
              <Popup>
                <div style={{ minWidth: 220, padding: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <span style={{ fontSize: 18 }}>🛒</span>
                    <div>
                      <b style={{ fontSize: 14 }}>Pedido #{p.numero_documento}</b>
                      <div style={{ fontSize: 10, color: '#6b7280' }}>{p.fecha}</div>
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: '#374151' }}>
                    <div>Cliente: <b>{p.cliente_nombre}</b></div>
                    <div>Vendedor: <b>{p.empleado_nombre}</b></div>
                    <div>Total: <b style={{ color: '#1d4ed8' }}>Bs. {p.total_venta.toFixed(2)}</b></div>
                    <div>Estado: <span style={{ fontWeight: 700 }}>{p.estado}</span></div>
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}

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
                    {rp.client_id ? `🏪 ${rp.client_name || 'Cliente asignado'}` : `📍 Punto de Ruta`}
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
                      ✓ Cliente: {rp.client_name}
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
'use client'

import { useEffect, useRef, memo, useState, useCallback } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Tooltip, useMapEvents, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'

// ─── TIPOS ───────────────────────────────────────────────────────────────────
type ZonaMarker = {
  id: string
  latitude: number
  longitude: number
  label: string
  color: string
  isPending?: boolean
  isSaving?: boolean
  isSaved?: boolean
}

type NominatimResult = {
  place_id: number
  display_name: string
  lat: string
  lon: string
  type: string
  importance: number
}

// ─── ICONO minimalista — solo un punto de color ───────────────────────────────
function createZonaIcon(color: string, isSaving: boolean, isSaved: boolean, isPending: boolean) {
  const c = isSaving ? '#94a3b8' : color
  const pulse = isPending && !isSaved
    ? `<div style="position:absolute;inset:-5px;border-radius:50%;border:2px solid ${c};animation:ping 1.2s cubic-bezier(0,0,0.2,1) infinite;opacity:0.35"></div>`
    : ''
  const inner = isSaving
    ? `<div style="width:6px;height:6px;border-radius:50%;border:1.5px solid white;border-top-color:transparent;animation:spin 0.8s linear infinite"></div>`
    : isSaved
      ? `<div style="font-size:7px;font-weight:900;color:white;line-height:1">✓</div>`
      : `<div style="width:6px;height:6px;border-radius:50%;background:white;opacity:0.85"></div>`

  return L.divIcon({
    className: '',
    html: `
      <div style="position:relative;width:16px;height:16px">
        ${pulse}
        <div style="
          width:16px;height:16px;border-radius:50%;
          background:${c};
          border:2.5px solid white;
          box-shadow:0 2px 8px ${c}88, 0 0 0 1px ${c}44;
          display:flex;align-items:center;justify-content:center;
          transition:transform 0.15s;
        ">
          ${inner}
        </div>
      </div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
    popupAnchor: [0, -12],
    tooltipAnchor: [10, 0],
  })
}

// ─── Captura clics en el mapa ─────────────────────────────────────────────────
function ClickHandler({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng)
    }
  })
  return null
}

// ─── Auto-zoom SOLO al cargar los puntos iniciales ───────────────────────────
function AutoFit({ markers }: { markers: ZonaMarker[] }) {
  const map = useMap()
  const hasFitted = useRef(false)   // ← solo corre UNA vez

  useEffect(() => {
    // Solo si aún no hicimos fit Y hay marcadores guardados (isSaved = true)
    if (hasFitted.current) return
    const saved = markers.filter(m => m.isSaved && m.latitude && m.longitude)
    if (saved.length === 0) return

    const bounds = L.latLngBounds(saved.map(m => [m.latitude, m.longitude] as [number, number]))
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 16, animate: false })
      hasFitted.current = true   // ← no vuelve a correr nunca más
    }
  }, [markers])

  return null
}

// ─── Controlador de vuelo a ubicación buscada ────────────────────────────────
function FlyToController({ target }: { target: [number, number] | null }) {
  const map = useMap()
  useEffect(() => {
    if (target) {
      map.flyTo(target, 17, { duration: 1.4 })
    }
  }, [target])
  return null
}

// ─── Barra de búsqueda de calles (Nominatim / OpenStreetMap) ─────────────────
function SearchBar({ onSelect }: { onSelect: (lat: number, lng: number, name: string) => void }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<NominatimResult[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)

  // Cerrar al click fuera
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 3) { setResults([]); setOpen(false); return }
    setLoading(true)
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=6&addressdetails=1&countrycodes=bo`
      const res = await fetch(url, { headers: { 'Accept-Language': 'es' } })
      const data: NominatimResult[] = await res.json()
      setResults(data)
      setOpen(data.length > 0)
    } catch {
      setResults([])
    }
    setLoading(false)
  }, [])

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setQuery(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(val), 500)
  }

  const handleSelect = (r: NominatimResult) => {
    onSelect(parseFloat(r.lat), parseFloat(r.lon), r.display_name)
    setQuery(r.display_name.split(',').slice(0, 2).join(','))
    setOpen(false)
    setResults([])
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && results.length > 0) handleSelect(results[0])
    if (e.key === 'Escape') { setOpen(false); setQuery('') }
  }

  return (
    <div
      ref={wrapperRef}
      style={{
        position: 'absolute',
        top: 12,
        left: 12,
        zIndex: 1000,
        width: 'min(340px, calc(100% - 24px))',
      }}
      // Evita que los clics en la barra de búsqueda creen marcadores
      onClick={e => e.stopPropagation()}
      onMouseDown={e => e.stopPropagation()}
    >
      {/* Input */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        background: 'white',
        borderRadius: 14,
        padding: '8px 14px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.18)',
        border: '2px solid rgba(99,102,241,0.3)',
        gap: 8,
      }}>
        <span style={{ fontSize: 16 }}>🔍</span>
        <input
          type="text"
          value={query}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder="Buscar calle, barrio, ciudad..."
          style={{
            flex: 1,
            border: 'none',
            outline: 'none',
            fontSize: 13,
            fontWeight: 600,
            color: '#1f2937',
            background: 'transparent',
            minWidth: 0,
          }}
        />
        {loading && (
          <div style={{
            width: 16, height: 16,
            border: '2px solid #e5e7eb',
            borderTop: '2px solid #6366f1',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
            flexShrink: 0,
          }} />
        )}
        {query && !loading && (
          <button
            onClick={() => { setQuery(''); setResults([]); setOpen(false) }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: '#9ca3af', padding: 0 }}>
            ✕
          </button>
        )}
      </div>

      {/* Resultados */}
      {open && results.length > 0 && (
        <div style={{
          marginTop: 6,
          background: 'white',
          borderRadius: 14,
          boxShadow: '0 8px 30px rgba(0,0,0,0.15)',
          border: '2px solid rgba(99,102,241,0.15)',
          overflow: 'hidden',
        }}>
          {results.map((r, i) => {
            const parts = r.display_name.split(',')
            const main = parts.slice(0, 2).join(',').trim()
            const secondary = parts.slice(2, 4).join(',').trim()
            return (
              <button
                key={r.place_id}
                onClick={() => handleSelect(r)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '10px 14px',
                  border: 'none',
                  borderBottom: i < results.length - 1 ? '1px solid #f3f4f6' : 'none',
                  background: 'white',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = '#eef2ff')}
                onMouseLeave={e => (e.currentTarget.style.background = 'white')}
              >
                <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>
                  {r.type === 'building' ? '🏢' : r.type === 'road' || r.type === 'street' ? '🛣️' : '📍'}
                </span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 12, color: '#1f2937', lineHeight: 1.3 }}>{main}</div>
                  {secondary && (
                    <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2, lineHeight: 1.3 }}>{secondary}</div>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* Sin resultados */}
      {open && !loading && results.length === 0 && query.length >= 3 && (
        <div style={{
          marginTop: 6, background: 'white', borderRadius: 14,
          boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
          padding: '12px 14px', fontSize: 12, color: '#6b7280', fontWeight: 600,
          textAlign: 'center',
        }}>
          No se encontraron resultados para "{query}"
        </div>
      )}

      {/* Animación CSS inline */}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes ping {
          75%, 100% { transform: scale(2); opacity: 0; }
        }
      `}</style>
    </div>
  )
}

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────
function ZonasMap({
  markers,
  onMapClick,
}: {
  markers: ZonaMarker[]
  onMapClick: (lat: number, lng: number) => void
}) {
  const center: [number, number] = markers.length > 0
    ? [markers[0].latitude, markers[0].longitude]
    : [-17.3935, -66.1570]

  // Target para FlyTo al buscar una dirección
  const [flyTarget, setFlyTarget] = useState<[number, number] | null>(null)

  const handleSearchSelect = (lat: number, lng: number, name: string) => {
    setFlyTarget([lat, lng])
    // Pequeño reset para permitir volar a la misma ubicación varias veces
    setTimeout(() => setFlyTarget(null), 2000)
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>

      {/* Barra de búsqueda — FUERA del MapContainer para mejor z-index */}
      <SearchBar onSelect={handleSearchSelect} />

      {/* Hint de clic — desplazado a la derecha para no chocar con búsqueda */}
      <div style={{
        position: 'absolute', top: 12, right: 12,
        zIndex: 1000, background: 'rgba(99,102,241,0.88)', color: 'white',
        padding: '7px 14px', borderRadius: 20, fontSize: 11, fontWeight: 700,
        boxShadow: '0 4px 14px rgba(99,102,241,0.4)', pointerEvents: 'none',
        backdropFilter: 'blur(8px)', whiteSpace: 'nowrap'
      }}>
        🎯 Clic para crear marcador
      </div>

      <MapContainer
        center={center}
        zoom={13}
        scrollWheelZoom
        style={{ height: '100%', width: '100%' }}
        className="cursor-crosshair"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <ClickHandler onMapClick={onMapClick} />
        <AutoFit markers={markers} />
        <FlyToController target={flyTarget} />

        {markers.map(m => (
          <Marker
            key={m.id}
            position={[m.latitude, m.longitude]}
            icon={createZonaIcon(m.color, m.isSaving ?? false, m.isSaved ?? false, m.isPending ?? false)}
          >
            {/* ── Tooltip: aparece al pasar el cursor (hover) ── */}
            <Tooltip
              direction="right"
              offset={[10, 0]}
              opacity={1}
              permanent={false}
            >
              <div style={{
                fontWeight: 700, fontSize: 12, color: '#1f2937',
                padding: '2px 0', whiteSpace: 'nowrap', lineHeight: 1.4,
              }}>
                <span style={{
                  display: 'inline-block', width: 8, height: 8,
                  borderRadius: '50%', background: m.color,
                  marginRight: 6, verticalAlign: 'middle',
                  boxShadow: `0 0 0 2px ${m.color}44`,
                }} />
                {m.label}
                <div style={{ fontSize: 10, color: m.isSaved ? '#16a34a' : m.isSaving ? '#9ca3af' : '#6366f1', fontWeight: 600, marginTop: 2 }}>
                  {m.isSaved ? '✓ guardado' : m.isSaving ? '⏳ guardando...' : '● pendiente'}
                </div>
              </div>
            </Tooltip>

            {/* ── Popup: al hacer clic, muestra detalles completos ── */}
            <Popup>
              <div style={{ minWidth: 160, padding: 4 }}>
                <div style={{ fontWeight: 900, fontSize: 14, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: m.color, display: 'inline-block', border: '2px solid white', boxShadow: '0 0 0 1px ' + m.color }} />
                  {m.label}
                </div>
                <div style={{ fontSize: 10, fontFamily: 'monospace', color: '#6b7280' }}>
                  {m.latitude.toFixed(6)}, {m.longitude.toFixed(6)}
                </div>
                <div style={{ marginTop: 6, fontSize: 11, fontWeight: 700, color: m.isSaved ? '#16a34a' : m.isSaving ? '#6b7280' : '#6366f1' }}>
                  {m.isSaved ? '✓ Guardado en base de datos' : m.isSaving ? '⏳ Guardando...' : '🔵 Pendiente de guardar'}
                </div>
                <div style={{ marginTop: 4, fontSize: 10, color: '#9ca3af' }}>
                  Sin preventista · puedes asignar después
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  )
}

export default memo(ZonasMap)

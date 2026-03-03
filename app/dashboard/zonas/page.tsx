'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/utils/supabase/client'
import ZonasMapLoader from '@/components/ui/ZonasMapLoader'
import {
  MapPin, Zap, Trash2, Check, Loader2, X, Edit2, Save,
  Route, Target, ToggleLeft, ToggleRight, Tags, Square, CheckSquare,
  Maximize2, Minimize2
} from 'lucide-react'

// ─── TIPOS ───────────────────────────────────────────────────────────────────
type PendingPoint = {
  tempId: string
  lat: number
  lng: number
  label: string
  color: string
  saved: boolean
  saving: boolean
  savedId?: string   // ID real de Supabase una vez guardado
  error?: string
}

type SavedPoint = {
  id: string
  latitude: number
  longitude: number
  label: string
  color: string
  zona_id: string | null
  zonas?: any   // puede venir como objeto o array según Supabase
}

// Supabase a veces devuelve el join como objeto, a veces como array
const getZonaName = (zonas: any): string | null => {
  if (!zonas) return null
  if (Array.isArray(zonas)) return zonas[0]?.codigo_zona || null
  return zonas.codigo_zona || null
}

type Zona = {
  id: string
  codigo_zona: string
  descripcion: string
}

const COLORS = [
  '#6366f1', '#10b981', '#f59e0b', '#ef4444',
  '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#06b6d4',
]

// ─── TABS ─────────────────────────────────────────────────────────────────────
type Tab = 'crear' | 'asignar'

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────
export default function ZonasEditorPage() {
  const supabase = createClient()

  // ── Tab activo
  const [tab, setTab] = useState<Tab>('crear')

  // ── CREACIÓN DE PUNTOS
  const [pendingPoints, setPendingPoints] = useState<PendingPoint[]>([])
  const [turboMode, setTurboMode] = useState(true)
  const [activeColor, setActiveColor] = useState(COLORS[0])
  const [labelPrefix, setLabelPrefix] = useState('Punto')
  const counterRef = useRef(1)
  const [counterDisplay, setCounterDisplay] = useState(1)   // versión visible y editable del contador
  const [savingAll, setSavingAll] = useState(false)

  // ── ZONA ASIGNADA EN TURBO (prefijo de ruta)
  const [turboZonaId, setTurboZonaId] = useState<string>('')

  // ── MAPA FULLSCREEN
  const [mapFullscreen, setMapFullscreen] = useState(false)

  // ESC para salir de fullscreen
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMapFullscreen(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // ── PUNTOS GUARDADOS (para la vista/asignación)
  const [savedPoints, setSavedPoints] = useState<SavedPoint[]>([])
  const [loadingSaved, setLoadingSaved] = useState(true)

  // ── MOSTRAR LISTA GUARDADOS EN TAB CREAR
  const [showSavedInCrear, setShowSavedInCrear] = useState(false)
  const [filterCrearZonaId, setFilterCrearZonaId] = useState<string>('')

  // ── ZONAS (para asignar después)
  const [zonas, setZonas] = useState<Zona[]>([])

  // ── MODO ASIGNACIÓN
  const [selectedPointIds, setSelectedPointIds] = useState<Set<string>>(new Set())
  const [assignToZonaId, setAssignToZonaId] = useState<string>('')
  const [assigning, setAssigning] = useState(false)
  const [filterUnassigned, setFilterUnassigned] = useState(false)
  const [filterZonaId, setFilterZonaId] = useState<string>('')
  const [filterPrefix, setFilterPrefix] = useState<string>('')   // búsqueda por prefijo

  // ── RENOMBRADO BATCH
  const [renamePrefix, setRenamePrefix] = useState('Punto')
  const [renameStart, setRenameStart] = useState(1)
  const [renaming, setRenaming] = useState(false)

  // ── Edición inline
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editLabel, setEditLabel] = useState('')

  // ── Cargar datos
  useEffect(() => {
    const fetchData = async () => {
      const [zonasRes, pointsRes] = await Promise.all([
        supabase.from('zonas').select('id, codigo_zona, descripcion').order('codigo_zona'),
        supabase.from('route_points')
          .select('id, latitude, longitude, label, color, zona_id, zonas:zona_id(codigo_zona, descripcion)')
          .order('created_at', { ascending: false })
          .limit(1000)
      ])
      if (zonasRes.data) setZonas(zonasRes.data)
      if (pointsRes.data) {
        setSavedPoints(pointsRes.data as SavedPoint[])
        // Inicializar contador desde la BD
        const nextNum = pointsRes.data.length + 1
        counterRef.current = nextNum
        setCounterDisplay(nextNum)
      }
      setLoadingSaved(false)
    }
    fetchData()
  }, [])

  // ─── CREAR PUNTOS ──────────────────────────────────────────────────────────

  const handleMapClick = (lat: number, lng: number) => {
    const tempId = `temp-${Date.now()}-${Math.random()}`
    const label = `${labelPrefix} ${counterRef.current}`
    counterRef.current++
    setCounterDisplay(counterRef.current)   // actualiza el display tras cada punto

    const newPoint: PendingPoint = {
      tempId, lat, lng, label, color: activeColor,
      saved: false, saving: false,
    }

    if (turboMode) {
      setPendingPoints(prev => [...prev, { ...newPoint, saving: true }])
      savePoint({ ...newPoint, saving: true })
    } else {
      setPendingPoints(prev => [...prev, newPoint])
    }
  }

  const savePoint = async (point: PendingPoint, zonaId?: string) => {
    try {
      const resolvedZonaId = zonaId || turboZonaId || null
      const { data, error } = await supabase.from('route_points').insert({
        latitude: point.lat,
        longitude: point.lng,
        label: point.label,
        color: point.color,
        vendor_id: null,
        client_id: null,
        zona_id: resolvedZonaId || null,
      }).select('id, latitude, longitude, label, color, zona_id').single()

      if (error) throw error

      setPendingPoints(prev =>
        prev.map(p => p.tempId === point.tempId
          ? { ...p, saved: true, saving: false, savedId: data?.id }
          : p
        )
      )
      if (data) {
        const zona = resolvedZonaId ? zonas.find(z => z.id === resolvedZonaId) || null : null
        setSavedPoints(prev => [{ ...data, zonas: zona } as any, ...prev])
      }
    } catch (err: any) {
      setPendingPoints(prev =>
        prev.map(p => p.tempId === point.tempId
          ? { ...p, saving: false, error: err.message }
          : p
        )
      )
    }
  }

  const handleSaveAll = async () => {
    const unsaved = pendingPoints.filter(p => !p.saved && !p.saving)
    if (!unsaved.length) return
    setSavingAll(true)
    for (const pt of unsaved) {
      setPendingPoints(prev => prev.map(p => p.tempId === pt.tempId ? { ...p, saving: true } : p))
      await savePoint({ ...pt, saving: true })
    }
    setSavingAll(false)
  }

  // ─── ASIGNAR RUTAS ─────────────────────────────────────────────────────────

  const toggleSelect = (id: string) => {
    setSelectedPointIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAll = (ids: string[]) => {
    setSelectedPointIds(new Set(ids))
  }

  const handleBatchAssign = async (explicitIds?: string[]) => {
    const ids = explicitIds ?? Array.from(selectedPointIds)
    if (!assignToZonaId || ids.length === 0) return
    setAssigning(true)

    const zona = zonas.find(z => z.id === assignToZonaId)

    const { error } = await supabase
      .from('route_points')
      .update({ zona_id: assignToZonaId })
      .in('id', ids)

    if (!error) {
      setSavedPoints(prev =>
        prev.map(p => ids.includes(p.id)
          ? { ...p, zona_id: assignToZonaId, zonas: zona || null }
          : p
        )
      )
      setSelectedPointIds(new Set())
      if (!explicitIds) setAssignToZonaId('')   // solo limpiar el selector en flujo normal
    }
    setAssigning(false)
  }

  // ── Renombrar los puntos seleccionados con prefijo + autonumérico
  const handleBatchRename = async () => {
    if (selectedPointIds.size === 0) return
    setRenaming(true)

    // Tomamos los puntos seleccionados en el orden en que aparecen en la lista filtrada
    const orderedIds = filteredPoints
      .filter(p => selectedPointIds.has(p.id))
      .map(p => p.id)

    const updates: { id: string; label: string }[] = orderedIds.map((id, i) => ({
      id,
      label: `${renamePrefix} ${renameStart + i}`,
    }))

    // Actualizar uno por uno (Supabase no soporta upsert con valores distintos en bulk)
    let allOk = true
    for (const u of updates) {
      const { error } = await supabase
        .from('route_points')
        .update({ label: u.label })
        .eq('id', u.id)
      if (error) { allOk = false; break }
    }

    if (allOk) {
      // Actualizar estado local
      const map = new Map(updates.map(u => [u.id, u.label]))
      setSavedPoints(prev =>
        prev.map(p => map.has(p.id) ? { ...p, label: map.get(p.id)! } : p)
      )
      setSelectedPointIds(new Set())
    }
    setRenaming(false)
  }

  const handleDeleteSaved = async (id: string) => {
    if (!confirm('¿Eliminar este punto del mapa?')) return
    const { error } = await supabase.from('route_points').delete().eq('id', id)
    if (!error) {
      setSavedPoints(prev => prev.filter(p => p.id !== id))
      setSelectedPointIds(prev => { const n = new Set(prev); n.delete(id); return n })
    }
  }

  const handleSaveEdit = async (id: string) => {
    const { error } = await supabase.from('route_points').update({ label: editLabel }).eq('id', id)
    if (!error) setSavedPoints(prev => prev.map(p => p.id === id ? { ...p, label: editLabel } : p))
    setEditingId(null)
  }

  // ─── DERIVED ───────────────────────────────────────────────────────────────

  const unsavedCount = pendingPoints.filter(p => !p.saved).length
  const savedThisSession = pendingPoints.filter(p => p.saved).length
  const unassignedCount = savedPoints.filter(p => !p.zona_id).length

  const filteredPoints = savedPoints.filter(p => {
    // Filtro por prefijo (búsqueda de texto en label)
    if (filterPrefix.trim()) {
      if (!p.label.toLowerCase().includes(filterPrefix.trim().toLowerCase())) return false
    }
    if (filterUnassigned) return !p.zona_id
    if (filterZonaId === '__none__') return !p.zona_id
    if (filterZonaId) return p.zona_id === filterZonaId
    return true
  })

  // Puntos guardados filtrados para la pestaña Crear
  const savedPointsForCrear = savedPoints.filter(p => {
    if (!filterCrearZonaId) return true
    if (filterCrearZonaId === '__none__') return !p.zona_id
    return p.zona_id === filterCrearZonaId
  })

  const allMarkersForMap = [
    ...pendingPoints.map(p => ({
      id: p.tempId,
      latitude: p.lat, longitude: p.lng,
      label: p.label,
      color: p.saving ? '#94a3b8' : p.color,
      isPending: true, isSaving: p.saving, isSaved: p.saved,
    })),
    // Solo mostrar savedPoints que coincidan con el filtro de ruta del creador
    ...savedPointsForCrear.map(p => ({
      id: p.id,
      latitude: p.latitude, longitude: p.longitude,
      label: p.label,
      color: p.color || '#6366f1',
      isPending: false, isSaving: false, isSaved: true,
    }))
  ]

  // ─── UI ────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 p-4 sm:p-6">
      <div className="fixed inset-0 z-0 pointer-events-none opacity-20"
        style={{ backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 35px, rgba(99,102,241,0.25) 35px, rgba(99,102,241,0.25) 38px)` }} />

      <div className="relative z-10 h-screen flex flex-col gap-4">

        {/* ── HEADER ─── */}
        <div className="bg-white rounded-3xl shadow-xl border-2 border-indigo-100 p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 flex-shrink-0">
          <div className="flex items-center gap-4">
            <div className="p-4 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl shadow-xl">
              <Route className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                Editor de Zonas
              </h1>
              <p className="text-gray-500 text-sm font-medium mt-0.5">
                Crea puntos en el mapa · asigna rutas cuando estén disponibles
              </p>
            </div>
          </div>
          {/* Stats */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="px-4 py-2 bg-indigo-50 rounded-xl border-2 border-indigo-200 text-center min-w-[72px]">
              <p className="text-2xl font-black text-indigo-600">{savedPoints.length}</p>
              <p className="text-xs text-indigo-500 font-bold">Puntos</p>
            </div>
            <div className="px-4 py-2 bg-amber-50 rounded-xl border-2 border-amber-200 text-center min-w-[72px]">
              <p className="text-2xl font-black text-amber-600">{unassignedCount}</p>
              <p className="text-xs text-amber-500 font-bold">Sin ruta</p>
            </div>
            <div className="px-4 py-2 bg-green-50 rounded-xl border-2 border-green-200 text-center min-w-[72px]">
              <p className="text-2xl font-black text-green-600">{savedPoints.length - unassignedCount}</p>
              <p className="text-xs text-green-500 font-bold">Con ruta</p>
            </div>
          </div>
        </div>

        {/* ── TABS ─── */}
        <div className="flex gap-2 flex-shrink-0">
          <button
            onClick={() => setTab('crear')}
            className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-bold text-sm transition-all shadow-md ${
              tab === 'crear'
                ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white scale-105'
                : 'bg-white text-gray-600 border-2 border-gray-200 hover:border-indigo-300'
            }`}>
            <MapPin className="w-4 h-4" />
            ⚡ Crear Puntos
          </button>
          <button
            onClick={() => setTab('asignar')}
            className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-bold text-sm transition-all shadow-md ${
              tab === 'asignar'
                ? 'bg-gradient-to-r from-purple-500 to-pink-600 text-white scale-105'
                : 'bg-white text-gray-600 border-2 border-gray-200 hover:border-purple-300'
            }`}>
            <Tags className="w-4 h-4" />
            Asignar Rutas
            {unassignedCount > 0 && (
              <span className="bg-amber-400 text-white text-xs font-black px-2 py-0.5 rounded-full">
                {unassignedCount}
              </span>
            )}
          </button>
        </div>

        {/* ══════════════════════════════════════════════════════════
            TAB 1: CREAR PUNTOS
        ══════════════════════════════════════════════════════════ */}
        {tab === 'crear' && (
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-4 min-h-0">

            {/* Panel izquierdo */}
            <div className="flex flex-col gap-4 overflow-y-auto">

              {/* Modo Turbo */}
              <div className={`bg-white rounded-3xl shadow-lg border-2 p-5 transition-all ${turboMode ? 'border-indigo-400 bg-indigo-50/60' : 'border-gray-200'}`}>
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h3 className="font-black text-gray-900 flex items-center gap-2">
                      <Zap className="w-5 h-5 text-yellow-500" />
                      Modo Turbo
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {turboMode ? 'Clic → guardado instantáneo ⚡' : 'Clic → acumula → guarda todo'}
                    </p>
                  </div>
                  <button onClick={() => setTurboMode(!turboMode)}
                    className={`transition-all ${turboMode ? 'text-indigo-600' : 'text-gray-400'}`}>
                    {turboMode ? <ToggleRight className="w-10 h-10" /> : <ToggleLeft className="w-10 h-10" />}
                  </button>
                </div>
                {!turboMode && unsavedCount > 0 && (
                  <button onClick={handleSaveAll} disabled={savingAll}
                    className="w-full mt-3 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-2xl font-bold text-sm transition-all shadow-lg disabled:opacity-50 hover:scale-105">
                    {savingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {savingAll ? 'Guardando...' : `Guardar ${unsavedCount} puntos`}
                  </button>
                )}
              </div>

              {/* Etiqueta */}
              <div className="bg-white rounded-3xl shadow-lg border-2 border-gray-200 p-5">
                <h3 className="font-black text-gray-900 mb-3 flex items-center gap-2">
                  <Edit2 className="w-4 h-4 text-indigo-500" />
                  Etiqueta Automática
                </h3>
                <div className="flex gap-2">
                  {/* Prefijo */}
                  <input
                    type="text"
                    value={labelPrefix}
                    onChange={e => setLabelPrefix(e.target.value)}
                    placeholder="Punto, Stop..."
                    className="flex-1 px-4 py-2.5 border-2 border-gray-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                  {/* Contador editable */}
                  <input
                    type="number"
                    min={1}
                    value={counterDisplay}
                    onChange={e => {
                      const n = Math.max(1, parseInt(e.target.value) || 1)
                      setCounterDisplay(n)
                      counterRef.current = n
                    }}
                    title="Número desde donde empieza el contador"
                    className="w-16 px-2 py-2.5 border-2 border-indigo-200 rounded-xl text-sm font-black text-indigo-700 text-center focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  Próximo: <span className="font-bold text-indigo-600">"{labelPrefix} {counterDisplay}"</span>
                  <span className="ml-2 text-gray-300">→ {labelPrefix} {counterDisplay + 1} → {labelPrefix} {counterDisplay + 2}...</span>
                </p>
              </div>

              {/* Ruta en Turbo */}
              <div className="bg-white rounded-3xl shadow-lg border-2 border-gray-200 p-5">
                <h3 className="font-black text-gray-900 mb-3 flex items-center gap-2">
                  <Route className="w-4 h-4 text-purple-500" />
                  Ruta del Punto
                </h3>
                {zonas.length === 0 ? (
                  <p className="text-xs text-amber-600 font-semibold">⏳ Sin rutas disponibles aún</p>
                ) : (
                  <select
                    value={turboZonaId}
                    onChange={e => setTurboZonaId(e.target.value)}
                    className="w-full px-3 py-2.5 border-2 border-purple-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-purple-400 text-gray-700"
                  >
                    <option value="">— Sin ruta (asignar después) —</option>
                    {zonas.map(z => (
                      <option key={z.id} value={z.id}>{z.codigo_zona} — {z.descripcion}</option>
                    ))}
                  </select>
                )}
                {turboZonaId && (
                  <p className="text-xs text-purple-600 font-bold mt-2">
                    ✓ Cada punto se guardará en: <span className="bg-purple-100 px-1.5 py-0.5 rounded">{zonas.find(z => z.id === turboZonaId)?.codigo_zona}</span>
                  </p>
                )}
              </div>

              {/* Color */}
              <div className="bg-white rounded-3xl shadow-lg border-2 border-gray-200 p-5">
                <h3 className="font-black text-gray-900 mb-3 flex items-center gap-2">
                  <Target className="w-4 h-4 text-indigo-500" />
                  Color del Marcador
                </h3>
                <div className="grid grid-cols-5 gap-2">
                  {COLORS.map(c => (
                    <button key={c} onClick={() => setActiveColor(c)}
                      className={`w-full aspect-square rounded-xl transition-all hover:scale-110 ${activeColor === c ? 'ring-4 ring-gray-800 ring-offset-2 scale-110' : ''}`}
                      style={{ backgroundColor: c }} />
                  ))}
                </div>
              </div>

              {/* Instrucciones */}
              <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-3xl p-5 text-white shadow-xl">
                <h3 className="font-black mb-3 flex items-center gap-2 text-sm">
                  <MapPin className="w-4 h-4" /> Cómo funciona
                </h3>
                <ol className="space-y-2 text-sm">
                  <li className="flex gap-2">
                    <span className="bg-white/20 rounded-full w-5 h-5 flex items-center justify-center text-xs font-black flex-shrink-0 mt-0.5">1</span>
                    <strong>Activa Turbo</strong> → clic en mapa → globito creado ⚡
                  </li>
                  <li className="flex gap-2">
                    <span className="bg-white/20 rounded-full w-5 h-5 flex items-center justify-center text-xs font-black flex-shrink-0 mt-0.5">2</span>
                    Crea todos los puntos que quieras — sin ruta
                  </li>
                  <li className="flex gap-2">
                    <span className="bg-white/20 rounded-full w-5 h-5 flex items-center justify-center text-xs font-black flex-shrink-0 mt-0.5">3</span>
                    Cuando el SQL esté conectado → ve a <strong>Asignar Rutas</strong>
                  </li>
                  <li className="flex gap-2">
                    <span className="bg-white/20 rounded-full w-5 h-5 flex items-center justify-center text-xs font-black flex-shrink-0 mt-0.5">4</span>
                    Selecciona puntos → elige ruta → asignar batch
                  </li>
                </ol>
              </div>

              {/* Sesión actual */}
              {pendingPoints.length > 0 && (
                <div className="bg-white rounded-3xl shadow-lg border-2 border-gray-200 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-black text-gray-900 text-sm">
                      Esta sesión ({pendingPoints.length})
                    </h3>
                    {savedThisSession > 0 && (
                      <button onClick={() => setPendingPoints(p => p.filter(x => !x.saved))}
                        className="text-xs text-gray-400 hover:text-red-500 font-bold transition-all">
                        Limpiar ✓
                      </button>
                    )}
                  </div>
                  <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                    {[...pendingPoints].reverse().map(p => (
                      <div key={p.tempId}
                        className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs ${
                          p.saved ? 'bg-green-50 border border-green-200'
                          : p.saving ? 'bg-gray-50 border border-gray-200 opacity-60'
                          : p.error ? 'bg-red-50 border border-red-200'
                          : 'bg-indigo-50 border border-indigo-200'
                        }`}>
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
                        <span className="flex-1 font-bold text-gray-700 truncate">{p.label}</span>
                        {p.saving && <Loader2 className="w-3 h-3 animate-spin text-gray-400" />}
                        {p.saved && <Check className="w-3 h-3 text-green-500" />}
                        {p.error && <span className="text-red-500 text-[10px]">Error</span>}
                        {!p.saved && !p.saving && (
                          <button onClick={() => setPendingPoints(prev => prev.filter(x => x.tempId !== p.tempId))}
                            className="text-gray-300 hover:text-red-500 transition-all">
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Puntos guardados (colapsable) con filtro de ruta */}
              <div className="bg-white rounded-3xl shadow-lg border-2 border-gray-200 p-4">
                <button
                  onClick={() => setShowSavedInCrear(!showSavedInCrear)}
                  className="flex items-center justify-between w-full mb-1"
                >
                  <h3 className="font-black text-gray-900 text-sm flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-indigo-500" />
                    Puntos guardados ({savedPoints.length})
                  </h3>
                  <span className="text-gray-400 text-xs">{showSavedInCrear ? '▲ Ocultar' : '▼ Ver'}</span>
                </button>

                {showSavedInCrear && (
                  <div className="mt-3">
                    {/* Filtro ruta */}
                    <select
                      value={filterCrearZonaId}
                      onChange={e => setFilterCrearZonaId(e.target.value)}
                      className="w-full px-3 py-2 border-2 border-gray-200 rounded-xl text-xs font-bold mb-3 focus:outline-none focus:ring-2 focus:ring-indigo-300 text-gray-700"
                    >
                      <option value="">Todas las rutas</option>
                      <option value="__none__">Sin ruta</option>
                      {zonas.map(z => (
                        <option key={z.id} value={z.id}>{z.codigo_zona} — {z.descripcion}</option>
                      ))}
                    </select>

                    {loadingSaved ? (
                      <div className="flex justify-center py-4">
                        <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
                      </div>
                    ) : savedPointsForCrear.length === 0 ? (
                      <p className="text-xs text-gray-400 text-center py-3">No hay puntos para mostrar</p>
                    ) : (
                      <div className="space-y-1 max-h-60 overflow-y-auto pr-1">
                        {savedPointsForCrear.map(p => (
                          <div key={p.id} className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs bg-green-50 border border-green-100">
                            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: p.color || '#6366f1' }} />
                            <span className="flex-1 font-semibold text-gray-700 truncate">{p.label}</span>
                            {p.zona_id ? (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700 flex-shrink-0">
                                {getZonaName(p.zonas) || '?'}
                              </span>
                            ) : (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-600 flex-shrink-0">Sin ruta</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* ─── MAPA ─── */}
            <div className={`bg-white shadow-2xl border-2 border-indigo-100 overflow-hidden flex flex-col ${
              mapFullscreen
                ? 'fixed inset-0 z-[9999] rounded-none'
                : 'rounded-3xl min-h-[500px]'
            }`}>
              {/* Barra del mapa */}
              <div className="bg-gradient-to-r from-indigo-50 to-purple-50 px-4 py-2.5 border-b-2 border-indigo-100 flex items-center justify-between flex-shrink-0 gap-3">

                {/* Estado turbo + contador + filtro ruta */}
                <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                  <p className="font-bold text-gray-700 text-sm flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full animate-pulse ${turboMode ? 'bg-green-500' : 'bg-amber-500'}`} />
                    {turboMode ? '⚡ Turbo' : '🎯 Manual'}
                    <span className="text-xs text-indigo-500 font-black bg-indigo-100 px-2 py-0.5 rounded-full">
                      {allMarkersForMap.length} pts
                    </span>
                  </p>
                  {/* Filtro rúta en mapa */}
                  {zonas.length > 0 && (
                    <select
                      value={filterCrearZonaId}
                      onChange={e => setFilterCrearZonaId(e.target.value)}
                      className="px-2 py-1 border-2 border-purple-200 rounded-lg text-xs font-bold focus:outline-none focus:ring-2 focus:ring-purple-400 text-gray-700 bg-white max-w-[140px]"
                    >
                      <option value="">🗺️ Toda las rutas</option>
                      <option value="__none__">Sin ruta</option>
                      {zonas.map(z => (
                        <option key={z.id} value={z.id}>{z.codigo_zona}</option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Controles flotantes en fullscreen */}
                {mapFullscreen && (
                  <div className="flex items-center gap-2 flex-1 justify-center flex-wrap">
                    {/* Toggle Turbo */}
                    <button onClick={() => setTurboMode(!turboMode)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border-2 transition-all ${
                        turboMode ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-300'
                      }`}>
                      <Zap className="w-3 h-3" />
                      {turboMode ? 'Turbo ON' : 'Turbo OFF'}
                    </button>

                    {/* Colores */}
                    <div className="flex items-center gap-1">
                      {COLORS.map(c => (
                        <button key={c} onClick={() => setActiveColor(c)}
                          className="rounded-full transition-all hover:scale-110"
                          style={{
                            width: activeColor === c ? 22 : 16,
                            height: activeColor === c ? 22 : 16,
                            background: c,
                            border: activeColor === c ? '3px solid white' : '2px solid white',
                            boxShadow: activeColor === c ? `0 0 0 2px ${c}` : 'none',
                          }} />
                      ))}
                    </div>

                    {/* Prefijo + Contador */}
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        value={labelPrefix}
                        onChange={e => setLabelPrefix(e.target.value)}
                        className="px-2 py-1 border-2 border-gray-200 rounded-lg text-xs font-bold w-24 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                        placeholder="Prefijo..."
                      />
                      <input
                        type="number"
                        min={1}
                        value={counterDisplay}
                        onChange={e => {
                          const n = Math.max(1, parseInt(e.target.value) || 1)
                          setCounterDisplay(n)
                          counterRef.current = n
                        }}
                        title="Número desde donde empieza el contador"
                        className="w-14 px-2 py-1 border-2 border-indigo-200 rounded-lg text-xs font-black text-indigo-700 text-center focus:outline-none focus:ring-2 focus:ring-indigo-400"
                      />
                    </div>

                    {/* Guardar pendientes */}
                    {!turboMode && unsavedCount > 0 && (
                      <button onClick={handleSaveAll} disabled={savingAll}
                        className="flex items-center gap-1 px-3 py-1.5 bg-green-500 text-white rounded-xl text-xs font-bold hover:bg-green-600 disabled:opacity-50">
                        {savingAll ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                        Guardar {unsavedCount}
                      </button>
                    )}

                    {/* Selector de ruta en fullscreen */}
                    {zonas.length > 0 && (
                      <select
                        value={turboZonaId}
                        onChange={e => setTurboZonaId(e.target.value)}
                        className="px-2 py-1 border-2 border-purple-200 rounded-lg text-xs font-bold focus:outline-none focus:ring-2 focus:ring-purple-400 text-gray-700 bg-white max-w-[120px]"
                        title="Ruta del punto"
                      >
                        <option value="">— Sin ruta —</option>
                        {zonas.map(z => (
                          <option key={z.id} value={z.id}>{z.codigo_zona}</option>
                        ))}
                      </select>
                    )}

                    {/* Filtro de mapa en fullscreen */}
                    {zonas.length > 0 && (
                      <select
                        value={filterCrearZonaId}
                        onChange={e => setFilterCrearZonaId(e.target.value)}
                        className="px-2 py-1 border-2 border-indigo-200 rounded-lg text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-400 text-gray-700 bg-white max-w-[110px]"
                        title="Filtrar mapa por ruta"
                      >
                        <option value="">🗺️ Todas</option>
                        <option value="__none__">Sin ruta</option>
                        {zonas.map(z => (
                          <option key={z.id} value={z.id}>{z.codigo_zona}</option>
                        ))}
                      </select>
                    )}
                  </div>
                )}

                {/* Botón Fullscreen */}
                <button
                  onClick={() => setMapFullscreen(!mapFullscreen)}
                  title={mapFullscreen ? 'Salir de pantalla completa (ESC)' : 'Pantalla completa'}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white border-2 border-indigo-200 text-indigo-700 rounded-xl text-xs font-bold hover:bg-indigo-50 hover:border-indigo-400 transition-all flex-shrink-0 shadow-sm">
                  {mapFullscreen
                    ? <><Minimize2 className="w-3.5 h-3.5" /> Salir <span className="text-[10px] text-gray-400">ESC</span></>
                    : <><Maximize2 className="w-3.5 h-3.5" /> Pantalla completa</>}
                </button>
              </div>

              <div className="flex-1">
                <ZonasMapLoader markers={allMarkersForMap} onMapClick={handleMapClick} />
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════
            TAB 2: ASIGNAR RUTAS
        ══════════════════════════════════════════════════════════ */}
        {tab === 'asignar' && (
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-4 min-h-0">

            {/* Panel de control de asignación */}
            <div className="flex flex-col gap-4 overflow-y-auto">

              {/* Selector de ruta destino */}
              <div className="bg-white rounded-3xl shadow-lg border-2 border-purple-200 p-5">
                <h3 className="font-black text-gray-900 mb-3 flex items-center gap-2">
                  <Route className="w-5 h-5 text-purple-500" />
                  Asignar a Ruta
                </h3>
                {zonas.length === 0 ? (
                  <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-4 text-center">
                    <p className="text-amber-700 font-bold text-sm">⏳ Rutas no disponibles aún</p>
                    <p className="text-amber-600 text-xs mt-1">
                      Se cargarán automáticamente cuando el sistema SQL Server esté conectado y sincronizado.
                    </p>
                  </div>
                ) : (
                  <>
                    <select
                      value={assignToZonaId}
                      onChange={e => setAssignToZonaId(e.target.value)}
                      className="w-full px-4 py-3 border-2 border-purple-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-purple-400 text-gray-700 mb-4">
                      <option value="">— Seleccionar ruta destino —</option>
                      {zonas.map(z => (
                        <option key={z.id} value={z.id}>
                          {z.codigo_zona} — {z.descripcion}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => handleBatchAssign()}
                      disabled={!assignToZonaId || selectedPointIds.size === 0 || assigning}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-2xl font-bold text-sm transition-all shadow-lg disabled:opacity-40 hover:scale-105 disabled:hover:scale-100">
                      {assigning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Tags className="w-4 h-4" />}
                      {assigning
                        ? 'Asignando...'
                        : selectedPointIds.size > 0
                          ? `Asignar ${selectedPointIds.size} punto${selectedPointIds.size !== 1 ? 's' : ''} a esta ruta`
                          : 'Selecciona puntos abajo'}
                    </button>
                  </>
                )}
              </div>

              {/* Filtros de lista */}
              <div className="bg-white rounded-3xl shadow-lg border-2 border-gray-200 p-5">
                <h3 className="font-black text-gray-900 mb-3 text-sm flex items-center gap-2">
                  Filtrar Puntos
                </h3>
                <div className="flex flex-col gap-2">

                  {/* Búsqueda por prefijo */}
                  <div className="relative">
                    <input
                      type="text"
                      value={filterPrefix}
                      onChange={e => setFilterPrefix(e.target.value)}
                      placeholder="Buscar por prefijo (ej: Punto, Stop, R1...)" 
                      className="w-full px-4 py-2.5 border-2 border-indigo-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-400 pr-10"
                    />
                    {filterPrefix && (
                      <button
                        onClick={() => setFilterPrefix('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500 transition-all"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Botón seleccionar todos los del prefijo */}
                  {filterPrefix.trim() && (
                    <div className="bg-indigo-50 border-2 border-indigo-200 rounded-xl px-3 py-2 flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-indigo-700">
                        {filteredPoints.length} punto{filteredPoints.length !== 1 ? 's' : ''} con "{filterPrefix.trim()}"
                      </span>
                      <button
                        onClick={() => selectAll(filteredPoints.map(p => p.id))}
                        className="text-xs font-black text-white bg-indigo-500 hover:bg-indigo-600 px-3 py-1 rounded-lg transition-all flex-shrink-0"
                      >
                        Seleccionar todos
                      </button>
                    </div>
                  )}

                  <button
                    onClick={() => { setFilterUnassigned(!filterUnassigned); setFilterZonaId('') }}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold border-2 transition-all ${
                      filterUnassigned ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-gray-600 border-gray-200 hover:border-amber-300'
                    }`}>
                    {filterUnassigned ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                    Solo sin ruta ({unassignedCount})
                  </button>
                  <select
                    value={filterZonaId}
                    onChange={e => { setFilterZonaId(e.target.value); setFilterUnassigned(false) }}
                    className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-purple-400 text-gray-700">
                    <option value="">Todas las rutas</option>
                    <option value="__none__">Sin ruta asignada</option>
                    {zonas.map(z => (
                      <option key={z.id} value={z.id}>{z.codigo_zona} — {z.descripcion}</option>
                    ))}
                  </select>

                  {/* Acción rápida: filtrar + asignar */}
                  {filterPrefix.trim() && assignToZonaId && filteredPoints.length > 0 && (
                    <button
                      onClick={() => handleBatchAssign(filteredPoints.map(p => p.id))}
                      disabled={assigning}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-2xl font-bold text-sm transition-all shadow-lg disabled:opacity-40 hover:scale-105"
                    >
                      {assigning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Tags className="w-4 h-4" />}
                      Asignar {filteredPoints.length} puntos "{filterPrefix.trim()}" a {zonas.find(z => z.id === assignToZonaId)?.codigo_zona}
                    </button>
                  )}

                </div>
              </div>

              {/* Selección masiva + Renombrado batch */}
              <div className="bg-white rounded-3xl shadow-lg border-2 border-gray-200 p-5">
                <h3 className="font-black text-gray-900 mb-3 text-sm">
                  Selección ({selectedPointIds.size} de {filteredPoints.length})
                </h3>
                <div className="flex gap-2 mb-4">
                  <button
                    onClick={() => selectAll(filteredPoints.map(p => p.id))}
                    className="flex-1 px-3 py-2 border-2 border-indigo-200 text-indigo-700 rounded-xl text-xs font-bold hover:bg-indigo-50 transition-all">
                    ✓ Seleccionar todos
                  </button>
                  <button
                    onClick={() => setSelectedPointIds(new Set())}
                    className="flex-1 px-3 py-2 border-2 border-gray-200 text-gray-500 rounded-xl text-xs font-bold hover:bg-gray-50 transition-all">
                    ✕ Limpiar
                  </button>
                </div>

                {/* ── Renombrador batch ── */}
                <div className={`mt-1 border-t-2 pt-4 transition-all ${selectedPointIds.size > 0 ? 'border-indigo-100' : 'border-gray-100 opacity-50 pointer-events-none'}`}>
                  <h4 className="font-black text-gray-800 text-xs mb-3 flex items-center gap-2">
                    <Edit2 className="w-3.5 h-3.5 text-indigo-500" />
                    Renombrar seleccionados
                    {selectedPointIds.size > 0 && (
                      <span className="bg-indigo-100 text-indigo-700 text-[10px] font-black px-2 py-0.5 rounded-full">
                        {selectedPointIds.size} puntos
                      </span>
                    )}
                  </h4>

                  <div className="flex gap-2 mb-2">
                    {/* Prefijo */}
                    <div className="flex-1">
                      <label className="text-[10px] font-bold text-gray-500 mb-1 block">Prefijo</label>
                      <input
                        type="text"
                        value={renamePrefix}
                        onChange={e => setRenamePrefix(e.target.value)}
                        placeholder="Stop, Punto, Cliente..."
                        className="w-full px-3 py-2 border-2 border-gray-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-400"
                      />
                    </div>
                    {/* Número inicial */}
                    <div className="w-20">
                      <label className="text-[10px] font-bold text-gray-500 mb-1 block">Desde #</label>
                      <input
                        type="number"
                        min={1}
                        value={renameStart}
                        onChange={e => setRenameStart(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full px-3 py-2 border-2 border-gray-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-400 text-center"
                      />
                    </div>
                  </div>

                  {/* Preview */}
                  {renamePrefix && selectedPointIds.size > 0 && (
                    <p className="text-[10px] text-gray-500 font-bold mb-3 bg-gray-50 rounded-lg px-3 py-2">
                      Vista previa: <span className="text-indigo-600">
                        {renamePrefix} {renameStart}
                        {selectedPointIds.size > 1 && ` → ${renamePrefix} ${renameStart + selectedPointIds.size - 1}`}
                      </span>
                    </p>
                  )}

                  <button
                    onClick={handleBatchRename}
                    disabled={selectedPointIds.size === 0 || !renamePrefix.trim() || renaming}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-2xl font-bold text-xs transition-all shadow-md disabled:opacity-40 hover:scale-105 disabled:hover:scale-100">
                    {renaming ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    {renaming
                      ? 'Renombrando...'
                      : selectedPointIds.size > 0
                        ? `Renombrar ${selectedPointIds.size} punto${selectedPointIds.size !== 1 ? 's' : ''}`
                        : 'Selecciona puntos primero'}
                  </button>
                </div>
              </div>

            </div>

            {/* Lista de puntos para seleccionar */}
            <div className="bg-white rounded-3xl shadow-2xl border-2 border-purple-100 overflow-hidden flex flex-col">
              <div className="bg-gradient-to-r from-purple-50 to-pink-50 px-5 py-3 border-b-2 border-purple-100 flex items-center justify-between flex-shrink-0">
                <p className="font-bold text-gray-700 text-sm">
                  {filteredPoints.length} puntos · haz clic en uno para seleccionarlo
                </p>
                {selectedPointIds.size > 0 && (
                  <span className="text-xs font-black text-purple-700 bg-purple-100 px-3 py-1 rounded-full">
                    {selectedPointIds.size} seleccionados
                  </span>
                )}
              </div>

              {loadingSaved ? (
                <div className="flex-1 flex items-center justify-center">
                  <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
                </div>
              ) : filteredPoints.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-gray-400 flex-col gap-2">
                  <MapPin className="w-12 h-12 opacity-20" />
                  <p className="font-semibold">No hay puntos para mostrar</p>
                  <p className="text-xs">Ve a "Crear Puntos" y empieza a clickear el mapa</p>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto p-4">
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                    {filteredPoints.map(p => {
                      const isSelected = selectedPointIds.has(p.id)
                      return (
                        <div
                          key={p.id}
                          onClick={() => toggleSelect(p.id)}
                          className={`relative flex flex-col gap-1.5 p-3 rounded-2xl border-2 cursor-pointer transition-all select-none ${
                            isSelected
                              ? 'border-purple-500 bg-purple-50 shadow-md scale-[1.02]'
                              : 'border-gray-200 bg-gray-50 hover:border-purple-300 hover:bg-purple-50/50'
                          }`}>
                          {/* Checkbox visual */}
                          <div className={`absolute top-2 right-2 w-4 h-4 rounded flex items-center justify-center transition-all ${
                            isSelected ? 'bg-purple-500' : 'bg-gray-200'
                          }`}>
                            {isSelected && <Check className="w-3 h-3 text-white" />}
                          </div>

                          {/* Color dot + label */}
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full flex-shrink-0 shadow"
                              style={{ backgroundColor: p.color || '#6366f1' }} />
                            {editingId === p.id ? (
                              <input
                                value={editLabel}
                                onChange={e => setEditLabel(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleSaveEdit(p.id)}
                                onClick={e => e.stopPropagation()}
                                className="flex-1 min-w-0 border border-purple-300 rounded px-1 py-0.5 text-xs focus:outline-none"
                                autoFocus
                              />
                            ) : (
                              <span className="flex-1 font-bold text-gray-700 text-xs truncate pr-4">{p.label}</span>
                            )}
                          </div>

                          {/* Badge de ruta */}
                          {p.zonas ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 truncate text-center">
                              🗺️ {p.zonas.codigo_zona}
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-600 text-center">
                              Sin ruta
                            </span>
                          )}

                          {/* Acciones hover */}
                          <div className="flex gap-1 justify-end mt-1">
                            {editingId === p.id ? (
                              <button onClick={e => { e.stopPropagation(); handleSaveEdit(p.id) }}
                                className="text-green-500 hover:text-green-700 p-0.5">
                                <Check className="w-3 h-3" />
                              </button>
                            ) : (
                              <button onClick={e => { e.stopPropagation(); setEditingId(p.id); setEditLabel(p.label) }}
                                className="text-gray-300 hover:text-indigo-500 p-0.5 transition-all">
                                <Edit2 className="w-3 h-3" />
                              </button>
                            )}
                            <button onClick={e => { e.stopPropagation(); handleDeleteSaved(p.id) }}
                              className="text-gray-300 hover:text-red-500 p-0.5 transition-all">
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

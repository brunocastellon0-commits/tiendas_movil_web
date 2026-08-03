'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  Download,
  Loader2,
  MapPin,
  Search,
  Store,
  TrendingUp,
  Users,
  XCircle,
} from 'lucide-react'

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function defaultFrom() {
  const d = new Date(Date.now() - 30 * 86400000)
  return d.toISOString().slice(0, 10)
}

function outcomeInfo(outcome: string): { label: string; badge: string } {
  switch (outcome) {
    case 'sale':
      return { label: 'Venta', badge: 'bg-green-100 text-green-700 border-green-200' }
    case 'no_sale':
      return { label: 'Sin Venta', badge: 'bg-amber-100 text-amber-700 border-amber-200' }
    case 'store_closed':
    case 'closed':
      return { label: 'Tienda Cerrada', badge: 'bg-red-100 text-red-700 border-red-200' }
    default:
      return { label: outcome || 'N/A', badge: 'bg-gray-100 text-gray-600 border-gray-200' }
  }
}

function formatDuration(seconds: number): string {
  if (!seconds || seconds < 0) return '0 seg'
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  if (m < 1) return `${s} seg`
  if (m < 60) return s > 0 ? `${m} min ${s} seg` : `${m} min`
  const h = Math.floor(m / 60)
  return `${h}h ${m % 60} min`
}

function formatDate(ts?: string) {
  if (!ts) return 'N/A'
  return new Date(ts).toLocaleString('es-BO', { dateStyle: 'short', timeStyle: 'short' })
}

// ─── CSV ─────────────────────────────────────────────────────────────────────
function toCsv(rows: any[]): string {
  const headers = [
    'Fecha', 'Vendedor', 'Cliente', 'Codigo', 'Inicio Visita', 'Fin Visita',
    'Duracion', 'Resultado', 'Precision GPS (m)', 'Notas',
  ]
  const esc = (val: any) => {
    const s = val == null ? '' : String(val)
    if (/[",\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`
    return s
  }
  const lines = rows.map(v => [
    formatDate(v.start_time),
    v.employees?.full_name || 'N/A',
    v.clients?.name || 'N/A',
    v.clients?.code || v.clients?.legacy_id || '',
    v.start_time ? new Date(v.start_time).toLocaleString('es-BO') : 'N/A',
    v.end_time ? new Date(v.end_time).toLocaleString('es-BO') : 'N/A',
    v.duration_seconds != null ? formatDuration(v.duration_seconds) : 'N/A',
    outcomeInfo(v.outcome).label,
    v.gps_accuracy_meters != null ? Number(v.gps_accuracy_meters).toFixed(1) : 'N/A',
    v.notes || '',
  ].map(esc).join(','))
  return '\uFEFF' + [headers.join(','), ...lines].join('\n')
}

// ─── COMPONENTE ─────────────────────────────────────────────────────────────
export default function VisitasReporte() {
  const supabase = createClient()

  const [visits, setVisits] = useState<any[]>([])
  const [employees, setEmployees] = useState<{ id: string; full_name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // ── Filtros propios (independientes del mapa) ──
  const [filterEmployee, setFilterEmployee] = useState<string>('ALL')
  const [filterFrom, setFilterFrom] = useState<string>(defaultFrom)
  const [filterTo, setFilterTo] = useState<string>(todayStr)

  // ── Filtros de la tabla ──
  const [searchTerm, setSearchTerm] = useState('')
  const [resultFilter, setResultFilter] = useState<'ALL' | 'sale' | 'no_sale' | 'closed'>('ALL')

  const fetchVisits = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      let q = supabase.from('visits')
        .select('id, start_time, end_time, outcome, notes, duration_seconds, gps_accuracy_meters, seller_id, client_id, check_in_location, check_out_location')
        .neq('outcome', 'pending')
        .gte('start_time', filterFrom)
        .lte('start_time', filterTo + 'T23:59:59')
        .order('start_time', { ascending: false })
        .limit(1000)
      if (filterEmployee !== 'ALL') q = q.eq('seller_id', filterEmployee)

      const { data: vData } = await q
      if (vData) {
        const vClientIds = [...new Set(vData.map((v: any) => v.client_id).filter(Boolean))]
        const vEmpIds = [...new Set(vData.map((v: any) => v.seller_id).filter(Boolean))]
        const [vClientsRes, vEmpsRes] = await Promise.all([
          vClientIds.length > 0 ? supabase.from('clients').select('id, name, legacy_id, code').in('id', vClientIds) : { data: [] },
          vEmpIds.length > 0 ? supabase.from('employees').select('id, full_name').in('id', vEmpIds) : { data: [] },
        ])
        const vClientMap: Record<string, any> = {}
        if (vClientsRes.data) vClientsRes.data.forEach((c: any) => { vClientMap[c.id] = c })
        const vEmpMap: Record<string, any> = {}
        if (vEmpsRes.data) vEmpsRes.data.forEach((e: any) => { vEmpMap[e.id] = e })
        setVisits(vData.map((v: any) => ({
          ...v,
          clients: v.client_id ? (vClientMap[v.client_id] || null) : null,
          employees: v.seller_id ? (vEmpMap[v.seller_id] || null) : null,
        })))
      } else {
        setVisits([])
      }
    } catch (e: any) {
      setError(e?.message || 'Error al cargar las visitas')
      setVisits([])
    } finally {
      setLoading(false)
    }
  }, [supabase, filterEmployee, filterFrom, filterTo])

  useEffect(() => {
    const load = async () => { await fetchVisits() }
    load()
  }, [fetchVisits])

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from('employees').select('id, full_name').order('full_name')
      if (data) setEmployees(data)
    }
    load()
  }, [supabase])

  const stats = useMemo(() => {
    const total = visits.length
    const ventas = visits.filter(v => v.outcome === 'sale').length
    const sinVenta = visits.filter(v => v.outcome === 'no_sale').length
    const cerradas = visits.filter(v => v.outcome === 'store_closed' || v.outcome === 'closed').length
    const clientesUnicos = new Set(visits.map(v => v.client_id).filter(Boolean)).size
    const efectividad = total > 0 ? Math.round((ventas / total) * 100) : 0
    return { total, ventas, sinVenta, cerradas, clientesUnicos, efectividad }
  }, [visits])

  const filteredVisits = useMemo(() => {
    return visits.filter(v => {
      const matchesResult =
        resultFilter === 'ALL' ||
        (resultFilter === 'closed' ? (v.outcome === 'store_closed' || v.outcome === 'closed') : v.outcome === resultFilter)
      const term = searchTerm.toLowerCase()
      const matchesSearch =
        !term ||
        (v.clients?.name || '').toLowerCase().includes(term) ||
        (v.clients?.code || v.clients?.legacy_id || '').toLowerCase().includes(term) ||
        (v.employees?.full_name || '').toLowerCase().includes(term)
      return matchesResult && matchesSearch
    })
  }, [visits, resultFilter, searchTerm])

  const employeeName =
    filterEmployee === 'ALL' ? 'Todos los vendedores' : employees.find(e => e.id === filterEmployee)?.full_name || 'N/A'

  const handleDownload = () => {
    const blob = new Blob([toCsv(filteredVisits)], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `tiendas_atendidas_${filterFrom}_${filterTo}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-gradient-to-br from-green-500 to-emerald-600 p-4 rounded-2xl shadow-lg text-white">
          <Store className="w-5 h-5 mb-2 opacity-80" />
          <p className="text-xs font-bold opacity-80">Tiendas Atendidas</p>
          <p className="text-2xl font-black">{stats.total}</p>
        </div>
        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-4 rounded-2xl shadow-lg text-white">
          <CheckCircle2 className="w-5 h-5 mb-2 opacity-80" />
          <p className="text-xs font-bold opacity-80">Con Venta</p>
          <p className="text-2xl font-black">{stats.ventas}</p>
        </div>
        <div className="bg-gradient-to-br from-amber-500 to-orange-600 p-4 rounded-2xl shadow-lg text-white">
          <XCircle className="w-5 h-5 mb-2 opacity-80" />
          <p className="text-xs font-bold opacity-80">Sin Venta</p>
          <p className="text-2xl font-black">{stats.sinVenta}</p>
        </div>
        <div className="bg-gradient-to-br from-red-500 to-rose-600 p-4 rounded-2xl shadow-lg text-white">
          <AlertCircle className="w-5 h-5 mb-2 opacity-80" />
          <p className="text-xs font-bold opacity-80">Cerradas</p>
          <p className="text-2xl font-black">{stats.cerradas}</p>
        </div>
        <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-4 rounded-2xl shadow-lg text-white">
          <TrendingUp className="w-5 h-5 mb-2 opacity-80" />
          <p className="text-xs font-bold opacity-80">Efectividad</p>
          <p className="text-2xl font-black">{stats.efectividad}%</p>
          <p className="text-[11px] opacity-80 mt-0.5">{stats.clientesUnicos} clientes únicos</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white p-4 rounded-3xl shadow-lg border-2 border-green-100">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
          <div>
            <h2 className="text-lg font-black text-gray-900">Tiendas Atendidas</h2>
            <p className="text-xs text-gray-500 font-medium">
              {employeeName} · {filterFrom} → {filterTo}
            </p>
          </div>
          <button onClick={handleDownload} disabled={filteredVisits.length === 0}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-bold text-sm transition-all shadow ${filteredVisits.length === 0 ? 'bg-gray-300 cursor-not-allowed text-white' : 'bg-gradient-to-r from-green-500 to-emerald-600 hover:scale-105 text-white'}`}>
            <Download className="w-4 h-4" /> Descargar CSV
          </button>
        </div>

        {/* Filtros */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1.5 flex items-center gap-1">
              <Users className="w-3.5 h-3.5" /> Vendedor
            </label>
            <select value={filterEmployee} onChange={e => setFilterEmployee(e.target.value)}
              className="w-full px-3 py-2.5 text-sm text-gray-900 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 font-medium">
              <option value="ALL">Todos los Vendedores</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.full_name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1.5 flex items-center gap-1">
              <CalendarDays className="w-3.5 h-3.5" /> Desde
            </label>
            <input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)} max={filterTo}
              className="w-full px-3 py-2.5 text-sm text-gray-900 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 font-medium" />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1.5 flex items-center gap-1">
              <CalendarDays className="w-3.5 h-3.5" /> Hasta
            </label>
            <input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)} min={filterFrom}
              className="w-full px-3 py-2.5 text-sm text-gray-900 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 font-medium" />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar cliente, código o vendedor..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border-2 border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 font-medium"
            />
          </div>
          <div className="flex p-1 bg-gray-100 rounded-xl">
            {([
              { key: 'ALL', label: 'Todos' },
              { key: 'sale', label: 'Con Venta' },
              { key: 'no_sale', label: 'Sin Venta' },
              { key: 'closed', label: 'Cerradas' },
            ] as const).map(f => (
              <button key={f.key} onClick={() => setResultFilter(f.key)}
                className={`px-3 py-2 rounded-lg text-xs font-bold transition-all ${resultFilter === f.key ? 'bg-white text-green-700 shadow border border-green-200' : 'text-gray-500 hover:text-gray-700'}`}>
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Carga / Error */}
      {loading && (
        <div className="bg-white rounded-3xl shadow-2xl border-2 border-green-100 p-12 flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-green-600" />
          <p className="text-gray-500 text-sm font-medium">Cargando visitas...</p>
        </div>
      )}

      {!loading && error && (
        <div className="bg-red-50 border-2 border-red-300 text-red-700 p-4 rounded-3xl flex items-start gap-2 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" /> {error}
        </div>
      )}

      {/* Tabla */}
      {!loading && !error && (
        <div className="bg-white rounded-3xl shadow-2xl border-2 border-green-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-gradient-to-r from-green-50 to-emerald-50 text-xs uppercase tracking-wider text-gray-500 font-black border-b-2 border-green-100">
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Código</th>
                  <th className="px-4 py-3">Vendedor</th>
                  <th className="px-4 py-3">Inicio Visita</th>
                  <th className="px-4 py-3">Fin Visita</th>
                  <th className="px-4 py-3">Duración</th>
                  <th className="px-4 py-3 text-center">Resultado</th>
                  <th className="px-4 py-3">Notas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredVisits.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-gray-400 font-medium">
                      <MapPin className="w-8 h-8 mx-auto mb-2 opacity-40" />
                      No hay visitas registradas en el período seleccionado.
                    </td>
                  </tr>
                )}
                {filteredVisits.map(v => {
                  const oi = outcomeInfo(v.outcome)
                  return (
                    <tr key={v.id} className="hover:bg-green-50/40 transition-colors">
                      <td className="px-4 py-3 font-bold text-gray-900 whitespace-nowrap">{v.clients?.name || 'N/A'}</td>
                      <td className="px-4 py-3 text-gray-500">{v.clients?.code || v.clients?.legacy_id || '—'}</td>
                      <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{v.employees?.full_name || 'N/A'}</td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{formatDate(v.start_time)}</td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{formatDate(v.end_time)}</td>
                      <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                        {v.duration_seconds != null ? formatDuration(v.duration_seconds) : 'N/A'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-bold border ${oi.badge}`}>{oi.label}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 italic max-w-[220px] truncate">{v.notes || '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="p-3 border-t border-green-100 bg-green-50/40 text-xs text-center text-gray-500 font-medium">
            Mostrando {filteredVisits.length} de {visits.length} visitas en el período
          </div>
        </div>
      )}
    </div>
  )
}

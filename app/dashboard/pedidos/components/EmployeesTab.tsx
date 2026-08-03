'use client'

import { useState, useEffect, useMemo, useRef, type ReactNode } from 'react'
import { createClient } from '@/utils/supabase/client'
import { format, parseISO, startOfWeek } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  DollarSign,
  Wallet,
  CreditCard,
  BarChart2,
  MapPin,
  TrendingUp,
  TrendingDown,
  Store,
  CalendarDays,
  Users,
} from 'lucide-react'
import {
  BarChart, Bar, ComposedChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'

// ─── Types ────────────────────────────────────────────────────────────────────

type Employee = {
  id: string
  full_name: string
}

type Order = {
  id: string
  numero_documento: string
  fecha_pedido: string
  total_venta: number
  tipo_pago: string
  estado: string
  observacion: string | null
  empleado_id: string
  clients: { name: string; legacy_id: string | null } | null
  employees: { full_name: string } | null
}

type Visit = {
  id: string
  start_time: string
  outcome: string
  seller_id: string
  notes?: string | null
  clients: { name: string } | null
}

type DateRange = {
  start: string
  end: string
}

type BarItem = {
  label: string
  value: number
  color: string
}

type KPICardProps = {
  icon: ReactNode
  label: string
  value: string
  sub?: string
  progress?: number
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple'
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CURRENT_YEAR = new Date().getFullYear()

const DEFAULT_DATE_RANGE: DateRange = {
  start: `${CURRENT_YEAR}-01-01`,
  end: `${CURRENT_YEAR}-12-31`,
}

const VARIANT_STYLES = {
  default: { iconBg: 'bg-slate-100', iconColor: 'text-slate-500' },
  success: { iconBg: 'bg-emerald-50', iconColor: 'text-emerald-600' },
  warning: { iconBg: 'bg-amber-50', iconColor: 'text-amber-500' },
  danger: { iconBg: 'bg-rose-50', iconColor: 'text-rose-500' },
  info: { iconBg: 'bg-blue-50', iconColor: 'text-blue-500' },
  purple: { iconBg: 'bg-violet-50', iconColor: 'text-violet-500' },
} as const

const OUTCOME_COLORS: Record<string, string> = {
  sale: '#22c55e',
  no_sale: '#f59e0b',
  store_closed: '#9ca3af',
}

const OUTCOME_LABELS: Record<string, string> = {
  sale: 'Con venta',
  no_sale: 'Sin venta',
  store_closed: 'Cerrado',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('es-BO', {
    style: 'currency',
    currency: 'BOB',
    maximumFractionDigits: 0,
  }).format(value)

const calcPercent = (a: number, b: number): number =>
  b === 0 ? 0 : Math.round((a / b) * 100)

// ─── Subcomponents ────────────────────────────────────────────────────────────

function KPICardSkeleton() {
  return (
    <div className="bg-white border border-slate-200/70 rounded-2xl p-5 flex flex-col gap-4">
      <div className="w-9 h-9 bg-slate-100 rounded-xl animate-pulse" />
      <div className="space-y-2">
        <div className="w-20 h-3 bg-slate-100 rounded-full animate-pulse" />
        <div className="w-32 h-7 bg-slate-100 rounded-lg animate-pulse" />
        <div className="w-24 h-3 bg-slate-100 rounded-full animate-pulse" />
      </div>
    </div>
  )
}

function KPICard({ icon, label, value, sub, progress, variant = 'default' }: KPICardProps) {
  const { iconBg, iconColor } = VARIANT_STYLES[variant]
  return (
    <div
      className="
        bg-white border border-slate-200/70 rounded-2xl p-5
        shadow-[0_1px_2px_rgba(0,0,0,0.04)]
        transition-all duration-200 ease-out
        hover:border-slate-300 hover:shadow-[0_4px_16px_rgba(0,0,0,0.07)]
        hover:-translate-y-px
        flex flex-col gap-4
      "
    >
      <div className="flex items-start justify-between">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg}`}>
          <span className={iconColor}>{icon}</span>
        </div>
        {progress !== undefined && (
          <span className="text-[11px] font-semibold text-slate-500 tabular-nums">
            {progress}%
          </span>
        )}
      </div>
      <div className="space-y-0.5">
        <p className="text-xs font-medium text-slate-400 tracking-wide">{label}</p>
        <p className="text-2xl font-semibold text-slate-900 tracking-tight tabular-nums">{value}</p>
        {sub && <p className="text-xs text-slate-400">{sub}</p>}
      </div>
    </div>
  )
}

function SectionDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3">
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">{label}</p>
      <div className="flex-1 h-px bg-slate-200/70" />
    </div>
  )
}

function ProgressBar({ value, max, color = '#22c55e' }: { value: number; max: number; color?: string }) {
  const percentage = Math.min(100, calcPercent(value, max))
  return (
    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-700"
        style={{ width: `${percentage}%`, background: color }}
      />
    </div>
  )
}

function MiniBarChart({ data }: { data: BarItem[] }) {
  const max = Math.max(...data.map((d) => d.value), 1)
  return (
    <div className="flex items-end gap-1.5 h-20">
      {data.map((d) => (
        <div key={d.label} className="flex-1 flex flex-col items-center gap-1">
          <div
            className="w-full rounded-md transition-all duration-500"
            style={{
              height: `${Math.max(4, (d.value / max) * 64)}px`,
              background: d.color,
              opacity: 0.8,
            }}
          />
          <span className="text-[10px] text-slate-400 truncate w-full text-center">{d.label}</span>
        </div>
      ))}
    </div>
  )
}

function StackedBarChart({ data }: { data: { label: string; sale: number; no_sale: number; store_closed: number }[] }) {
  const max = Math.max(...data.map((d) => d.sale + d.no_sale + d.store_closed), 1)
  return (
    <div className="flex items-end gap-1.5 h-24">
      {data.map((d) => {
        const total = d.sale + d.no_sale + d.store_closed
        const height = Math.max(8, (total / max) * 80)
        const saleH = total > 0 ? (d.sale / total) * height : 0
        const noSaleH = total > 0 ? (d.no_sale / total) * height : 0
        const closedH = total > 0 ? (d.store_closed / total) * height : 0
        return (
          <div key={d.label} className="flex-1 flex flex-col items-center gap-1">
            <div className="w-full flex flex-col-reverse rounded-md overflow-hidden" style={{ height: `${height}px` }}>
              <div style={{ height: `${saleH}px`, background: '#22c55e', opacity: 0.75 }} />
              <div style={{ height: `${noSaleH}px`, background: '#f59e0b', opacity: 0.75 }} />
              <div style={{ height: `${closedH}px`, background: '#9ca3af', opacity: 0.6 }} />
            </div>
            <span className="text-[10px] text-slate-400 truncate w-full text-center">{d.label}</span>
          </div>
        )
      })}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function EmployeesTab() {
  const supabase = useRef(createClient()).current

  const [loading, setLoading] = useState(false)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [selectedEmployee, setSelectedEmployee] = useState<string>('ALL')
  const [dateRange, setDateRange] = useState<DateRange>(DEFAULT_DATE_RANGE)
  const [orders, setOrders] = useState<Order[]>([])
  const [visits, setVisits] = useState<Visit[]>([])

  useEffect(() => {
    supabase
      .from('employees')
      .select('id, full_name')
      .then(({ data }) => {
        if (data) setEmployees(data)
      })
  }, [supabase])

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        let ordersQuery = supabase
          .from('pedidos')
          .select(`
            id, numero_documento, fecha_pedido, total_venta,
            tipo_pago, estado, observacion, empleado_id,
            clients:clients_id (name, legacy_id),
            employees:empleado_id (full_name)
          `)
          .gte('fecha_pedido', dateRange.start)
          .lte('fecha_pedido', dateRange.end)
          .order('fecha_pedido', { ascending: false })
          .limit(1000)

        let visitsQuery = supabase
          .from('visits')
          .select('id, start_time, outcome, seller_id, notes, clients:client_id (name)')
          .gte('start_time', dateRange.start)
          .lte('start_time', dateRange.end)
          .limit(1000)

        if (selectedEmployee !== 'ALL') {
          ordersQuery = ordersQuery.eq('empleado_id', selectedEmployee)
          visitsQuery = visitsQuery.eq('seller_id', selectedEmployee)
        }

        const [ordersResult, visitsResult] = await Promise.all([ordersQuery, visitsQuery])

        if (!ordersResult.error) {
          setOrders((ordersResult.data as unknown as Order[]) ?? [])
        }
        if (!visitsResult.error) {
          setVisits((visitsResult.data as unknown as Visit[]) ?? [])
        }
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [supabase, selectedEmployee, dateRange])

  // ─── Sales metrics ──────────────────────────────────────────────────────

  const salesMetrics = useMemo(() => {
    const active = orders.filter((o) => o.estado !== 'Anulado')
    const total = active.reduce((sum, o) => sum + o.total_venta, 0)
    const contado = active
      .filter((o) => o.tipo_pago === 'Contado')
      .reduce((sum, o) => sum + o.total_venta, 0)
    const credito = active
      .filter((o) => o.tipo_pago === 'Crédito')
      .reduce((sum, o) => sum + o.total_venta, 0)
    const pendingCount = active.filter((o) => o.estado === 'Pendiente').length
    const average = active.length ? total / active.length : 0

    // Weekly sales with contado/credito split
    const weekMap = new Map<string, { label: string; contado: number; credito: number; pedidos: number }>()
    active.forEach((o) => {
      const date = parseISO(o.fecha_pedido)
      const weekStart = startOfWeek(date, { weekStartsOn: 1 })
      const isoKey = format(weekStart, 'yyyy-MM-dd')
      const displayLabel = format(weekStart, 'dd/MM', { locale: es })
      const existing = weekMap.get(isoKey) ?? { label: displayLabel, contado: 0, credito: 0, pedidos: 0 }
      if (o.tipo_pago === 'Contado') existing.contado += o.total_venta
      else existing.credito += o.total_venta
      existing.pedidos++
      weekMap.set(isoKey, existing)
    })

    const weeklySales = Array.from(weekMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-8)
      .map(([, data]) => data)

    // Daily sales with contado/credito split
    const dayMap = new Map<string, { label: string; contado: number; credito: number; pedidos: number }>()
    active.forEach((o) => {
      const date = parseISO(o.fecha_pedido)
      const isoKey = format(date, 'yyyy-MM-dd')
      const displayLabel = format(date, 'dd/MM', { locale: es })
      const existing = dayMap.get(isoKey) ?? { label: displayLabel, contado: 0, credito: 0, pedidos: 0 }
      if (o.tipo_pago === 'Contado') existing.contado += o.total_venta
      else existing.credito += o.total_venta
      existing.pedidos++
      dayMap.set(isoKey, existing)
    })

    const dailySales = Array.from(dayMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-14)
      .map(([, data]) => data)

    const clientMap = new Map<string, number>()
    active.forEach((o) => {
      const name = o.clients?.name ?? 'Sin nombre'
      clientMap.set(name, (clientMap.get(name) ?? 0) + o.total_venta)
    })

    const topClients = Array.from(clientMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)

    return { total, contado, credito, pendingCount, average, weeklySales, dailySales, topClients, activeCount: active.length }
  }, [orders])

  // ─── Visit metrics ──────────────────────────────────────────────────────

  const visitMetrics = useMemo(() => {
    const totalVisits = visits.length
    const salesVisits = visits.filter((v) => v.outcome === 'sale').length
    const noSaleVisits = visits.filter((v) => v.outcome === 'no_sale').length
    const closedVisits = visits.filter((v) => v.outcome === 'store_closed').length
    const effectiveness = calcPercent(salesVisits, totalVisits)

    const uniqueClients = new Set(visits.map((v) => v.clients?.name).filter(Boolean))
    const uniqueClientCount = uniqueClients.size
    const visitsPerClient = uniqueClientCount > 0
      ? Math.round((totalVisits / uniqueClientCount) * 10) / 10
      : 0

    const clientVisitMap = new Map<string, { sale: number; no_sale: number; store_closed: number; total: number }>()
    visits.forEach((v) => {
      const name = v.clients?.name ?? 'Sin cliente'
      const existing = clientVisitMap.get(name) ?? { sale: 0, no_sale: 0, store_closed: 0, total: 0 }
      if (v.outcome === 'sale') existing.sale++
      else if (v.outcome === 'no_sale') existing.no_sale++
      else if (v.outcome === 'store_closed') existing.store_closed++
      existing.total++
      clientVisitMap.set(name, existing)
    })

    const topVisitedClients = Array.from(clientVisitMap.entries())
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 8)

    const dayMap = new Map<string, { label: string; sale: number; no_sale: number; store_closed: number }>()
    visits.forEach((v) => {
      const date = parseISO(v.start_time)
      const isoKey = format(date, 'yyyy-MM-dd')
      const displayLabel = format(date, 'dd/MM', { locale: es })
      const existing = dayMap.get(isoKey) ?? { label: displayLabel, sale: 0, no_sale: 0, store_closed: 0 }
      if (v.outcome === 'sale') existing.sale++
      else if (v.outcome === 'no_sale') existing.no_sale++
      else if (v.outcome === 'store_closed') existing.store_closed++
      dayMap.set(isoKey, existing)
    })

    const dailyDistribution = Array.from(dayMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-14)
      .map(([, data]) => data)

    const sellerMap = new Map<string, { id: string; name: string; visits: number; sales: number; amount: number }>()
    visits.forEach((v) => {
      const existing = sellerMap.get(v.seller_id) ?? { id: v.seller_id, name: '', visits: 0, sales: 0, amount: 0 }
      existing.visits++
      if (v.outcome === 'sale') existing.sales++
      sellerMap.set(v.seller_id, existing)
    })

    const activeOrders = orders.filter((o) => o.estado !== 'Anulado')
    sellerMap.forEach((seller, sellerId) => {
      const emp = employees.find((e) => e.id === sellerId)
      seller.name = emp?.full_name ?? 'Desconocido'
      seller.amount = activeOrders
        .filter((o) => o.empleado_id === sellerId)
        .reduce((sum, o) => sum + o.total_venta, 0)
    })

    const sellerRanking = Array.from(sellerMap.values()).sort((a, b) => b.sales - a.sales)

    return {
      totalVisits, salesVisits, noSaleVisits, closedVisits,
      effectiveness, uniqueClientCount, visitsPerClient,
      topVisitedClients, dailyDistribution, sellerRanking,
    }
  }, [visits, orders, employees])

  const selectedEmployeeName =
    selectedEmployee === 'ALL'
      ? 'Todos los Vendedores'
      : (employees.find((e) => e.id === selectedEmployee)?.full_name ?? '\u2014')

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 pb-10">

      {/* ── Header ── */}
      <div className="bg-white border border-slate-200/70 rounded-2xl p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900 tracking-tight">
              Rendimiento de Ventas
            </h2>
            <p className="text-slate-400 text-sm mt-0.5">
              {selectedEmployee === 'ALL'
                ? 'Vista consolidada de todo el equipo'
                : `Detalle de ${selectedEmployeeName}`}
            </p>
          </div>

          <div className="flex flex-wrap gap-3 items-center">
            <select
              value={selectedEmployee}
              onChange={(e) => setSelectedEmployee(e.target.value)}
              className="
                px-4 py-2.5 rounded-xl border border-slate-200 text-sm
                font-medium text-slate-700 bg-white
                focus:outline-none focus:border-slate-400
                transition-colors
              "
            >
              <option value="ALL">Todos los vendedores</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>{e.full_name}</option>
              ))}
            </select>

            <div className="flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-2 border border-slate-200">
              <CalendarDays size={14} className="text-slate-400" />
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange((prev) => ({ ...prev, start: e.target.value }))}
                className="text-sm bg-transparent font-medium text-slate-700 focus:outline-none"
              />
              <span className="text-slate-300">{'\u2192'}</span>
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange((prev) => ({ ...prev, end: e.target.value }))}
                className="text-sm bg-transparent font-medium text-slate-700 focus:outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Skeleton ── */}
      {loading && (
        <div className="space-y-6">
          <SectionDivider label="Ventas" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => <KPICardSkeleton key={i} />)}
          </div>
          <SectionDivider label="Visitas" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => <KPICardSkeleton key={`v-${i}`} />)}
          </div>
        </div>
      )}

      {!loading && (
        <>
          {/* ── Sales Section ── */}
          <SectionDivider label="Ventas" />

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KPICard
              icon={<DollarSign size={16} strokeWidth={1.8} />}
              label="Total vendido"
              value={formatCurrency(salesMetrics.total)}
              sub={`${salesMetrics.activeCount} pedidos activos`}
              variant="success"
            />
            <KPICard
              icon={<Wallet size={16} strokeWidth={1.8} />}
              label="Contado"
              value={formatCurrency(salesMetrics.contado)}
              sub="del total en efectivo"
              variant="info"
              progress={calcPercent(salesMetrics.contado, salesMetrics.total)}
            />
            <KPICard
              icon={<CreditCard size={16} strokeWidth={1.8} />}
              label="Credito"
              value={formatCurrency(salesMetrics.credito)}
              sub="del total financiado"
              variant="warning"
              progress={calcPercent(salesMetrics.credito, salesMetrics.total)}
            />
            <KPICard
              icon={<BarChart2 size={16} strokeWidth={1.8} />}
              label="Promedio / pedido"
              value={formatCurrency(salesMetrics.average)}
              sub={
                salesMetrics.pendingCount > 0
                  ? `${salesMetrics.pendingCount} pedidos pendientes`
                  : 'Sin pendientes'
              }
              variant="purple"
            />
          </div>

          {/* ── Visits Section ── */}
          <SectionDivider label="Visitas" />

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KPICard
              icon={<MapPin size={16} strokeWidth={1.8} />}
              label="Total visitas"
              value={String(visitMetrics.totalVisits)}
              sub={`${visitMetrics.uniqueClientCount} clientes unicos`}
              variant="default"
            />
            <KPICard
              icon={<TrendingUp size={16} strokeWidth={1.8} />}
              label="Con venta"
              value={String(visitMetrics.salesVisits)}
              sub={`${visitMetrics.effectiveness}% efectividad`}
              variant="success"
              progress={visitMetrics.effectiveness}
            />
            <KPICard
              icon={<TrendingDown size={16} strokeWidth={1.8} />}
              label="Sin venta"
              value={String(visitMetrics.noSaleVisits)}
              sub={`${calcPercent(visitMetrics.noSaleVisits, visitMetrics.totalVisits)}% del total`}
              variant="warning"
              progress={calcPercent(visitMetrics.noSaleVisits, visitMetrics.totalVisits)}
            />
            <KPICard
              icon={<Store size={16} strokeWidth={1.8} />}
              label="Tiendas cerradas"
              value={String(visitMetrics.closedVisits)}
              sub={`${calcPercent(visitMetrics.closedVisits, visitMetrics.totalVisits)}% del total`}
              variant="danger"
              progress={calcPercent(visitMetrics.closedVisits, visitMetrics.totalVisits)}
            />
          </div>

          {/* ── Charts Section ── */}
          <SectionDivider label="Analisis" />

          {/* Weekly Sales — full width ComposedChart */}
          <div className="bg-white border border-slate-200/70 rounded-2xl p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
            <div className="flex items-center justify-between mb-1">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Ventas por semana</h3>
                <p className="text-xs text-slate-400">Contado vs Credito + volumen de pedidos</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-emerald-500" /><span className="text-[10px] text-slate-400">Contado</span></div>
                <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-amber-400" /><span className="text-[10px] text-slate-400">Credito</span></div>
                <div className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-slate-400" /><span className="text-[10px] text-slate-400">Pedidos</span></div>
              </div>
            </div>
            {salesMetrics.weeklySales.length === 0 ? (
              <p className="text-slate-300 text-sm text-center py-16">Sin datos en el periodo</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <ComposedChart data={salesMetrics.weeklySales} margin={{ top: 12, right: 12, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="amount" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
                  <YAxis yAxisId="count" orientation="right" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', fontSize: '12px' }}
                    formatter={(value: number | undefined, name: string | undefined) => {
                      const v = value ?? 0
                      if (name === 'Pedidos') return [v, name]
                      return [formatCurrency(v), name ?? '']
                    }}
                    labelStyle={{ fontWeight: 600, color: '#334155', marginBottom: 4 }}
                  />
                  <Bar yAxisId="amount" dataKey="contado" name="Contado" stackId="sales" fill="#10b981" radius={[0, 0, 4, 4]} barSize={32} opacity={0.85} />
                  <Bar yAxisId="amount" dataKey="credito" name="Credito" stackId="sales" fill="#fbbf24" radius={[4, 4, 0, 0]} barSize={32} opacity={0.8} />
                  <Line yAxisId="count" type="monotone" dataKey="pedidos" name="Pedidos" stroke="#64748b" strokeWidth={2} dot={{ fill: '#64748b', r: 3 }} activeDot={{ r: 5, strokeWidth: 0 }} />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Daily Sales — full width BarChart */}
          <div className="bg-white border border-slate-200/70 rounded-2xl p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
            <div className="flex items-center justify-between mb-1">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Ventas por dia</h3>
                <p className="text-xs text-slate-400">Ultimos 14 dias con actividad</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-emerald-500" /><span className="text-[10px] text-slate-400">Contado</span></div>
                <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-amber-400" /><span className="text-[10px] text-slate-400">Credito</span></div>
              </div>
            </div>
            {salesMetrics.dailySales.length === 0 ? (
              <p className="text-slate-300 text-sm text-center py-16">Sin ventas en el periodo</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <ComposedChart data={salesMetrics.dailySales} margin={{ top: 12, right: 12, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="amount" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
                  <YAxis yAxisId="count" orientation="right" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', fontSize: '12px' }}
                   formatter={(value: number | undefined, name: string | undefined) => {
  const v = value ?? 0
  if (name === 'Pedidos') return [v, name]
  return [formatCurrency(v), name ?? '']
}}
                    labelStyle={{ fontWeight: 600, color: '#334155', marginBottom: 4 }}
                  />
                  <Bar yAxisId="amount" dataKey="contado" name="Contado" stackId="daily" fill="#10b981" radius={[0, 0, 3, 3]} barSize={24} opacity={0.85} />
                  <Bar yAxisId="amount" dataKey="credito" name="Credito" stackId="daily" fill="#fbbf24" radius={[3, 3, 0, 0]} barSize={24} opacity={0.8} />
                  <Line yAxisId="count" type="monotone" dataKey="pedidos" name="Pedidos" stroke="#64748b" strokeWidth={1.5} strokeDasharray="4 3" dot={{ fill: '#64748b', r: 2.5 }} />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            {/* Effectiveness */}
            <div className="bg-white border border-slate-200/70 rounded-2xl p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
              <h3 className="text-sm font-semibold text-slate-900 mb-0.5">Efectividad de visitas</h3>
              <p className="text-xs text-slate-400 mb-5">{visitMetrics.totalVisits} visitas en total</p>
              <div className="flex items-end gap-6">
                <div>
                  <p className="text-4xl font-semibold text-slate-900 tracking-tight tabular-nums">
                    {visitMetrics.effectiveness}%
                  </p>
                  <p className="text-xs text-slate-400 mt-1">de efectividad</p>
                </div>
                <div className="flex-1 pb-2">
                  <ProgressBar
                    value={visitMetrics.effectiveness}
                    max={100}
                    color={
                      visitMetrics.effectiveness >= 60
                        ? '#10b981'
                        : visitMetrics.effectiveness >= 30
                          ? '#f59e0b'
                          : '#ef4444'
                    }
                  />
                  <div className="flex justify-between mt-1.5">
                    <span className="text-[10px] text-rose-400 font-medium">Bajo</span>
                    <span className="text-[10px] text-amber-400 font-medium">Regular</span>
                    <span className="text-[10px] text-emerald-500 font-medium">Bueno</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Top Clients by Sales */}
            <div className="bg-white border border-slate-200/70 rounded-2xl p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
              <h3 className="text-sm font-semibold text-slate-900 mb-0.5">Top clientes</h3>
              <p className="text-xs text-slate-400 mb-5">Por monto comprado</p>
              <div className="space-y-3">
                {salesMetrics.topClients.length === 0 ? (
                  <p className="text-slate-300 text-sm text-center py-6">Sin datos</p>
                ) : (
                  salesMetrics.topClients.map(([name, amount], i) => (
                    <div key={name} className="flex items-center gap-3">
                      <span className="text-sm font-semibold text-slate-300 w-5 text-right tabular-nums">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-sm font-medium text-slate-700 truncate">{name}</span>
                          <span className="text-sm font-semibold text-emerald-600 ml-2 flex-shrink-0 tabular-nums">
                            {formatCurrency(amount)}
                          </span>
                        </div>
                        <ProgressBar
                          value={amount}
                          max={salesMetrics.topClients[0][1]}
                          color="#10b981"
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Daily Visits — full width stacked BarChart */}
          <div className="bg-white border border-slate-200/70 rounded-2xl p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
            <div className="flex items-center justify-between mb-1">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Visitas por dia</h3>
                <p className="text-xs text-slate-400">Ultimos 14 dias con actividad</p>
              </div>
              <div className="flex items-center gap-3">
                {Object.entries(OUTCOME_LABELS).map(([key, label]) => (
                  <div key={key} className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-sm" style={{ background: OUTCOME_COLORS[key] }} />
                    <span className="text-[10px] text-slate-400">{label}</span>
                  </div>
                ))}
              </div>
            </div>
            {visitMetrics.dailyDistribution.length === 0 ? (
              <p className="text-slate-300 text-sm text-center py-16">Sin visitas en el periodo</p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={visitMetrics.dailyDistribution} margin={{ top: 12, right: 12, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', fontSize: '12px' }}
                    labelStyle={{ fontWeight: 600, color: '#334155', marginBottom: 4 }}
                  />
                  <Bar dataKey="sale" name="Con venta" stackId="visits" fill="#10b981" radius={[0, 0, 3, 3]} barSize={20} opacity={0.85} />
                  <Bar dataKey="no_sale" name="Sin venta" stackId="visits" fill="#fbbf24" barSize={20} opacity={0.8} />
                  <Bar dataKey="store_closed" name="Cerrado" stackId="visits" fill="#94a3b8" radius={[3, 3, 0, 0]} barSize={20} opacity={0.6} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* ── Coverage + Payment ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            {/* Payment Type */}
            <div className="bg-white border border-slate-200/70 rounded-2xl p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
              <h3 className="text-sm font-semibold text-slate-900 mb-0.5">Tipo de pago</h3>
              <p className="text-xs text-slate-400 mb-5">Distribucion del periodo</p>
              <div className="space-y-4">
                {[
                  { label: 'Contado', value: salesMetrics.contado, color: '#3b82f6' },
                  { label: 'Credito', value: salesMetrics.credito, color: '#f59e0b' },
                ].map((item) => (
                  <div key={item.label}>
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-sm font-medium text-slate-600">{item.label}</span>
                      <span className="text-sm font-semibold tabular-nums" style={{ color: item.color }}>
                        {formatCurrency(item.value)}
                      </span>
                    </div>
                    <ProgressBar value={item.value} max={salesMetrics.total} color={item.color} />
                  </div>
                ))}
              </div>
            </div>

            {/* Client Coverage */}
            <div className="bg-white border border-slate-200/70 rounded-2xl p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
              <h3 className="text-sm font-semibold text-slate-900 mb-0.5">Cobertura de clientes</h3>
              <p className="text-xs text-slate-400 mb-5">Clientes visitados en el periodo</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/50">
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Clientes unicos</p>
                  <p className="text-3xl font-semibold text-slate-900 mt-1 tabular-nums">{visitMetrics.uniqueClientCount}</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/50">
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Visitas / cliente</p>
                  <p className="text-3xl font-semibold text-slate-900 mt-1 tabular-nums">{visitMetrics.visitsPerClient}</p>
                </div>
              </div>
            </div>
          </div>

          {/* ── Top Visited Clients ── */}
          <div className="bg-white border border-slate-200/70 rounded-2xl p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
            <h3 className="text-sm font-semibold text-slate-900 mb-0.5">Clientes mas visitados</h3>
            <p className="text-xs text-slate-400 mb-5">Desglose por resultado de visita</p>
            {visitMetrics.topVisitedClients.length === 0 ? (
              <p className="text-slate-300 text-sm text-center py-8">Sin visitas registradas</p>
            ) : (
              <div className="space-y-1">
                {visitMetrics.topVisitedClients.map(([name, data]) => (
                  <div key={name} className="flex items-center gap-3 py-2.5 border-b border-slate-100/80 last:border-0">
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="text-sm font-medium text-slate-700 truncate">{name}</span>
                        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                          <span className="text-[11px] font-semibold text-emerald-600 tabular-nums">{data.sale} ventas</span>
                          <span className="text-slate-200">|</span>
                          <span className="text-[11px] font-medium text-amber-500 tabular-nums">{data.no_sale} sin venta</span>
                          {data.store_closed > 0 && (
                            <>
                              <span className="text-slate-200">|</span>
                              <span className="text-[11px] text-slate-400 tabular-nums">{data.store_closed} cerrado</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden flex">
                        <div className="h-full" style={{ width: `${calcPercent(data.sale, data.total)}%`, background: '#10b981', opacity: 0.8 }} />
                        <div className="h-full" style={{ width: `${calcPercent(data.no_sale, data.total)}%`, background: '#f59e0b', opacity: 0.7 }} />
                        <div className="h-full" style={{ width: `${calcPercent(data.store_closed, data.total)}%`, background: '#9ca3af', opacity: 0.5 }} />
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-slate-400 w-6 text-right flex-shrink-0 tabular-nums">{data.total}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Seller Ranking (ALL view) ── */}
          {selectedEmployee === 'ALL' && visitMetrics.sellerRanking.length > 0 && (
            <>
              <SectionDivider label="Ranking" />
              <div className="bg-white border border-slate-200/70 rounded-2xl overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
                <div className="px-6 py-4 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <Users size={14} className="text-slate-400" />
                    <h3 className="text-sm font-semibold text-slate-900">Ranking de vendedores</h3>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5 ml-[22px]">Comparativa de rendimiento en el periodo</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50/80 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                        <th className="text-left px-6 py-3">#</th>
                        <th className="text-left px-6 py-3">Vendedor</th>
                        <th className="text-center px-4 py-3">Visitas</th>
                        <th className="text-center px-4 py-3">Con venta</th>
                        <th className="text-center px-4 py-3">Efectividad</th>
                        <th className="text-right px-6 py-3">Monto total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100/80">
                      {visitMetrics.sellerRanking.map((seller, i) => {
                        const eff = calcPercent(seller.sales, seller.visits)
                        const effColor = eff >= 60 ? '#10b981' : eff >= 30 ? '#f59e0b' : '#ef4444'
                        return (
                          <tr
                            key={seller.id}
                            className="transition-colors hover:bg-slate-50/50"
                          >
                            <td className="px-6 py-3.5 text-slate-300 font-semibold tabular-nums">{i + 1}</td>
                            <td className="px-6 py-3.5 font-medium text-slate-800">{seller.name}</td>
                            <td className="px-4 py-3.5 text-center text-slate-500 tabular-nums">{seller.visits}</td>
                            <td className="px-4 py-3.5 text-center">
                              <span className="font-semibold text-emerald-600 tabular-nums">{seller.sales}</span>
                            </td>
                            <td className="px-4 py-3.5 text-center">
                              <div className="flex items-center justify-center gap-2">
                                <div className="w-14 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                  <div
                                    className="h-full rounded-full transition-all duration-500"
                                    style={{ width: `${eff}%`, background: effColor }}
                                  />
                                </div>
                                <span className="text-[11px] font-semibold tabular-nums" style={{ color: effColor }}>
                                  {eff}%
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-3.5 text-right font-semibold text-slate-900 tabular-nums">
                              {formatCurrency(seller.amount)}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
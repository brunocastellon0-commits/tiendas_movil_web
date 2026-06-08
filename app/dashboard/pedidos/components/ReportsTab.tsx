'use client'

import { useState, useMemo, useEffect, Fragment } from 'react'
import { createClient } from '@/utils/supabase/client'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts'
import {
  User, Download, ChevronDown, AlertCircle, CheckCircle2, Clock, ChevronRight,
  TrendingUp, Wallet, AlertTriangle, BarChart2
} from 'lucide-react'
import { format, differenceInDays, addDays } from 'date-fns'
import { es } from 'date-fns/locale'
import type { ReactNode } from 'react'

// ─── Colores ──────────────────────────────────────────────────────────────────

const COLORS = {
  collected: '#10B981',
  pending: '#F59E0B',
  overdue: '#EF4444',
  grid: '#f1f5f9',
}

// ─── Tipos ────────────────────────────────────────────────────────────────────

type Employee = {
  id: string
  full_name: string
}

type OrderData = {
  id: string
  numero_documento: number
  fecha_pedido: string
  tipo_pago: string
  total_venta: number
  estado: string
  client_name: string
  client_legacy_id: string | null
  client_credit_days: number
  client_balance: number
  descuento_porcentaje: number
  descuento_monto: number
  due_date: string
  days_overdue: number
  collected: number
  collection_status: 'Cobrado' | 'Parcial' | 'Pendiente' | 'Vencido'
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatMoney = (val: number) =>
  new Intl.NumberFormat('es-BO', { style: 'currency', currency: 'BOB', maximumFractionDigits: 0 }).format(val)

const calcPercent = (a: number, b: number): number =>
  b === 0 ? 0 : Math.round((a / b) * 100)

// ─── Subcomponentes ───────────────────────────────────────────────────────────

type KPICardProps = {
  icon: ReactNode
  label: string
  value: string
  sub?: string
  progress?: number
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple'
}

const VARIANT_STYLES = {
  default: { iconBg: 'bg-slate-100', iconColor: 'text-slate-500' },
  success: { iconBg: 'bg-emerald-50', iconColor: 'text-emerald-600' },
  warning: { iconBg: 'bg-amber-50', iconColor: 'text-amber-500' },
  danger: { iconBg: 'bg-rose-50', iconColor: 'text-rose-500' },
  info: { iconBg: 'bg-blue-50', iconColor: 'text-blue-500' },
  purple: { iconBg: 'bg-violet-50', iconColor: 'text-violet-500' },
} as const

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
    <div className="
      bg-white border border-slate-200/70 rounded-2xl p-5
      shadow-[0_1px_2px_rgba(0,0,0,0.04)]
      transition-all duration-200 ease-out
      hover:border-slate-300 hover:shadow-[0_4px_16px_rgba(0,0,0,0.07)]
      hover:-translate-y-px
      flex flex-col gap-4
    ">
      <div className="flex items-start justify-between">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg}`}>
          <span className={iconColor}>{icon}</span>
        </div>
        {progress !== undefined && (
          <span className="text-[11px] font-semibold text-slate-500 tabular-nums">{progress}%</span>
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

function ProgressBar({ value, max, color = '#10b981' }: { value: number; max: number; color?: string }) {
  const percentage = Math.min(100, calcPercent(value, max))
  return (
    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-700"
        style={{ width: `${percentage}%`, background: color }}
      />
    </div>
  )
}

// ─── Componente Principal ─────────────────────────────────────────────────────

export default function ReportsTab() {
  const supabase = createClient()

  // --- Estados (sin cambios) ---
  const [employees, setEmployees] = useState<Employee[]>([])
  const [selectedEmployee, setSelectedEmployee] = useState<string>('ALL')
  const [orders, setOrders] = useState<OrderData[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null)
  const [orderDetails, setOrderDetails] = useState<Record<string, any[]>>({})
  const [loadingDetails, setLoadingDetails] = useState<Record<string, boolean>>({})

  // --- Carga de Empleados (sin cambios) ---
  useEffect(() => {
    const fetchEmployees = async () => {
      const { data, error } = await supabase
        .from('employees')
        .select('id, full_name')
        .order('full_name')
      if (error) { console.error('Error cargando empleados:', error); return }
      if (data) setEmployees(data)
    }
    fetchEmployees()
  }, [])

  // --- Carga de Pedidos (sin cambios) ---
  useEffect(() => {
    const fetchOrders = async () => {
      setLoading(true)
      try {
        // Fetch clientes map una vez
        let rClienteMap: Record<string, any> = {}
        const { data: rClients } = await supabase.from('clients')
          .select('id, name, legacy_id, credit_days, current_balance')
        if (rClients) rClients.forEach((c: any) => { rClienteMap[c.id] = c })

        let query = supabase
          .from('pedidos')
          .select('id, numero_documento, fecha_pedido, tipo_pago, total_venta, estado, empleado_id, descuento_porcentaje, descuento_monto, clients_id')
          .eq('tipo_pago', 'Crédito')
          .order('fecha_pedido', { ascending: false })

        if (selectedEmployee !== 'ALL') {
          query = query.eq('empleado_id', selectedEmployee)
        }

        const { data, error } = await query
        if (error) throw error

        const processedOrders: OrderData[] = (data || []).map((order: any) => {
          const client = order.clients_id ? (rClienteMap[order.clients_id] || null) : null
          const creditDays = client?.credit_days || 30
          const dueDate = addDays(new Date(order.fecha_pedido), creditDays)
          const today = new Date()
          const daysOverdue = differenceInDays(today, dueDate)
          const totalVenta = order.total_venta
          const clientBalance = client?.current_balance || 0
          let collected = 0
          let collectionStatus: 'Cobrado' | 'Parcial' | 'Pendiente' | 'Vencido' = 'Pendiente'

          if (order.estado === 'Entregado') {
            collected = Math.max(0, totalVenta - clientBalance)
            if (collected >= totalVenta) collectionStatus = 'Cobrado'
            else if (collected > 0) collectionStatus = 'Parcial'
            else if (daysOverdue > 0) collectionStatus = 'Vencido'
            else collectionStatus = 'Pendiente'
          } else if (daysOverdue > 0) {
            collectionStatus = 'Vencido'
          }

          return {
            id: order.id,
            numero_documento: order.numero_documento,
            fecha_pedido: order.fecha_pedido,
            tipo_pago: order.tipo_pago,
            total_venta: totalVenta,
            estado: order.estado,
            client_name: client?.name || 'Sin cliente',
            client_legacy_id: client?.legacy_id || null,
            client_credit_days: creditDays,
            client_balance: clientBalance,
            descuento_porcentaje: order.descuento_porcentaje || 0,
            descuento_monto: order.descuento_monto || 0,
            due_date: format(dueDate, 'yyyy-MM-dd'),
            days_overdue: Math.max(0, daysOverdue),
            collected,
            collection_status: collectionStatus,
          }
        })

        setOrders(processedOrders)
      } catch (error) {
        console.error('Error cargando pedidos:', error)
        setOrders([])
      } finally {
        setLoading(false)
      }
    }
    fetchOrders()
  }, [selectedEmployee])

  // --- Cálculos para Gráficos (sin cambios) ---
  const chartData = useMemo(() => {
    const totalSold = orders.reduce((acc, curr) => acc + curr.total_venta, 0)
    const totalCollected = orders.reduce((acc, curr) => acc + curr.collected, 0)
    const totalPending = totalSold - totalCollected
    const barData = [{ name: 'Gestión Actual', cobrado: totalCollected, pendiente: totalPending }]

    const cobrado = orders.filter(o => o.collection_status === 'Cobrado').reduce((acc, c) => acc + c.collected, 0)
    const vigente = orders.filter(o => (o.collection_status === 'Pendiente' || o.collection_status === 'Parcial') && o.days_overdue === 0).reduce((acc, c) => acc + (c.total_venta - c.collected), 0)
    const vencido = orders.filter(o => o.collection_status === 'Vencido' || o.days_overdue > 0).reduce((acc, c) => acc + (c.total_venta - c.collected), 0)

    const pieData = [
      { name: 'Cobrado', value: cobrado },
      { name: 'Por Cobrar (Vigente)', value: vigente },
      { name: 'Vencido (Riesgo)', value: vencido },
    ]
    return { barData, pieData }
  }, [orders])

  // --- Función para cargar detalles del pedido (sin cambios) ---
  const toggleOrderDetails = async (orderId: string) => {
    if (expandedOrderId === orderId) { setExpandedOrderId(null); return }
    setExpandedOrderId(orderId)
    if (!orderDetails[orderId]) {
      setLoadingDetails({ ...loadingDetails, [orderId]: true })
      try {
        const { data, error } = await supabase
          .from('detalle_pedido')
          .select(`
            id, cantidad, precio_unitario, subtotal, unidad_seleccionada, producto_id,
            productos:producto_id ( nombre_producto, codigo_producto )
          `)
          .eq('pedido_id', orderId)
        if (error) throw error
        setOrderDetails({ ...orderDetails, [orderId]: data || [] })
      } catch (error) {
        console.error('Error cargando detalles:', error)
        setOrderDetails({ ...orderDetails, [orderId]: [] })
      } finally {
        setLoadingDetails({ ...loadingDetails, [orderId]: false })
      }
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 pb-10">

      {/* ── Header ── */}
      <div className="bg-white border border-slate-200/70 rounded-2xl p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900 tracking-tight">
              Hoja de Cobranza
            </h2>
            <p className="text-slate-400 text-sm mt-0.5">
              {selectedEmployee === 'ALL'
                ? 'Gestión de recuperación de cartera — todos los preventistas'
                : `Detalle de cartera — ${employees.find(e => e.id === selectedEmployee)?.full_name ?? '—'}`}
            </p>
          </div>

          <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
              <User size={14} />
            </div>
            <select
              value={selectedEmployee}
              onChange={(e) => setSelectedEmployee(e.target.value)}
              className="
                pl-9 pr-9 py-2.5 rounded-xl border border-slate-200 text-sm
                font-medium text-slate-700 bg-white appearance-none
                focus:outline-none focus:border-slate-400
                transition-colors
              "
            >
              <option value="ALL">Todos los preventistas</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.full_name}</option>
              ))}
            </select>
            <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* ── Skeleton ── */}
      {loading && (
        <div className="space-y-6">
          <SectionDivider label="Cartera" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => <KPICardSkeleton key={i} />)}
          </div>
          <SectionDivider label="Análisis" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white border border-slate-200/70 rounded-2xl h-80 animate-pulse" />
            <div className="bg-white border border-slate-200/70 rounded-2xl h-80 animate-pulse" />
          </div>
        </div>
      )}

      {!loading && (
        <>
          {/* ── KPIs de Cartera ── */}
          <SectionDivider label="Cartera" />

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KPICard
              icon={<Wallet size={16} strokeWidth={1.8} />}
              label="Total cartera"
              value={formatMoney(chartData.barData[0].cobrado + chartData.barData[0].pendiente)}
              sub={`${orders.length} pedidos a crédito`}
              variant="info"
            />
            <KPICard
              icon={<CheckCircle2 size={16} strokeWidth={1.8} />}
              label="Total cobrado"
              value={formatMoney(chartData.barData[0].cobrado)}
              sub={`${calcPercent(chartData.barData[0].cobrado, chartData.barData[0].cobrado + chartData.barData[0].pendiente)}% recuperado`}
              variant="success"
              progress={calcPercent(chartData.barData[0].cobrado, chartData.barData[0].cobrado + chartData.barData[0].pendiente)}
            />
            <KPICard
              icon={<Clock size={16} strokeWidth={1.8} />}
              label="Saldo pendiente"
              value={formatMoney(chartData.barData[0].pendiente)}
              sub={`${orders.filter(o => o.collection_status === 'Pendiente' || o.collection_status === 'Parcial').length} pedidos vigentes`}
              variant="warning"
              progress={calcPercent(chartData.barData[0].pendiente, chartData.barData[0].cobrado + chartData.barData[0].pendiente)}
            />
            <KPICard
              icon={<AlertTriangle size={16} strokeWidth={1.8} />}
              label="Cartera vencida"
              value={formatMoney(chartData.pieData[2].value)}
              sub={`${orders.filter(o => o.collection_status === 'Vencido' || o.days_overdue > 0).length} pedidos vencidos`}
              variant="danger"
              progress={calcPercent(chartData.pieData[2].value, chartData.barData[0].cobrado + chartData.barData[0].pendiente)}
            />
          </div>

          {/* ── Gráficos ── */}
          <SectionDivider label="Análisis" />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

            {/* Barras: Cobrado vs Pendiente */}
            <div className="bg-white border border-slate-200/70 rounded-2xl p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
              <div className="mb-5">
                <h3 className="text-sm font-semibold text-slate-900">Efectividad de cobro</h3>
                <p className="text-xs text-slate-400 mt-0.5">Cobrado vs saldo pendiente</p>
              </div>
              <div className="flex items-center gap-3 mb-4">
                <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-emerald-500" /><span className="text-[10px] text-slate-400">Cobrado</span></div>
                <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-rose-400" /><span className="text-[10px] text-slate-400">Pendiente</span></div>
              </div>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={chartData.barData} barSize={64} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={COLORS.grid} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={false} />
                  <YAxis
                    axisLine={false} tickLine={false}
                    tick={{ fill: '#94a3b8', fontSize: 11 }}
                    tickFormatter={(val: number) => val >= 1000 ? `${(val / 1000).toFixed(0)}k` : String(val)}
                  />
                  <Tooltip
                    cursor={{ fill: 'rgba(148,163,184,0.06)' }}
                    formatter={(value: number | undefined) => value !== undefined ? formatMoney(value) : ''}
                    contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', fontSize: '12px' }}
                    labelStyle={{ fontWeight: 600, color: '#334155', marginBottom: 4 }}
                  />
                  <Bar dataKey="cobrado" name="Total Cobrado" stackId="a" fill="#10b981" radius={[0, 0, 4, 4]} opacity={0.85} />
                  <Bar dataKey="pendiente" name="Saldo Pendiente" stackId="a" fill="#f87171" radius={[4, 4, 0, 0]} opacity={0.8} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Torta: Estado de Cartera */}
            <div className="bg-white border border-slate-200/70 rounded-2xl p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
              <div className="mb-5">
                <h3 className="text-sm font-semibold text-slate-900">Composición de cartera</h3>
                <p className="text-xs text-slate-400 mt-0.5">Distribución por estado</p>
              </div>
              <div className="relative">
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie
                      data={chartData.pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={72}
                      outerRadius={100}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      <Cell fill={COLORS.collected} />
                      <Cell fill={COLORS.pending} />
                      <Cell fill={COLORS.overdue} />
                    </Pie>
                    <Tooltip
                      formatter={(value: number | undefined) => value !== undefined ? formatMoney(value) : ''}
                      contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', fontSize: '12px' }}
                    />
                    <Legend
                      verticalAlign="middle"
                      align="right"
                      layout="vertical"
                      iconType="circle"
                      iconSize={8}
                      wrapperStyle={{ fontSize: '11px', color: '#94a3b8' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                {/* Centro del donut */}
                <div className="absolute left-[38%] top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center pointer-events-none">
                  <span className="text-[10px] text-slate-400 font-medium">Total</span>
                  <span className="text-base font-semibold text-slate-900 tabular-nums">
                    {formatMoney(chartData.barData[0].cobrado + chartData.barData[0].pendiente)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ── Tabla de Cobranzas ── */}
          <SectionDivider label="Detalle" />

          <div className="bg-white border border-slate-200/70 rounded-2xl overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.04)]">

            {/* Toolbar */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Detalle de cobranzas</h3>
                <p className="text-xs text-slate-400 mt-0.5">{orders.length} registros en total</p>
              </div>
              <button className="
                flex items-center gap-2 px-3.5 py-2 rounded-xl
                border border-slate-200 text-xs font-medium text-slate-600
                bg-white hover:bg-slate-50 hover:border-slate-300
                transition-all duration-150 shadow-[0_1px_2px_rgba(0,0,0,0.04)]
              ">
                <Download size={13} />
                Exportar
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50/80 text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                    <th className="w-10 px-3 py-3" />
                    <th className="text-left px-6 py-3">Cliente</th>
                    <th className="text-left px-6 py-3">Pedido</th>
                    <th className="text-center px-4 py-3">Vencimiento</th>
                    <th className="text-center px-4 py-3">Atraso</th>
                    <th className="text-right px-4 py-3">Total</th>
                    <th className="text-right px-4 py-3">Cobrado</th>
                    <th className="text-right px-4 py-3">Saldo</th>
                    <th className="text-center px-6 py-3">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100/80">
                  {loading ? (
                    <tr>
                      <td colSpan={9} className="px-6 py-16 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <div className="w-8 h-8 border-2 border-slate-200 border-t-slate-500 rounded-full animate-spin" />
                          <p className="text-sm text-slate-400">Cargando pedidos…</p>
                        </div>
                      </td>
                    </tr>
                  ) : orders.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-6 py-16 text-center text-sm text-slate-400">
                        No se encontraron pedidos a crédito
                      </td>
                    </tr>
                  ) : (
                    orders.map((order) => {
                      const isOverdue = order.collection_status === 'Vencido' || order.days_overdue > 0
                      const isPaid = order.collection_status === 'Cobrado'
                      const isExpanded = expandedOrderId === order.id

                      return (
                        <Fragment key={order.id}>
                          <tr
                            className={`
                              transition-colors cursor-pointer
                              ${isOverdue ? 'bg-rose-50/40 hover:bg-rose-50/70' : 'hover:bg-slate-50/60'}
                            `}
                          >
                            {/* Expand */}
                            <td className="px-3 py-3.5">
                              <button
                                onClick={() => toggleOrderDetails(order.id)}
                                className="p-1 rounded-lg hover:bg-slate-200/60 transition-colors"
                              >
                                <ChevronRight
                                  size={13}
                                  className={`text-slate-400 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
                                />
                              </button>
                            </td>

                            {/* Cliente */}
                            <td className="px-6 py-3.5" onClick={() => toggleOrderDetails(order.id)}>
                              <div className="flex items-center gap-2">
                                {isOverdue && <AlertCircle size={13} className="text-rose-400 flex-shrink-0" />}
                                <span className={`font-medium text-sm ${isOverdue ? 'text-rose-900' : 'text-slate-800'}`}>
                                  {order.client_name}
                                </span>
                              </div>
                            </td>

                            {/* Pedido */}
                            <td className="px-6 py-3.5" onClick={() => toggleOrderDetails(order.id)}>
                              <span className="text-xs font-mono text-slate-500">PED-{order.numero_documento}</span>
                              <p className="text-[11px] text-slate-400 mt-0.5">
                                {format(new Date(order.fecha_pedido), 'dd/MM/yyyy', { locale: es })}
                              </p>
                            </td>

                            {/* Vencimiento */}
                            <td className="px-4 py-3.5 text-center text-xs text-slate-500" onClick={() => toggleOrderDetails(order.id)}>
                              {format(new Date(order.due_date), 'dd/MM/yyyy', { locale: es })}
                            </td>

                            {/* Días atraso */}
                            <td className="px-4 py-3.5 text-center" onClick={() => toggleOrderDetails(order.id)}>
                              {order.days_overdue > 0 ? (
                                <span className="text-[11px] font-bold text-rose-600 bg-rose-100 px-2 py-0.5 rounded-full">
                                  {order.days_overdue}d
                                </span>
                              ) : (
                                <span className="text-[11px] text-slate-300">—</span>
                              )}
                            </td>

                            {/* Montos */}
                            <td className="px-4 py-3.5 text-right text-sm font-medium text-slate-700 tabular-nums" onClick={() => toggleOrderDetails(order.id)}>
                              {formatMoney(order.total_venta)}
                            </td>
                            <td className="px-4 py-3.5 text-right text-sm font-semibold text-emerald-600 tabular-nums" onClick={() => toggleOrderDetails(order.id)}>
                              {formatMoney(order.collected)}
                            </td>
                            <td className="px-4 py-3.5 text-right text-sm font-bold text-rose-500 tabular-nums" onClick={() => toggleOrderDetails(order.id)}>
                              {formatMoney(order.total_venta - order.collected)}
                            </td>

                            {/* Estado */}
                            <td className="px-6 py-3.5 text-center" onClick={() => toggleOrderDetails(order.id)}>
                              <span className={`
                                inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold
                                ${isPaid
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/70'
                                  : isOverdue
                                    ? 'bg-rose-50 text-rose-600 border border-rose-200/70'
                                    : 'bg-amber-50 text-amber-600 border border-amber-200/70'
                                }
                              `}>
                                {isPaid && <CheckCircle2 size={10} />}
                                {isOverdue && !isPaid && <AlertCircle size={10} />}
                                {!isPaid && !isOverdue && <Clock size={10} />}
                                {order.collection_status}
                              </span>
                            </td>
                          </tr>

                          {/* Fila expandible */}
                          {isExpanded && (
                            <tr className="bg-slate-50/60">
                              <td colSpan={9} className="px-10 py-5">
                                <div className="space-y-4">

                                  {/* Info del pedido */}
                                  <div className="bg-white rounded-xl border border-slate-200/70 p-5">
                                    <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">
                                      Información del pedido
                                    </h4>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-4">
                                      {[
                                        { label: 'ID Cliente', value: order.client_legacy_id || 'N/A' },
                                        { label: 'Cliente', value: order.client_name },
                                        { label: 'Fecha pedido', value: format(new Date(order.fecha_pedido), 'dd/MM/yyyy', { locale: es }) },
                                        { label: 'Tipo de pago', value: order.tipo_pago },
                                        { label: 'Días de plazo', value: `${order.client_credit_days} días` },
                                        { label: 'Total venta', value: formatMoney(order.total_venta) },
                                        { label: 'Descuento', value: `${order.descuento_porcentaje}% — ${formatMoney(order.descuento_monto)}` },
                                        { label: 'Vencimiento', value: format(new Date(order.due_date), 'dd/MM/yyyy', { locale: es }) },
                                        { label: 'Estado pedido', value: order.estado },
                                        { label: 'Estado cobranza', value: order.collection_status },
                                        { label: 'Días de atraso', value: order.days_overdue > 0 ? `${order.days_overdue} días` : 'Al día' },
                                      ].map(({ label, value }) => (
                                        <div key={label}>
                                          <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wide mb-0.5">{label}</p>
                                          <p className="text-sm font-semibold text-slate-800">{value}</p>
                                        </div>
                                      ))}
                                    </div>

                                    {/* Resumen montos */}
                                    <div className="mt-5 pt-4 border-t border-slate-100 grid grid-cols-3 gap-4">
                                      {[
                                        { label: 'Total Venta', value: formatMoney(order.total_venta), color: 'text-slate-900' },
                                        { label: 'Total Cobrado', value: formatMoney(order.collected), color: 'text-emerald-600' },
                                        { label: 'Saldo Pendiente', value: formatMoney(order.total_venta - order.collected), color: 'text-rose-500' },
                                      ].map(({ label, value, color }) => (
                                        <div key={label} className="text-center">
                                          <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wide mb-1">{label}</p>
                                          <p className={`text-lg font-semibold tabular-nums ${color}`}>{value}</p>
                                          <ProgressBar
                                            value={label === 'Total Cobrado' ? order.collected : label === 'Saldo Pendiente' ? order.total_venta - order.collected : order.total_venta}
                                            max={order.total_venta}
                                            color={label === 'Total Cobrado' ? '#10b981' : label === 'Saldo Pendiente' ? '#f87171' : '#64748b'}
                                          />
                                        </div>
                                      ))}
                                    </div>
                                  </div>

                                  {/* Productos */}
                                  <div className="bg-white rounded-xl border border-slate-200/70 overflow-hidden">
                                    <div className="px-5 py-3.5 border-b border-slate-100">
                                      <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
                                        Productos del pedido
                                      </h4>
                                    </div>

                                    {loadingDetails[order.id] ? (
                                      <div className="flex justify-center py-8">
                                        <div className="w-6 h-6 border-2 border-slate-200 border-t-slate-500 rounded-full animate-spin" />
                                      </div>
                                    ) : orderDetails[order.id] && orderDetails[order.id].length > 0 ? (
                                      <table className="w-full text-sm">
                                        <thead>
                                          <tr className="bg-slate-50/80 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                                            <th className="text-left px-5 py-2.5">Código</th>
                                            <th className="text-left px-5 py-2.5">Producto</th>
                                            <th className="text-center px-4 py-2.5">Cantidad</th>
                                            <th className="text-right px-4 py-2.5">Precio unit.</th>
                                            <th className="text-right px-5 py-2.5">Subtotal</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100/80">
                                          {orderDetails[order.id].map((detail: any) => (
                                            <tr key={detail.id} className="hover:bg-slate-50/40">
                                              <td className="px-5 py-3 font-mono text-xs text-slate-400">
                                                {detail.productos?.codigo_producto || '—'}
                                              </td>
                                              <td className="px-5 py-3 font-medium text-slate-700">
                                                {detail.productos?.nombre_producto || 'Producto desconocido'}
                                              </td>
                                              <td className="px-4 py-3 text-center text-slate-500 tabular-nums">
                                                {detail.cantidad} {detail.unidad_seleccionada}
                                              </td>
                                              <td className="px-4 py-3 text-right text-slate-600 tabular-nums">
                                                {formatMoney(detail.precio_unitario)}
                                              </td>
                                              <td className="px-5 py-3 text-right font-semibold text-slate-900 tabular-nums">
                                                {formatMoney(detail.subtotal)}
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    ) : (
                                      <p className="text-sm text-slate-400 text-center py-8">Sin productos registrados</p>
                                    )}
                                  </div>

                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <span className="text-xs text-slate-400">{orders.length} registros</span>
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5 text-[11px] text-slate-400">
                  <span className="w-2 h-2 rounded-full bg-rose-400" /> Vencido
                </span>
                <span className="flex items-center gap-1.5 text-[11px] text-slate-400">
                  <span className="w-2 h-2 rounded-full bg-amber-400" /> Por vencer
                </span>
                <span className="flex items-center gap-1.5 text-[11px] text-slate-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" /> Cobrado
                </span>
              </div>
            </div>

          </div>
        </>
      )}
    </div>
  )
}
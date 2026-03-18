'use client'

import { createClient } from '@/utils/supabase/client'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  AlertCircle,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  DollarSign,
  Edit,
  Filter,
  Loader2,
  Package,
  Percent,
  Plus,
  RefreshCw,
  Save,
  Search,
  ShoppingCart,
  Tag,
  Trash2,
  User,
  X,
  XCircle
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

// ─── Tipos ────────────────────────────────────────────────────────────────────
type Product = {
  id: string
  codigo_producto: string
  nombre_producto: string
  precio_base_venta: number
  stock_actual: number
}

type EditableLine = {
  id?: string            // undefined = nueva línea (aún no en DB)
  producto_id: string | null
  codigo_producto: string
  nombre_producto: string
  cantidad: number
  precio_unitario: number
  descuento_pct: number  // % de descuento (0–100)
  subtotal: number
  unidad_seleccionada: string
  isNew?: boolean
  isDeleted?: boolean
}

type OrderDetail = {
  id: string
  producto_id: string | null
  cantidad: number
  precio_unitario: number
  subtotal: number
  unidad_seleccionada: string | null
  factor_aplicado: string | null
  productos: { codigo_producto: string; nombre_producto: string } | null
}

type Order = {
  id: string
  numero_documento: number
  fecha_pedido: string
  total_venta: number
  estado: string
  tipo_pago: string
  observacion: string | null
  clients: { name: string; legacy_id: string | null; code?: string | null } | null
  employees: { full_name: string } | null
}

// ─── StatusBadge ──────────────────────────────────────────────────────────────
const StatusBadge = ({ status }: { status: string }) => {
  const styles: Record<string, string> = {
    'Pendiente': 'bg-yellow-100 text-yellow-800 border-yellow-200',
    'Aprobado': 'bg-blue-100 text-blue-800 border-blue-200',
    'Entregado': 'bg-green-100 text-green-800 border-green-200',
    'Completado': 'bg-emerald-100 text-emerald-800 border-emerald-200',
    'Anulado': 'bg-red-100 text-red-800 border-red-200',
  }
  const icons: Record<string, any> = {
    'Pendiente': Clock, 'Aprobado': CheckCircle2, 'Entregado': CheckCircle2,
    'Completado': CheckCircle2, 'Anulado': XCircle,
  }
  const Icon = icons[status] || Clock
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${styles[status] || 'bg-gray-100 text-gray-800 border-gray-200'}`}>
      <Icon className="w-3 h-3" />{status}
    </span>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (v: number) => new Intl.NumberFormat('es-BO', { style: 'currency', currency: 'BOB' }).format(v)

function computeSubtotal(cantidad: number, precio: number, descPct: number) {
  return cantidad * precio * (1 - descPct / 100)
}

// ─── Buscador de producto inline ──────────────────────────────────────────────
function InlineProductSearch({ products, onSelect }: { products: Product[]; onSelect: (p: Product) => void }) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const filtered = useMemo(() =>
    q.length < 1 ? products.slice(0, 30) : products.filter(p =>
      p.nombre_producto.toLowerCase().includes(q.toLowerCase()) ||
      p.codigo_producto.toLowerCase().includes(q.toLowerCase())
    ).slice(0, 30)
  , [products, q])

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-gray-400" />
        <input type="text" placeholder="Buscar producto..." value={q}
          onChange={e => { setQ(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          className="w-full pl-8 pr-3 py-2 text-xs border-2 border-green-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400 bg-white" />
      </div>
      {open && (
        <div className="absolute z-50 w-72 mt-1 bg-white border-2 border-gray-200 rounded-xl shadow-2xl max-h-56 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="text-center text-gray-400 py-4 text-xs">Sin resultados</p>
          ) : filtered.map(p => (
            <button key={p.id} type="button"
              onClick={() => { onSelect(p); setQ(''); setOpen(false) }}
              className="w-full text-left px-3 py-2 hover:bg-green-50 border-b border-gray-100 last:border-0">
              <p className="text-xs font-bold text-gray-800 truncate">{p.nombre_producto}</p>
              <p className="text-[10px] text-gray-500">{p.codigo_producto} · {fmt(p.precio_base_venta)}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function VentasPage() {
  const supabase = createClient()

  const [orders, setOrders] = useState<Order[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  // ── Filtros
  const [searchTerm, setSearchTerm] = useState('')
  const [filterEstado, setFilterEstado] = useState('')
  const [filterTipoPago, setFilterTipoPago] = useState('')
  const [filterEmpleado, setFilterEmpleado] = useState('')
  const [filterFechaDesde, setFilterFechaDesde] = useState('')
  const [filterFechaHasta, setFilterFechaHasta] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  // ── Paginación
  const PAGE_SIZE = 25
  const [currentPage, setCurrentPage] = useState(1)

  // ── Modal detalle + edición combinado
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [modalTab, setModalTab] = useState<'detail' | 'edit'>('detail')

  // Detalle
  const [rawDetail, setRawDetail] = useState<OrderDetail[]>([])
  const [loadingDetail, setLoadingDetail] = useState(false)

  // Edición cabecera
  const [editEstado, setEditEstado] = useState('')
  const [editTipoPago, setEditTipoPago] = useState('')
  const [editObservacion, setEditObservacion] = useState('')

  // Edición líneas
  const [editLines, setEditLines] = useState<EditableLine[]>([])
  const [editGlobalDiscount, setEditGlobalDiscount] = useState(0) // % descuento global adicional
  const [savingEdit, setSavingEdit] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const [editSuccess, setEditSuccess] = useState(false)

  // ── Carga de datos ─────────────────────────────────────────────────────────
  const fetchOrders = async () => {
    setLoading(true)
    try {
      const { data } = await supabase.from('pedidos')
        .select('id, numero_documento, fecha_pedido, total_venta, estado, tipo_pago, observacion, clients:clients_id (name, legacy_id, code), employees:empleado_id (full_name)')
        .order('fecha_pedido', { ascending: false })
      if (data) setOrders(data as any)
    } finally {
      setLoading(false)
    }
  }

  const fetchProducts = async () => {
    const { data } = await supabase.from('productos')
      .select('id, codigo_producto, nombre_producto, precio_base_venta, stock_actual')
      .or('activo.eq.true,estado.eq.Activo')
      .order('nombre_producto')
    if (data) setProducts(data as any)
  }

  useEffect(() => { fetchOrders(); fetchProducts() }, [])

  // ── Filtrado y paginación ──────────────────────────────────────────────────
  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      const term = searchTerm.toLowerCase()
      const matchSearch = !searchTerm ||
        (o.clients?.name || '').toLowerCase().includes(term) ||
        (o.clients?.code || '').toLowerCase().includes(term) ||
        o.numero_documento.toString().includes(term) ||
        (o.employees?.full_name || '').toLowerCase().includes(term)
      const matchEstado = !filterEstado || o.estado === filterEstado
      const matchPago = !filterTipoPago || o.tipo_pago === filterTipoPago
      const matchEmp = !filterEmpleado || (o.employees?.full_name || '') === filterEmpleado
      const fecha = new Date(o.fecha_pedido)
      const matchDesde = !filterFechaDesde || fecha >= new Date(filterFechaDesde)
      const matchHasta = !filterFechaHasta || fecha <= new Date(filterFechaHasta + 'T23:59:59')
      return matchSearch && matchEstado && matchPago && matchEmp && matchDesde && matchHasta
    })
  }, [orders, searchTerm, filterEstado, filterTipoPago, filterEmpleado, filterFechaDesde, filterFechaHasta])

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / PAGE_SIZE))
  const pagedOrders = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE
    return filteredOrders.slice(start, start + PAGE_SIZE)
  }, [filteredOrders, currentPage])

  useEffect(() => { setCurrentPage(1) }, [searchTerm, filterEstado, filterTipoPago, filterEmpleado, filterFechaDesde, filterFechaHasta])

  const activeFiltersCount = [filterEstado, filterTipoPago, filterEmpleado, filterFechaDesde, filterFechaHasta].filter(Boolean).length
  const clearAllFilters = () => { setSearchTerm(''); setFilterEstado(''); setFilterTipoPago(''); setFilterEmpleado(''); setFilterFechaDesde(''); setFilterFechaHasta('') }

  const empleadosUnicos = useMemo(() => {
    const set = new Set<string>()
    orders.forEach(o => { if (o.employees?.full_name) set.add(o.employees.full_name) })
    return Array.from(set).sort()
  }, [orders])

  const kpis = useMemo(() => ({
    totalVentas: filteredOrders.reduce((s, o) => s + (o.estado !== 'Anulado' ? o.total_venta : 0), 0),
    countPendientes: filteredOrders.filter(o => o.estado === 'Pendiente').length,
    countOrders: filteredOrders.length,
  }), [filteredOrders])

  // ── Abrir modal ────────────────────────────────────────────────────────────
  const openModal = async (order: Order, tab: 'detail' | 'edit' = 'detail') => {
    setSelectedOrder(order)
    setShowModal(true)
    setModalTab(tab)
    setEditError(null)
    setEditSuccess(false)
    setEditEstado(order.estado)
    setEditTipoPago(order.tipo_pago)
    setEditObservacion(order.observacion || '')
    setEditGlobalDiscount(0)

    setRawDetail([])
    setEditLines([])
    setLoadingDetail(true)
    try {
      const { data } = await supabase
        .from('detalle_pedido')
        .select('id, producto_id, cantidad, precio_unitario, subtotal, unidad_seleccionada, factor_aplicado, productos:producto_id (codigo_producto, nombre_producto)')
        .eq('pedido_id', order.id)
        .order('created_at')
      const rows = (data as any) || []
      setRawDetail(rows)
      // Convertir a líneas editables
      setEditLines(rows.map((d: any): EditableLine => ({
        id: d.id,
        producto_id: d.producto_id,
        codigo_producto: d.productos?.codigo_producto || d.factor_aplicado || '—',
        nombre_producto: d.productos?.nombre_producto || 'Producto no vinculado',
        cantidad: d.cantidad,
        precio_unitario: d.precio_unitario,
        descuento_pct: 0,
        subtotal: d.subtotal,
        unidad_seleccionada: d.unidad_seleccionada || 'UND',
      })))
    } finally {
      setLoadingDetail(false)
    }
  }

  const closeModal = () => { setShowModal(false); setSelectedOrder(null) }

  // ── Líneas editables ───────────────────────────────────────────────────────
  const updateLine = (i: number, field: keyof EditableLine, value: any) => {
    setEditLines(prev => {
      const next = [...prev]
      next[i] = { ...next[i], [field]: value }
      // Recalcular subtotal
      const l = next[i]
      next[i].subtotal = computeSubtotal(l.cantidad, l.precio_unitario, l.descuento_pct)
      return next
    })
  }

  const deleteLine = (i: number) => {
    setEditLines(prev => {
      const next = [...prev]
      if (next[i].id) {
        // Existente → marcar para borrar
        next[i] = { ...next[i], isDeleted: true }
      } else {
        // Nueva → remover
        next.splice(i, 1)
      }
      return next
    })
  }

  const addProductLine = (p: Product) => {
    const newLine: EditableLine = {
      producto_id: p.id,
      codigo_producto: p.codigo_producto,
      nombre_producto: p.nombre_producto,
      cantidad: 1,
      precio_unitario: p.precio_base_venta,
      descuento_pct: 0,
      subtotal: p.precio_base_venta,
      unidad_seleccionada: 'UND',
      isNew: true,
    }
    setEditLines(prev => [...prev, newLine])
  }

  const activeLines = editLines.filter(l => !l.isDeleted)
  const subtotalBruto = activeLines.reduce((s, l) => s + l.subtotal, 0)
  const descuentoGlobalMonto = subtotalBruto * (editGlobalDiscount / 100)
  const totalConDescuento = subtotalBruto - descuentoGlobalMonto

  // ── Guardar edición ────────────────────────────────────────────────────────
  const handleSaveEdit = async () => {
    if (!selectedOrder) return
    setSavingEdit(true)
    setEditError(null)
    try {
      // 1. Actualizar cabecera del pedido
      const { error: cabErr } = await supabase.from('pedidos').update({
        estado: editEstado,
        tipo_pago: editTipoPago,
        observacion: editObservacion || null,
        total_venta: totalConDescuento,
      }).eq('id', selectedOrder.id)
      if (cabErr) throw cabErr

      // 2. Eliminar líneas marcadas
      const toDelete = editLines.filter(l => l.isDeleted && l.id)
      for (const l of toDelete) {
        const { error } = await supabase.from('detalle_pedido').delete().eq('id', l.id!)
        if (error) throw error
      }

      // 3. Actualizar líneas existentes modificadas
      const toUpdate = editLines.filter(l => !l.isDeleted && l.id)
      for (const l of toUpdate) {
        const { error } = await supabase.from('detalle_pedido').update({
          cantidad: l.cantidad,
          precio_unitario: l.precio_unitario,
          subtotal: l.subtotal,
          unidad_seleccionada: 'UND',
        }).eq('id', l.id!)
        if (error) throw error
      }

      // 4. Insertar nuevas líneas
      const toInsert = editLines.filter(l => l.isNew && !l.isDeleted)
      if (toInsert.length > 0) {
        const { error } = await supabase.from('detalle_pedido').insert(
          toInsert.map(l => ({
            pedido_id: selectedOrder.id,
            producto_id: l.producto_id,
            cantidad: l.cantidad,
            precio_unitario: l.precio_unitario,
            subtotal: l.subtotal,
            unidad_seleccionada: 'UND',
            factor_aplicado: 1,
          }))
        )
        if (error) throw error
      }

      setEditSuccess(true)
      await fetchOrders()
      // Recargar detalle
      await openModal({ ...selectedOrder, total_venta: totalConDescuento, estado: editEstado, tipo_pago: editTipoPago, observacion: editObservacion || null }, 'detail')
    } catch (err: any) {
      setEditError(err.message || 'Error al guardar')
    } finally {
      setSavingEdit(false)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 p-4 sm:p-6 lg:p-8">
      <div className="fixed inset-0 z-0 pointer-events-none opacity-30"
        style={{ backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 35px, rgba(16,185,129,0.2) 35px, rgba(16,185,129,0.2) 39px)` }} />

      <div className="relative z-10 space-y-6">

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl shadow-lg border-2 border-green-100">
          <div>
            <h1 className="text-3xl md:text-4xl font-black bg-gradient-to-r from-green-600 to-emerald-500 bg-clip-text text-transparent">
              Ventas y Pedidos
            </h1>
            <p className="text-gray-500 text-sm mt-1 font-medium">Historial completo · haz clic en un pedido para ver o editar todos los detalles</p>
          </div>
          <button onClick={fetchOrders} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 border-2 border-green-200 rounded-xl text-green-700 font-bold hover:bg-green-50 transition-all disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Actualizar
          </button>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gradient-to-br from-green-500 to-emerald-600 p-6 rounded-3xl shadow-xl text-white">
            <div className="flex justify-between mb-4"><DollarSign className="w-7 h-7" /><span className="font-bold text-sm">VENTAS TOTALES</span></div>
            <h3 className="text-3xl font-black">{fmt(kpis.totalVentas)}</h3>
            <p className="text-green-100 text-sm mt-1">Del período filtrado</p>
          </div>
          <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-6 rounded-3xl shadow-xl text-white">
            <div className="flex justify-between mb-4"><ShoppingCart className="w-7 h-7" /><span className="font-bold text-sm">PEDIDOS</span></div>
            <h3 className="text-3xl font-black">{kpis.countOrders}</h3>
            <p className="text-blue-100 text-sm mt-1">En total</p>
          </div>
          <div className="bg-gradient-to-br from-orange-500 to-amber-600 p-6 rounded-3xl shadow-xl text-white">
            <div className="flex justify-between mb-4"><Clock className="w-7 h-7" /><span className="font-bold text-sm">PENDIENTES</span></div>
            <h3 className="text-3xl font-black">{kpis.countPendientes}</h3>
            <p className="text-orange-100 text-sm mt-1">Por procesar</p>
          </div>
        </div>

        {/* Tabla */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">

          {/* Barra de búsqueda + filtros */}
          <div className="p-4 bg-gray-50 border-b space-y-3">
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-gray-700">Lista de Pedidos</h3>
                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-black">{filteredOrders.length}</span>
              </div>
              <div className="flex flex-wrap gap-2 items-center">
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 text-gray-400 w-4 h-4" />
                  <input type="text" placeholder="Buscar por cliente, código, nº doc o vendedor..."
                    className="pl-9 pr-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400 w-72"
                    value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                </div>
                <button onClick={() => setShowFilters(v => !v)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-semibold transition-all ${showFilters || activeFiltersCount > 0 ? 'bg-green-600 text-white border-green-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-100'}`}>
                  <Filter className="w-4 h-4" /> Filtros
                  {activeFiltersCount > 0 && <span className="ml-1 bg-white text-green-700 rounded-full w-5 h-5 text-xs font-black flex items-center justify-center">{activeFiltersCount}</span>}
                </button>
                {activeFiltersCount > 0 && (
                  <button onClick={clearAllFilters} className="flex items-center gap-1 px-3 py-2 text-sm text-red-600 font-semibold hover:bg-red-50 rounded-lg border border-red-200">
                    <X className="w-4 h-4" /> Limpiar
                  </button>
                )}
              </div>
            </div>

            {showFilters && (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 pt-3 border-t border-gray-200">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Estado</label>
                  <select value={filterEstado} onChange={e => setFilterEstado(e.target.value)} className="w-full px-2 py-2 border border-gray-200 rounded-lg text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-green-400">
                    <option value="">Todos</option>
                    {['Pendiente','Aprobado','Entregado','Completado','Anulado'].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Tipo de Pago</label>
                  <select value={filterTipoPago} onChange={e => setFilterTipoPago(e.target.value)} className="w-full px-2 py-2 border border-gray-200 rounded-lg text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-green-400">
                    <option value="">Todos</option>
                    <option value="Contado">Contado</option>
                    <option value="Crédito">Crédito</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Empleado</label>
                  <select value={filterEmpleado} onChange={e => setFilterEmpleado(e.target.value)} className="w-full px-2 py-2 border border-gray-200 rounded-lg text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-green-400">
                    <option value="">Todos</option>
                    {empleadosUnicos.map(e => <option key={e} value={e}>{e}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Desde</label>
                  <input type="date" value={filterFechaDesde} onChange={e => setFilterFechaDesde(e.target.value)} className="w-full px-2 py-2 border border-gray-200 rounded-lg text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-green-400" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Hasta</label>
                  <input type="date" value={filterFechaHasta} onChange={e => setFilterFechaHasta(e.target.value)} className="w-full px-2 py-2 border border-gray-200 rounded-lg text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-green-400" />
                </div>
              </div>
            )}

            {activeFiltersCount > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {filterEstado && <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold"><Tag className="w-3 h-3" /> {filterEstado}<button onClick={() => setFilterEstado('')} className="ml-1"><X className="w-3 h-3" /></button></span>}
                {filterTipoPago && <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-semibold"><Tag className="w-3 h-3" /> {filterTipoPago}<button onClick={() => setFilterTipoPago('')} className="ml-1"><X className="w-3 h-3" /></button></span>}
                {filterEmpleado && <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-semibold"><User className="w-3 h-3" /> {filterEmpleado}<button onClick={() => setFilterEmpleado('')} className="ml-1"><X className="w-3 h-3" /></button></span>}
                {filterFechaDesde && <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-teal-100 text-teal-700 rounded-full text-xs font-semibold"><Calendar className="w-3 h-3" /> Desde: {filterFechaDesde}<button onClick={() => setFilterFechaDesde('')} className="ml-1"><X className="w-3 h-3" /></button></span>}
                {filterFechaHasta && <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-teal-100 text-teal-700 rounded-full text-xs font-semibold"><Calendar className="w-3 h-3" /> Hasta: {filterFechaHasta}<button onClick={() => setFilterFechaHasta('')} className="ml-1"><X className="w-3 h-3" /></button></span>}
              </div>
            )}
          </div>

          {/* Cabeceras tabla */}
          {!loading && (
            <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-gray-100 text-xs font-black text-gray-500 uppercase tracking-wider border-b">
              <div className="col-span-1"># Doc</div>
              <div className="col-span-2">Fecha</div>
              <div className="col-span-3">Cliente</div>
              <div className="col-span-2">Vendedor</div>
              <div className="col-span-2 text-right">Total</div>
              <div className="col-span-1 text-center">Estado</div>
              <div className="col-span-1"></div>
            </div>
          )}

          {loading ? (
            <div className="flex justify-center items-center py-16"><Loader2 className="w-8 h-8 text-green-600 animate-spin" /></div>
          ) : (
            <div className="divide-y divide-gray-100">
              {pagedOrders.length === 0 ? (
                <div className="text-center py-16 text-gray-400 font-medium">No hay pedidos que coincidan con los filtros</div>
              ) : pagedOrders.map(o => (
                <div key={o.id}
                  onClick={() => openModal(o, 'detail')}
                  className="grid grid-cols-12 gap-2 p-4 hover:bg-green-50 transition-colors items-center text-sm cursor-pointer group">
                  <div className="col-span-1 font-black text-gray-800">#{o.numero_documento}</div>
                  <div className="col-span-2 text-gray-500 text-xs">{format(new Date(o.fecha_pedido), 'dd/MM/yy HH:mm')}</div>
                  <div className="col-span-3">
                    <p className="font-semibold text-gray-800 truncate">{o.clients?.name || <span className="text-red-400 italic">Sin cliente</span>}</p>
                    <div className="flex items-center gap-1 flex-wrap mt-0.5">
                      {o.clients?.code && <span className="text-xs font-mono bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded">{o.clients.code}</span>}
                      {o.tipo_pago && <span className={`text-xs px-1.5 py-0.5 rounded font-semibold ${o.tipo_pago === 'Crédito' ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-600'}`}>{o.tipo_pago}</span>}
                    </div>
                  </div>
                  <div className="col-span-2 text-gray-500 truncate text-xs">{o.employees?.full_name || <span className="text-gray-400 italic">Sin vendedor</span>}</div>
                  <div className="col-span-2 font-black text-green-700 text-right">{fmt(o.total_venta)}</div>
                  <div className="col-span-1 text-center"><StatusBadge status={o.estado} /></div>
                  <div className="col-span-1 flex items-center justify-end">
                    <button onClick={e => { e.stopPropagation(); openModal(o, 'edit') }}
                      className="text-blue-600 hover:bg-blue-50 p-1.5 rounded opacity-0 group-hover:opacity-100 transition-all" title="Editar">
                      <Edit className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Paginación */}
          {!loading && totalPages > 1 && (
            <div className="px-4 py-3 bg-gray-50 border-t flex items-center justify-between">
              <span className="text-sm text-gray-600 font-medium">
                <span className="font-black text-green-700">{(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filteredOrders.length)}</span> de <span className="font-black text-green-700">{filteredOrders.length}</span>
              </span>
              <div className="flex items-center gap-1">
                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-100 disabled:opacity-40"><ChevronLeft className="w-4 h-4 text-green-700" /></button>
                <span className="px-3 py-1 text-sm bg-green-600 text-white rounded-lg font-black">{currentPage}/{totalPages}</span>
                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-100 disabled:opacity-40"><ChevronRight className="w-4 h-4 text-green-700" /></button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── MODAL DETALLE + EDICIÓN ── */}
      {showModal && selectedOrder && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[9999] flex items-center justify-center p-3">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[96vh] flex flex-col">

            {/* ── Header modal ── */}
            <div className="bg-gradient-to-r from-green-500 via-emerald-500 to-teal-500 px-6 py-4 rounded-t-3xl flex-shrink-0">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h2 className="text-2xl font-black text-white">Pedido #{selectedOrder.numero_documento}</h2>
                    <StatusBadge status={selectedOrder.estado} />
                  </div>
                  <p className="text-green-100 text-sm">
                    {format(new Date(selectedOrder.fecha_pedido), "dd 'de' MMMM yyyy · HH:mm", { locale: es })}
                    {selectedOrder.employees?.full_name && ` · ${selectedOrder.employees.full_name}`}
                  </p>
                </div>
                <button onClick={closeModal} className="p-2 hover:bg-white/20 rounded-xl transition-all mt-1">
                  <X className="w-5 h-5 text-white" />
                </button>
              </div>

              {/* Tabs dentro del modal */}
              <div className="flex gap-2 mt-4">
                {(['detail', 'edit'] as const).map(tab => (
                  <button key={tab} onClick={() => setModalTab(tab)}
                    className={`px-5 py-2 rounded-xl font-bold text-sm transition-all ${modalTab === tab ? 'bg-white text-green-700 shadow-lg' : 'text-white/80 hover:bg-white/20'}`}>
                    {tab === 'detail' ? 'Detalle' : 'Editar Pedido'}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Cuerpo modal ── */}
            {loadingDetail ? (
              <div className="flex-1 flex items-center justify-center py-16">
                <Loader2 className="w-8 h-8 text-green-600 animate-spin" />
              </div>
            ) : modalTab === 'detail' ? (

              // ─────────────────────── TAB DETALLE ───────────────────────
              <div className="flex-1 overflow-y-auto p-6 space-y-5">

                {/* Info cabecera */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">

                  {/* Cliente — ocupa 2 cols */}
                  <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-4 rounded-2xl border border-gray-200 md:col-span-2">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Cliente</p>
                    <p className="font-black text-gray-900 text-lg leading-tight">{selectedOrder.clients?.name || 'Sin cliente'}</p>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      {selectedOrder.clients?.code && (
                        <span className="text-xs font-mono bg-blue-100 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-lg font-bold">
                          Cód: {selectedOrder.clients.code}
                        </span>
                      )}
                      {selectedOrder.clients?.legacy_id && (
                        <span className="text-xs font-mono bg-gray-200 text-gray-600 px-2 py-0.5 rounded-lg">
                          ID: {selectedOrder.clients.legacy_id}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Vendedor</p>
                    <p className="font-bold text-gray-900">{selectedOrder.employees?.full_name || 'Sin asignar'}</p>
                  </div>

                  <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Tipo de Pago</p>
                    <p className="font-bold text-gray-900">{selectedOrder.tipo_pago}</p>
                  </div>

                  {selectedOrder.observacion && (
                    <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl md:col-span-4">
                      <p className="text-xs font-bold text-amber-600 uppercase tracking-wider mb-1">Observación</p>
                      <p className="text-sm text-gray-800">{selectedOrder.observacion}</p>
                    </div>
                  )}
                </div>

                {/* Total destacado */}
                <div className="bg-gradient-to-r from-green-500 to-emerald-600 p-5 rounded-2xl text-white flex items-center justify-between">
                  <div>
                    <p className="text-green-100 text-sm font-semibold">Total del Pedido</p>
                    <p className="text-4xl font-black">{fmt(selectedOrder.total_venta)}</p>
                  </div>
                  <DollarSign className="w-12 h-12 text-white/30" />
                </div>

                {/* Productos */}
                <div>
                  <h3 className="font-black text-gray-700 mb-3 flex items-center gap-2 text-base">
                    <Package className="w-5 h-5 text-green-600" />
                    Productos del Pedido
                    <span className="text-xs font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded-full ml-1">{rawDetail.length} líneas</span>
                  </h3>

                  {rawDetail.length === 0 ? (
                    <div className="text-center py-8 text-gray-400">
                      <Package className="w-10 h-10 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">Sin productos registrados</p>
                    </div>
                  ) : (
                    <>
                      {/* Cabecera */}
                      <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-gray-100 text-xs font-black text-gray-500 uppercase rounded-xl mb-2">
                        <div className="col-span-1">Cód.</div>
                        <div className="col-span-5">Producto</div>
                        <div className="col-span-2 text-center">Unidad</div>
                        <div className="col-span-1 text-center">Cant.</div>
                        <div className="col-span-1 text-right">P/U</div>
                        <div className="col-span-2 text-right">Subtotal</div>
                      </div>
                      <div className="space-y-1">
                        {rawDetail.map((d, i) => (
                          <div key={d.id || i} className="grid grid-cols-12 gap-2 px-3 py-3 bg-gray-50 hover:bg-green-50 rounded-xl border border-gray-100 items-center transition-colors">
                            <div className="col-span-1 text-xs font-mono text-gray-400 truncate">{d.productos?.codigo_producto || d.factor_aplicado || '—'}</div>
                            <div className="col-span-5">
                              <p className="font-semibold text-gray-800 text-sm">{d.productos?.nombre_producto || <span className="text-red-400 italic text-xs">No vinculado</span>}</p>
                            </div>
                            <div className="col-span-2 text-center">
                              <span className="text-xs font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded-lg">{d.unidad_seleccionada || 'UND'}</span>
                            </div>
                            <div className="col-span-1 text-center font-bold text-gray-700">{d.cantidad}</div>
                            <div className="col-span-1 text-right text-xs text-gray-500">{fmt(d.precio_unitario)}</div>
                            <div className="col-span-2 text-right font-black text-green-700">{fmt(d.subtotal)}</div>
                          </div>
                        ))}
                      </div>
                      {/* Total */}
                      <div className="flex justify-between items-center mt-4 pt-3 border-t-2 border-green-200">
                        <span className="text-sm text-gray-500 font-bold">{rawDetail.length} producto{rawDetail.length !== 1 ? 's' : ''}</span>
                        <span className="text-2xl font-black text-green-700">{fmt(selectedOrder.total_venta)}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>

            ) : (

              // ─────────────────────── TAB EDICIÓN ───────────────────────
              <div className="flex-1 overflow-y-auto p-6 space-y-5">

                {editSuccess && (
                  <div className="flex items-center gap-2 bg-green-50 border border-green-300 text-green-700 p-3 rounded-xl text-sm font-semibold">
                    <CheckCircle2 className="w-5 h-5" /> Pedido guardado correctamente
                  </div>
                )}
                {editError && (
                  <div className="flex items-start gap-2 bg-red-50 border border-red-300 text-red-700 p-3 rounded-xl text-sm">
                    <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" /> {editError}
                  </div>
                )}

                {/* ── Cabecera del pedido ── */}
                <div className="bg-gray-50 rounded-2xl border border-gray-200 p-5">
                  <h3 className="font-black text-gray-700 text-sm uppercase tracking-wider mb-4 flex items-center gap-2">
                    <Edit className="w-4 h-4 text-blue-500" /> Datos Generales
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1">Estado</label>
                      <select value={editEstado} onChange={e => setEditEstado(e.target.value)}
                        className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white font-semibold">
                        {['Pendiente','Aprobado','Entregado','Completado','Anulado'].map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1">Tipo de Pago</label>
                      <select value={editTipoPago} onChange={e => setEditTipoPago(e.target.value)}
                        className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white font-semibold">
                        <option value="Contado">Contado</option>
                        <option value="Crédito">Crédito</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1 flex items-center gap-1">
                        <Percent className="w-3 h-3 text-purple-500" /> Descuento Global (%)
                      </label>
                      <input type="number" min="0" max="100" step="0.5"
                        value={editGlobalDiscount}
                        onChange={e => setEditGlobalDiscount(parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2.5 border-2 border-purple-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white font-semibold" />
                    </div>
                    <div className="md:col-span-3">
                      <label className="block text-xs font-bold text-gray-500 mb-1">Observación</label>
                      <textarea rows={2} value={editObservacion} onChange={e => setEditObservacion(e.target.value)}
                        className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none" />
                    </div>
                  </div>
                </div>

                {/* ── Líneas de productos ── */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-black text-gray-700 text-sm uppercase tracking-wider flex items-center gap-2">
                      <Package className="w-4 h-4 text-green-600" /> Líneas del Pedido
                    </h3>
                    <span className="text-xs text-gray-400 font-semibold">{activeLines.length} línea{activeLines.length !== 1 ? 's' : ''} activa{activeLines.length !== 1 ? 's' : ''}</span>
                  </div>

                  {/* Cabecera de la tabla editable */}
                  <div className="grid grid-cols-12 gap-1.5 px-2 py-2 bg-gray-100 text-[10px] font-black text-gray-500 uppercase rounded-xl mb-1.5">
                    <div className="col-span-4">Producto</div>
                    <div className="col-span-2 text-center">Cantidad</div>
                    <div className="col-span-2 text-center">Precio U.</div>
                    <div className="col-span-1 text-center">Desc%</div>
                    <div className="col-span-2 text-right">Subtotal</div>
                    <div className="col-span-1"></div>
                  </div>

                  <div className="space-y-1.5">
                    {editLines.map((l, i) => l.isDeleted ? null : (
                      <div key={l.id || `new-${i}`} className={`grid grid-cols-12 gap-1.5 px-2 py-2.5 rounded-xl border items-center ${l.isNew ? 'bg-green-50 border-green-300' : 'bg-white border-gray-200'}`}>
                        <div className="col-span-4">
                          <p className="text-xs font-bold text-gray-800 truncate">{l.nombre_producto}</p>
                          <p className="text-[10px] text-gray-400 font-mono">{l.codigo_producto}</p>
                        </div>
                        <div className="col-span-2">
                          <input type="number" min="0.01" step="0.01" value={l.cantidad}
                            onChange={e => updateLine(i, 'cantidad', parseFloat(e.target.value) || 0)}
                            className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-xs text-center font-bold focus:outline-none focus:ring-2 focus:ring-green-400" />
                        </div>
                        <div className="col-span-2">
                          <input type="number" min="0" step="0.01" value={l.precio_unitario}
                            onChange={e => updateLine(i, 'precio_unitario', parseFloat(e.target.value) || 0)}
                            className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-xs text-center font-bold focus:outline-none focus:ring-2 focus:ring-green-400" />
                        </div>
                        <div className="col-span-1">
                          <input type="number" min="0" max="100" step="1" value={l.descuento_pct}
                            onChange={e => updateLine(i, 'descuento_pct', parseFloat(e.target.value) || 0)}
                            className="w-full px-1 py-1.5 border border-purple-200 rounded-lg text-xs text-center font-bold focus:outline-none focus:ring-2 focus:ring-purple-400 bg-purple-50" />
                        </div>
                        <div className="col-span-2 text-right font-black text-green-700 text-xs">{fmt(l.subtotal)}</div>
                        <div className="col-span-1 flex justify-center">
                          <button onClick={() => deleteLine(i)} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all" title="Eliminar línea">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Agregar nueva línea */}
                  <div className="mt-3 p-3 bg-green-50 border-2 border-dashed border-green-300 rounded-xl">
                    <p className="text-xs font-bold text-green-700 mb-2 flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Agregar producto al pedido</p>
                    <InlineProductSearch products={products} onSelect={addProductLine} />
                  </div>
                </div>

                {/* ── Resumen de totales ── */}
                <div className="bg-gray-50 rounded-2xl border border-gray-200 p-4 space-y-2">
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>Subtotal bruto</span>
                    <span className="font-bold">{fmt(subtotalBruto)}</span>
                  </div>
                  {editGlobalDiscount > 0 && (
                    <div className="flex justify-between text-sm text-purple-600">
                      <span>Descuento global ({editGlobalDiscount}%)</span>
                      <span className="font-bold">− {fmt(descuentoGlobalMonto)}</span>
                    </div>
                  )}
                  <div className="flex justify-between pt-2 border-t-2 border-gray-300">
                    <span className="font-black text-gray-900 text-lg">TOTAL</span>
                    <span className="font-black text-green-700 text-2xl">{fmt(totalConDescuento)}</span>
                  </div>
                  {Math.abs(totalConDescuento - selectedOrder.total_venta) > 0.01 && (
                    <div className="flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 mt-1">
                      <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                      El total cambiará de {fmt(selectedOrder.total_venta)} a {fmt(totalConDescuento)}
                    </div>
                  )}
                </div>

              </div>
            )}

            {/* ── Footer modal ── */}
            <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between flex-shrink-0 bg-gray-50 rounded-b-3xl">
              <button onClick={closeModal} className="px-5 py-2.5 border-2 border-gray-300 text-gray-600 rounded-2xl font-bold text-sm hover:bg-gray-100 transition-all">
                Cerrar
              </button>

              {modalTab === 'detail' ? (
                <button onClick={() => setModalTab('edit')}
                  className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-2xl font-bold text-sm hover:from-blue-600 hover:to-indigo-700 transition-all shadow-lg">
                  <Edit className="w-4 h-4" /> Editar este pedido
                </button>
              ) : (
                <button onClick={handleSaveEdit} disabled={savingEdit}
                  className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-2xl font-bold text-sm hover:from-green-600 hover:to-emerald-700 transition-all shadow-lg disabled:opacity-50">
                  {savingEdit ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {savingEdit ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              )}
            </div>

          </div>
        </div>
      )}
    </div>
  )
}

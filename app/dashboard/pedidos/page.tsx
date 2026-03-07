'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { createClient } from '@/utils/supabase/client'
import {
  Search, ShoppingCart, Calendar, User, CheckCircle2, XCircle, Clock,
  DollarSign, Plus, Trash2, Save, Loader2, AlertTriangle, Edit, X,
  ChevronDown, ChevronUp, Package, RefreshCw
} from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import EmployeesTab from './components/EmployeesTab'
import ReportsTab from './components/ReportsTab'

// ─── Tipos ────────────────────────────────────────────────────────────────────
type Product = {
  id: string
  codigo_producto: string
  nombre_producto: string
  precio_base_venta: number
  unidad_base_venta: string
  stock_actual: number
}

type Client = {
  id: string
  name: string
  legacy_id: string | null
  code?: string | null
}

type OrderProduct = {
  producto_id: string
  codigo_producto: string
  nombre_producto: string
  cantidad: number
  precio_unitario: number
  unidad_seleccionada: string
  subtotal: number
}

type OrderDetail = {
  id: string
  producto_id: string
  cantidad: number
  precio_unitario: number
  subtotal: number
  unidad_seleccionada: string
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
  ubicacion_venta: any
  clients: { name: string; legacy_id: string | null } | null
  employees: { full_name: string } | null
}

// ─── StatusBadge ─────────────────────────────────────────────────────────────
const StatusBadge = ({ status }: { status: string }) => {
  const styles: Record<string, string> = {
    'Pendiente': 'bg-yellow-100 text-yellow-800 border-yellow-200',
    'Aprobado': 'bg-blue-100 text-blue-800 border-blue-200',
    'Entregado': 'bg-green-100 text-green-800 border-green-200',
    'Anulado': 'bg-red-100 text-red-800 border-red-200',
  }
  const icons: Record<string, any> = {
    'Pendiente': Clock, 'Aprobado': CheckCircle2, 'Entregado': CheckCircle2, 'Anulado': XCircle,
  }
  const Icon = icons[status] || Clock
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${styles[status] || 'bg-gray-100 text-gray-800 border-gray-200'}`}>
      <Icon className="w-3 h-3 mr-1" />{status}
    </span>
  )
}

// ─── Buscador de clientes con autocomplete ───────────────────────────────────
function ClientSearch({
  clients,
  onSelect,
  selectedId,
}: {
  clients: Client[]
  onSelect: (c: Client | null) => void
  selectedId: string
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!selectedId) setQuery('')
    else {
      const found = clients.find(c => c.id === selectedId)
      if (found) setQuery(found.name)
    }
  }, [selectedId, clients])

  const filtered = useMemo(() =>
    query.length < 1 ? clients.slice(0, 50) : clients.filter(c =>
      c.name.toLowerCase().includes(query.toLowerCase()) ||
      (c.legacy_id || '').toString().includes(query) ||
      (c.code || '').toLowerCase().includes(query.toLowerCase())
    ).slice(0, 50)
  , [clients, query])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleSelect = (c: Client) => {
    setQuery(c.name)
    setOpen(false)
    onSelect(c)
  }

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); onSelect(null) }}
          onFocus={() => setOpen(true)}
          placeholder="Buscar cliente por nombre o código..."
          className="w-full pl-9 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-400 text-sm text-gray-900 bg-white"
        />
      </div>
      {open && (
        <div className="absolute z-50 w-full mt-1 bg-white border-2 border-gray-200 rounded-xl shadow-2xl max-h-64 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="text-center text-gray-400 py-6 text-sm">No se encontraron clientes</p>
          ) : (
            filtered.map(c => (
              <button key={c.id} type="button"
                onClick={() => handleSelect(c)}
                className="w-full text-left px-4 py-3 hover:bg-green-50 border-b border-gray-100 last:border-0 transition-colors">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold text-gray-800">{c.name}</p>
                  {c.legacy_id && (
                    <span className="text-xs font-mono bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                      #{c.legacy_id}
                    </span>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
function ProductSearch({
  products,
  onSelect,
  selectedId,
}: {
  products: Product[]
  onSelect: (p: Product | null) => void
  selectedId: string
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Sync display when selectedId changes (e.g. cleared)
  useEffect(() => {
    if (!selectedId) setQuery('')
  }, [selectedId])

  const filtered = useMemo(() =>
    query.length < 1 ? products.slice(0, 40) : products.filter(p =>
      p.nombre_producto.toLowerCase().includes(query.toLowerCase()) ||
      p.codigo_producto.toLowerCase().includes(query.toLowerCase())
    ).slice(0, 40)
  , [products, query])

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleSelect = (p: Product) => {
    setQuery(p.nombre_producto)
    setOpen(false)
    onSelect(p)
  }

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); onSelect(null) }}
          onFocus={() => setOpen(true)}
          placeholder="Buscar por nombre o SKU..."
          className="w-full pl-9 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-400 text-sm"
        />
      </div>
      {open && (
        <div className="absolute z-50 w-full mt-1 bg-white border-2 border-gray-200 rounded-xl shadow-2xl max-h-64 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="text-center text-gray-400 py-6 text-sm">No se encontraron productos</p>
          ) : (
            filtered.map(p => (
              <button key={p.id} type="button"
                onClick={() => handleSelect(p)}
                className="w-full text-left px-4 py-3 hover:bg-green-50 border-b border-gray-100 last:border-0 transition-colors">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-gray-800">{p.nombre_producto}</p>
                    <p className="text-xs text-gray-500">{p.codigo_producto} · {p.unidad_base_venta}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-green-700">
                      {new Intl.NumberFormat('es-BO', { style: 'currency', currency: 'BOB' }).format(p.precio_base_venta)}
                    </p>
                    <p className={`text-xs font-semibold ${p.stock_actual <= 0 ? 'text-red-500' : 'text-gray-500'}`}>
                      Stock: {p.stock_actual}
                    </p>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function OrdersPage() {
  const supabase = createClient()

  const [activeTab, setActiveTab] = useState<'pedidos' | 'empleados' | 'reportes'>('pedidos')

  // Datos
  const [orders, setOrders] = useState<Order[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null)
  const [orderDetails, setOrderDetails] = useState<Record<string, OrderDetail[]>>({})
  const [loadingDetails, setLoadingDetails] = useState(false)

  // Formulario
  const [formData, setFormData] = useState({ client_id: '', tipo_pago: 'Contado', observacion: '', estado: 'Pendiente' })
  const [orderProducts, setOrderProducts] = useState<OrderProduct[]>([])
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [productQuantity, setProductQuantity] = useState('1')
  const [productPrice, setProductPrice] = useState('')    // precio editable
  const [formLoading, setFormLoading] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [formSuccess, setFormSuccess] = useState(false)

  // Modal edición
  const [editingOrder, setEditingOrder] = useState<Order | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editFormData, setEditFormData] = useState({ estado: '', tipo_pago: '', observacion: '' })
  const [editLoading, setEditLoading] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const [editSuccess, setEditSuccess] = useState(false)

  // ── Carga inicial ─────────────────────────────────────────────────────────
  const fetchData = async () => {
    setLoading(true)
    try {
      const [ordersRes, clientsRes, productsRes] = await Promise.all([
        supabase.from('pedidos')
          .select('*, clients:clients_id (name, legacy_id), employees:empleado_id (full_name)')
          .order('fecha_pedido', { ascending: false }),
        supabase.from('clients').select('id, name, legacy_id, code').order('name'),
        supabase.from('productos')
          .select('id, codigo_producto, nombre_producto, precio_base_venta, unidad_base_venta, stock_actual')
          .or('activo.eq.true,estado.eq.Activo')
          .order('nombre_producto'),
      ])
      if (ordersRes.error) throw ordersRes.error
      if (clientsRes.error) throw clientsRes.error
      if (ordersRes.data) setOrders(ordersRes.data as any)
      if (clientsRes.data) setClients(clientsRes.data)
      if (productsRes.data) setProducts(productsRes.data as any)
    } catch (err: any) {
      console.error('Error cargando datos:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'pedidos') fetchData()
  }, [activeTab])

  // ── Cargar detalle de un pedido (expandible) ──────────────────────────────
  const loadOrderDetail = async (orderId: string) => {
    if (orderDetails[orderId]) {
      setExpandedOrderId(expandedOrderId === orderId ? null : orderId)
      return
    }
    setLoadingDetails(true)
    try {
      const { data, error } = await supabase
        .from('detalle_pedido')
        .select('id, producto_id, cantidad, precio_unitario, subtotal, unidad_seleccionada, productos:producto_id (codigo_producto, nombre_producto)')
        .eq('pedido_id', orderId)
      if (error) throw error
      setOrderDetails(prev => ({ ...prev, [orderId]: (data as any) || [] }))
      setExpandedOrderId(orderId)
    } catch (err) {
      console.error('Error cargando detalle:', err)
    } finally {
      setLoadingDetails(false)
    }
  }

  // ── KPIs y filtros ────────────────────────────────────────────────────────
  const filteredOrders = useMemo(() =>
    orders.filter(o =>
      o.clients?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.numero_documento.toString().includes(searchTerm) ||
      o.employees?.full_name.toLowerCase().includes(searchTerm.toLowerCase())
    )
  , [orders, searchTerm])

  const kpis = useMemo(() => ({
    totalVentas: orders.reduce((s, o) => s + (o.estado !== 'Anulado' ? o.total_venta : 0), 0),
    countPendientes: orders.filter(o => o.estado === 'Pendiente').length,
    countOrders: orders.length,
  }), [orders])

  const fmt = (v: number) => new Intl.NumberFormat('es-BO', { style: 'currency', currency: 'BOB' }).format(v)

  // ── Agregar producto a la lista ───────────────────────────────────────────
  const handleAddProduct = () => {
    if (!selectedProduct) { setFormError('Selecciona un producto'); return }
    const qty = parseFloat(productQuantity)
    if (!qty || qty <= 0) { setFormError('Cantidad inválida'); return }
    const price = parseFloat(productPrice) || selectedProduct.precio_base_venta
    if (price <= 0) { setFormError('El precio debe ser mayor a 0'); return }

    // Evitar duplicados — suma cantidad si ya existe
    const existing = orderProducts.findIndex(p => p.producto_id === selectedProduct.id)
    if (existing >= 0) {
      const updated = [...orderProducts]
      updated[existing].cantidad += qty
      updated[existing].subtotal = updated[existing].cantidad * updated[existing].precio_unitario
      setOrderProducts(updated)
    } else {
      setOrderProducts([...orderProducts, {
        producto_id: selectedProduct.id,
        codigo_producto: selectedProduct.codigo_producto,
        nombre_producto: selectedProduct.nombre_producto,
        cantidad: qty,
        precio_unitario: price,
        unidad_seleccionada: selectedProduct.unidad_base_venta,
        subtotal: qty * price,
      }])
    }
    setSelectedProduct(null)
    setProductQuantity('1')
    setProductPrice('')
    setFormError(null)
  }

  const handleUpdateQty = (i: number, qty: number) => {
    if (qty <= 0) return
    const updated = [...orderProducts]
    updated[i] = { ...updated[i], cantidad: qty, subtotal: qty * updated[i].precio_unitario }
    setOrderProducts(updated)
  }

  const handleUpdatePrice = (i: number, price: number) => {
    if (price <= 0) return
    const updated = [...orderProducts]
    updated[i] = { ...updated[i], precio_unitario: price, subtotal: updated[i].cantidad * price }
    setOrderProducts(updated)
  }

  const calculateTotal = () => orderProducts.reduce((s, p) => s + p.subtotal, 0)

  const handleClearForm = () => {
    setFormData({ client_id: '', tipo_pago: 'Contado', observacion: '', estado: 'Pendiente' })
    setOrderProducts([])
    setSelectedProduct(null)
    setProductQuantity('1')
    setProductPrice('')
    setFormError(null)
    setFormSuccess(false)
  }

  // ── Crear pedido ──────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.client_id) { setFormError('Selecciona un cliente'); return }
    if (orderProducts.length === 0) { setFormError('Agrega al menos un producto'); return }

    try {
      setFormLoading(true)
      setFormError(null)
      const total = calculateTotal()

      // [1] Auth
      console.log('📦 [1] Obteniendo usuario...')
      const { data: { user }, error: userErr } = await supabase.auth.getUser()
      if (userErr) throw userErr
      console.log('📦 [1] OK —', user?.email)

      // [2] Empleado
      const { data: empData } = await supabase.from('employees').select('id').eq('email', user?.email).single()
      console.log('📦 [2] Empleado:', empData?.id || 'no encontrado (se guarda null)')

      // GPS
      let gpsWKT: string | null = null
      try {
        const pos = await new Promise<GeolocationPosition>((res, rej) =>
          navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 })
        )
        gpsWKT = `POINT(${pos.coords.longitude} ${pos.coords.latitude})`
        console.log('📍 GPS:', gpsWKT)
      } catch { console.log('📍 Sin GPS') }

      console.log('📦 [3] Enviando pedido al API route (bypass RLS)...')
      const cabecera = {
        clients_id: formData.client_id,
        tipo_pago: formData.tipo_pago,
        observacion: formData.observacion || null,
        estado: formData.estado,
        total_venta: total,
        fecha_pedido: new Date().toISOString(),
        empleado_id: empData?.id || null,
        ubicacion_venta: gpsWKT,
      }

      const detalles = orderProducts.map(p => ({
        producto_id: p.producto_id,
        cantidad: p.cantidad,
        precio_unitario: p.precio_unitario,
        unidad_seleccionada: p.unidad_seleccionada,
        subtotal: p.subtotal,
        factor_aplicado: 1,
      }))

      const apiRes = await fetch('/api/pedidos/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cabecera, detalles }),
      })
      const apiJson = await apiRes.json()

      if (!apiRes.ok || apiJson.error) {
        const errMsg = apiJson.error || apiJson.details || apiJson.hint || 'Error al guardar el pedido'
        console.error('📦 [3] ERROR API pedido:', apiJson)
        throw new Error(errMsg)
      }
      console.log('📦 [3+4] OK — pedido_id:', apiJson.pedido_id)


      // Sincronización con SQL Server
      try {
        const clientSel = clients.find(c => c.id === formData.client_id)
        await fetch('/api/sync/master', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            entity: 'ORDER',
            data: {
              cliente_legacy_id: clientSel?.legacy_id ? parseInt(clientSel.legacy_id) : 0,
              total_venta: total,
              items: orderProducts.map(p => ({
                codigo_producto: p.codigo_producto,
                cantidad: p.cantidad,
                precio: p.precio_unitario,
              })),
            },
          }),
        })
      } catch (syncErr) {
        console.warn('Sincronización local omitida:', syncErr)
      }

      await fetchData()
      handleClearForm()
      setFormSuccess(true)
      setTimeout(() => setFormSuccess(false), 3000)
    } catch (err: any) {
      // Ya convertimos los errores de Supabase en Error estándar arriba con throw new Error(...)
      const msg = err?.message || String(err) || 'Error desconocido al crear el pedido'
      console.error('❌ handleSubmit catch:', msg, err)
      setFormError(msg)
    } finally {
      setFormLoading(false)
    }
  }

  // ── Editar pedido ─────────────────────────────────────────────────────────
  const handleEditOrder = (order: Order) => {
    setEditingOrder(order)
    setEditFormData({ estado: order.estado, tipo_pago: order.tipo_pago, observacion: order.observacion || '' })
    setShowEditModal(true)
    setEditError(null)
    setEditSuccess(false)
  }

  const handleUpdateOrder = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingOrder) return
    try {
      setEditLoading(true)
      const { error } = await supabase.from('pedidos')
        .update({ estado: editFormData.estado, tipo_pago: editFormData.tipo_pago, observacion: editFormData.observacion || null })
        .eq('id', editingOrder.id)
      if (error) throw error
      await fetchData()
      setEditSuccess(true)
      setTimeout(() => { setShowEditModal(false); setEditSuccess(false); setEditingOrder(null) }, 1500)
    } catch (err: any) {
      setEditError(err.message)
    } finally {
      setEditLoading(false)
    }
  }

  // ─── Render ───────────────|────────────────────────────────────────────────
  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 p-4 sm:p-6 lg:p-8">
      <div className="fixed inset-0 z-0 pointer-events-none opacity-30"
        style={{ backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 35px, rgba(16,185,129,0.2) 35px, rgba(16,185,129,0.2) 39px)` }} />

      <div className="relative z-10 space-y-6">

        {/* Header + Tabs */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl shadow-lg border-2 border-green-100">
            <div>
              <h1 className="text-3xl md:text-4xl font-black bg-gradient-to-r from-green-600 to-emerald-500 bg-clip-text text-transparent">
                Gestión de Pedidos
              </h1>
              <p className="text-gray-500 text-sm mt-1 font-medium">Ventas, empleados y reportes</p>
            </div>
            <button onClick={fetchData} className="flex items-center gap-2 px-4 py-2 border-2 border-green-200 rounded-xl text-green-700 font-bold hover:bg-green-50 transition-all">
              <RefreshCw className="w-4 h-4" /> Actualizar
            </button>
          </div>
          <nav className="flex flex-col sm:flex-row gap-3 bg-white p-3 rounded-3xl border-2 border-green-100 shadow-lg">
            {(['pedidos', 'empleados', 'reportes'] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`flex-1 flex items-center justify-center gap-2 px-6 py-4 rounded-2xl font-bold text-sm transition-all capitalize ${
                  activeTab === tab ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-lg' : 'text-gray-700 hover:bg-green-50'
                }`}>
                {tab === 'pedidos' ? <ShoppingCart className="w-5 h-5" /> : tab === 'empleados' ? <User className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
                {tab === 'pedidos' ? 'Pedidos' : tab === 'empleados' ? 'Por Empleado' : 'Reportes'}
              </button>
            ))}
          </nav>
        </div>

        {/* TAB PEDIDOS */}
        {activeTab === 'pedidos' && (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gradient-to-br from-green-500 to-emerald-600 p-6 rounded-3xl shadow-xl text-white">
                <div className="flex justify-between mb-4"><DollarSign className="w-7 h-7" /><span className="font-bold text-sm">VENTAS TOTALES</span></div>
                <h3 className="text-3xl font-black">{fmt(kpis.totalVentas)}</h3>
              </div>
              <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-6 rounded-3xl shadow-xl text-white">
                <div className="flex justify-between mb-4"><ShoppingCart className="w-7 h-7" /><span className="font-bold text-sm">PEDIDOS</span></div>
                <h3 className="text-3xl font-black">{kpis.countOrders}</h3>
                <p className="text-blue-100 text-sm">{products.length} productos disponibles</p>
              </div>
              <div className="bg-gradient-to-br from-orange-500 to-amber-600 p-6 rounded-3xl shadow-xl text-white">
                <div className="flex justify-between mb-4"><Clock className="w-7 h-7" /><span className="font-bold text-sm">PENDIENTES</span></div>
                <h3 className="text-3xl font-black">{kpis.countPendientes}</h3>
              </div>
            </div>

            {/* Formulario nuevo pedido */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
              <h2 className="text-xl font-bold mb-6 text-gray-800 flex items-center gap-2">
                <Plus className="w-6 h-6 text-green-600" /> Nuevo Pedido
              </h2>

              {formSuccess && (
                <div className="mb-4 p-4 bg-green-100 text-green-700 rounded-xl flex gap-2 font-semibold">
                  <CheckCircle2 className="w-5 h-5 flex-shrink-0" /> ¡Pedido creado exitosamente!
                </div>
              )}
              {formError && (
                <div className="mb-4 p-4 bg-red-100 text-red-700 rounded-xl flex gap-2 font-semibold">
                  <AlertTriangle className="w-5 h-5 flex-shrink-0" /> {formError}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Cliente + Tipo pago */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Cliente <span className="text-red-500">*</span></label>
                  <ClientSearch
                    clients={clients}
                    onSelect={c => setFormData({ ...formData, client_id: c?.id || '' })}
                    selectedId={formData.client_id}
                  />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Tipo de Pago</label>
                  <select className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-400 text-sm text-gray-900 bg-white"
                    value={formData.tipo_pago} onChange={e => setFormData({ ...formData, tipo_pago: e.target.value })}>
                    <option value="Contado">Contado</option>
                    <option value="Crédito">Crédito</option>
                  </select>
                  </div>
                </div>

                {/* Agregar productos */}
                <div className="p-5 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-300">
                  <h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2">
                    <Package className="w-5 h-5 text-green-600" /> Productos del Pedido
                  </h3>

                  {/* Buscador + cantidad + precio + agregar */}
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3 mb-4 items-end">
                    <div className="md:col-span-5">
                      <label className="block text-xs font-bold text-gray-600 mb-1">Producto</label>
                      <ProductSearch
                        products={products}
                        onSelect={p => {
                          setSelectedProduct(p)
                          if (p) setProductPrice(p.precio_base_venta.toString())
                          else setProductPrice('')
                        }}
                        selectedId={selectedProduct?.id || ''}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs font-bold text-gray-600 mb-1">Cantidad</label>
                      <input type="number" min="0.01" step="0.01"
                        className="w-full px-3 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-400 text-sm text-gray-900 bg-white"
                        value={productQuantity}
                        onChange={e => setProductQuantity(e.target.value)} />
                    </div>
                    <div className="md:col-span-3">
                      <label className="block text-xs font-bold text-gray-600 mb-1">
                        Precio unitario
                        {selectedProduct && (
                          <span className="ml-1 text-gray-400 font-normal">
                            (base: {fmt(selectedProduct.precio_base_venta)})
                          </span>
                        )}
                      </label>
                      <input type="number" min="0.01" step="0.01"
                        className="w-full px-3 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-400 text-sm text-gray-900 bg-white"
                        value={productPrice}
                        onChange={e => setProductPrice(e.target.value)}
                        placeholder={selectedProduct ? selectedProduct.precio_base_venta.toString() : '0.00'} />
                    </div>
                    <div className="md:col-span-2">
                      <button type="button" onClick={handleAddProduct}
                        className="w-full py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold flex items-center justify-center gap-1 transition-all text-sm">
                        <Plus className="w-4 h-4" /> Agregar
                      </button>
                    </div>
                  </div>

                  {/* Lista de productos agregados */}
                  {orderProducts.length === 0 ? (
                    <p className="text-center text-gray-400 py-6 text-sm italic">No has agregado productos aún</p>
                  ) : (
                    <>
                      <div className="space-y-2">
                        {orderProducts.map((p, i) => (
                          <div key={i} className="flex items-center gap-3 bg-white p-3 rounded-xl border border-gray-200 shadow-sm">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-gray-800 truncate">{p.nombre_producto}</p>
                              <p className="text-xs text-gray-500">{p.codigo_producto} · {p.unidad_seleccionada}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <input type="number" min="0.01" step="0.01"
                                value={p.cantidad}
                                onChange={e => handleUpdateQty(i, parseFloat(e.target.value))}
                                className="w-20 px-2 py-1.5 border rounded-lg text-xs text-center font-bold text-gray-900 bg-white" />
                              <span className="text-gray-400 text-xs">×</span>
                              <input type="number" min="0.01" step="0.01"
                                value={p.precio_unitario}
                                onChange={e => handleUpdatePrice(i, parseFloat(e.target.value))}
                                className="w-24 px-2 py-1.5 border rounded-lg text-xs text-center font-bold text-gray-900 bg-white" />
                              <span className="text-sm font-black text-green-700 w-24 text-right">{fmt(p.subtotal)}</span>
                            </div>
                            <button type="button" onClick={() => setOrderProducts(orderProducts.filter((_, j) => j !== i))}
                              className="text-red-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition-all">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                      <div className="flex justify-between items-center mt-4 pt-4 border-t border-gray-200">
                        <span className="font-bold text-gray-700 flex items-center gap-2">
                          <span className="text-sm bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-black">{orderProducts.length}</span>
                          ítems
                        </span>
                        <span className="font-black text-2xl text-green-700">{fmt(calculateTotal())}</span>
                      </div>
                    </>
                  )}
                </div>

                {/* Observaciones */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Observaciones</label>
                  <textarea className="w-full p-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-400 text-sm text-gray-900 bg-white" rows={2}
                    value={formData.observacion} onChange={e => setFormData({ ...formData, observacion: e.target.value })} />
                </div>

                <div className="flex gap-4">
                  <button type="button" onClick={handleClearForm}
                    className="px-6 py-3 border-2 border-gray-300 rounded-xl font-bold text-gray-600 hover:bg-gray-100 transition-all">
                    Limpiar
                  </button>
                  <button type="submit" disabled={formLoading}
                    className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white py-3 rounded-xl font-bold disabled:opacity-50 flex justify-center items-center gap-2 transition-all">
                    {formLoading && <Loader2 className="animate-spin w-4 h-4" />}
                    {formLoading ? 'Guardando...' : 'Crear Pedido'}
                  </button>
                </div>
              </form>
            </div>

            {/* Tabla pedidos */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
              <div className="p-4 bg-gray-50 border-b flex justify-between items-center">
                <h3 className="font-bold text-gray-700">Pedidos Recientes</h3>
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 text-gray-400 w-4 h-4" />
                  <input type="text" placeholder="Buscar..." className="pl-9 pr-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                    value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                </div>
              </div>

              {loading ? (
                <div className="flex justify-center items-center py-16">
                  <Loader2 className="w-8 h-8 text-green-600 animate-spin" />
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {filteredOrders.map(o => (
                    <div key={o.id}>
                      {/* Fila principal */}
                      <div className="grid grid-cols-12 gap-2 p-4 hover:bg-gray-50 transition-colors items-center text-sm">
                        <div className="col-span-1 font-black text-gray-800">#{o.numero_documento}</div>
                        <div className="col-span-2 text-gray-500">{format(new Date(o.fecha_pedido), 'dd/MM/yy HH:mm')}</div>
                        <div className="col-span-3 font-semibold text-gray-800 truncate">{o.clients?.name}</div>
                        <div className="col-span-2 text-gray-500 truncate">{o.employees?.full_name || '-'}</div>
                        <div className="col-span-2 font-black text-green-700 text-right">{fmt(o.total_venta)}</div>
                        <div className="col-span-1 text-center"><StatusBadge status={o.estado} /></div>
                        <div className="col-span-1 flex items-center justify-end gap-1">
                          <button onClick={() => handleEditOrder(o)} className="text-blue-600 hover:bg-blue-50 p-1.5 rounded" title="Editar">
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => loadOrderDetail(o.id)}
                            className={`p-1.5 rounded transition-colors ${expandedOrderId === o.id ? 'text-green-600 bg-green-50' : 'text-gray-400 hover:bg-gray-100'}`}
                            title="Ver detalle">
                            {loadingDetails && expandedOrderId !== o.id
                              ? <Loader2 className="w-4 h-4 animate-spin" />
                              : expandedOrderId === o.id
                                ? <ChevronUp className="w-4 h-4" />
                                : <ChevronDown className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      {/* Detalle expandible */}
                      {expandedOrderId === o.id && orderDetails[o.id] && (
                        <div className="bg-green-50/50 border-t border-green-100 px-6 py-4">
                          <p className="text-xs font-black text-gray-500 uppercase tracking-wider mb-3">Detalle del pedido</p>
                          {orderDetails[o.id].length === 0 ? (
                            <p className="text-sm text-gray-400 italic">Sin detalles registrados</p>
                          ) : (
                            <div className="space-y-2">
                              {orderDetails[o.id].map(d => (
                                <div key={d.id} className="flex items-center justify-between bg-white px-4 py-2.5 rounded-xl border border-gray-200 text-sm">
                                  <div>
                                    <span className="font-bold text-gray-800">{d.productos?.nombre_producto || 'Producto eliminado'}</span>
                                    <span className="text-xs text-gray-500 ml-2">{d.productos?.codigo_producto}</span>
                                  </div>
                                  <div className="flex items-center gap-6 text-right">
                                    <span className="text-gray-600">{d.cantidad} {d.unidad_seleccionada}</span>
                                    <span className="text-gray-600">{fmt(d.precio_unitario)}</span>
                                    <span className="font-black text-green-700">{fmt(d.subtotal)}</span>
                                  </div>
                                </div>
                              ))}
                              <div className="flex justify-between items-center pt-2 px-4">
                                <span className="text-xs text-gray-500">{orderDetails[o.id].length} producto{orderDetails[o.id].length !== 1 ? 's' : ''}</span>
                                <span className="font-black text-green-700">{fmt(o.total_venta)}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                  {filteredOrders.length === 0 && (
                    <p className="text-center text-gray-400 py-12 text-sm">No se encontraron pedidos</p>
                  )}
                </div>
              )}
            </div>
          </>
        )}

        {activeTab === 'empleados' && <EmployeesTab />}
        {activeTab === 'reportes' && <ReportsTab />}

        {/* Modal editar pedido */}
        {showEditModal && editingOrder && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold">Editar Pedido #{editingOrder.numero_documento}</h3>
                <button onClick={() => { setShowEditModal(false); setEditingOrder(null) }}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="mb-4 p-3 bg-gray-50 rounded-xl text-sm space-y-1">
                <p className="text-gray-600"><span className="font-bold">Cliente:</span> {editingOrder.clients?.name}</p>
                <p className="text-gray-600"><span className="font-bold">Fecha:</span> {format(new Date(editingOrder.fecha_pedido), 'dd/MM/yyyy HH:mm', { locale: es })}</p>
                <p className="text-gray-600"><span className="font-bold">Total:</span> <span className="text-green-700 font-black">{fmt(editingOrder.total_venta)}</span></p>
              </div>

              {editSuccess && (
                <div className="mb-4 p-3 bg-green-100 text-green-700 rounded-lg flex gap-2 font-semibold">
                  <CheckCircle2 className="w-5 h-5" /> ¡Actualizado correctamente!
                </div>
              )}
              {editError && (
                <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg flex gap-2 font-semibold">
                  <AlertTriangle className="w-5 h-5" /> {editError}
                </div>
              )}

              <form onSubmit={handleUpdateOrder} className="space-y-4">
                <div>
                  <label className="font-bold text-sm text-gray-700 mb-1 block">Estado</label>
                  <select className="w-full p-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-400 text-gray-900 bg-white"
                    value={editFormData.estado} onChange={e => setEditFormData({ ...editFormData, estado: e.target.value })}>
                    <option value="Pendiente">Pendiente</option>
                    <option value="Aprobado">Aprobado</option>
                    <option value="Entregado">Entregado</option>
                    <option value="Anulado">Anulado</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-sm text-gray-700 mb-1 block">Tipo de Pago</label>
                  <select className="w-full p-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-400 text-gray-900 bg-white"
                    value={editFormData.tipo_pago} onChange={e => setEditFormData({ ...editFormData, tipo_pago: e.target.value })}>
                    <option value="Contado">Contado</option>
                    <option value="Crédito">Crédito</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-sm text-gray-700 mb-1 block">Observación</label>
                  <textarea className="w-full p-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-400 text-gray-900 bg-white" rows={3}
                    value={editFormData.observacion} onChange={e => setEditFormData({ ...editFormData, observacion: e.target.value })} />
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => { setShowEditModal(false); setEditingOrder(null) }}
                    className="flex-1 py-3 border-2 border-gray-200 rounded-xl font-bold text-gray-600 hover:bg-gray-50 transition-all">
                    Cancelar
                  </button>
                  <button type="submit" disabled={editLoading}
                    className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold flex justify-center items-center gap-2 transition-all disabled:opacity-50">
                    {editLoading && <Loader2 className="animate-spin w-4 h-4" />}
                    <Save className="w-4 h-4" /> Guardar Cambios
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
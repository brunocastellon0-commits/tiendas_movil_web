'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/utils/supabase/client'
import { 
  Search, 
  Filter, 
  ShoppingCart, 
  Calendar, 
  MapPin, 
  User, 
  ChevronRight, 
  X, 
  FileText, 
  CheckCircle2, 
  XCircle, 
  Clock,
  DollarSign,
  Plus,
  Trash2,
  Save,
  Loader2,
  AlertTriangle
} from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import Link from 'next/link'

// --- 1. Tipos TypeScript (Basado en tus imágenes DB) ---

type Product = {
  id: string
  codigo_producto: string
  nombre_producto: string
  precio_base_venta: number
  unidad_base_venta: string
}

type Client = {
  id: string
  name: string
  legacy_id: string | null
}

type OrderProduct = {
  producto_id: string
  nombre_producto: string
  cantidad: number
  precio_unitario: number
  unidad_seleccionada: string
  subtotal: number
}

type OrderDetail = {
  id: string
  cantidad: number
  precio_unitario: number
  subtotal: number
  unidad_seleccionada: string
  producto: {
    nombre_producto: string
    codigo_producto: string
  }
}

type Order = {
  id: string
  numero_documento: number
  fecha_pedido: string
  total_venta: number
  estado: string // 'Pendiente' | 'Entregado' | 'Cancelado'
  tipo_pago: string
  observacion: string | null
  ubicacion_venta: any // GeoJSON
  clients: {
    name: string
    legacy_id: string | null
  } | null
  employees: {
    full_name: string
  } | null
}

// --- 2. Componente de Estado (Badge) ---
const StatusBadge = ({ status }: { status: string }) => {
  const styles: any = {
    'Pendiente': 'bg-yellow-100 text-yellow-800 border-yellow-200',
    'Aprobado': 'bg-blue-100 text-blue-800 border-blue-200',
    'Entregado': 'bg-green-100 text-green-800 border-green-200',
    'Anulado': 'bg-red-100 text-red-800 border-red-200'
  }
  
  const icons: any = {
    'Pendiente': Clock,
    'Aprobado': CheckCircle2,
    'Entregado': CheckCircle2,
    'Anulado': XCircle
  }

  const Icon = icons[status] || Clock
  const style = styles[status] || 'bg-gray-100 text-gray-800 border-gray-200'

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${style}`}>
      <Icon className="w-3 h-3 mr-1" />
      {status}
    </span>
  )
}

// --- 3. Página Principal ---
export default function OrdersPage() {
  const supabase = createClient()
  
  // Tab State
  const [activeTab, setActiveTab] = useState<'pedidos' | 'empleados' | 'reportes'>('pedidos')
  
  // Estados de datos
  const [orders, setOrders] = useState<Order[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  
  // Estados del formulario
  const [formData, setFormData] = useState({
    client_id: '',
    tipo_pago: 'Contado',
    observacion: '',
    estado: 'Pendiente'
  })
  const [orderProducts, setOrderProducts] = useState<OrderProduct[]>([])
  const [selectedProductId, setSelectedProductId] = useState('')
  const [productQuantity, setProductQuantity] = useState('1')
  const [formLoading, setFormLoading] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [formSuccess, setFormSuccess] = useState(false)

  // Carga Inicial
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        console.log('🔍 Fetching orders...')
        
        // Cargar pedidos
        const { data: ordersData, error: ordersError } = await supabase
          .from('pedidos')
          .select(`
            *,
            clients:clients_id (name, legacy_id),
            employees:empleado_id (full_name)
          `)
          .order('fecha_pedido', { ascending: false })

        if (ordersError) throw ordersError
        if (ordersData) setOrders(ordersData as any)

        // Cargar clientes
        const { data: clientsData, error: clientsError } = await supabase
          .from('clients')
          .select('id, name, legacy_id')
          .order('name')

        if (clientsError) throw clientsError
        if (clientsData) setClients(clientsData)

        // Cargar productos
        const { data: productsData, error: productsError } = await supabase
          .from('productos')
          .select('id, codigo_producto, nombre_producto, precio_base_venta, unidad_base_venta')
          .eq('estado', 'Activo')
          .order('nombre_producto')

        if (productsError) throw productsError
        if (productsData) setProducts(productsData)

      } catch (error: any) {
        console.error('❌ Error cargando datos:', error)
      } finally {
        setLoading(false)
      }
    }
    
    if (activeTab === 'pedidos') {
      fetchData()
    }
  }, [activeTab])

  // Filtros y KPIs
  const filteredOrders = useMemo(() => {
    return orders.filter(o => 
      o.clients?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.numero_documento.toString().includes(searchTerm) ||
      o.employees?.full_name.toLowerCase().includes(searchTerm.toLowerCase())
    )
  }, [orders, searchTerm])

  const kpis = useMemo(() => {
    const totalVentas = orders.reduce((sum, o) => sum + (o.estado !== 'Anulado' ? o.total_venta : 0), 0)
    const countPendientes = orders.filter(o => o.estado === 'Pendiente').length
    const countOrders = orders.length
    
    return { totalVentas, countPendientes, countOrders }
  }, [orders])

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('es-BO', { style: 'currency', currency: 'BOB' }).format(val)

  // Funciones del formulario
  const handleAddProduct = () => {
    if (!selectedProductId || !productQuantity) {
      setFormError('Selecciona un producto y cantidad')
      return
    }

    const product = products.find(p => p.id === selectedProductId)
    if (!product) return

    const cantidad = parseFloat(productQuantity)
    if (cantidad <= 0) {
      setFormError('La cantidad debe ser mayor a 0')
      return
    }

    const newProduct: OrderProduct = {
      producto_id: product.id,
      nombre_producto: product.nombre_producto,
      cantidad,
      precio_unitario: product.precio_base_venta,
      unidad_seleccionada: product.unidad_base_venta,
      subtotal: cantidad * product.precio_base_venta
    }

    setOrderProducts([...orderProducts, newProduct])
    setSelectedProductId('')
    setProductQuantity('1')
    setFormError(null)
  }

  const handleRemoveProduct = (index: number) => {
    setOrderProducts(orderProducts.filter((_, i) => i !== index))
  }

  const calculateTotal = () => {
    return orderProducts.reduce((sum, p) => sum + p.subtotal, 0)
  }

  const handleClearForm = () => {
    setFormData({
      client_id: '',
      tipo_pago: 'Contado',
      observacion: '',
      estado: 'Pendiente'
    })
    setOrderProducts([])
    setSelectedProductId('')
    setProductQuantity('1')
    setFormError(null)
    setFormSuccess(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.client_id) {
      setFormError('Selecciona un cliente')
      return
    }

    if (orderProducts.length === 0) {
      setFormError('Agrega al menos un producto')
      return
    }

    try {
      setFormLoading(true)
      setFormError(null)

      const total = calculateTotal()

      // 1. Crear el pedido
      const { data: orderData, error: orderError } = await supabase
        .from('pedidos')
        .insert({
          clients_id: formData.client_id,
          tipo_pago: formData.tipo_pago,
          observacion: formData.observacion || null,
          estado: formData.estado,
          total_venta: total,
          fecha_pedido: new Date().toISOString()
        })
        .select()
        .single()

      if (orderError) throw orderError

      // 2. Crear los detalles del pedido
      const detalles = orderProducts.map(p => ({
        pedido_id: orderData.id,
        producto_id: p.producto_id,
        cantidad: p.cantidad,
        precio_unitario: p.precio_unitario,
        unidad_seleccionada: p.unidad_seleccionada,
        subtotal: p.subtotal,
        factor_aplicado: 1
      }))

      const { error: detallesError } = await supabase
        .from('detalle_pedido')
        .insert(detalles)

      if (detallesError) throw detallesError

      // 3. Recargar pedidos
      const { data: ordersData } = await supabase
        .from('pedidos')
        .select(`
          *,
          clients:clients_id (name, legacy_id),
          employees:empleado_id (full_name)
        `)
        .order('fecha_pedido', { ascending: false })

      if (ordersData) setOrders(ordersData as any)

      // 4. Limpiar formulario y mostrar éxito
      handleClearForm()
      setFormSuccess(true)
      setTimeout(() => setFormSuccess(false), 3000)

    } catch (error: any) {
      console.error('Error creating order:', error)
      setFormError(error.message || 'Error al crear el pedido')
    } finally {
      setFormLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6 space-y-8">
      
      {/* HEADER */}
      <div className="flex flex-col gap-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
              Gestión de Pedidos
            </h1>
            <p className="text-gray-600 text-sm mt-2">Controla ventas, empleados y reportes</p>
          </div>
        </div>

        {/* TABS NAVIGATION */}
        <nav className="flex gap-2 bg-white p-2 rounded-xl border-2 border-gray-200 shadow-sm">
          <button
            onClick={() => setActiveTab('pedidos')}
            className={`flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition-all ${
              activeTab === 'pedidos'
                ? 'bg-green-600 text-white shadow-lg shadow-green-900/20'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <ShoppingCart className="w-4 h-4" />
            Pedidos
          </button>
          <button
            onClick={() => setActiveTab('empleados')}
            className={`flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition-all ${
              activeTab === 'empleados'
                ? 'bg-green-600 text-white shadow-lg shadow-green-900/20'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <User className="w-4 h-4" />
            Por Empleado
          </button>
          <button
            onClick={() => setActiveTab('reportes')}
            className={`flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition-all ${
              activeTab === 'reportes'
                ? 'bg-green-600 text-white shadow-lg shadow-green-900/20'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <FileText className="w-4 h-4" />
            Reportes
          </button>
        </nav>
      </div>

      {/* TAB: PEDIDOS */}
      {activeTab === 'pedidos' && (
        <>
          {/* KPIS */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* KPI 1: Ventas Totales */}
            <div className="bg-gradient-to-br from-green-500 to-green-600 p-6 rounded-2xl shadow-lg text-white">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl">
                  <DollarSign className="w-6 h-6" />
                </div>
                <span className="text-xs font-semibold bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full">
                  VENTAS TOTALES
                </span>
              </div>
              <h3 className="text-3xl font-bold mb-1">{formatCurrency(kpis.totalVentas)}</h3>
              <p className="text-sm text-green-100">Ingresos del período</p>
            </div>

            {/* KPI 2: Total Pedidos */}
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-6 rounded-2xl shadow-lg text-white">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl">
                  <FileText className="w-6 h-6" />
                </div>
                <span className="text-xs font-semibold bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full">
                  PEDIDOS
                </span>
              </div>
              <h3 className="text-3xl font-bold mb-1">{kpis.countOrders}</h3>
              <p className="text-sm text-blue-100">Registrados en sistema</p>
            </div>

            {/* KPI 3: Pendientes */}
            <div className="bg-gradient-to-br from-orange-500 to-orange-600 p-6 rounded-2xl shadow-lg text-white">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl">
                  <Clock className="w-4 h-4" />
                </div>
                <span className="text-xs font-semibold bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full">
                  PENDIENTES
                </span>
              </div>
              <h3 className="text-3xl font-bold mb-1">{kpis.countPendientes}</h3>
              <p className="text-sm text-orange-100">Por despachar</p>
            </div>
          </div>

          {/* FORMULARIO DE NUEVO PEDIDO */}
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200">
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 px-8 py-6 border-b border-gray-200 rounded-t-2xl">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-green-600 rounded-xl shadow-lg shadow-green-900/20">
                  <ShoppingCart className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Nuevo Pedido</h2>
                  <p className="text-sm text-gray-600 mt-0.5">Completa los datos para crear un pedido</p>
                </div>
              </div>
            </div>

            <div className="p-8">
              {formError && (
                <div className="mb-6 flex items-start gap-3 bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl">
                  <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">Error</p>
                    <p className="text-sm mt-0.5">{formError}</p>
                  </div>
                </div>
              )}

              {formSuccess && (
                <div className="mb-6 flex items-start gap-3 bg-green-50 border border-green-200 text-green-700 p-4 rounded-xl">
                  <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">¡Pedido creado exitosamente!</p>
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Cliente y Tipo de Pago */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Cliente *
                    </label>
                    <select
                      value={formData.client_id}
                      onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                      required
                    >
                      <option value="">Selecciona un cliente</option>
                      {clients.map(client => (
                        <option key={client.id} value={client.id}>
                          {client.name} {client.legacy_id && `(${client.legacy_id})`}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Tipo de Pago
                    </label>
                    <select
                      value={formData.tipo_pago}
                      onChange={(e) => setFormData({ ...formData, tipo_pago: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                    >
                      <option value="Contado">Contado</option>
                      <option value="Crédito">Crédito</option>
                    </select>
                  </div>
                </div>

                {/* Agregar Productos */}
                <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 bg-gray-50">
                  <h3 className="text-sm font-bold text-gray-700 mb-4">Agregar Productos</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-2">
                      <select
                        value={selectedProductId}
                        onChange={(e) => setSelectedProductId(e.target.value)}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                      >
                        <option value="">Selecciona un producto</option>
                        {products.map(product => (
                          <option key={product.id} value={product.id}>
                            {product.nombre_producto} - {formatCurrency(product.precio_base_venta)} / {product.unidad_base_venta}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={productQuantity}
                        onChange={(e) => setProductQuantity(e.target.value)}
                        placeholder="Cantidad"
                        className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                      />
                     <button
                        type="button"
                        onClick={handleAddProduct}
                        className="px-6 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-all flex items-center gap-2 font-semibold shadow-lg shadow-green-900/20"
                      >
                        <Plus className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  {/* Lista de Productos Agregados */}
                  {orderProducts.length > 0 && (
                    <div className="mt-6 space-y-3">
                      <h4 className="text-sm font-bold text-gray-700">Productos en el pedido:</h4>
                      {orderProducts.map((product, index) => (
                        <div key={index} className="flex items-center justify-between bg-white p-4 rounded-xl border border-gray-200">
                          <div className="flex-1">
                            <p className="font-semibold text-gray-900">{product.nombre_producto}</p>
                            <p className="text-sm text-gray-600">
                              {product.cantidad} {product.unidad_seleccionada} × {formatCurrency(product.precio_unitario)}
                            </p>
                          </div>
                          <div className="flex items-center gap-4">
                            <p className="font-bold text-gray-900">{formatCurrency(product.subtotal)}</p>
                            <button
                              type="button"
                              onClick={() => handleRemoveProduct(index)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-all"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          </div>
                        </div>
                      ))}
                      <div className="flex justify-between items-center p-4 bg-green-50 rounded-xl border-2 border-green-200">
                        <span className="font-bold text-gray-900">Total:</span>
                        <span className="text-2xl font-bold text-green-700">{formatCurrency(calculateTotal())}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Observaciones */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Observaciones
                  </label>
                  <textarea
                    value={formData.observacion}
                    onChange={(e) => setFormData({ ...formData, observacion: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all resize-none"
                    placeholder="Notas adicionales del pedido..."
                  />
                </div>

                {/* Botones */}
                <div className="flex gap-4 pt-4">
                  <button
                    type="button"
                    onClick={handleClearForm}
                    className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 font-semibold transition-all"
                    disabled={formLoading}
                  >
                    <X className="w-5 h-5 inline mr-2" />
                    Limpiar
                  </button>
                  <button
                    type="submit"
                    disabled={formLoading || orderProducts.length === 0}
                    className="flex-1 px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl hover:from-green-700 hover:to-emerald-700 font-semibold shadow-lg shadow-green-900/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {formLoading ? (
                      <>
                        <Loader2 className="w-5 h-5 inline mr-2 animate-spin" />
                        Creando...
                      </>
                    ) : (
                      <>
                        <Save className="w-5 h-5 inline mr-2" />
                        Crear Pedido
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* TABLA DE PEDIDOS */}
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
            
            {/* Toolbar */}
            <div className="bg-gradient-to-r from-gray-50 to-slate-50 px-6 py-5 border-b border-gray-200">
              <div className="flex items-center gap-4">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input 
                    type="text" 
                    placeholder="Buscar por Nro, Cliente o Vendedor..."
                    className="w-full pl-12 pr-4 py-3 text-sm border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-gray-600">Mostrando</span>
                  <span className="font-bold text-green-600">{filteredOrders.length}</span>
                  <span className="text-gray-600">pedidos</span>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gradient-to-r from-gray-50 to-slate-50 border-b-2 border-gray-200">
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">N° Pedido</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Fecha</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Cliente</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Vendedor</th>
                    <th className="px-6 py-4 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">Total</th>
                    <th className="px-6 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-16 text-center">
                        <div className="flex flex-col items-center justify-center gap-3">
                          <div className="w-10 h-10 border-4 border-green-200 border-t-green-600 rounded-full animate-spin"></div>
                          <p className="text-gray-600 font-medium">Cargando pedidos...</p>
                        </div>
                      </td>
                    </tr>
                  ) : filteredOrders.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-16 text-center text-gray-500">
                        No se encontraron pedidos
                      </td>
                    </tr>
                  ) : (
                    filteredOrders.map((order) => (
                      <tr key={order.id} className="hover:bg-gradient-to-r hover:from-green-50/30 hover:to-emerald-50/30 transition-all">
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-2">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-100 to-emerald-100 flex items-center justify-center text-green-700 font-bold text-sm shadow-sm">
                              #
                            </div>
                            <span className="font-mono text-sm font-bold text-gray-900">{order.numero_documento}</span>
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Calendar className="w-4 h-4 text-gray-400" />
                            <span className="font-medium">{format(new Date(order.fecha_pedido), 'dd MMM yyyy', { locale: es })}</span>
                          </div>
                          <div className="text-xs text-gray-400 mt-0.5 ml-6">
                            {format(new Date(order.fecha_pedido), 'HH:mm', { locale: es })}
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <div className="text-sm font-bold text-gray-900">{order.clients?.name || 'Cliente Casual'}</div>
                          {order.clients?.legacy_id && (
                            <div className="text-xs text-gray-400 mt-0.5">Cod: {order.clients.legacy_id}</div>
                          )}
                        </td>
                        <td className="px-6 py-5">
                          <div className="text-sm text-gray-600 font-medium">{order.employees?.full_name || 'Admin'}</div>
                        </td>
                        <td className="px-6 py-5 text-right">
                          <div className="text-base font-bold text-gray-900">{formatCurrency(order.total_venta)}</div>
                        </td>
                        <td className="px-6 py-5 text-center">
                          <StatusBadge status={order.estado} />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            
            {/* Footer */}
            <div className="bg-gradient-to-r from-gray-50 to-slate-50 px-6 py-4 border-t-2 border-gray-200 flex items-center justify-between">
              <span className="text-sm text-gray-600">
                Página 1 de 1
              </span>
              <div className="flex gap-2">
                <button className="px-4 py-2 text-sm border-2 border-gray-200 rounded-lg bg-white hover:bg-gray-50 disabled:opacity-50 font-medium transition-all" disabled>
                  Anterior
                </button>
                <button className="px-4 py-2 text-sm border-2 border-gray-200 rounded-lg bg-white hover:bg-gray-50 disabled:opacity-50 font-medium transition-all" disabled>
                  Siguiente
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* TAB: POR EMPLEADO */}
      {activeTab === 'empleados' && (
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-12 text-center">
          <User className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-gray-900 mb-2">Vista Por Empleado</h3>
          <p className="text-gray-500">Aquí podrás ver el detalle de pedidos por cada vendedor</p>
          <p className="text-sm text-gray-400 mt-2">Próximamente...</p>
        </div>
      )}

      {/* TAB: REPORTES */}
      {activeTab === 'reportes' && (
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-12 text-center">
          <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-gray-900 mb-2">Reportes y Análisis</h3>
          <p className="text-gray-500">Gráficos y estadísticas de ventas</p>
          <p className="text-sm text-gray-400 mt-2">Próximamente...</p>
        </div>
      )}
    </div>
  )
}
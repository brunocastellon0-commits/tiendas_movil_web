'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/utils/supabase/client'
import { 
  Search, 
  ShoppingCart, 
  Calendar, 
  User, 
  CheckCircle2, 
  XCircle, 
  Clock,
  DollarSign,
  Plus,
  Trash2,
  Save,
  Loader2,
  AlertTriangle,
  Edit,
  X
} from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import EmployeesTab from './components/EmployeesTab'
import ReportsTab from './components/ReportsTab'

// --- Tipos TypeScript ---

type Product = {
  id: string
  codigo_producto: string
  nombre_producto: string
  precio_base_venta: number
  unidad_base_venta: string
  // Necesitamos el legacy_id (idprd de SQL) o usaremos el codigo para buscarlo
  legacy_id?: number 
}

type Client = {
  id: string
  name: string
  legacy_id: string | null // El ID del cliente en SQL Server (tbcli)
}

type OrderProduct = {
  producto_id: string
  codigo_producto: string // Agregado para sincronización
  nombre_producto: string
  cantidad: number
  precio_unitario: number
  unidad_seleccionada: string
  subtotal: number
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
  clients: {
    name: string
    legacy_id: string | null
  } | null
  employees: {
    full_name: string
  } | null
}

// --- Componente de Estado (Badge) ---
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

// --- Página Principal ---
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
  
  // Estados para edición
  const [editingOrder, setEditingOrder] = useState<Order | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editFormData, setEditFormData] = useState({
    estado: '',
    tipo_pago: '',
    observacion: ''
  })
  const [editLoading, setEditLoading] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const [editSuccess, setEditSuccess] = useState(false)

  // Carga Inicial
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        
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
          .eq('estado', 'Activo') // Asumiendo que 'estado' es string 'Activo'/'Inactivo'
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
      codigo_producto: product.codigo_producto,
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

  /**
   * MANEJO DEL ENVÍO DE PEDIDO (Sync Logic)
   */
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

      // Obtener el empleado del usuario autenticado
      const { data: { user } } = await supabase.auth.getUser()
      
      const { data: employeeData } = await supabase
        .from('employees')
        .select('id, full_name')
        .eq('email', user?.email)
        .single()

      // 1. Guardar en Supabase (Cabecera)
      const { data: orderData, error: orderError } = await supabase
        .from('pedidos')
        .insert({
          clients_id: formData.client_id,
          tipo_pago: formData.tipo_pago,
          observacion: formData.observacion || null,
          estado: formData.estado,
          total_venta: total,
          fecha_pedido: new Date().toISOString(),
          empleado_id: employeeData?.id || null
        })
        .select()
        .single()

      if (orderError) throw orderError

      // 2. Guardar en Supabase (Detalles)
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

      // 3. SINCRONIZACIÓN CON SQL SERVER LOCAL (El Puente)
      try {
        const clientSelected = clients.find(c => c.id === formData.client_id);
        
        const syncPayload = {
          entity: 'ORDER',
          data: {
            // Datos para SQL Server
            cliente_legacy_id: clientSelected?.legacy_id ? parseInt(clientSelected.legacy_id) : 0,
            total_venta: total,
            // Enviamos los detalles para que el backend los inserte en tbivven
            items: orderProducts.map(p => ({
                codigo_producto: p.codigo_producto,
                cantidad: p.cantidad,
                precio: p.precio_unitario
            }))
          }
        };

        const syncResponse = await fetch('/api/sync/master', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(syncPayload)
        });

        if (!syncResponse.ok) {
          console.warn('Pedido guardado en web, pendiente en local.');
        } else {
          console.log('✅ Pedido sincronizado con Adminisis');
        }

      } catch (syncError) {
        console.error('Error de red al sincronizar pedido:', syncError);
      }

      // 4. Finalización y Recarga
      const { data: updatedOrders } = await supabase
        .from('pedidos')
        .select(`
          *,
          clients:clients_id (name, legacy_id),
          employees:empleado_id (full_name)
        `)
        .order('fecha_pedido', { ascending: false })

      if (updatedOrders) setOrders(updatedOrders as any)

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

  // --- Funciones para Editar (Solo local web por ahora) ---
  const handleEditOrder = (order: Order) => {
    setEditingOrder(order)
    setEditFormData({
      estado: order.estado,
      tipo_pago: order.tipo_pago,
      observacion: order.observacion || ''
    })
    setShowEditModal(true)
    setEditError(null)
    setEditSuccess(false)
  }

  const handleUpdateOrder = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingOrder) return

    try {
      setEditLoading(true)
      const { error: updateError } = await supabase
        .from('pedidos')
        .update({
          estado: editFormData.estado,
          tipo_pago: editFormData.tipo_pago,
          observacion: editFormData.observacion || null
        })
        .eq('id', editingOrder.id)

      if (updateError) throw updateError

      // Recargar
      const { data: ordersData } = await supabase
        .from('pedidos')
        .select(`
          *,
          clients:clients_id (name, legacy_id),
          employees:empleado_id (full_name)
        `)
        .order('fecha_pedido', { ascending: false })

      if (ordersData) setOrders(ordersData as any)

      setEditSuccess(true)
      setTimeout(() => {
        setShowEditModal(false)
        setEditSuccess(false)
        setEditingOrder(null)
      }, 1500)

    } catch (error: any) {
      setEditError(error.message)
    } finally {
      setEditLoading(false)
    }
  }

  const handleCloseEditModal = () => {
    setShowEditModal(false)
    setEditingOrder(null)
    setEditError(null)
    setEditSuccess(false)
  }

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 p-4 sm:p-6 lg:p-8">
      
      {/* Fondos decorativos */}
      <div className="fixed inset-0 z-0 pointer-events-none opacity-35" 
           style={{ backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 35px, rgba(16, 185, 129, 0.25) 35px, rgba(16, 185, 129, 0.25) 39px)` }}>
      </div>
      <div className="fixed inset-0 z-0 bg-gradient-to-b from-white/40 via-transparent to-transparent pointer-events-none"></div>
      
      <div className="relative z-10 space-y-6">
      
      {/* HEADER */}
      <div className="flex flex-col gap-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl shadow-lg border-2 border-green-100">
          <div>
            <h1 className="text-3xl md:text-4xl font-black bg-gradient-to-r from-green-600 via-green-500 to-emerald-500 bg-clip-text text-transparent">
              Gestión de Pedidos
            </h1>
            <p className="text-gray-600 text-sm mt-2 font-medium">Controla ventas, empleados y reportes</p>
          </div>
        </div>

        {/* TABS */}
        <nav className="flex flex-col sm:flex-row gap-3 bg-white p-3 rounded-3xl border-2 border-green-100 shadow-2xl">
          <button onClick={() => setActiveTab('pedidos')}
            className={`flex-1 flex items-center justify-center gap-3 px-6 py-4 rounded-2xl font-bold text-sm transition-all ${activeTab === 'pedidos' ? 'bg-gradient-to-r from-green-500 via-green-600 to-emerald-600 text-white shadow-xl' : 'text-gray-700 hover:bg-green-50'}`}>
            <ShoppingCart className="w-5 h-5" /> Pedidos
          </button>
          <button onClick={() => setActiveTab('empleados')}
            className={`flex-1 flex items-center justify-center gap-3 px-6 py-4 rounded-2xl font-bold text-sm transition-all ${activeTab === 'empleados' ? 'bg-gradient-to-r from-green-500 via-green-600 to-emerald-600 text-white shadow-xl' : 'text-gray-700 hover:bg-green-50'}`}>
            <User className="w-5 h-5" /> Por Empleado
          </button>
          <button onClick={() => setActiveTab('reportes')}
            className={`flex-1 flex items-center justify-center gap-3 px-6 py-4 rounded-2xl font-bold text-sm transition-all ${activeTab === 'reportes' ? 'bg-gradient-to-r from-green-500 via-green-600 to-emerald-600 text-white shadow-xl' : 'text-gray-700 hover:bg-green-50'}`}>
            <Clock className="w-5 h-5" /> Reportes
          </button>
        </nav>
      </div>

      {/* CONTENIDO TAB PEDIDOS */}
      {activeTab === 'pedidos' && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6">
            <div className="bg-gradient-to-br from-green-500 to-emerald-600 p-6 rounded-3xl shadow-xl text-white">
               <div className="flex justify-between mb-4"><DollarSign className="w-7 h-7"/> <span className="font-bold">VENTAS</span></div>
               <h3 className="text-3xl font-black">{formatCurrency(kpis.totalVentas)}</h3>
            </div>
            <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-6 rounded-3xl shadow-xl text-white">
               <div className="flex justify-between mb-4"><ShoppingCart className="w-7 h-7"/> <span className="font-bold">PEDIDOS</span></div>
               <h3 className="text-3xl font-black">{kpis.countOrders}</h3>
            </div>
            <div className="bg-gradient-to-br from-orange-500 to-amber-600 p-6 rounded-3xl shadow-xl text-white">
               <div className="flex justify-between mb-4"><Clock className="w-7 h-7"/> <span className="font-bold">PENDIENTES</span></div>
               <h3 className="text-3xl font-black">{kpis.countPendientes}</h3>
            </div>
          </div>

          {/* FORMULARIO NUEVO PEDIDO */}
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8">
             <h2 className="text-xl font-bold mb-6 text-gray-800 flex items-center gap-2">
                <Plus className="w-6 h-6 text-green-600"/> Nuevo Pedido
             </h2>
             
             {formSuccess && <div className="mb-4 p-4 bg-green-100 text-green-700 rounded-xl flex gap-2"><CheckCircle2/> Pedido creado exitosamente</div>}
             {formError && <div className="mb-4 p-4 bg-red-100 text-red-700 rounded-xl flex gap-2"><AlertTriangle/> {formError}</div>}

             <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">Cliente</label>
                      <select className="w-full p-3 border-2 border-gray-200 rounded-xl"
                        value={formData.client_id} onChange={e => setFormData({...formData, client_id: e.target.value})}>
                        <option value="">Seleccionar Cliente</option>
                        {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                   </div>
                   <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">Tipo Pago</label>
                      <select className="w-full p-3 border-2 border-gray-200 rounded-xl"
                        value={formData.tipo_pago} onChange={e => setFormData({...formData, tipo_pago: e.target.value})}>
                        <option value="Contado">Contado</option>
                        <option value="Crédito">Crédito</option>
                      </select>
                   </div>
                </div>

                <div className="p-6 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
                   <h3 className="font-bold text-gray-700 mb-4">Agregar Productos</h3>
                   <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                      <div className="md:col-span-2">
                         <select className="w-full p-3 border rounded-xl" 
                           value={selectedProductId} onChange={e => setSelectedProductId(e.target.value)}>
                           <option value="">Buscar producto...</option>
                           {products.map(p => (
                             <option key={p.id} value={p.id}>{p.nombre_producto} - {formatCurrency(p.precio_base_venta)}</option>
                           ))}
                         </select>
                      </div>
                      <div className="flex gap-2">
                         <input type="number" className="w-20 p-3 border rounded-xl" value={productQuantity} onChange={e => setProductQuantity(e.target.value)}/>
                         <button type="button" onClick={handleAddProduct} className="bg-green-600 text-white px-4 rounded-xl font-bold flex-1">Agregar</button>
                      </div>
                   </div>

                   {orderProducts.map((p, i) => (
                     <div key={i} className="flex justify-between items-center bg-white p-3 rounded-lg border mb-2 shadow-sm">
                        <div>
                           <div className="font-bold">{p.nombre_producto}</div>
                           <div className="text-sm text-gray-500">{p.cantidad} x {formatCurrency(p.precio_unitario)}</div>
                        </div>
                        <div className="flex items-center gap-4">
                           <div className="font-bold">{formatCurrency(p.subtotal)}</div>
                           <button type="button" onClick={() => handleRemoveProduct(i)} className="text-red-500"><Trash2/></button>
                        </div>
                     </div>
                   ))}
                   
                   {orderProducts.length > 0 && (
                     <div className="flex justify-between items-center mt-4 pt-4 border-t border-gray-300">
                        <span className="font-bold text-lg">Total:</span>
                        <span className="font-bold text-2xl text-green-700">{formatCurrency(calculateTotal())}</span>
                     </div>
                   )}
                </div>

                <div>
                   <label className="block text-sm font-bold text-gray-700 mb-2">Observaciones</label>
                   <textarea className="w-full p-3 border-2 border-gray-200 rounded-xl" rows={2}
                     value={formData.observacion} onChange={e => setFormData({...formData, observacion: e.target.value})}></textarea>
                </div>

                <div className="flex gap-4">
                   <button type="button" onClick={handleClearForm} className="px-6 py-3 border-2 border-gray-300 rounded-xl font-bold text-gray-600 hover:bg-gray-100">Limpiar</button>
                   <button type="submit" disabled={formLoading} className="flex-1 bg-green-600 text-white py-3 rounded-xl font-bold hover:bg-green-700 disabled:opacity-50 flex justify-center items-center gap-2">
                      {formLoading && <Loader2 className="animate-spin"/>} Crear Pedido
                   </button>
                </div>
             </form>
          </div>

          {/* TABLA DE PEDIDOS RECIENTES */}
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden mt-6">
             <div className="p-4 bg-gray-50 border-b flex justify-between items-center">
                <h3 className="font-bold text-gray-700">Pedidos Recientes</h3>
                <div className="relative">
                   <Search className="absolute left-3 top-2.5 text-gray-400 w-4 h-4"/>
                   <input type="text" placeholder="Buscar..." className="pl-9 pr-4 py-2 border rounded-lg text-sm"
                     value={searchTerm} onChange={e => setSearchTerm(e.target.value)}/>
                </div>
             </div>
             <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600">
                   <tr>
                      <th className="p-4 text-left">Pedido #</th>
                      <th className="p-4 text-left">Fecha</th>
                      <th className="p-4 text-left">Cliente</th>
                      <th className="p-4 text-right">Total</th>
                      <th className="p-4 text-center">Estado</th>
                      <th className="p-4 text-center">Acciones</th>
                   </tr>
                </thead>
                <tbody className="divide-y">
                   {filteredOrders.map(o => (
                      <tr key={o.id} className="hover:bg-gray-50">
                         <td className="p-4 font-bold">{o.numero_documento}</td>
                         <td className="p-4">{format(new Date(o.fecha_pedido), 'dd/MM/yy HH:mm')}</td>
                         <td className="p-4">{o.clients?.name}</td>
                         <td className="p-4 text-right font-bold">{formatCurrency(o.total_venta)}</td>
                         <td className="p-4 text-center"><StatusBadge status={o.estado}/></td>
                         <td className="p-4 text-center">
                            <button onClick={() => handleEditOrder(o)} className="text-blue-600 hover:bg-blue-50 p-2 rounded"><Edit className="w-4 h-4"/></button>
                         </td>
                      </tr>
                   ))}
                </tbody>
             </table>
          </div>
        </>
      )}

      {/* TABS SECUNDARIOS */}
      {activeTab === 'empleados' && <EmployeesTab />}
      {activeTab === 'reportes' && <ReportsTab />}

      {/* MODAL EDITAR PEDIDO */}
      {showEditModal && editingOrder && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
           <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl">
              <div className="flex justify-between items-center mb-6">
                 <h3 className="text-xl font-bold">Editar Pedido #{editingOrder.numero_documento}</h3>
                 <button onClick={handleCloseEditModal}><X/></button>
              </div>
              
              {editSuccess && <div className="mb-4 p-3 bg-green-100 text-green-700 rounded-lg flex gap-2"><CheckCircle2/> Actualizado</div>}

              <form onSubmit={handleUpdateOrder} className="space-y-4">
                 <div>
                    <label className="font-bold text-sm">Estado</label>
                    <select className="w-full p-3 border rounded-xl" 
                      value={editFormData.estado} onChange={e => setEditFormData({...editFormData, estado: e.target.value})}>
                      <option value="Pendiente">Pendiente</option>
                      <option value="Aprobado">Aprobado</option>
                      <option value="Entregado">Entregado</option>
                      <option value="Anulado">Anulado</option>
                    </select>
                 </div>
                 <div>
                    <label className="font-bold text-sm">Tipo Pago</label>
                    <select className="w-full p-3 border rounded-xl"
                      value={editFormData.tipo_pago} onChange={e => setEditFormData({...editFormData, tipo_pago: e.target.value})}>
                      <option value="Contado">Contado</option>
                      <option value="Crédito">Crédito</option>
                    </select>
                 </div>
                 <div>
                    <label className="font-bold text-sm">Observación</label>
                    <textarea className="w-full p-3 border rounded-xl" rows={3}
                      value={editFormData.observacion} onChange={e => setEditFormData({...editFormData, observacion: e.target.value})}/>
                 </div>
                 <div className="flex gap-3 pt-4">
                    <button type="button" onClick={handleCloseEditModal} className="flex-1 py-3 border rounded-xl font-bold">Cancelar</button>
                    <button type="submit" disabled={editLoading} className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold flex justify-center items-center gap-2">
                       {editLoading && <Loader2 className="animate-spin"/>} Guardar
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
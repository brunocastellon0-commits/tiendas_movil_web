'use client'

import { useState, useMemo, useEffect, Fragment } from 'react'
import { createClient } from '@/utils/supabase/client'
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend
} from 'recharts'
import { 
  User, Download, ChevronDown, FileText, AlertCircle, CheckCircle2, Clock, ChevronRight
} from 'lucide-react'
import { format, differenceInDays, addDays } from 'date-fns'
import { es } from 'date-fns/locale'

// --- Colores Corporativos ---
const COLORS = {
  collected: '#10B981', // Verde (Cobrado)
  pending: '#F59E0B',   // Amarillo (Pendiente vigentes)
  overdue: '#EF4444',   // Rojo (Vencido)
  grid: '#F3F4F6'
}

// --- Tipos ---
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

export default function ReportsTab() {
  const supabase = createClient()
  
  // --- Estados ---
  const [employees, setEmployees] = useState<Employee[]>([])
  const [selectedEmployee, setSelectedEmployee] = useState<string>('ALL')
  const [orders, setOrders] = useState<OrderData[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null)
  const [orderDetails, setOrderDetails] = useState<Record<string, any[]>>({})
  const [loadingDetails, setLoadingDetails] = useState<Record<string, boolean>>({})

  // --- Carga de Empleados ---
  useEffect(() => {
    const fetchEmployees = async () => {
      const { data, error } = await supabase
        .from('employees')
        .select('id, full_name')
        .order('full_name')
      
      if (error) {
        console.error('Error cargando empleados:', error)
        return
      }
      
      if (data) {
        setEmployees(data)
      }
    }
    fetchEmployees()
  }, [])

  // --- Carga de Pedidos ---
  useEffect(() => {
    const fetchOrders = async () => {
      setLoading(true)
      
      try {
        let query = supabase
          .from('pedidos')
          .select(`
            id,
            numero_documento,
            fecha_pedido,
            tipo_pago,
            total_venta,
            estado,
            empleado_id,
            descuento_porcentaje,
            descuento_monto,
            clients:clients_id (
              name,
              legacy_id,
              credit_days,
              current_balance
            )
          `)
          .eq('tipo_pago', 'Crédito') // Solo pedidos a crédito para cobranza
          .order('fecha_pedido', { ascending: false })

        // Filtrar por empleado si no es ALL
        if (selectedEmployee !== 'ALL') {
          query = query.eq('empleado_id', selectedEmployee)
        }

        const { data, error } = await query

        if (error) throw error

        // Procesar datos
        const processedOrders: OrderData[] = (data || []).map((order: any) => {
          const client = order.clients
          const creditDays = client?.credit_days || 30
          const dueDate = addDays(new Date(order.fecha_pedido), creditDays)
          const today = new Date()
          const daysOverdue = differenceInDays(today, dueDate)
          
          // Calcular monto cobrado basado en el balance del cliente
          const totalVenta = order.total_venta
          const clientBalance = client?.current_balance || 0
          
          let collected = 0
          let collectionStatus: 'Cobrado' | 'Parcial' | 'Pendiente' | 'Vencido' = 'Pendiente'
          
          if (order.estado === 'Entregado') {
            collected = Math.max(0, totalVenta - clientBalance)
            
            if (collected >= totalVenta) {
              collectionStatus = 'Cobrado'
            } else if (collected > 0) {
              collectionStatus = 'Parcial'
            } else if (daysOverdue > 0) {
              collectionStatus = 'Vencido'
            } else {
              collectionStatus = 'Pendiente'
            }
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
            collection_status: collectionStatus
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

  // --- Cálculos para Gráficos ---
  const chartData = useMemo(() => {
    // Totales Generales
    const totalSold = orders.reduce((acc, curr) => acc + curr.total_venta, 0)
    const totalCollected = orders.reduce((acc, curr) => acc + curr.collected, 0)
    const totalPending = totalSold - totalCollected

    // Datos para Barras (Cobrado vs Pendiente)
    const barData = [
      { name: 'Gestión Actual', cobrado: totalCollected, pendiente: totalPending }
    ]

    // Datos para Torta (Distribución de Estado)
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

  // --- Función para cargar detalles del pedido ---
  const toggleOrderDetails = async (orderId: string) => {
    // Si ya está expandido, colapsar
    if (expandedOrderId === orderId) {
      setExpandedOrderId(null)
      return
    }

    // Expandir y cargar detalles si no están cargados
    setExpandedOrderId(orderId)
    
    if (!orderDetails[orderId]) {
      setLoadingDetails({ ...loadingDetails, [orderId]: true })
      
      try {
        const { data, error } = await supabase
          .from('detalle_pedido')
          .select(`
            id,
            cantidad,
            precio_unitario,
            subtotal,
            unidad_seleccionada,
            producto_id,
            productos:producto_id (
              nombre_producto,
              codigo_producto
            )
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

  const formatMoney = (val: number) => new Intl.NumberFormat('es-BO', { style: 'currency', currency: 'BOB', maximumFractionDigits: 0 }).format(val)

  return (
    <div className="space-y-8 pb-10">
      
      {/* 1. HEADER & FILTRO ÚNICO */}
      <div className="flex flex-col md:flex-row justify-between items-end gap-6 bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
        <div>
           <h1 className="text-2xl font-bold text-gray-900">Hoja de Cobranza por Preventista</h1>
           <p className="text-gray-500 mt-1">Gestión de recuperación de cartera y eficiencia de cobro.</p>
        </div>
        
        <div className="w-full md:w-80">
           <label className="text-xs font-bold text-gray-500 uppercase mb-1.5 block ml-1">Seleccionar Preventista</label>
           <div className="relative">
             <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
               <User className="w-5 h-5" />
             </div>
             <select 
                value={selectedEmployee}
                onChange={(e) => setSelectedEmployee(e.target.value)}
                className="w-full pl-10 pr-10 py-3 bg-gray-50 border border-gray-200 rounded-xl font-medium text-gray-900 appearance-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all cursor-pointer hover:bg-gray-100"
             >
                <option value="ALL"> Todos los Empleados</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>{emp.full_name}</option>
                ))}
             </select>
             <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
           </div>
        </div>
      </div>

      {/* 2. GRÁFICOS (BARRAS Y TORTA) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* GRÁFICO BARRAS: Cobrado vs Pendiente */}
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex flex-col">
           <h3 className="text-lg font-bold text-gray-900 mb-6">Efectividad de Cobro</h3>
           <div className="flex-1 min-h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                 <BarChart data={chartData.barData} barSize={60}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={COLORS.grid} />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={false} />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tickFormatter={(val) => `$${val/1000}k`} 
                      tick={{fill: '#9CA3AF', fontSize: 12}}
                    />
                    <Tooltip 
                      cursor={{fill: 'transparent'}}
                      formatter={(value: number | undefined) => value !== undefined ? formatMoney(value) : ''}
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    />
                    <Legend iconType="circle" wrapperStyle={{paddingTop: '20px'}} />
                    <Bar dataKey="cobrado" name="Total Cobrado" stackId="a" fill={COLORS.collected} radius={[0, 0, 4, 4]} />
                    <Bar dataKey="pendiente" name="Saldo Pendiente" stackId="a" fill={COLORS.overdue} radius={[4, 4, 0, 0]} />
                 </BarChart>
              </ResponsiveContainer>
           </div>
        </div>

        {/* GRÁFICO TORTA: Estado de Cartera */}
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex flex-col">
           <h3 className="text-lg font-bold text-gray-900 mb-6">Composición de Cartera</h3>
           <div className="flex-1 min-h-[300px] relative">
              <ResponsiveContainer width="100%" height="100%">
                 <PieChart>
                    <Pie
                       data={chartData.pieData}
                       cx="50%"
                       cy="50%"
                       innerRadius={80}
                       outerRadius={110}
                       paddingAngle={5}
                       dataKey="value"
                    >
                       <Cell fill={COLORS.collected} /> {/* Cobrado */}
                       <Cell fill={COLORS.pending} />   {/* Vigente */}
                       <Cell fill={COLORS.overdue} />   {/* Vencido */}
                    </Pie>
                    <Tooltip formatter={(value: number | undefined) => value !== undefined ? formatMoney(value) : ''} />
                    <Legend 
                      verticalAlign="middle" 
                      align="right" 
                      layout="vertical"
                      iconType="circle"
                    />
                 </PieChart>
              </ResponsiveContainer>
              {/* Centro de la torta */}
              <div className="absolute left-[35%] top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center justify-center pointer-events-none">
                 <span className="text-sm text-gray-400">Total Gestión</span>
                 <span className="text-xl font-bold text-gray-900">
                    {formatMoney(chartData.barData[0].cobrado + chartData.barData[0].pendiente)}
                 </span>
              </div>
           </div>
        </div>
      </div>

      {/* 3. TABLA DE DETALLE DE COBRANZAS */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        
        {/* Toolbar de Tabla */}
        <div className="px-6 py-5 border-b border-gray-200 flex justify-between items-center bg-gray-50/50">
           <h3 className="text-lg font-bold text-gray-900">Detalle de Cobranzas</h3>
           <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50 transition shadow-sm">
              <Download className="w-4 h-4" /> Exportar Reporte
           </button>
        </div>

        <div className="overflow-x-auto">
           <table className="w-full text-left border-collapse">
              <thead>
                 <tr className="text-xs font-bold text-gray-500 uppercase bg-gray-50 border-b border-gray-200 tracking-wide">
                    <th className="px-3 py-4 w-10"></th>
                    <th className="px-6 py-4">Cliente</th>
                    <th className="px-6 py-4">Pedido / Fecha</th>
                    <th className="px-6 py-4 text-center">Tipo</th>
                    <th className="px-6 py-4 text-center">Vencimiento</th>
                    <th className="px-6 py-4 text-center">Días Atraso</th>
                    <th className="px-6 py-4 text-right">Monto Total</th>
                    <th className="px-6 py-4 text-right text-green-600">Cobrado</th>
                    <th className="px-6 py-4 text-right text-red-600">Saldo</th>
                    <th className="px-6 py-4 text-center">Estado</th>
                 </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                 {loading ? (
                    <tr>
                       <td colSpan={10} className="px-6 py-16 text-center">
                          <div className="flex flex-col items-center justify-center gap-3">
                             <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                             <p className="text-gray-600 font-medium">Cargando pedidos...</p>
                          </div>
                       </td>
                    </tr>
                 ) : orders.length === 0 ? (
                    <tr>
                       <td colSpan={10} className="px-6 py-16 text-center text-gray-500">
                          No se encontraron pedidos a crédito
                       </td>
                    </tr>
                 ) : (
                  orders.map((order) => {
                     const isOverdue = order.collection_status === 'Vencido' || order.days_overdue > 0
                     const isPaid = order.collection_status === 'Cobrado'
                     const isExpanded = expandedOrderId === order.id
                     
                     // Fila Roja suave si está vencido
                     const rowClass = isOverdue ? 'bg-red-50/60 hover:bg-red-50' : 'hover:bg-gray-50'

                     return (
                        <Fragment key={order.id}>
                        <tr className={`${rowClass} transition-colors group cursor-pointer`}>
                           
                           {/* Botón Expandir */}
                           <td className="px-3 py-4">
                              <button
                                 onClick={() => toggleOrderDetails(order.id)}
                                 className="p-1 hover:bg-gray-200 rounded transition-colors"
                              >
                                 <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                              </button>
                           </td>

                           {/* Cliente */}
                           <td className="px-6 py-4" onClick={() => toggleOrderDetails(order.id)}>
                              <div className="flex items-center gap-3">
                                 {isOverdue && <AlertCircle className="w-4 h-4 text-red-500" />}
                                 <span className={`text-sm font-semibold ${isOverdue ? 'text-red-900' : 'text-gray-900'}`}>
                                    {order.client_name}
                                 </span>
                              </div>
                           </td>

                           {/* Pedido */}
                           <td className="px-6 py-4" onClick={() => toggleOrderDetails(order.id)}>
                              <div className="flex flex-col">
                                 <span className="text-xs font-mono text-gray-500">PED-{order.numero_documento}</span>
                                 <span className="text-xs text-gray-400">{format(new Date(order.fecha_pedido), 'dd/MM/yyyy', { locale: es })}</span>
                              </div>
                           </td>

                           {/* Tipo */}
                           <td className="px-6 py-4 text-center" onClick={() => toggleOrderDetails(order.id)}>
                              <span className={`px-2 py-1 rounded text-xs font-medium border ${
                                 order.tipo_pago === 'Contado' 
                                   ? 'bg-green-50 text-green-700 border-green-100' 
                                   : 'bg-purple-50 text-purple-700 border-purple-100'
                              }`}>
                                 {order.tipo_pago}
                              </span>
                           </td>

                           {/* Vencimiento */}
                           <td className="px-6 py-4 text-center text-sm text-gray-600" onClick={() => toggleOrderDetails(order.id)}>
                              {format(new Date(order.due_date), 'dd/MM/yyyy', { locale: es })}
                           </td>

                           {/* Días Atraso */}
                           <td className="px-6 py-4 text-center" onClick={() => toggleOrderDetails(order.id)}>
                              {order.days_overdue > 0 ? (
                                 <span className="text-xs font-bold text-red-600 bg-red-100 px-2 py-1 rounded-full">
                                    {order.days_overdue} días
                                 </span>
                              ) : (
                                 <span className="text-xs text-gray-400">-</span>
                              )}
                           </td>

                           {/* Montos */}
                           <td className="px-6 py-4 text-right font-medium text-gray-900" onClick={() => toggleOrderDetails(order.id)}>
                              {formatMoney(order.total_venta)}
                           </td>
                           <td className="px-6 py-4 text-right font-medium text-green-600" onClick={() => toggleOrderDetails(order.id)}>
                              {formatMoney(order.collected)}
                           </td>
                           <td className="px-6 py-4 text-right font-bold text-red-600" onClick={() => toggleOrderDetails(order.id)}>
                              {formatMoney(order.total_venta - order.collected)}
                           </td>

                           {/* Estado (Badge) */}
                           <td className="px-6 py-4 text-center" onClick={() => toggleOrderDetails(order.id)}>
                              <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${
                                 isPaid ? 'bg-green-100 text-green-700 border-green-200' :
                                 isOverdue ? 'bg-red-100 text-red-700 border-red-200' :
                                 'bg-yellow-100 text-yellow-800 border-yellow-200'
                              }`}>
                                 {isPaid && <CheckCircle2 className="w-3 h-3" />}
                                 {isOverdue && <AlertCircle className="w-3 h-3" />}
                                 {!isPaid && !isOverdue && <Clock className="w-3 h-3" />}
                                 {order.collection_status}
                              </div>
                           </td>

                        </tr>

                        {/* Fila Expandible con Detalles */}
                        {isExpanded && (
                           <tr className="bg-gray-50">
                              <td colSpan={10} className="px-12 py-6">
                                 <div className="space-y-4">
                                    {/* Detalles del Pedido */}
                                    <div className="bg-white p-4 rounded-lg border border-gray-200">
                                       <h4 className="text-sm font-bold text-gray-700 mb-3">Información del Pedido</h4>
                                       <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                          <div>
                                             <p className="text-xs text-gray-500 mb-1">ID Cliente</p>
                                             <p className="text-sm font-semibold text-gray-900">
                                                {order.client_legacy_id || 'N/A'}
                                             </p>
                                          </div>
                                          <div>
                                             <p className="text-xs text-gray-500 mb-1">Cliente</p>
                                             <p className="text-sm font-semibold text-gray-900">{order.client_name}</p>
                                          </div>
                                          <div>
                                             <p className="text-xs text-gray-500 mb-1">Fecha Pedido</p>
                                             <p className="text-sm font-semibold text-gray-900">{format(new Date(order.fecha_pedido), 'dd/MM/yyyy', { locale: es })}</p>
                                          </div>
                                          <div>
                                             <p className="text-xs text-gray-500 mb-1">Tipo de Pago</p>
                                             <p className="text-sm font-semibold text-gray-900">{order.tipo_pago}</p>
                                          </div>
                                          <div>
                                             <p className="text-xs text-gray-500 mb-1">Días de Plazo</p>
                                             <p className="text-sm font-semibold text-gray-900">{order.client_credit_days} días</p>
                                          </div>
                                          <div>
                                             <p className="text-xs text-gray-500 mb-1">Total Venta</p>
                                             <p className="text-sm font-semibold text-gray-900">{formatMoney(order.total_venta)}</p>
                                          </div>
                                          <div>
                                             <p className="text-xs text-gray-500 mb-1">Descuento %</p>
                                             <p className="text-sm font-semibold text-orange-600">{order.descuento_porcentaje}%</p>
                                          </div>
                                          <div>
                                             <p className="text-xs text-gray-500 mb-1">Descuento Monto</p>
                                             <p className="text-sm font-semibold text-orange-600">{formatMoney(order.descuento_monto)}</p>
                                          </div>
                                          <div>
                                             <p className="text-xs text-gray-500 mb-1">Fecha Vencimiento</p>
                                             <p className="text-sm font-semibold text-gray-900">{format(new Date(order.due_date), 'dd/MM/yyyy', { locale: es })}</p>
                                          </div>
                                          <div>
                                             <p className="text-xs text-gray-500 mb-1">Estado</p>
                                             <p className="text-sm font-semibold text-gray-900">{order.estado}</p>
                                          </div>
                                          <div>
                                             <p className="text-xs text-gray-500 mb-1">Estado de Cobranza</p>
                                             <p className={`text-sm font-bold ${
                                                order.collection_status === 'Cobrado' ? 'text-green-600' :
                                                order.collection_status === 'Vencido' ? 'text-red-600' :
                                                'text-yellow-600'
                                             }`}>{order.collection_status}</p>
                                          </div>
                                          <div>
                                             <p className="text-xs text-gray-500 mb-1">Días de Atraso</p>
                                             <p className={`text-sm font-bold ${order.days_overdue > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                                {order.days_overdue > 0 ? `${order.days_overdue} días` : 'Al día'}
                                             </p>
                                          </div>
                                       </div>
                                       
                                       {/* Resumen de Montos */}
                                       <div className="mt-4 pt-4 border-t border-gray-200">
                                          <div className="grid grid-cols-3 gap-4">
                                             <div className="text-center">
                                                <p className="text-xs text-gray-500 mb-1">Total Venta</p>
                                                <p className="text-lg font-bold text-gray-900">{formatMoney(order.total_venta)}</p>
                                             </div>
                                             <div className="text-center">
                                                <p className="text-xs text-gray-500 mb-1">Total Cobrado</p>
                                                <p className="text-lg font-bold text-green-600">{formatMoney(order.collected)}</p>
                                             </div>
                                             <div className="text-center">
                                                <p className="text-xs text-gray-500 mb-1">Saldo Pendiente</p>
                                                <p className="text-lg font-bold text-red-600">{formatMoney(order.total_venta - order.collected)}</p>
                                             </div>
                                          </div>
                                       </div>
                                    </div>

                                    {/* Productos del Pedido */}
                                    <div className="bg-white p-4 rounded-lg border border-gray-200">
                                       <h4 className="text-sm font-bold text-gray-700 mb-3">Productos del Pedido</h4>
                                       
                                       {loadingDetails[order.id] ? (
                                          <div className="flex justify-center py-4">
                                             <div className="w-6 h-6 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                                          </div>
                                       ) : orderDetails[order.id] && orderDetails[order.id].length > 0 ? (
                                          <div className="overflow-x-auto">
                                             <table className="w-full text-sm">
                                                <thead>
                                                   <tr className="text-xs text-gray-500 border-b">
                                                      <th className="text-left py-2 px-2">Código</th>
                                                      <th className="text-left py-2 px-2">Producto</th>
                                                      <th className="text-center py-2 px-2">Cantidad</th>
                                                      <th className="text-right py-2 px-2">Precio Unitario</th>
                                                      <th className="text-right py-2 px-2">Subtotal</th>
                                                   </tr>
                                                </thead>
                                                <tbody>
                                                   {orderDetails[order.id].map((detail: any) => (
                                                      <tr key={detail.id} className="border-b last:border-0">
                                                         <td className="py-2 px-2 font-mono text-xs text-gray-500">
                                                            {detail.productos?.codigo_producto || '-'}
                                                         </td>
                                                         <td className="py-2 px-2 font-medium text-gray-900">
                                                            {detail.productos?.nombre_producto || 'Producto desconocido'}
                                                         </td>
                                                         <td className="py-2 px-2 text-center">
                                                            {detail.cantidad} {detail.unidad_seleccionada}
                                                         </td>
                                                         <td className="py-2 px-2 text-right text-gray-700">
                                                            {formatMoney(detail.precio_unitario)}
                                                         </td>
                                                         <td className="py-2 px-2 text-right font-semibold text-gray-900">
                                                            {formatMoney(detail.subtotal)}
                                                         </td>
                                                      </tr>
                                                   ))}
                                                </tbody>
                                             </table>
                                          </div>
                                       ) : (
                                          <p className="text-sm text-gray-500 text-center py-4">No hay productos registrados</p>
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
        
        {/* Footer simple */}
        <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 text-xs text-gray-500 flex justify-between">
           <span>Total registros: {orders.length}</span>
           <div className="flex gap-4">
              <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-500"></div> Deuda Vencida</span>
              <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-yellow-500"></div> Por Vencer</span>
           </div>
        </div>

      </div>

    </div>
  )
}

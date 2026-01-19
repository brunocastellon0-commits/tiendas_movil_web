import { Download, AlertTriangle } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import type { Order } from '../../types/employee-reports'

interface EmployeeOrdersTableProps {
  orders: Order[]
  loading: boolean
}

export default function EmployeeOrdersTable({ orders, loading }: EmployeeOrdersTableProps) {
  const formatMoney = (val: number) => new Intl.NumberFormat('es-BO', { 
    style: 'currency', 
    currency: 'BOB', 
    minimumFractionDigits: 2,
    maximumFractionDigits: 2 
  }).format(val)

  if (loading) {
    return (
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-12 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
        <p className="text-gray-500 mt-4">Cargando pedidos...</p>
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
      <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
        <h3 className="text-lg font-bold text-gray-900">Historial de Pedidos y Riesgo</h3>
        <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50">
          <Download className="w-4 h-4" /> Exportar
        </button>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-xs font-semibold tracking-wide text-left text-gray-500 uppercase bg-gray-50 border-b border-gray-200">
              <th className="px-6 py-4">Fecha</th>
              <th className="px-6 py-4">Cliente</th>
              <th className="px-6 py-4">Tipo</th>
              <th className="px-6 py-4">Monto</th>
              <th className="px-6 py-4">Días Deuda</th>
              <th className="px-6 py-4 text-center">Estado</th>
              <th className="px-6 py-4 text-center">Riesgo</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {orders.map((order) => {
              // Lógica de Riesgo
              const isCredit = order.tipo_pago === 'Crédito'
              const isPending = order.estado === 'Pendiente'
              const riskLevel: 'Bajo' | 'Medio' | 'Alto' = !isCredit ? 'Bajo' : (isPending ? 'Medio' : 'Bajo')

              return (
                <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 text-sm text-gray-700 font-medium">
                    {format(new Date(order.fecha_pedido), 'd MMM yyyy', { locale: es })}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700">
                    {order.clients?.name || 'Cliente Casual'}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                      isCredit ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700'
                    }`}>
                      {order.tipo_pago}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm font-bold text-gray-900">
                    {formatMoney(order.total_venta)}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {isCredit && isPending ? (
                      <span className="text-yellow-600 font-medium">Pendiente</span>
                    ) : (
                      <span className="text-gray-300">---</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`px-2 py-1 rounded border text-xs font-medium ${
                      order.estado === 'Entregado' 
                        ? 'bg-green-50 border-green-200 text-green-700' :
                      order.estado === 'Pendiente'
                        ? 'bg-yellow-50 border-yellow-200 text-yellow-700' :
                      order.estado === 'Aprobado'
                        ? 'bg-blue-50 border-blue-200 text-blue-700' :
                        'bg-red-50 border-red-200 text-red-700'
                    }`}>
                      {order.estado}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                      (riskLevel as string) === 'Alto' ? 'bg-red-100 text-red-700' :
                      riskLevel === 'Medio' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-green-100 text-green-700'
                    }`}>
                      {riskLevel}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      
      {/* Footer Tabla */}
      <div className="bg-gray-50 p-4 border-t border-gray-200 flex justify-between items-center text-xs text-gray-500">
        <span>Mostrando últimos {orders.length} pedidos</span>
        <div className="flex gap-4">
          <span className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-green-500"></div> Riesgo Bajo
          </span>
          <span className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-yellow-500"></div> Riesgo Medio
          </span>
          <span className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-red-500"></div> Riesgo Alto
          </span>
        </div>
      </div>
    </div>
  )
}

'use client'

import { TrendingUp, Target, DollarSign, Package } from 'lucide-react'
import type { Order } from '../../types/employee-reports'

interface EfficiencyMetricsProps {
  orders: Order[]
}

export default function EfficiencyMetrics({ orders }: EfficiencyMetricsProps) {
  // Calcular métricas
  const totalPedidos = orders.length
  const pedidosEntregados = orders.filter(o => o.estado === 'Entregado').length
  const tasaEntrega = totalPedidos > 0 ? (pedidosEntregados / totalPedidos) * 100 : 0
  
  const totalVendido = orders.reduce((sum, o) => sum + o.total_venta, 0)
  const ticketPromedio = totalPedidos > 0 ? totalVendido / totalPedidos : 0
  
  const pedidosCredito = orders.filter(o => o.tipo_pago === 'Crédito').length
  const tasaCredito = totalPedidos > 0 ? (pedidosCredito / totalPedidos) * 100 : 0

  const formatMoney = (val: number) => new Intl.NumberFormat('es-BO', { 
    style: 'currency', 
    currency: 'BOB', 
    minimumFractionDigits: 2,
    maximumFractionDigits: 2 
  }).format(val)

  const metrics = [
    {
      title: 'Tasa de Entrega',
      value: `${tasaEntrega.toFixed(1)}%`,
      description: `${pedidosEntregados} de ${totalPedidos} pedidos entregados`,
      icon: Target,
      progress: tasaEntrega,
      color: tasaEntrega >= 80 ? 'green' : tasaEntrega >= 60 ? 'yellow' : 'red'
    },
    {
      title: 'Ticket Promedio',
      value: formatMoney(ticketPromedio),
      description: `Por cada pedido realizado`,
      icon: DollarSign,
      progress: Math.min((ticketPromedio / 1000) * 100, 100),
      color: 'blue'
    },
    {
      title: 'Total Pedidos',
      value: totalPedidos.toString(),
      description: `En el período seleccionado`,
      icon: Package,
      progress: 100,
      color: 'purple'
    },
    {
      title: 'Uso de Crédito',
      value: `${tasaCredito.toFixed(1)}%`,
      description: `${pedidosCredito} pedidos a crédito`,
      icon: TrendingUp,
      progress: tasaCredito,
      color: 'orange'
    }
  ]

  const colorClasses = {
    green: 'bg-green-500',
    yellow: 'bg-yellow-500',
    red: 'bg-red-500',
    blue: 'bg-blue-500',
    purple: 'bg-purple-500',
    orange: 'bg-orange-500'
  }

  const bgColorClasses = {
    green: 'bg-green-50 border-green-200',
    yellow: 'bg-yellow-50 border-yellow-200',
    red: 'bg-red-50 border-red-200',
    blue: 'bg-blue-50 border-blue-200',
    purple: 'bg-purple-50 border-purple-200',
    orange: 'bg-orange-50 border-orange-200'
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold text-gray-900">Métricas de Eficiencia</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {metrics.map((metric, idx) => {
          const Icon = metric.icon
          return (
            <div 
              key={idx}
              className={`p-5 rounded-xl border-2 ${bgColorClasses[metric.color as keyof typeof bgColorClasses]} transition-all hover:shadow-md`}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-1">
                    {metric.title}
                  </p>
                  <p className="text-2xl font-bold text-gray-900">
                    {metric.value}
                  </p>
                </div>
                <div className={`p-2 rounded-lg ${colorClasses[metric.color as keyof typeof colorClasses]} bg-opacity-20`}>
                  <Icon className={`w-5 h-5 ${colorClasses[metric.color as keyof typeof colorClasses].replace('bg-', 'text-')}`} />
                </div>
              </div>
              
              <p className="text-xs text-gray-600 mb-2">{metric.description}</p>
              
              {/* Barra de progreso visual */}
              <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                <div 
                  className={`h-full ${colorClasses[metric.color as keyof typeof colorClasses]} transition-all duration-500`}
                  style={{ width: `${metric.progress}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <p className="text-sm text-blue-800">
          <strong>💡 Cómo interpretar:</strong> Una tasa de entrega alta (≥80%) indica eficiencia. 
          Un ticket promedio alto significa ventas de calidad. El uso de crédito muestra la confianza del empleado con los clientes.
        </p>
      </div>
    </div>
  )
}

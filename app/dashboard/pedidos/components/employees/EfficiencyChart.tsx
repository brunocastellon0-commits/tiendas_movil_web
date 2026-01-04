'use client'

import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts'
import { CheckCircle2, Clock, XCircle } from 'lucide-react'
import type { Order } from '../../types/employee-reports'

interface EfficiencyChartProps {
  orders: Order[]
}

export default function EfficiencyChart({ orders }: EfficiencyChartProps) {
  // Calcular métricas
  const ventasCerradas = orders.filter(o => o.estado === 'Entregado').length
  const enProceso = orders.filter(o => o.estado === 'Pendiente' || o.estado === 'Aprobado').length
  const canceladas = orders.filter(o => o.estado === 'Anulado').length
  const total = orders.length

  const data = [
    { 
      name: 'Ventas Cerradas', 
      value: ventasCerradas,
      percentage: total > 0 ? ((ventasCerradas / total) * 100).toFixed(1) : 0,
      color: '#10b981'
    },
    { 
      name: 'En Proceso', 
      value: enProceso,
      percentage: total > 0 ? ((enProceso / total) * 100).toFixed(1) : 0,
      color: '#f59e0b'
    },
    { 
      name: 'Canceladas', 
      value: canceladas,
      percentage: total > 0 ? ((canceladas / total) * 100).toFixed(1) : 0,
      color: '#ef4444'
    }
  ]

  const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5
    const x = cx + radius * Math.cos(-midAngle * Math.PI / 180)
    const y = cy + radius * Math.sin(-midAngle * Math.PI / 180)

    if (percent < 0.05) return null

    return (
      <text 
        x={x} 
        y={y} 
        fill="white" 
        textAnchor={x > cx ? 'start' : 'end'} 
        dominantBaseline="central"
        className="font-bold text-sm"
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    )
  }

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
      <h3 className="text-lg font-bold text-gray-900 mb-6">Eficiencia de Ventas</h3>
      
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={renderCustomLabel}
            outerRadius={100}
            innerRadius={60}
            fill="#8884d8"
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip 
            contentStyle={{
              backgroundColor: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'
            }}
            formatter={(value: number | undefined) => {
              if (value === undefined) return ['', '']
              return [`${value} pedidos`, '']
            }}
          />
        </PieChart>
      </ResponsiveContainer>

      {/* Resumen Visual */}
      <div className="mt-6 space-y-3">
        <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
            <span className="text-sm font-semibold text-green-900">Ventas Cerradas</span>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-green-600">{ventasCerradas}</p>
            <p className="text-xs text-green-600">{data[0].percentage}%</p>
          </div>
        </div>

        <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg border border-orange-200">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-orange-600" />
            <span className="text-sm font-semibold text-orange-900">En Proceso</span>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-orange-600">{enProceso}</p>
            <p className="text-xs text-orange-600">{data[1].percentage}%</p>
          </div>
        </div>

        <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-200">
          <div className="flex items-center gap-2">
            <XCircle className="w-5 h-5 text-red-600" />
            <span className="text-sm font-semibold text-red-900">Canceladas</span>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-red-600">{canceladas}</p>
            <p className="text-xs text-red-600">{data[2].percentage}%</p>
          </div>
        </div>
      </div>

      <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-100">
        <p className="text-xs text-blue-700">
          <strong>💡 Eficiencia:</strong> Un empleado eficiente tiene alta tasa de ventas cerradas (verde) 
          y baja tasa de canceladas (roja). El color naranja indica pedidos pendientes de completar.
        </p>
      </div>
    </div>
  )
}

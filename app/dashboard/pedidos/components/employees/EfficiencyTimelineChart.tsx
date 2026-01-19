'use client'

import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart } from 'recharts'
import type { TimelineDataItem } from '../../types/employee-reports'

interface EfficiencyTimelineChartProps {
  timelineData: TimelineDataItem[]
}

export default function EfficiencyTimelineChart({ timelineData }: EfficiencyTimelineChartProps) {
  const formatMoney = (val: number) => new Intl.NumberFormat('es-BO', { 
    style: 'currency', 
    currency: 'BOB', 
    minimumFractionDigits: 2,
    maximumFractionDigits: 2 
  }).format(val)

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
      <h3 className="text-lg font-bold text-gray-900 mb-6">Línea de Tiempo de Efectividad</h3>
      
      <ResponsiveContainer width="100%" height={350}>
        <ComposedChart data={timelineData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis 
            dataKey="date" 
            stroke="#888" 
            style={{ fontSize: '12px' }}
          />
          <YAxis 
            yAxisId="left"
            stroke="#888" 
            style={{ fontSize: '12px' }}
          />
          <YAxis 
            yAxisId="right"
            orientation="right"
            stroke="#888" 
            style={{ fontSize: '12px' }}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: '#fff', 
              border: '1px solid #e5e7eb', 
              borderRadius: '8px',
              boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'
            }}
            formatter={(value: number | undefined, name: string | undefined) => {
              if (value === undefined || name === undefined) return ['', '']
              if (name === 'Monto Vendido') return [formatMoney(value), name]
              return [value, name]
            }}
          />
          <Legend 
            wrapperStyle={{ paddingTop: '20px' }}
            iconType="circle"
          />
          
          {/* Barras de fondo: Visitas */}
          <Bar 
            yAxisId="left"
            dataKey="visitas" 
            fill="#93c5fd" 
            name="Visitas Realizadas"
            radius={[8, 8, 0, 0]}
            opacity={0.6}
          />
          
          {/* Línea principal: Monto vendido */}
          <Line 
            yAxisId="right"
            type="monotone" 
            dataKey="monto" 
            stroke="#10b981" 
            strokeWidth={3}
            name="Monto Vendido"
            dot={{ fill: '#10b981', r: 4 }}
            activeDot={{ r: 6 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
      
      <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-100">
        <p className="text-xs text-blue-700">
          💡 <strong>Insight:</strong> Este gráfico muestra la relación entre esfuerzo (visitas) y resultado (ventas). 
          Si hay muchas barras altas pero la línea está baja, indica que el empleado visita mucho pero vende poco.
        </p>
      </div>
    </div>
  )
}

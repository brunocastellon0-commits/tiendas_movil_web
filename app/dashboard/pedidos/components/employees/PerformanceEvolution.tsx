'use client'

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { TrendingUp } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

interface Visit {
  id: string
  start_time: string
  outcome: 'sale' | 'no_sale' | 'store_closed'
  seller_id: string
  notes?: string
}

interface PerformanceEvolutionProps {
  visits: Visit[]
}

export default function PerformanceEvolution({ visits }: PerformanceEvolutionProps) {
  // Agrupar visitas por día según outcome
  const evolutionData = visits.reduce((acc, visit) => {
    const date = format(new Date(visit.start_time), 'dd/MM', { locale: es })
    
    if (!acc[date]) {
      acc[date] = {
        date,
        conVenta: 0,
        sinVenta: 0,
        tiendasCerradas: 0
      }
    }
    
    // Clasificación basada en el campo outcome de la visita
    if (visit.outcome === 'sale') {
      acc[date].conVenta += 1
    } else if (visit.outcome === 'no_sale') {
      acc[date].sinVenta += 1
    } else if (visit.outcome === 'store_closed') {
      acc[date].tiendasCerradas += 1
    }
    
    return acc
  }, {} as Record<string, { date: string; conVenta: number; sinVenta: number; tiendasCerradas: number }>)

  const chartData = Object.values(evolutionData).slice(-14) // Últimas 2 semanas

  const formatTooltip = (value: number | undefined) => {
    if (value === undefined) return ['', '']
    return [`${value} pedidos`, '']
  }

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
      <div className="flex items-center gap-2 mb-6">
        <TrendingUp className="w-5 h-5 text-green-600" />
        <h3 className="text-lg font-bold text-gray-900">Evolución de Efectividad</h3>
      </div>
      
      <p className="text-sm text-gray-500 mb-4">Análisis general del rendimiento en los últimos 14 días</p>

      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis 
            dataKey="date" 
            stroke="#888"
            style={{ fontSize: '12px' }}
          />
          <YAxis 
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
            formatter={formatTooltip}
          />
          <Legend 
            wrapperStyle={{ paddingTop: '20px' }}
            iconType="line"
          />
          
          {/* Línea verde: Visitas con Venta */}
          <Line 
            type="monotone" 
            dataKey="conVenta" 
            stroke="#10b981" 
            strokeWidth={3}
            name="Visita con Venta"
            dot={{ fill: '#10b981', r: 4 }}
            activeDot={{ r: 6 }}
          />
          
          {/* Línea naranja: Sin Venta */}
          <Line 
            type="monotone" 
            dataKey="sinVenta" 
            stroke="#f59e0b" 
            strokeWidth={2}
            name="Sin Venta"
            dot={{ fill: '#f59e0b', r: 3 }}
          />
          
          {/* Línea gris punteada: Tiendas Cerradas */}
          <Line 
            type="monotone" 
            dataKey="tiendasCerradas" 
            stroke="#9ca3af" 
            strokeWidth={2}
            strokeDasharray="5 5"
            name="Tiendas Cerradas"
            dot={{ fill: '#9ca3af', r: 3 }}
          />
        </LineChart>
      </ResponsiveContainer>

      {/* Resumen de últimas 14 días */}
      <div className="mt-6 grid grid-cols-3 gap-4">
        <div className="p-3 bg-green-50 rounded-lg border border-green-200">
          <p className="text-xs font-semibold text-green-600 mb-1">VISITA CON VENTA</p>
          <p className="text-2xl font-bold text-green-700">
            {visits.filter(v => v.outcome === 'sale').length}
          </p>
        </div>
        
        <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
          <p className="text-xs font-semibold text-orange-600 mb-1">SIN VENTA</p>
          <p className="text-2xl font-bold text-orange-700">
            {visits.filter(v => v.outcome === 'no_sale').length}
          </p>
        </div>
        
        <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
          <p className="text-xs font-semibold text-gray-600 mb-1">TIENDAS CERRADAS</p>
          <p className="text-2xl font-bold text-gray-700">
            {visits.filter(v => v.outcome === 'store_closed').length}
          </p>
        </div>
      </div>

      <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-100">
        <p className="text-xs text-blue-700">
          <strong>💡 Interpretación:</strong> La línea verde debe estar arriba (más ventas cerradas). 
          Mucho naranja indica trabajo pendiente. Línea gris alta indica problemas con tiendas que no reciben.
        </p>
      </div>
    </div>
  )
}

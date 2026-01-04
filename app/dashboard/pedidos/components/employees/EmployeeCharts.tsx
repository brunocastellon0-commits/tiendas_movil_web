import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'
import type { ChartDataItem, KPIs } from '../../types/employee-reports'

const COLORS = {
  primary: '#10B981',   // Verde
  secondary: '#3B82F6', // Azul
  accent: '#8B5CF6',    // Morado
  warning: '#F59E0B',   // Naranja
  danger: '#EF4444',    // Rojo
  text: '#1F2937',
  grid: '#E5E7EB'
}

interface EmployeeChartsProps {
  chartData: ChartDataItem[]
  kpis: KPIs
}

export default function EmployeeCharts({ chartData, kpis }: EmployeeChartsProps) {
  const formatMoney = (val: number) => new Intl.NumberFormat('es-BO', { 
    style: 'currency', 
    currency: 'BOB', 
    minimumFractionDigits: 2,
    maximumFractionDigits: 2 
  }).format(val)

  return (
    <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
      <h3 className="text-lg font-bold text-gray-900 mb-6">Ventas al Contado vs Crédito</h3>
      <div className="h-80 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#9CA3AF'}} />
            <YAxis 
              axisLine={false} 
              tickLine={false} 
              tick={{fill: '#9CA3AF'}} 
              tickFormatter={(value) => `$${value/1000}k`} 
            />
            <Tooltip 
              contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
              formatter={(value: number | undefined) => value !== undefined ? [formatMoney(value), ''] : ['', '']}
            />
            <Bar 
              dataKey="contado" 
              name="Contado" 
              stackId="a" 
              fill={COLORS.primary} 
              radius={[0, 0, 4, 4]} 
              barSize={40} 
            />
            <Bar 
              dataKey="credito" 
              name="Crédito" 
              stackId="a" 
              fill={COLORS.accent} 
              radius={[4, 4, 0, 0]} 
              barSize={40} 
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

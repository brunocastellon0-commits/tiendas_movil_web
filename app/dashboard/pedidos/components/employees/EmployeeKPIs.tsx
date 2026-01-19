import { DollarSign, CreditCard, AlertTriangle, TrendingUp } from 'lucide-react'
import type { KPIs } from '../../types/employee-reports'

interface EmployeeKPIsProps {
  kpis: KPIs
}

export default function EmployeeKPIs({ kpis }: EmployeeKPIsProps) {
  const formatMoney = (val: number) => new Intl.NumberFormat('es-BO', { 
    style: 'currency', 
    currency: 'BOB', 
    minimumFractionDigits: 2,
    maximumFractionDigits: 2 
  }).format(val)

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
      
      {/* Card 1: Total Vendido */}
      <div className="bg-white p-6 rounded-2xl border border-blue-100 shadow-sm relative overflow-hidden group">
        <div className="absolute right-0 top-0 w-24 h-24 bg-blue-50 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
        <div className="relative">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-sm font-medium text-gray-500">Total Vendido</p>
              <h3 className="text-3xl font-bold text-gray-900 mt-1">{formatMoney(kpis.totalVendido)}</h3>
            </div>
            <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
              <DollarSign className="w-6 h-6" />
            </div>
          </div>
          <div className="flex items-center text-sm">

          </div>
        </div>
      </div>

      {/* Card 2: Contado */}
      <div className="bg-white p-6 rounded-2xl border border-green-100 shadow-sm relative overflow-hidden group">
        <div className="absolute right-0 top-0 w-24 h-24 bg-green-50 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
        <div className="relative">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-sm font-medium text-gray-500">Ventas al Contado</p>
              <h3 className="text-3xl font-bold text-gray-900 mt-1">{formatMoney(kpis.ventasContado)}</h3>
            </div>
            <div className="p-2 bg-green-100 rounded-lg text-green-600">
              <DollarSign className="w-6 h-6" />
            </div>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-1.5 mt-2">
            <div 
              className="bg-green-500 h-1.5 rounded-full" 
              style={{ width: `${kpis.totalVendido > 0 ? (kpis.ventasContado / kpis.totalVendido * 100) : 0}%` }}
            ></div>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            {kpis.totalVendido > 0 ? Math.round(kpis.ventasContado / kpis.totalVendido * 100) : 0}% del total
          </p>
        </div>
      </div>

      {/* Card 3: Crédito */}
      <div className="bg-white p-6 rounded-2xl border border-purple-100 shadow-sm relative overflow-hidden group">
        <div className="absolute right-0 top-0 w-24 h-24 bg-purple-50 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
        <div className="relative">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-sm font-medium text-gray-500">Ventas a Crédito</p>
              <h3 className="text-3xl font-bold text-gray-900 mt-1">{formatMoney(kpis.ventasCredito)}</h3>
            </div>
            <div className="p-2 bg-purple-100 rounded-lg text-purple-600">
              <CreditCard className="w-6 h-6" />
            </div>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-1.5 mt-2">
            <div 
              className="bg-purple-500 h-1.5 rounded-full" 
              style={{ width: `${kpis.totalVendido > 0 ? (kpis.ventasCredito / kpis.totalVendido * 100) : 0}%` }}
            ></div>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            {kpis.totalVendido > 0 ? Math.round(kpis.ventasCredito / kpis.totalVendido * 100) : 0}% del total
          </p>
        </div>
      </div>

      {/* Card 4: Deuda (Riesgo) */}
      <div className="bg-white p-6 rounded-2xl border border-red-100 shadow-sm relative overflow-hidden group">
        <div className="absolute right-0 top-0 w-24 h-24 bg-red-50 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
        <div className="relative">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-sm font-medium text-gray-500">Deudas Pendientes</p>
              <h3 className="text-3xl font-bold text-red-600 mt-1">{formatMoney(kpis.deudaPendiente)}</h3>
            </div>
            <div className="p-2 bg-red-100 rounded-lg text-red-600">
              <AlertTriangle className="w-6 h-6" />
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}

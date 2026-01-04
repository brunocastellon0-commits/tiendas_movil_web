'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/utils/supabase/client'
import { 
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell 
} from 'recharts'
import { 
  TrendingUp, AlertOctagon, Wallet, Users, ArrowUpRight, 
  MoreHorizontal, FileDown, Search, Filter
} from 'lucide-react'

// --- TIPO DE DATOS ---
type ParetoCliente = {
  client_id: string
  nombre_cliente: string
  codigo_cliente: string
  zona: string
  monto_total: number
  frecuencia_pedidos: number
  ultima_compra: string
  deuda_actual: number
  pct_acumulado: number
  clasificacion_abc: 'A' | 'B' | 'C'
  clasificacion_frecuencia: string
  alerta_riesgo_pareto: boolean
}

// --- CONFIGURACIÓN DE ESTILO (Theme System) ---
const THEME = {
  colors: {
    primary: '#0F172A', // Slate 900
    risk: '#EF4444',    // Red 500
    warning: '#F59E0B', // Amber 500
    success: '#10B981', // Emerald 500
    info: '#3B82F6',    // Blue 500
    muted: '#64748B'    // Slate 500
  }
}

const formatMoney = (val: number) => 
  new Intl.NumberFormat('es-BO', { style: 'currency', currency: 'BOB', maximumFractionDigits: 0 }).format(val)

export default function ParetoAnalysis() {
  const supabase = createClient()
  
  // --- ESTADOS ---
  const [data, setData] = useState<ParetoCliente[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'TODOS' | 'A' | 'B' | 'C'>('TODOS')
  const [searchTerm, setSearchTerm] = useState('')

  // --- FETCHING ---
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      const { data: result, error } = await supabase
        .from('analytics_pareto_clientes')
        .select('*')
        .order('monto_total', { ascending: false }) // Traemos ordenado por defecto
      
      if (!error && result) setData(result)
      setLoading(false)
    }
    fetchData()
  }, [])

  // --- LÓGICA DE NEGOCIO (KPIs) ---
  const stats = useMemo(() => {
    const totalVenta = data.reduce((acc, curr) => acc + curr.monto_total, 0)
    const clientesRiesgo = data.filter(c => c.alerta_riesgo_pareto).length
    const clientesA = data.filter(c => c.clasificacion_abc === 'A').length
    const deudaTotal = data.filter(c => c.clasificacion_abc === 'A').reduce((acc, curr) => acc + curr.deuda_actual, 0)
    
    return { totalVenta, clientesRiesgo, clientesA, deudaTotal }
  }, [data])

  // --- FILTRADO DE TABLA ---
  const filteredData = useMemo(() => {
    return data.filter(item => {
      const matchesTab = activeTab === 'TODOS' || item.clasificacion_abc === activeTab
      const matchesSearch = item.nombre_cliente.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            item.codigo_cliente.toLowerCase().includes(searchTerm.toLowerCase())
      return matchesTab && matchesSearch
    })
  }, [data, activeTab, searchTerm])

  // --- DATA PARA GRÁFICO (TOP 20) ---
  const chartData = useMemo(() => data.slice(0, 20), [data])

  if (loading) return (
    <div className="min-h-[400px] flex flex-col items-center justify-center gap-3">
      <div className="w-8 h-8 border-4 border-slate-900 border-t-transparent rounded-full animate-spin"></div>
      <p className="text-slate-500 text-sm font-medium animate-pulse">Cargando inteligencia de negocios...</p>
    </div>
  )

  return (
    <div className="w-full max-w-7xl mx-auto space-y-8 p-4 md:p-8 bg-slate-50/50 min-h-screen">
      
      {/* 1. ENCABEZADO EJECUTIVO */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Análisis Pareto (80/20)</h1>
          <p className="text-slate-500 text-sm mt-1">Visión estratégica de concentración de ingresos y riesgo de cartera.</p>
        </div>
        <div className="flex gap-3">
          <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 text-sm font-medium rounded-lg shadow-sm hover:bg-slate-50 transition-all">
            <FileDown className="w-4 h-4" /> Exportar CSV
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg shadow-md hover:bg-slate-800 transition-all">
            <TrendingUp className="w-4 h-4" /> Ver Proyecciones
          </button>
        </div>
      </header>

      {/* 2. TARJETAS DE KPI (Bento Style) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KPICard 
          title="Venta Total (YTD)" 
          value={formatMoney(stats.totalVenta)} 
          icon={<Wallet className="w-5 h-5 text-emerald-600" />}
          trend="+12% vs mes anterior"
          trendColor="text-emerald-600"
        />
        <KPICard 
          title="Clientes VIP (Clase A)" 
          value={stats.clientesA.toString()} 
          subtitle="Generan el 80% del ingreso"
          icon={<Users className="w-5 h-5 text-indigo-600" />}
        />
        <KPICard 
          title="Riesgo de Fuga" 
          value={stats.clientesRiesgo.toString()} 
          subtitle="Clientes A con baja frecuencia"
          icon={<AlertOctagon className="w-5 h-5 text-orange-600" />}
          alert
        />
        <KPICard 
          title="Deuda en VIPs" 
          value={formatMoney(stats.deudaTotal)} 
          subtitle="Capital expuesto en Clase A"
          icon={<TrendingUp className="w-5 h-5 text-rose-600" />}
        />
      </div>

      {/* 3. SECCIÓN PRINCIPAL: GRÁFICO + DATOS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* GRÁFICO (Ocupa 2 columnas) */}
        <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-semibold text-slate-900">Concentración de Ventas (Top 20)</h3>
            <div className="flex items-center gap-4 text-xs text-slate-500">
               <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-800"></span> Venta</span>
               <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500"></span> % Acumulado</span>
            </div>
          </div>
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{top:10, right:10, left:0, bottom:0}}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="nombre_cliente" hide />
                <YAxis yAxisId="left" orientation="left" tickFormatter={(v) => `${v/1000}k`} axisLine={false} tickLine={false} fontSize={12} stroke="#94A3B8" />
                <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => `${v}%`} axisLine={false} tickLine={false} fontSize={12} stroke="#94A3B8" />
                <Tooltip 
                  cursor={{ fill: '#F1F5F9' }}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                />
                <Bar yAxisId="left" dataKey="monto_total" barSize={20} radius={[4, 4, 0, 0]}>
                   {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.clasificacion_abc === 'A' ? THEME.colors.primary : THEME.colors.muted} />
                   ))}
                </Bar>
                <Line yAxisId="right" type="monotone" dataKey="pct_acumulado" stroke={THEME.colors.warning} strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* CONTROLES RÁPIDOS (Ocupa 1 columna) */}
        <div className="bg-slate-900 p-6 rounded-xl shadow-lg text-white flex flex-col justify-between relative overflow-hidden">
          <div className="relative z-10">
            <h3 className="text-lg font-bold mb-1">Estrategia Comercial</h3>
            <p className="text-slate-400 text-sm mb-6">Acciones recomendadas para esta semana.</p>
            
            <div className="space-y-4">
              <div className="p-3 bg-white/10 rounded-lg backdrop-blur-sm">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-amber-400 font-medium">Recuperación</span>
                  <span className="text-xs text-slate-300">Alta Prioridad</span>
                </div>
                <p className="text-xs text-slate-300">Contactar a los <b>{stats.clientesRiesgo} clientes VIP</b> que no han comprado en el último mes.</p>
              </div>

              <div className="p-3 bg-white/10 rounded-lg backdrop-blur-sm">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-emerald-400 font-medium">Cross-selling</span>
                  <span className="text-xs text-slate-300">Oportunidad</span>
                </div>
                <p className="text-xs text-slate-300">Ofrecer descuento por volumen a clientes B cerca de convertirse en A.</p>
              </div>
            </div>
          </div>
          
          {/* Decoración de fondo abstracta */}
          <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-indigo-500 rounded-full blur-[80px] opacity-20"></div>
        </div>
      </div>

      {/* 4. TABLA DETALLADA CON FILTROS */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        
        {/* Toolbar de Tabla */}
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4">
          
          {/* Tabs de Filtro */}
          <div className="flex p-1 bg-slate-100 rounded-lg">
            {['TODOS', 'A', 'B', 'C'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${
                  activeTab === tab 
                    ? 'bg-white text-slate-900 shadow-sm' 
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {tab === 'TODOS' ? 'Todos' : `Clase ${tab}`}
              </button>
            ))}
          </div>

          {/* Buscador */}
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Buscar cliente o código..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border-none rounded-lg text-sm focus:ring-2 focus:ring-slate-200 outline-none transition-all"
            />
          </div>
        </div>

        {/* Tabla */}
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-100 text-xs uppercase tracking-wider text-slate-500 font-semibold bg-slate-50/50">
                <th className="px-6 py-4">Cliente</th>
                <th className="px-6 py-4 text-right">Venta Total</th>
                <th className="px-6 py-4 text-right">Deuda</th>
                <th className="px-6 py-4 w-48 text-left">Impacto Acumulado</th>
                <th className="px-6 py-4 text-center">Clasificación</th>
                <th className="px-6 py-4 text-center">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredData.slice(0, 50).map((cliente) => (
                <tr key={cliente.client_id} className="group hover:bg-slate-50 transition-colors">
                  
                  <td className="px-6 py-3">
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-800 text-sm">{cliente.nombre_cliente}</span>
                      <span className="text-xs text-slate-400 flex items-center gap-1">
                        {cliente.codigo_cliente} • {cliente.zona}
                        {cliente.alerta_riesgo_pareto && (
                          <span className="text-rose-500 bg-rose-50 px-1.5 rounded text-[10px] font-bold border border-rose-100">RIESGO</span>
                        )}
                      </span>
                    </div>
                  </td>

                  <td className="px-6 py-3 text-right">
                    <p className="font-bold text-slate-900 text-sm">{formatMoney(cliente.monto_total)}</p>
                    <p className="text-[10px] text-slate-400">{cliente.frecuencia_pedidos} pedidos</p>
                  </td>

                  <td className="px-6 py-3 text-right">
                    <span className={`text-sm font-medium ${cliente.deuda_actual > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                      {cliente.deuda_actual > 0 ? formatMoney(cliente.deuda_actual) : '-'}
                    </span>
                  </td>

                  <td className="px-6 py-3">
                    <div className="flex flex-col gap-1">
                      <div className="flex justify-between text-[10px] text-slate-500">
                        <span>Contribución</span>
                        <span className="font-mono">{cliente.pct_acumulado}%</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${cliente.clasificacion_abc === 'A' ? 'bg-emerald-500' : 'bg-amber-400'}`} 
                          style={{ width: `${Math.min(cliente.pct_acumulado, 100)}%` }}
                        ></div>
                      </div>
                    </div>
                  </td>

                  <td className="px-6 py-3 text-center">
                    <span className={`
                      inline-flex items-center justify-center w-8 h-8 rounded-lg text-xs font-bold
                      ${cliente.clasificacion_abc === 'A' ? 'bg-slate-900 text-white shadow-md shadow-slate-200' : 
                        cliente.clasificacion_abc === 'B' ? 'bg-white border border-slate-200 text-slate-600' : 'bg-slate-100 text-slate-400'}
                    `}>
                      {cliente.clasificacion_abc}
                    </span>
                  </td>

                  <td className="px-6 py-3 text-center">
                    <button className="p-2 hover:bg-white hover:shadow-md rounded-full text-slate-400 hover:text-indigo-600 transition-all">
                      <ArrowUpRight className="w-4 h-4" />
                    </button>
                  </td>

                </tr>
              ))}
            </tbody>
          </table>
          {filteredData.length === 0 && (
             <div className="p-10 text-center text-slate-400 text-sm">No se encontraron clientes con estos filtros.</div>
          )}
        </div>
        <div className="p-4 border-t border-slate-100 bg-slate-50 text-xs text-center text-slate-400">
          Mostrando los primeros 50 registros de {filteredData.length} resultados
        </div>
      </div>
    </div>
  )
}

// --- SUBCOMPONENTES UI (Para mantener el código limpio) ---
function KPICard({ title, value, subtitle, icon, trend, trendColor, alert }: any) {
  return (
    <div className={`p-5 rounded-xl border shadow-sm transition-all hover:shadow-md ${alert ? 'bg-white border-rose-100' : 'bg-white border-slate-200'}`}>
      <div className="flex justify-between items-start mb-2">
        <span className="text-slate-500 text-xs font-bold uppercase tracking-wider">{title}</span>
        <div className={`p-2 rounded-lg ${alert ? 'bg-rose-50' : 'bg-slate-50'}`}>
          {icon}
        </div>
      </div>
      <div className="mt-1">
        <h3 className="text-2xl font-bold text-slate-900">{value}</h3>
        {subtitle && <p className="text-xs text-slate-400 mt-1">{subtitle}</p>}
        {trend && (
           <div className={`flex items-center gap-1 text-xs font-bold mt-2 ${trendColor}`}>
             <TrendingUp className="w-3 h-3" /> {trend}
           </div>
        )}
      </div>
    </div>
  )
}
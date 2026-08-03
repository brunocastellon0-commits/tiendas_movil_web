'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/utils/supabase/client'
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts'
import { 
  MapPin, CalendarDays, TrendingUp, Loader2, AlertCircle 
} from 'lucide-react'

function formatNumber(val: number) {
  return new Intl.NumberFormat('es-BO').format(val)
}

export default function VisitasReport() {
  const supabase = createClient()
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      setError(null)
      try {
        // Solo necesitamos los últimos 12 meses para los KPIs y gráficos
        const since = new Date()
        since.setFullYear(since.getFullYear() - 1)
        const sinceISO = since.toISOString()

        const { data: visits, error: err } = await supabase
          .from('visits')
          .select('id, start_time, created_at, outcome')
          .neq('outcome', 'pending')
          .not('start_time', 'is', null)
          .gte('start_time', sinceISO)
          .order('start_time', { ascending: false })
          .limit(5000)

        if (err) throw err

        if (visits) setData(visits)
      } catch (e: any) {
        setError(e.message || 'Error al cargar visitas')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const stats = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)

    const hoy = data.filter(v => new Date(v.start_time) >= today).length
    const esteMes = data.filter(v => new Date(v.start_time) >= monthStart).length
    const total = data.length
    const conVenta = data.filter(v => v.outcome === 'sale').length

    // Por día (últimos 30 días)
    const daysMap = new Map<string, number>()
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000)
    data.forEach(v => {
      const d = new Date(v.start_time)
      if (d >= thirtyDaysAgo) {
        const key = d.toISOString().slice(0, 10)
        daysMap.set(key, (daysMap.get(key) || 0) + 1)
      }
    })
    const dailyData = Array.from(daysMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date: date.slice(5), count }))

    // Por mes (últimos 12 meses)
    const monthsMap = new Map<string, number>()
    const twelveMonthsAgo = new Date()
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12)
    data.forEach(v => {
      const d = new Date(v.start_time)
      if (d >= twelveMonthsAgo) {
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        monthsMap.set(key, (monthsMap.get(key) || 0) + 1)
      }
    })
    const monthlyData = Array.from(monthsMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count }))

    const promedioDiario = dailyData.length > 0 
      ? Math.round(dailyData.reduce((s, d) => s + d.count, 0) / dailyData.length) 
      : 0

    return { hoy, esteMes, total, conVenta, promedioDiario, dailyData, monthlyData }
  }, [data])

  if (loading) return (
    <div className="min-h-[300px] flex flex-col items-center justify-center gap-3">
      <Loader2 className="w-8 h-8 text-green-600 animate-spin" />
      <p className="text-gray-500 text-sm font-medium">Cargando reporte de visitas...</p>
    </div>
  )

  if (error) return (
    <div className="bg-red-50 border border-red-200 p-4 rounded-2xl flex items-center gap-2 text-sm text-red-700">
      <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
    </div>
  )

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-gradient-to-br from-green-500 to-emerald-600 p-5 rounded-2xl shadow-lg text-white">
          <MapPin className="w-6 h-6 mb-2 opacity-80" />
          <p className="text-xs font-bold opacity-80">Hoy</p>
          <p className="text-3xl font-black">{formatNumber(stats.hoy)}</p>
        </div>
        <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-5 rounded-2xl shadow-lg text-white">
          <CalendarDays className="w-6 h-6 mb-2 opacity-80" />
          <p className="text-xs font-bold opacity-80">Este Mes</p>
          <p className="text-3xl font-black">{formatNumber(stats.esteMes)}</p>
        </div>
        <div className="bg-gradient-to-br from-purple-500 to-violet-600 p-5 rounded-2xl shadow-lg text-white">
          <TrendingUp className="w-6 h-6 mb-2 opacity-80" />
          <p className="text-xs font-bold opacity-80">Prom. Diario</p>
          <p className="text-3xl font-black">{formatNumber(stats.promedioDiario)}</p>
        </div>
        <div className="bg-gradient-to-br from-amber-500 to-orange-600 p-5 rounded-2xl shadow-lg text-white">
          <MapPin className="w-6 h-6 mb-2 opacity-80" />
          <p className="text-xs font-bold opacity-80">Total Visitas</p>
          <p className="text-3xl font-black">{formatNumber(stats.total)}</p>
        </div>
        <div className="bg-gradient-to-br from-teal-500 to-cyan-600 p-5 rounded-2xl shadow-lg text-white">
          <TrendingUp className="w-6 h-6 mb-2 opacity-80" />
          <p className="text-xs font-bold opacity-80">Con Venta</p>
          <p className="text-3xl font-black">{formatNumber(stats.conVenta)}</p>
        </div>
      </div>

      {/* Gráfico por día */}
      <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-200">
        <h3 className="font-bold text-gray-900 mb-1">Visitas por Día (Últimos 30 días)</h3>
        <p className="text-xs text-gray-500 mb-4">Total de puntos atendidos por día</p>
        {stats.dailyData.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-10">Sin datos en el período</p>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={stats.dailyData} margin={{ top: 10, right: 10, left: -10, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
              <XAxis dataKey="date" angle={-45} textAnchor="end" height={60} fontSize={11} stroke="#94A3B8" />
              <YAxis allowDecimals={false} fontSize={11} stroke="#94A3B8" axisLine={false} tickLine={false} />
              <Tooltip
                cursor={{ fill: '#F1F5F9' }}
                contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
                formatter={(value: any) => [value, 'Visitas']}
                labelFormatter={(label) => `Fecha: ${label}`}
              />
              <Bar dataKey="count" fill="#10B981" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Gráfico por mes */}
      <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-200">
        <h3 className="font-bold text-gray-900 mb-1">Visitas por Mes (Últimos 12 meses)</h3>
        <p className="text-xs text-gray-500 mb-4">Total de puntos atendidos por mes</p>
        {stats.monthlyData.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-10">Sin datos en el período</p>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={stats.monthlyData} margin={{ top: 10, right: 10, left: -10, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
              <XAxis dataKey="date" angle={-45} textAnchor="end" height={60} fontSize={11} stroke="#94A3B8" />
              <YAxis allowDecimals={false} fontSize={11} stroke="#94A3B8" axisLine={false} tickLine={false} />
              <Tooltip
                cursor={{ fill: '#F1F5F9' }}
                contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
                formatter={(value: any) => [value, 'Visitas']}
                labelFormatter={(label) => `Mes: ${label}`}
              />
              <Bar dataKey="count" fill="#6366F1" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}

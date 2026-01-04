'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/utils/supabase/client'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import EmployeeFilters from './employees/EmployeeFilters'
import EmployeeKPIs from './employees/EmployeeKPIs'
import EmployeeCharts from './employees/EmployeeCharts'
import EmployeeOrdersTable from './employees/EmployeeOrdersTable'
import PerformanceEvolution from './employees/PerformanceEvolution'
import type { Employee, Order, KPIs, ChartDataItem } from '../types/employee-reports'

export default function EmployeesTab() {
  const supabase = createClient()
  
  // --- Estados ---
  const [loading, setLoading] = useState(false)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [selectedEmployee, setSelectedEmployee] = useState<string>('ALL')
  const [dateRange, setDateRange] = useState({ start: '2025-01-01', end: '2026-12-31' })
  const [orders, setOrders] = useState<Order[]>([])

  // --- Carga Inicial ---
  useEffect(() => {
    const fetchEmployees = async () => {
      console.log('🔍 Cargando empleados...')
      const { data, error } = await supabase.from('employees').select('id, full_name')
      
      if (error) {
        console.error('❌ Error cargando empleados:', error)
        return
      }
      
      console.log('✅ Empleados cargados:', data)
      
      if (data) {
        setEmployees(data)
        console.log('✅ Total de empleados:', data.length)
      }
    }
    fetchEmployees()
  }, [])

  // --- Carga de Datos del Reporte ---
  useEffect(() => {
    if (!selectedEmployee) return

    const fetchData = async () => {
      setLoading(true)
      
      console.log('📊 Cargando pedidos para empleado:', selectedEmployee)
      console.log('📅 Rango de fechas:', dateRange.start, 'a', dateRange.end)
      
      try {
        // Query 1: Pedidos
        let query = supabase
          .from('pedidos')
          .select(`
            id,
            numero_documento,
            fecha_pedido,
            total_venta,
            tipo_pago,
            estado,
            observacion,
            empleado_id,
            clients:clients_id (name, legacy_id),
            employees:empleado_id (full_name)
          `)
          .gte('fecha_pedido', dateRange.start)
          .lte('fecha_pedido', dateRange.end)
          .order('fecha_pedido', { ascending: false })

        // Si no es "ALL", filtrar por empleado específico
        if (selectedEmployee !== 'ALL') {
          query = query.eq('empleado_id', selectedEmployee)
        }

        const { data, error } = await query

        if (error) {
          console.error('❌ Error cargando pedidos:', error)
          throw error
        }
        
        const msg = selectedEmployee === 'ALL' 
          ? `✅ Pedidos cargados de TODOS los empleados: ${data?.length || 0} pedidos`
          : `✅ Pedidos cargados: ${data?.length || 0} pedidos`
        console.log(msg)
        setOrders((data as any) || [])
        
      } catch (error) {
        console.error('Error fetching employee orders:', error)
        setOrders([])
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [selectedEmployee, dateRange])

  // --- Cálculos y Métricas (KPIs) ---
  const kpis: KPIs = useMemo(() => {
    const totalVendido = orders.reduce((acc, o) => acc + o.total_venta, 0)
    const ventasContado = orders.filter(o => o.tipo_pago === 'Contado').reduce((acc, o) => acc + o.total_venta, 0)
    const ventasCredito = orders.filter(o => o.tipo_pago === 'Crédito').reduce((acc, o) => acc + o.total_venta, 0)
    const deudaPendiente = orders.filter(o => o.tipo_pago === 'Crédito' && o.estado === 'Pendiente').reduce((acc, o) => acc + o.total_venta, 0)
    
    return { totalVendido, ventasContado, ventasCredito, deudaPendiente }
  }, [orders])

  // --- Datos para Gráficos ---
  const chartData: ChartDataItem[] = useMemo(() => {
    // Agrupar pedidos por semana
    const weekMap = new Map<string, { contado: number; credito: number }>()
    
    orders.forEach(order => {
      const date = new Date(order.fecha_pedido)
      // Obtener el número de semana del año
      const weekNum = Math.ceil((date.getDate()) / 7)
      const monthYear = format(date, 'MMM yyyy', { locale: es })
      const weekKey = `Sem ${weekNum} - ${monthYear}`
      
      if (!weekMap.has(weekKey)) {
        weekMap.set(weekKey, { contado: 0, credito: 0 })
      }
      
      const week = weekMap.get(weekKey)!
      if (order.tipo_pago === 'Contado') {
        week.contado += order.total_venta
      } else {
        week.credito += order.total_venta
      }
    })
    
    // Convertir a array y ordenar
    return Array.from(weekMap.entries())
      .map(([name, data]) => ({ name, ...data }))
      .slice(0, 5) // Mostrar últimas 5 semanas
  }, [orders])

  // Obtener nombre del empleado seleccionado para el título
  const selectedEmployeeName = selectedEmployee === 'ALL' 
    ? 'Todos los Empleados' 
    : employees.find(e => e.id === selectedEmployee)?.full_name || 'Empleado'

  return (
    <div className="space-y-8 pb-10">
      
      {/* 1. HEADER */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          {selectedEmployee === 'ALL' 
            ? ' Estadísticas Generales de Todos los Empleados' 
            : ` Detalle de Pedidos - ${selectedEmployeeName}`
          }
        </h1>
        <p className="text-gray-500">
          {selectedEmployee === 'ALL'
            ? 'Vista consolidada del desempeño de ventas de todo el equipo.'
            : 'Análisis detallado del desempeño de ventas y gestión de pedidos.'
          }
        </p>
      </div>

      {/* 2. FILTROS */}
      <EmployeeFilters
        employees={employees}
        selectedEmployee={selectedEmployee}
        setSelectedEmployee={setSelectedEmployee}
        dateRange={dateRange}
        setDateRange={setDateRange}
      />

      {/* 3. KPI CARDS */}
      <EmployeeKPIs kpis={kpis} />

      {/* 4. GRÁFICOS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <EmployeeCharts 
          chartData={chartData}
          kpis={kpis}
        />
        <PerformanceEvolution orders={orders} />
      </div>

      {/* 5. TABLA DETALLADA */}
      <EmployeeOrdersTable 
        orders={orders}
        loading={loading}
      />

    </div>
  )
}

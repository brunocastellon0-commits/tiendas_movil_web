export interface Order {
  id: string
  numero_documento: number
  fecha_pedido: string
  total_venta: number
  tipo_pago: 'Contado' | 'Crédito'
  estado: 'Pendiente' | 'Aprobado' | 'Entregado' | 'Anulado'
  observacion: string | null
  visit_id: number | null
  clients: {
    name: string
    legacy_id: string | null
  } | null
  employees: {
    full_name: string
  } | null
}

export interface Visit {
  id: number
  created_at: string
  duration_seconds: number | null
  outcome: string | null
  pedidos?: {
    id: string
    total_venta: number
  }[]
}

export interface EfficiencyMetrics {
  totalVisitas: number
  visitasConPedido: number
  tasaEfectividad: number
  ticketPromedio: number
  tiempoPromedio: number
}

export interface TimelineDataItem {
  date: string
  visitas: number
  ventas: number
  monto: number
}

export interface KPIs {
  totalVendido: number
  ventasContado: number
  ventasCredito: number
  deudaPendiente: number
}

export interface ChartDataItem {
  name: string
  contado: number
  credito: number
}

export interface PieDataItem {
  name: string
  value: number
  [key: string]: string | number
}

export interface Employee {
  id: string
  full_name: string
}

export interface DateRange {
  start: string
  end: string
}

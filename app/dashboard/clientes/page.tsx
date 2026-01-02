'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/utils/supabase/client'
import { 
  Search, 
  Users, 
  MapPin, 
  CreditCard, 
  AlertTriangle, 
  Briefcase, 
  Edit2,
  Trash2,
  Save,
  Loader2,
  X,
  Phone,
  FileText
} from 'lucide-react'

// --- 1. Tipos TypeScript ---
type Client = {
  id: string
  code: string
  name: string
  business_name: string | null
  tax_id: string | null
  address: string | null
  phones: string | null
  credit_limit: number
  current_balance: number
  latitude: number | null
  longitude: number | null
  status: string // 'Vigente' | 'Suspendido'
}

// --- 2. Componente Principal ---
export default function ClientsPage() {
  const supabase = createClient()
  
  // Estados de datos
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  
  // Estados del formulario
  const [formLoading, setFormLoading] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [formSuccess, setFormSuccess] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  
  // Estado para GPS
  const [gpsLoading, setGpsLoading] = useState(false)

  // Formulario inicial
  const initialFormState = {
    code: '',
    name: '',
    business_name: '',
    tax_id: '',
    address: '',
    phones: '',
    credit_limit: '',
    current_balance: '0',
    latitude: null as number | null,
    longitude: null as number | null,
    status: 'Vigente'
  }

  const [formData, setFormData] = useState(initialFormState)

  // --- Cargar Datos ---
  useEffect(() => {
    const fetchClients = async () => {
      try {
        setLoading(true)
        const { data, error } = await supabase
          .from('clients') // Asegúrate que tu tabla se llame 'clients' o 'clientes'
          .select('*')
          .order('created_at', { ascending: false })

        if (error) throw error
        if (data) setClients(data as any)

      } catch (error) {
        console.error('Error cargando clientes:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchClients()
  }, [])

  // --- KPIs y Filtros ---
  const filteredClients = useMemo(() => {
    return clients.filter(c => 
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.tax_id?.includes(searchTerm)
    )
  }, [clients, searchTerm])

  const kpis = useMemo(() => {
    const totalClients = clients.length
    // Suma de saldos (Deuda total de clientes hacia la empresa)
    const totalDebt = clients.reduce((acc, c) => acc + (c.current_balance || 0), 0)
    const activeClients = clients.filter(c => c.status === 'Vigente').length
    
    return { totalClients, totalDebt, activeClients }
  }, [clients])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-BO', { style: 'currency', currency: 'BOB' }).format(amount)
  }

  // --- Manejo del Formulario ---
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleClearForm = () => {
    if (confirm('¿Limpiar formulario?')) {
      setFormData(initialFormState)
      setFormError(null)
      setFormSuccess(false)
      setIsEditing(false)
      setEditingId(null)
    }
  }

  // Función GPS Web
  const handleCaptureGPS = () => {
    if (!navigator.geolocation) {
      alert('Tu navegador no soporta geolocalización')
      return
    }
    setGpsLoading(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setFormData(prev => ({
          ...prev,
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude
        }))
        setGpsLoading(false)
      },
      (err) => {
        alert('Error obteniendo ubicación: ' + err.message)
        setGpsLoading(false)
      }
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    setFormSuccess(false)

    if (!formData.name || !formData.code) {
      setFormError('El nombre y el código son obligatorios.')
      return
    }

    try {
      setFormLoading(true)
      const { data: { user } } = await supabase.auth.getUser()

      const payload = {
        code: formData.code,
        name: formData.name,
        business_name: formData.business_name,
        tax_id: formData.tax_id,
        address: formData.address,
        phones: formData.phones,
        credit_limit: parseFloat(formData.credit_limit || '0'),
        latitude: formData.latitude,
        longitude: formData.longitude,
        status: formData.status,
        // Si es nuevo, asignamos vendor_id, si edita no lo tocamos necesariamente
        vendor_id: user?.id 
      }

      if (isEditing && editingId) {
        // UPDATE
        const { error } = await supabase
          .from('clients')
          .update(payload)
          .eq('id', editingId)
        if (error) throw error

        // Actualizar estado local
        setClients(clients.map(c => c.id === editingId ? { ...c, ...payload, id: editingId, current_balance: c.current_balance } : c))
      } else {
        // INSERT
        const { data, error } = await supabase
          .from('clients')
          .insert([{ ...payload, current_balance: 0 }]) // Saldo inicial 0
          .select()
        if (error) throw error

        if (data) setClients([data[0] as any, ...clients])
      }

      setFormSuccess(true)
      setFormData(initialFormState)
      setIsEditing(false)
      setEditingId(null)

      setTimeout(() => setFormSuccess(false), 3000)

    } catch (err: any) {
      console.error(err)
      setFormError(err.message || 'Error al guardar')
    } finally {
      setFormLoading(false)
    }
  }

  const handleEdit = (client: Client) => {
    setFormData({
      code: client.code,
      name: client.name,
      business_name: client.business_name || '',
      tax_id: client.tax_id || '',
      address: client.address || '',
      phones: client.phones || '',
      credit_limit: client.credit_limit.toString(),
      current_balance: client.current_balance.toString(),
      latitude: client.latitude,
      longitude: client.longitude,
      status: client.status
    })
    setIsEditing(true)
    setEditingId(client.id)
    setFormError(null)
    
    // Scroll suave hacia arriba
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Suspender cliente? Esto no borrará su historial.')) return

    try {
      const { error } = await supabase
        .from('clients')
        .update({ status: 'Suspendido' })
        .eq('id', id)
      
      if (error) throw error
      setClients(clients.map(c => c.id === id ? { ...c, status: 'Suspendido' } : c))
    } catch (err) {
      alert('Error al suspender')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6 space-y-8">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
            Gestión de Clientes
          </h1>
          <p className="text-gray-600 text-sm mt-2">Administra tu cartera, créditos y geolocalización</p>
        </div>
      </div>

      {/* KPI CARDS (Estilo Idéntico a Productos) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* KPI 1: Total Clientes */}
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-6 rounded-2xl shadow-lg text-white">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl">
              <Users className="w-6 h-6" />
            </div>
            <span className="text-xs font-semibold bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full">
              TOTAL CLIENTES
            </span>
          </div>
          <h3 className="text-3xl font-bold mb-1">{kpis.totalClients}</h3>
          <p className="text-sm text-blue-100">Registrados en sistema</p>
        </div>

        {/* KPI 2: Saldo en Calle (Deuda Total) */}
        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 p-6 rounded-2xl shadow-lg text-white">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl">
              <CreditCard className="w-6 h-6" />
            </div>
            <span className="text-xs font-semibold bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full">
              SALDO TOTAL
            </span>
          </div>
          <h3 className="text-3xl font-bold mb-1">{formatCurrency(kpis.totalDebt)}</h3>
          <p className="text-sm text-emerald-100">Cuentas por cobrar</p>
        </div>

        {/* KPI 3: Activos */}
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 p-6 rounded-2xl shadow-lg text-white">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl">
              <Briefcase className="w-6 h-6" />
            </div>
            <span className="text-xs font-semibold bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full">
              ACTIVOS
            </span>
          </div>
          <h3 className="text-3xl font-bold mb-1">{kpis.activeClients}</h3>
          <p className="text-sm text-purple-100">Clientes vigentes</p>
        </div>
      </div>

      {/* FORMULARIO INTEGRADO */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-200">
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 px-8 py-6 border-b border-gray-200 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-green-600 rounded-xl shadow-lg shadow-green-900/20">
                <Users className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  {isEditing ? 'Editar Cliente' : 'Nuevo Cliente'}
                </h2>
                <p className="text-sm text-gray-600 mt-0.5">
                  {isEditing ? 'Actualizando datos del cliente' : 'Registrar un nuevo punto de venta'}
                </p>
              </div>
            </div>
            {isEditing && (
              <button
                type="button"
                onClick={() => {
                  setIsEditing(false)
                  setEditingId(null)
                  setFormData(initialFormState)
                }}
                className="text-sm text-gray-600 hover:text-gray-900 font-medium"
              >
                Cancelar edición
              </button>
            )}
          </div>
        </div>

        <div className="p-8">
          {/* Mensajes de Estado */}
          {formError && (
            <div className="mb-6 flex items-start gap-3 bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl">
              <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Error</p>
                <p className="text-sm mt-0.5">{formError}</p>
              </div>
            </div>
          )}

          {formSuccess && (
            <div className="mb-6 flex items-start gap-3 bg-green-50 border border-green-200 text-green-700 p-4 rounded-xl">
              <Users className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">¡Éxito!</p>
                <p className="text-sm mt-0.5">La operación se completó correctamente.</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-8">
            
            {/* Sección 1: Datos Generales */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b-2 border-green-100">
                <div className="w-1 h-6 bg-green-600 rounded-full"></div>
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">
                  Datos Generales
                </h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">
                    Código <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="code"
                    value={formData.code}
                    onChange={handleChange}
                    className="w-full px-4 py-3 text-sm border-2 border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                    placeholder="Ej: CLI-001"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">
                    Nombre de Tienda / Cliente <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    className="w-full px-4 py-3 text-sm border-2 border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                    placeholder="Ej: Tienda El Sol"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">Razón Social</label>
                  <input
                    type="text"
                    name="business_name"
                    value={formData.business_name || ''}
                    onChange={handleChange}
                    className="w-full px-4 py-3 text-sm border-2 border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                    placeholder="Juan Perez S.A."
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">NIT / CI</label>
                  <input
                    type="text"
                    name="tax_id"
                    value={formData.tax_id || ''}
                    onChange={handleChange}
                    className="w-full px-4 py-3 text-sm border-2 border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Sección 2: Contacto, Crédito y Ubicación */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b-2 border-blue-100">
                <div className="w-1 h-6 bg-blue-600 rounded-full"></div>
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">
                  Contacto, Crédito y GPS
                </h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">Teléfono</label>
                  <div className="relative">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      name="phones"
                      value={formData.phones || ''}
                      onChange={handleChange}
                      className="w-full pl-10 pr-4 py-3 text-sm border-2 border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">Límite de Crédito (Bs)</label>
                  <input
                    type="number"
                    name="credit_limit"
                    value={formData.credit_limit}
                    onChange={handleChange}
                    className="w-full px-4 py-3 text-sm border-2 border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                    placeholder="0.00"
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700">Dirección</label>
                  <input
                    type="text"
                    name="address"
                    value={formData.address || ''}
                    onChange={handleChange}
                    className="w-full px-4 py-3 text-sm border-2 border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                    placeholder="Av. Principal #123"
                  />
                </div>

                {/* Módulo GPS embebido */}
                <div className="space-y-2 md:col-span-2 bg-gray-50 p-4 rounded-xl border-2 border-gray-100">
                    <div className="flex justify-between items-center mb-2">
                        <label className="text-sm font-semibold text-gray-700">Geolocalización</label>
                        {formData.latitude && (
                            <span className="text-xs text-green-600 font-bold bg-green-100 px-2 py-1 rounded">
                                GPS Capturado
                            </span>
                        )}
                    </div>
                    
                    <div className="flex gap-4 items-center">
                         <div className="flex-1 text-xs text-gray-500 font-mono bg-white p-2 rounded border border-gray-200">
                            Lat: {formData.latitude || '---'}<br/>
                            Lon: {formData.longitude || '---'}
                         </div>
                         <button
                           type="button"
                           onClick={handleCaptureGPS}
                           disabled={gpsLoading}
                           className="flex items-center gap-2 px-4 py-2 bg-white border-2 border-green-500 text-green-700 rounded-lg hover:bg-green-50 font-semibold text-sm transition-all"
                         >
                            {gpsLoading ? <Loader2 className="w-4 h-4 animate-spin"/> : <MapPin className="w-4 h-4" />}
                            Capturar Ubicación
                         </button>
                    </div>
                </div>

              </div>
            </div>

            {/* BOTONES DE ACCIÓN */}
            <div className="flex gap-4 pt-6 border-t-2 border-gray-100">
              <button
                type="button"
                onClick={handleClearForm}
                className="px-8 py-3.5 border-2 border-orange-200 text-orange-700 bg-orange-50 rounded-xl hover:bg-orange-100 hover:border-orange-300 font-semibold transition-all flex items-center gap-2 shadow-sm hover:shadow"
              >
                <X className="w-5 h-5" />
                Limpiar
              </button>
              <button
                type="submit"
                disabled={formLoading}
                className={`flex-1 flex items-center justify-center gap-3 px-8 py-3.5 rounded-xl text-white font-semibold transition-all shadow-lg ${
                  formLoading
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 shadow-green-900/20 hover:shadow-xl'
                }`}
              >
                {formLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5" />
                    {isEditing ? 'Actualizar Cliente' : 'Guardar Cliente'}
                  </>
                )}
              </button>
            </div>

          </form>
        </div>
      </div>

      {/* TABLA DE CLIENTES */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
        
        {/* Toolbar de búsqueda */}
        <div className="bg-gradient-to-r from-gray-50 to-slate-50 px-6 py-5 border-b border-gray-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input 
                type="text"
                placeholder="Buscar cliente por nombre o código..."
                className="w-full pl-12 pr-4 py-3 text-sm border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-600">Total</span>
              <span className="font-bold text-green-600">{filteredClients.length}</span>
              <span className="text-gray-600">clientes</span>
            </div>
          </div>
        </div>

        {/* Tabla */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gradient-to-r from-gray-50 to-slate-50 border-b-2 border-gray-200">
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Cliente / Negocio</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Contacto</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Ubicación</th>
                <th className="px-6 py-4 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">Saldo (Deuda)</th>
                <th className="px-6 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">Estado</th>
                <th className="px-6 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <Loader2 className="w-10 h-10 text-green-600 animate-spin" />
                      <p className="text-gray-600 font-medium">Cargando cartera...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredClients.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center text-gray-500">
                    No se encontraron clientes coincidentes
                  </td>
                </tr>
              ) : (
                filteredClients.map((client) => (
                  <tr key={client.id} className="hover:bg-gradient-to-r hover:from-green-50/30 hover:to-emerald-50/30 transition-all">
                    
                    <td className="px-6 py-5">
                      <div className="flex flex-col gap-1">
                        <span className="text-sm font-bold text-gray-900">
                          {client.name}
                        </span>
                        <div className="flex items-center gap-2">
                             <span className="text-xs text-gray-500 font-mono bg-gray-100 px-2 py-0.5 rounded border border-gray-200">
                                {client.code}
                             </span>
                             {client.business_name && (
                                <span className="text-xs text-gray-400 flex items-center gap-1">
                                    <FileText className="w-3 h-3"/> {client.business_name}
                                </span>
                             )}
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-5">
                        <div className="text-sm text-gray-600">{client.phones || 'S/N'}</div>
                        <div className="text-xs text-gray-400">NIT: {client.tax_id || 'S/N'}</div>
                    </td>

                    <td className="px-6 py-5">
                        <div className="text-sm text-gray-600 max-w-xs truncate" title={client.address || ''}>
                             {client.address || 'Sin dirección'}
                        </div>
                        {client.latitude ? (
                             <div className="flex items-center gap-1 text-xs text-green-600 mt-1">
                                <MapPin className="w-3 h-3" /> GPS Activo
                             </div>
                        ) : (
                             <div className="text-xs text-gray-400 mt-1 italic">Sin GPS</div>
                        )}
                    </td>

                    <td className="px-6 py-5 text-right">
                       <span className={`text-sm font-bold ${client.current_balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {formatCurrency(client.current_balance)}
                       </span>
                    </td>

                    <td className="px-6 py-5 text-center">
                       <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border ${
                         client.status === 'Vigente'
                           ? 'bg-green-100 text-green-700 border-green-200' 
                           : 'bg-red-100 text-red-700 border-red-200'
                       }`}>
                         <div className={`w-2 h-2 rounded-full ${
                           client.status === 'Vigente' ? 'bg-green-500' : 'bg-red-500'
                         }`}></div>
                         {client.status}
                       </div>
                    </td>

                    <td className="px-6 py-5">
                      <div className="flex items-center justify-center gap-2">
                        <button 
                          onClick={() => handleEdit(client)}
                          className="p-2.5 text-gray-600 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-all border border-transparent hover:border-orange-200"
                          title="Editar"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDelete(client.id)}
                          className="p-2.5 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all border border-transparent hover:border-red-200"
                          title="Suspender"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>

                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  )
}
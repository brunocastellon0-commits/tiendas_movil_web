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

// Tipos TypeScript
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

  // Cargar Datos
  useEffect(() => {
    const fetchClients = async () => {
      try {
        setLoading(true)
        const { data, error } = await supabase
          .from('clients')
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

  // KPIs y Filtros
  const filteredClients = useMemo(() => {
    return clients.filter(c => 
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.tax_id?.includes(searchTerm)
    )
  }, [clients, searchTerm])

  const kpis = useMemo(() => {
    const totalClients = clients.length
    const totalDebt = clients.reduce((acc, c) => acc + (c.current_balance || 0), 0)
    const activeClients = clients.filter(c => c.status === 'Vigente').length
    
    return { totalClients, totalDebt, activeClients }
  }, [clients])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-BO', { style: 'currency', currency: 'BOB' }).format(amount)
  }

  // Manejo del Formulario
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

  // Funcion GPS Web
  const handleCaptureGPS = () => {
    if (!navigator.geolocation) {
      alert('Tu navegador no soporta geolocalización')
      return
    }
    setGpsLoading(true)
    
    const options = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    }
    
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude
        const lon = pos.coords.longitude
        
        // Validacion basica Cochabamba
        if (lat < -18 || lat > -16 || lon < -67 || lon > -65) {
          alert(`Coordenadas fuera del rango esperado para Cochabamba: Lat: ${lat.toFixed(6)}, Lon: ${lon.toFixed(6)}. ¿Estás seguro de continuar?`)
        }
        
        setFormData(prev => ({
          ...prev,
          latitude: lat,
          longitude: lon
        }))
        setGpsLoading(false)
      },
      (err) => {
        console.error('Error GPS:', err)
        alert('Error obteniendo ubicación: ' + err.message)
        setGpsLoading(false)
      },
      options
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

      let location = null
      if (formData.latitude !== null && formData.longitude !== null) {
        location = `SRID=4326;POINT(${formData.longitude} ${formData.latitude})`
      }

      // Preparar payload para Supabase
      const payload = {
        code: formData.code,
        name: formData.name,
        business_name: formData.business_name,
        tax_id: formData.tax_id,
        address: formData.address,
        phones: formData.phones,
        credit_limit: parseFloat(formData.credit_limit || '0'),
        location: location,
        status: formData.status,
        vendor_id: user?.id 
      }

      // 1. Guardar en Supabase
      if (isEditing && editingId) {
        const { error } = await supabase
          .from('clients')
          .update(payload)
          .eq('id', editingId)
        if (error) throw error

        setClients(clients.map(c => c.id === editingId ? { ...c, ...payload, id: editingId, current_balance: c.current_balance } : c))
      } else {
        const { data, error } = await supabase
          .from('clients')
          .insert([{ ...payload, current_balance: 0 }])
          .select()
        if (error) throw error

        if (data) setClients([data[0] as any, ...clients])
      }

      // 2. Sincronizar con SQL Server Local (Puente)
      try {
        const syncResponse = await fetch('/api/sync/master', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            entity: 'CLIENT',
            data: payload
          }),
        });

        if (!syncResponse.ok) {
          console.warn('Advertencia: Cliente guardado en la nube pero pendiente de sincronización local.')
        }
      } catch (syncError) {
        console.error('Error de red al sincronizar cliente:', syncError)
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
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 p-4 sm:p-6 lg:p-8">
      
      {/* Patrones de fondo */}
      <div className="fixed inset-0 z-0 pointer-events-none opacity-35" 
           style={{
             backgroundImage: `
               repeating-linear-gradient(45deg, transparent, transparent 35px, rgba(16, 185, 129, 0.25) 35px, rgba(16, 185, 129, 0.25) 39px),
               repeating-linear-gradient(-45deg, transparent, transparent 35px, rgba(16, 185, 129, 0.25) 35px, rgba(16, 185, 129, 0.25) 39px)
             `,
           }}>
      </div>
      
      <div className="fixed inset-0 z-0 pointer-events-none opacity-25" 
           style={{
             backgroundImage: `radial-gradient(circle at 2px 2px, rgba(20, 184, 166, 0.12) 1px, transparent 1px)`,
             backgroundSize: '48px 48px'
           }}>
      </div>
      
      <div className="fixed inset-0 z-0 bg-gradient-to-b from-white/40 via-transparent to-transparent pointer-events-none"></div>
      
      {/* Elementos decorativos */}
      <div className="fixed -top-24 -left-24 w-96 h-96 bg-green-200/30 rounded-full blur-3xl z-0 pointer-events-none"></div>
      <div className="fixed top-32 left-32 w-64 h-64 bg-emerald-300/20 rounded-full blur-2xl z-0 pointer-events-none"></div>
      <div className="fixed -top-32 -right-32 w-[500px] h-[500px] bg-teal-200/25 rounded-full blur-3xl z-0 pointer-events-none"></div>
      
      {/* Contenido principal */}
      <div className="relative z-10 space-y-6">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl shadow-lg border-2 border-green-100">
        <div>
          <h1 className="text-3xl md:text-4xl font-black bg-gradient-to-r from-green-600 via-green-500 to-emerald-500 bg-clip-text text-transparent">
            Gestión de Clientes
          </h1>
          <p className="text-gray-600 text-sm mt-2 font-medium">Administra tu cartera, créditos y geolocalización</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6">
        
        {/* Total Clientes */}
        <div className="group relative bg-gradient-to-br from-green-500 via-green-600 to-emerald-600 p-6 rounded-3xl shadow-xl hover:shadow-2xl transition-all duration-300 border-2 border-green-400 hover:scale-105">
          <div className="absolute inset-0 bg-white/10 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
          <div className="relative">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-white/20 backdrop-blur-sm rounded-2xl shadow-lg">
                <Users className="w-7 h-7 text-white" />
              </div>
              <span className="text-xs font-bold bg-white text-green-600 px-4 py-1.5 rounded-full shadow-md">
                TOTAL
              </span>
            </div>
            <h3 className="text-4xl font-black mb-1 text-white">{kpis.totalClients}</h3>
            <p className="text-sm text-green-50 font-semibold">Clientes registrados</p>
          </div>
        </div>

        {/* Saldo en Calle */}
        <div className="group relative bg-gradient-to-br from-red-500 via-red-600 to-rose-600 p-6 rounded-3xl shadow-xl hover:shadow-2xl transition-all duration-300 border-2 border-red-400 hover:scale-105">
          <div className="absolute inset-0 bg-white/10 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
          <div className="relative">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-white/20 backdrop-blur-sm rounded-2xl shadow-lg">
                <CreditCard className="w-7 h-7 text-white" />
              </div>
              <span className="text-xs font-bold bg-white text-red-600 px-4 py-1.5 rounded-full shadow-md">
                SALDO
              </span>
            </div>
            <h3 className="text-3xl lg:text-4xl font-black mb-1 text-white">{formatCurrency(kpis.totalDebt)}</h3>
            <p className="text-sm text-red-50 font-semibold">Cuentas por cobrar</p>
          </div>
        </div>

        {/* Activos */}
        <div className="group relative bg-gradient-to-br from-emerald-400 via-green-400 to-teal-500 p-6 rounded-3xl shadow-xl hover:shadow-2xl transition-all duration-300 border-2 border-emerald-300 hover:scale-105">
          <div className="absolute inset-0 bg-white/10 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
          <div className="relative">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-white/20 backdrop-blur-sm rounded-2xl shadow-lg">
                <Briefcase className="w-7 h-7 text-white" />
              </div>
              <span className="text-xs font-bold bg-white text-emerald-600 px-4 py-1.5 rounded-full shadow-md">
                ACTIVOS
              </span>
            </div>
            <h3 className="text-4xl font-black mb-1 text-white">{kpis.activeClients}</h3>
            <p className="text-sm text-emerald-50 font-semibold">Clientes vigentes</p>
          </div>
        </div>
      </div>

      {/* Formulario */}
      <div className="bg-white rounded-3xl shadow-2xl border-2 border-green-100 overflow-hidden">
        <div className="bg-gradient-to-r from-green-500 via-green-600 to-emerald-600 px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-4 bg-white rounded-2xl shadow-lg">
                <Users className="w-7 h-7 text-green-600" />
              </div>
              <div>
                <h2 className="text-2xl font-black text-white">
                  {isEditing ? 'Editar Cliente' : 'Nuevo Cliente'}
                </h2>
                <p className="text-sm text-green-50 mt-1 font-medium">
                  {isEditing ? 'Actualiza la información del cliente' : 'Completa los datos para agregar un nuevo cliente'}
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
                className="text-sm text-white hover:text-green-100 font-bold px-4 py-2 bg-white/20 rounded-xl hover:bg-white/30 transition-all"
              >
                Cancelar edición
              </button>
            )}
          </div>
        </div>

        <div className="p-8">
          {/* Mensajes de Estado */}
          {formError && (
            <div className="mb-6 flex items-start gap-3 bg-red-50 border-2 border-red-300 text-red-700 p-5 rounded-2xl shadow-lg">
              <AlertTriangle className="w-6 h-6 flex-shrink-0 mt-0.5 text-red-600" />
              <div>
                <p className="font-bold text-base">Error</p>
                <p className="text-sm mt-1">{formError}</p>
              </div>
            </div>
          )}

          {formSuccess && (
            <div className="mb-6 flex items-start gap-3 bg-green-50 border-2 border-green-300 text-green-700 p-5 rounded-2xl shadow-lg">
              <Users className="w-6 h-6 flex-shrink-0 mt-0.5 text-green-600" />
              <div>
                <p className="font-bold text-base">¡Éxito!</p>
                <p className="text-sm mt-1">La operación se completó correctamente.</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-8">
            
            {/* Sección 1: Datos Generales */}
            <div className="space-y-5">
              <div className="flex items-center gap-3 pb-3 border-b-4 border-green-500">
                <div className="w-2 h-8 bg-gradient-to-b from-green-500 to-emerald-600 rounded-full shadow-lg"></div>
                <h3 className="text-base font-black text-gray-900 uppercase tracking-wider">
                  Datos Generales
                </h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="block text-sm font-bold text-gray-800">
                    Código <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="code"
                    value={formData.code}
                    onChange={handleChange}
                    className="w-full px-5 py-3.5 text-sm border-2 border-gray-200 rounded-2xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-green-200 focus:border-green-500 transition-all shadow-sm hover:border-green-300"
                    placeholder="Ej: CLI-001"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-bold text-gray-800">
                    Nombre de Tienda / Cliente <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                    placeholder="Ej: Tienda El Sol"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-bold text-gray-800">Razón Social</label>
                  <input
                    type="text"
                    name="business_name"
                    value={formData.business_name || ''}
                    onChange={handleChange}
                    className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                    placeholder="Juan Perez S.A."
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-bold text-gray-800">NIT / CI</label>
                  <input
                    type="text"
                    name="tax_id"
                    value={formData.tax_id || ''}
                    onChange={handleChange}
                    className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Sección 2: Contacto, Crédito y Ubicación */}
            <div className="space-y-5">
              <div className="flex items-center gap-3 pb-3 border-b-4 border-green-500">
                <div className="w-2 h-8 bg-gradient-to-b from-green-500 to-emerald-600 rounded-full shadow-lg"></div>
                <h3 className="text-base font-black text-gray-900 uppercase tracking-wider">
                  Contacto, Crédito y GPS
                </h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                
                <div className="space-y-2">
                  <label className="block text-sm font-bold text-gray-800">Teléfono</label>
                  <div className="relative">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      name="phones"
                      value={formData.phones || ''}
                      onChange={handleChange}
                      className="w-full pl-12 pr-5 py-3.5 text-sm border-2 border-gray-200 rounded-2xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-green-200 focus:border-green-500 transition-all shadow-sm hover:border-green-300"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-900">Límite de Crédito (Bs)</label>
                  <input
                    type="number"
                    name="credit_limit"
                    value={formData.credit_limit}
                    onChange={handleChange}
                    className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                    placeholder="0.00"
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label className="block text-sm font-bold text-gray-800">Dirección</label>
                  <input
                    type="text"
                    name="address"
                    value={formData.address || ''}
                    onChange={handleChange}
                    className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                    placeholder="Av. Principal #123"
                  />
                </div>

                {/* Módulo GPS */}
                <div className="space-y-2 md:col-span-2 bg-gradient-to-r from-green-50 to-emerald-50 p-6 rounded-2xl border-2 border-green-200 shadow-md">
                    <div className="flex justify-between items-center mb-3">
                        <label className="text-base font-black text-gray-900">Geolocalización</label>
                        {formData.latitude && (
                            <span className="text-xs text-green-700 font-black bg-green-100 px-4 py-2 rounded-full border-2 border-green-300 shadow-sm">
                              ✓ GPS Capturado
                            </span>
                        )}
                    </div>
                    
                    <div className="flex gap-4 items-center">
                          <div className="flex-1 text-sm text-black font-mono bg-white p-4 rounded-xl border-2 border-gray-200 shadow-sm">
                            Lat: {formData.latitude?.toFixed(6) || '---'}<br/>
                            Lon: {formData.longitude?.toFixed(6) || '---'}
                          </div>
                          <button
                            type="button"
                            onClick={handleCaptureGPS}
                            disabled={gpsLoading}
                            className="flex items-center gap-2 px-6 py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl hover:from-green-600 hover:to-emerald-700 font-bold text-sm transition-all shadow-lg hover:shadow-xl hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                          >
                             {gpsLoading ? <Loader2 className="w-5 h-5 animate-spin"/> : <MapPin className="w-5 h-5" />}
                             Capturar
                          </button>
                    </div>
                </div>

              </div>
            </div>

            {/* BOTONES */}
            <div className="flex gap-4 pt-6 border-t-2 border-gray-100">
              <button
                type="button"
                onClick={handleClearForm}
                className="px-8 py-4 border-2 border-red-300 text-red-700 bg-red-50 rounded-2xl hover:bg-red-100 hover:border-red-400 font-bold transition-all shadow-md hover:shadow-lg flex items-center gap-2"
              >
                <X className="w-5 h-5" />
                Limpiar
              </button>
              <button
                type="submit"
                disabled={formLoading}
                className={`flex-1 flex items-center justify-center gap-3 px-8 py-4 rounded-2xl text-white font-black transition-all shadow-xl ${
                  formLoading
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-green-500 via-green-600 to-emerald-600 hover:from-green-600 hover:via-green-700 hover:to-emerald-700 hover:shadow-2xl hover:scale-105'
                }`}
              >
                {formLoading ? (
                  <>
                    <Loader2 className="w-6 h-6 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <Save className="w-6 h-6" />
                    {isEditing ? 'Actualizar Cliente' : 'Guardar Cliente'}
                  </>
                )}
              </button>
            </div>

          </form>
        </div>
      </div>

      {/* TABLA DE CLIENTES */}
      <div className="bg-white rounded-3xl shadow-2xl border-2 border-green-100 overflow-hidden">
        
        {/* Toolbar */}
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 px-6 py-5 border-b-2 border-green-200">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="relative flex-1 w-full max-w-2xl">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-green-600" />
              <input 
                type="text"
                placeholder="Buscar por nombre, código o NIT..."
                className="w-full pl-14 pr-5 py-4 text-sm border-2 border-green-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-green-200 focus:border-green-500 transition-all shadow-sm hover:border-green-300 bg-white font-medium"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2 text-sm bg-white px-5 py-3 rounded-xl border-2 border-green-200 shadow-sm">
              <span className="text-gray-600 font-medium">Mostrando</span>
              <span className="font-black text-green-600 text-base">{filteredClients.length}</span>
              <span className="text-gray-600 font-medium">clientes</span>
            </div>
          </div>
        </div>

        {/* Tabla */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gradient-to-r from-green-100 to-emerald-100 border-b-4 border-green-300">
                <th className="px-6 py-5 text-left text-xs font-black text-gray-800 uppercase tracking-wider">Cliente / Negocio</th>
                <th className="px-6 py-5 text-left text-xs font-black text-gray-800 uppercase tracking-wider">Contacto</th>
                <th className="px-6 py-5 text-left text-xs font-black text-gray-800 uppercase tracking-wider">Ubicación</th>
                <th className="px-6 py-5 text-right text-xs font-black text-gray-800 uppercase tracking-wider">Saldo (Deuda)</th>
                <th className="px-6 py-5 text-center text-xs font-black text-gray-800 uppercase tracking-wider">Estado</th>
                <th className="px-6 py-5 text-center text-xs font-black text-gray-800 uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center justify-center gap-4">
                      <Loader2 className="w-12 h-12 text-green-600 animate-spin" />
                      <p className="text-gray-700 font-bold text-lg">Cargando clientes...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredClients.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center text-gray-600 font-semibold text-lg">
                    No se encontraron clientes
                  </td>
                </tr>
              ) : (
                filteredClients.map((client) => (
                  <tr key={client.id} className="hover:bg-gradient-to-r hover:from-green-50/50 hover:to-emerald-50/50 transition-all">
                    
                    <td className="px-6 py-6">
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center text-white font-black text-xl shadow-lg">
                          {client.name.charAt(0)}
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-sm font-bold text-gray-900">
                            {client.name}
                          </span>
                          <div className="flex items-center gap-2 flex-wrap">
                               <span className="text-xs text-gray-600 font-mono bg-gray-100 px-3 py-1 rounded-lg border-2 border-gray-200 shadow-sm">
                                  {client.code}
                               </span>
                               {client.business_name && (
                                  <span className="text-xs text-gray-500 flex items-center gap-1">
                                       <FileText className="w-3 h-3"/> {client.business_name}
                                  </span>
                               )}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-6">
                        <div className="text-sm text-gray-800 font-bold">{client.phones || 'S/N'}</div>
                        <div className="text-xs text-gray-600 mt-1 font-medium">NIT: {client.tax_id || 'S/N'}</div>
                    </td>

                    <td className="px-6 py-6">
                        <div className="text-sm text-gray-800 font-bold max-w-xs truncate" title={client.address || ''}>
                             {client.address || 'Sin dirección'}
                        </div>
                        {client.latitude ? (
                             <div className="flex items-center gap-1 text-xs text-green-600 mt-1 font-black">
                                <MapPin className="w-3.5 h-3.5" /> GPS Activo
                             </div>
                        ) : (
                             <div className="text-xs text-gray-400 mt-1 font-medium">Sin GPS</div>
                        )}
                    </td>

                    <td className="px-6 py-6 text-right">
                        <span className={`text-sm font-black ${client.current_balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                           {formatCurrency(client.current_balance)}
                        </span>
                    </td>

                    <td className="px-6 py-6 text-center">
                        <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black shadow-md ${
                          client.status === 'Vigente'
                            ? 'bg-emerald-100 text-emerald-700 border-2 border-emerald-300' 
                            : 'bg-red-100 text-red-700 border-2 border-red-300'
                        }`}>
                          <div className={`w-2.5 h-2.5 rounded-full ${
                            client.status === 'Vigente' ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'
                          }`}></div>
                          {client.status}
                        </div>
                    </td>

                    <td className="px-6 py-6">
                      <div className="flex items-center justify-center gap-2">
                        <button 
                          onClick={() => handleEdit(client)}
                          className="p-3 text-gray-700 hover:text-green-600 hover:bg-green-50 rounded-xl transition-all border-2 border-transparent hover:border-green-300 shadow-sm hover:shadow-md"
                          title="Editar"
                        >
                          <Edit2 className="w-5 h-5" />
                        </button>
                        <button 
                          onClick={() => handleDelete(client.id)}
                          className="p-3 text-gray-700 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all border-2 border-transparent hover:border-red-300 shadow-sm hover:shadow-md"
                          title="Suspender"
                        >
                          <Trash2 className="w-5 h-5" />
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
    </div>
  )
}


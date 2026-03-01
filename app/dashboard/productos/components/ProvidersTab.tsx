'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useFormPersistence } from '@/hooks/useFormPersistence'
import { 
  Search, 
  Truck,
  AlertTriangle, 
  Edit2,
  Trash2,
  X,
  Save,
  Loader2
} from 'lucide-react'

/**
 * Definición de tipos para Categorías y Proveedores
 */
type Category = {
  id: string
  nombre_categoria: string
}

type Provider = {
  id: string
  codigo: string
  nombre: string
  razon_social: string
  nit_ci: string
  direccion: string | null
  localidad: string | null
  ciudad: string | null
  telefono: string | null
  fax: string | null
  email: string | null
  persona_contacto: string | null
  tipo: string | null
  estado: string
  zonas: string | null
  transportista: string | null
  comentario: string | null
  limite_credito: number | null
  autorizacion: string | null
  forma_pago: string | null
  salda_inicial: string | null
  moneda: string | null
  cuenta_contable: string | null
  detalle_adicional: string | null
  categoria_id: string | null
  categoria?: Category | null
  created_at?: string
}

export default function ProvidersTab() {
  const supabase = createClient()
  
  // Estados para manejo de datos
  const [providers, setProviders] = useState<Provider[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  
  // Estados para manejo del formulario
  const [formLoading, setFormLoading] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [formSuccess, setFormSuccess] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  
  const {
    formData,
    setFormData,
    clearForm
  } = useFormPersistence('proveedores_form', {
    codigo: '',
    nombre: '',
    razon_social: '',
    nit_ci: '',
    direccion: '',
    localidad: '',
    ciudad: '',
    telefono: '',
    fax: '',
    email: '',
    persona_contacto: '',
    tipo: '',
    estado: 'Activo',
    zonas: '',
    transportista: '',
    comentario: '',
    limite_credito: '',
    autorizacion: '',
    forma_pago: '',
    salda_inicial: '',
    moneda: 'BOB',
    cuenta_contable: '',
    detalle_adicional: '',
    categoria_id: ''
  })

  // Carga inicial de datos
  useEffect(() => {
    fetchData()
  }, [])

  /**
   * Obtiene la lista de proveedores y categorías desde Supabase
   */
  const fetchData = async () => {
    try {
      setLoading(true)
      
      const { data: providersData, error: providersError } = await supabase
        .from('proveedores')
        .select(`
          *,
          categoria:categorias (id, nombre_categoria)
        `)
        .order('created_at', { ascending: false })

      if (providersError) throw providersError
      if (providersData) setProviders(providersData as any)

      const { data: categoriesData, error: categoriesError } = await supabase
        .from('categorias')
        .select('*')
        .order('nombre_categoria')

      if (categoriesError) throw categoriesError
      if (categoriesData) setCategories(categoriesData)

    } catch (error) {
      console.error('Error cargando datos:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  /**
   * Maneja el envío del formulario.
   * Guarda en Supabase y luego sincroniza con SQL Server local.
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    setFormSuccess(false)

    if (!formData.nombre || !formData.razon_social) {
      setFormError('Por favor completa el nombre y razón social.')
      return
    }

    try {
      setFormLoading(true)

      const providerData = {
        codigo: formData.codigo,
        nombre: formData.nombre,
        razon_social: formData.razon_social,
        nit_ci: formData.nit_ci,
        direccion: formData.direccion || null,
        localidad: formData.localidad || null,
        ciudad: formData.ciudad || null,
        telefono: formData.telefono || null,
        fax: formData.fax || null,
        email: formData.email || null,
        persona_contacto: formData.persona_contacto || null,
        tipo: formData.tipo || null,
        estado: formData.estado,
        zonas: formData.zonas || null,
        transportista: formData.transportista || null,
        comentario: formData.comentario || null,
        limite_credito: formData.limite_credito ? parseFloat(formData.limite_credito) : null,
        autorizacion: formData.autorizacion || null,
        forma_pago: formData.forma_pago || null,
        salda_inicial: formData.salda_inicial || null,
        moneda: formData.moneda || 'BOB',
        cuenta_contable: formData.cuenta_contable || null,
        detalle_adicional: formData.detalle_adicional || null,
        categoria_id: formData.categoria_id || null
      }

      // 1. Operación en Supabase (Nube)
      if (isEditing && editingId) {
        const { error } = await supabase
          .from('proveedores')
          .update(providerData)
          .eq('id', editingId)

        if (error) throw error
      } else {
        const { error } = await supabase
          .from('proveedores')
          .insert([providerData])

        if (error) throw error
      }

      // 2. Operación de Sincronización (Puente a SQL Server Local)
      try {
        const syncResponse = await fetch('/api/sync/master', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            entity: 'PROVIDER',
            data: providerData
          }),
        });

        if (!syncResponse.ok) {
          console.warn('Advertencia: El proveedor se guardó en la nube pero falló la sincronización local.')
        }
      } catch (syncError) {
        console.error('Error de red al intentar sincronizar con SQL Server:', syncError)
        // No lanzamos el error para no bloquear la experiencia de usuario si Supabase funcionó
      }

      // 3. Finalización exitosa
      setFormSuccess(true)
      clearForm()
      setIsEditing(false)
      setEditingId(null)
      fetchData()

      setTimeout(() => {
        setFormSuccess(false)
      }, 3000)

    } catch (err: any) {
      console.error('Error guardando proveedor:', err)
      setFormError(err.message || 'Ocurrió un error inesperado')
    } finally {
      setFormLoading(false)
    }
  }

  const handleEdit = (provider: Provider) => {
    setFormData({
      codigo: provider.codigo,
      nombre: provider.nombre,
      razon_social: provider.razon_social,
      nit_ci: provider.nit_ci,
      direccion: provider.direccion || '',
      localidad: provider.localidad || '',
      ciudad: provider.ciudad || '',
      telefono: provider.telefono || '',
      fax: provider.fax || '',
      email: provider.email || '',
      persona_contacto: provider.persona_contacto || '',
      tipo: provider.tipo || '',
      estado: provider.estado,
      zonas: provider.zonas || '',
      transportista: provider.transportista || '',
      comentario: provider.comentario || '',
      limite_credito: provider.limite_credito?.toString() || '',
      autorizacion: provider.autorizacion || '',
      forma_pago: provider.forma_pago || '',
      salda_inicial: provider.salda_inicial || '',
      moneda: provider.moneda || 'BOB',
      cuenta_contable: provider.cuenta_contable || '',
      detalle_adicional: provider.detalle_adicional || '',
      categoria_id: provider.categoria_id || ''
    })
    setIsEditing(true)
    setEditingId(provider.id)
    setFormError(null)
    setFormSuccess(false)
    
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleDelete = async (provider: Provider) => {
    if (!confirm(`¿Estás seguro de desactivar el proveedor "${provider.nombre}"?`)) {
      return
    }

    try {
      const { error } = await supabase
        .from('proveedores')
        .update({ estado: 'Inactivo' })
        .eq('id', provider.id)

      if (error) throw error

      fetchData()

    } catch (err: any) {
      console.error('Error desactivando proveedor:', err)
      alert('Error al desactivar el proveedor')
    }
  }

  const filteredProviders = providers.filter(p => 
    p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.razon_social.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.nit_ci.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const activeProviders = providers.filter(p => p.estado === 'Activo').length

  return (
    <>
      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-6 rounded-2xl shadow-lg text-white">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl">
              <Truck className="w-6 h-6" />
            </div>
            <span className="text-xs font-semibold bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full">
              TOTAL
            </span>
          </div>
          <h3 className="text-3xl font-bold mb-1">{providers.length}</h3>
          <p className="text-sm text-blue-100">Proveedores registrados</p>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 p-6 rounded-2xl shadow-lg text-white">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl">
              <Truck className="w-6 h-6" />
            </div>
            <span className="text-xs font-semibold bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full">
              ACTIVOS
            </span>
          </div>
          <h3 className="text-3xl font-bold mb-1">{activeProviders}</h3>
          <p className="text-sm text-green-100">Proveedores activos</p>
        </div>

        <div className="bg-gradient-to-br from-orange-500 to-orange-600 p-6 rounded-2xl shadow-lg text-white">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <span className="text-xs font-semibold bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full">
              INACTIVOS
            </span>
          </div>
          <h3 className="text-3xl font-bold mb-1">{providers.length - activeProviders}</h3>
          <p className="text-sm text-orange-100">Proveedores inactivos</p>
        </div>
      </div>

      {/* FORMULARIO */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-200">
        <div className="bg-gradient-to-r from-blue-50 to-cyan-50 px-8 py-6 border-b border-gray-200 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-600 rounded-xl shadow-lg shadow-blue-900/20">
                <Truck className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  {isEditing ? 'Editar Proveedor' : 'Nuevo Proveedor'}
                </h2>
                <p className="text-sm text-gray-600 mt-0.5">
                  {isEditing ? 'Actualiza la información del proveedor' : 'Completa los datos para agregar un nuevo proveedor'}
                </p>
              </div>
            </div>
            {isEditing && (
              <button
                type="button"
                onClick={() => {
                  setIsEditing(false)
                  setEditingId(null)
                  clearForm()
                  setFormError(null)
                }}
                className="text-sm text-gray-600 hover:text-gray-900 font-medium"
              >
                Cancelar edición
              </button>
            )}
          </div>
        </div>

        <div className="p-8">
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
              <Truck className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">¡Éxito!</p>
                <p className="text-sm mt-0.5">
                  {isEditing ? 'El proveedor ha sido actualizado correctamente.' : 'El proveedor ha sido creado correctamente.'}
                </p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-8">
            
            {/* Información General */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b-2 border-blue-100">
                <div className="w-1 h-6 bg-blue-600 rounded-full"></div>
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Información General</h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">Código</label>
                  <input type="text" name="codigo" value={formData.codigo} onChange={handleChange}
                    className="w-full px-4 py-3 text-sm border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 transition-all"
                    placeholder="Ej: PROV-001" />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">
                    Nombre <span className="text-red-500">*</span>
                  </label>
                  <input type="text" name="nombre" value={formData.nombre} onChange={handleChange}
                    className="w-full px-4 py-3 text-sm border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 transition-all"
                    placeholder="Nombre comercial" required />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">
                    Razón Social <span className="text-red-500">*</span>
                  </label>
                  <input type="text" name="razon_social" value={formData.razon_social} onChange={handleChange}
                    className="w-full px-4 py-3 text-sm border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 transition-all"
                    placeholder="Razón social legal" required />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">NIT/CI</label>
                  <input type="text" name="nit_ci" value={formData.nit_ci} onChange={handleChange}
                    className="w-full px-4 py-3 text-sm border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 transition-all"
                    placeholder="Número de identificación" />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">Tipo</label>
                  <input type="text" name="tipo" value={formData.tipo} onChange={handleChange}
                    className="w-full px-4 py-3 text-sm border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 transition-all"
                    placeholder="Ej: Mayorista, Distribuidor" />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">Categoría</label>
                  <select name="categoria_id" value={formData.categoria_id} onChange={handleChange}
                    className="w-full px-4 py-3 text-sm border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 transition-all">
                    <option value="">Sin categoría</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.nombre_categoria}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Información de Contacto */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b-2 border-green-100">
                <div className="w-1 h-6 bg-green-600 rounded-full"></div>
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Contacto</h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">Dirección</label>
                  <input type="text" name="direccion" value={formData.direccion} onChange={handleChange}
                    className="w-full px-4 py-3 text-sm border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 transition-all"
                    placeholder="Dirección completa" />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">Localidad</label>
                  <input type="text" name="localidad" value={formData.localidad} onChange={handleChange}
                    className="w-full px-4 py-3 text-sm border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 transition-all"
                    placeholder="Localidad" />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">Ciudad</label>
                  <input type="text" name="ciudad" value={formData.ciudad} onChange={handleChange}
                    className="w-full px-4 py-3 text-sm border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 transition-all"
                    placeholder="Ciudad" />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">Teléfono</label>
                  <input type="text" name="telefono" value={formData.telefono} onChange={handleChange}
                    className="w-full px-4 py-3 text-sm border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 transition-all"
                    placeholder="Teléfono" />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">Fax</label>
                  <input type="text" name="fax" value={formData.fax} onChange={handleChange}
                    className="w-full px-4 py-3 text-sm border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 transition-all"
                    placeholder="Fax" />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">Email</label>
                  <input type="email" name="email" value={formData.email} onChange={handleChange}
                    className="w-full px-4 py-3 text-sm border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 transition-all"
                    placeholder="email@ejemplo.com" />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700">Persona de Contacto</label>
                  <input type="text" name="persona_contacto" value={formData.persona_contacto} onChange={handleChange}
                    className="w-full px-4 py-3 text-sm border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 transition-all"
                    placeholder="Nombre del contacto principal" />
                </div>
              </div>
            </div>

            {/* Información Financiera */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b-2 border-purple-100">
                <div className="w-1 h-6 bg-purple-600 rounded-full"></div>
                <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Financiero</h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">Límite de Crédito</label>
                  <input type="number" name="limite_credito" value={formData.limite_credito} onChange={handleChange} step="0.01"
                    className="w-full px-4 py-3 text-sm border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 transition-all"
                    placeholder="0.00" />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">Forma de Pago</label>
                  <input type="text" name="forma_pago" value={formData.forma_pago} onChange={handleChange}
                    className="w-full px-4 py-3 text-sm border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 transition-all"
                    placeholder="Contado, Crédito..." />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">Moneda</label>
                  <select name="moneda" value={formData.moneda} onChange={handleChange}
                    className="w-full px-4 py-3 text-sm border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 transition-all">
                    <option value="BOB">BOB - Boliviano</option>
                    <option value="USD">USD - Dólar</option>
                    <option value="EUR">EUR - Euro</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">Saldo Inicial</label>
                  <input type="text" name="salda_inicial" value={formData.salda_inicial} onChange={handleChange}
                    className="w-full px-4 py-3 text-sm border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 transition-all"
                    placeholder="Saldo inicial" />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">Cuenta Contable</label>
                  <input type="text" name="cuenta_contable" value={formData.cuenta_contable} onChange={handleChange}
                    className="w-full px-4 py-3 text-sm border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 transition-all"
                    placeholder="Código cuenta" />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">Autorización</label>
                  <input type="text" name="autorizacion" value={formData.autorizacion} onChange={handleChange}
                    className="w-full px-4 py-3 text-sm border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 transition-all"
                    placeholder="Autorización" />
                </div>
              </div>
            </div>

            {/* Información Adicional */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b-2 border-orange-100">
                <div className="w-1 h-6 bg-orange-600 rounded-full"></div>
                <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Adicional</h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">Zonas</label>
                  <input type="text" name="zonas" value={formData.zonas} onChange={handleChange}
                    className="w-full px-4 py-3 text-sm border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 transition-all"
                    placeholder="Zonas de cobertura" />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">Transportista</label>
                  <input type="text" name="transportista" value={formData.transportista} onChange={handleChange}
                    className="w-full px-4 py-3 text-sm border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 transition-all"
                    placeholder="Transportista" />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700">Comentario</label>
                  <textarea name="comentario" value={formData.comentario} onChange={handleChange} rows={2}
                    className="w-full px-4 py-3 text-sm border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 transition-all"
                    placeholder="Comentarios adicionales" />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700">Detalle Adicional</label>
                  <textarea name="detalle_adicional" value={formData.detalle_adicional} onChange={handleChange} rows={2}
                    className="w-full px-4 py-3 text-sm border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 transition-all"
                    placeholder="Información adicional" />
                </div>
              </div>
            </div>

            {/* Botones */}
            <div className="flex gap-4 pt-6 border-t-2 border-gray-100">
              <button type="button" onClick={() => {
                  if (confirm('¿Estás seguro de que deseas limpiar el formulario?')) {
                    clearForm()
                    setFormError(null)
                    setFormSuccess(false)
                    setIsEditing(false)
                    setEditingId(null)
                  }
                }}
                className="px-8 py-3.5 border-2 border-orange-200 text-orange-700 bg-orange-50 rounded-xl hover:bg-orange-100 font-semibold transition-all flex items-center gap-2">
                <X className="w-5 h-5" />
                Limpiar Formulario
              </button>
              <button type="submit" disabled={formLoading}
                className={`flex-1 flex items-center justify-center gap-3 px-8 py-3.5 rounded-xl text-white font-semibold transition-all shadow-lg ${
                  formLoading ? 'bg-gray-400 cursor-not-allowed' : 'bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700'
                }`}>
                {formLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5" />
                    {isEditing ? 'Actualizar Proveedor' : 'Guardar Proveedor'}
                  </>
                )}
              </button>
            </div>

          </form>
        </div>
      </div>

      {/* TABLA */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
        <div className="bg-gradient-to-r from-gray-50 to-slate-50 px-6 py-5 border-b border-gray-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input type="text" placeholder="Buscar por nombre, razón social o NIT..."
                className="w-full pl-12 pr-4 py-3 text-sm border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 transition-all"
                value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-600">Mostrando</span>
              <span className="font-bold text-blue-600">{filteredProviders.length}</span>
              <span className="text-gray-600">registros</span>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gradient-to-r from-gray-50 to-slate-50 border-b-2 border-gray-200">
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase">Nombre</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase">Razón Social</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase">NIT/CI</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase">Teléfono</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase">Email</th>
                <th className="px-6 py-4 text-center text-xs font-bold text-gray-700 uppercase">Estado</th>
                <th className="px-6 py-4 text-center text-xs font-bold text-gray-700 uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
                      <p className="text-gray-600 font-medium">Cargando proveedores...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredProviders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center text-gray-500">No se encontraron proveedores</td>
                </tr>
              ) : (
                filteredProviders.map((provider) => (
                  <tr key={provider.id} className="hover:bg-blue-50/30 transition-all">
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-100 to-cyan-100 flex items-center justify-center">
                          <Truck className="w-5 h-5 text-blue-700" />
                        </div>
                        <span className="text-sm font-bold text-gray-900">{provider.nombre}</span>
                      </div>
                    </td>
                    <td className="px-6 py-5 text-sm text-gray-700">{provider.razon_social}</td>
                    <td className="px-6 py-5 text-sm text-gray-600">{provider.nit_ci}</td>
                    <td className="px-6 py-5 text-sm text-gray-600">{provider.telefono || '-'}</td>
                    <td className="px-6 py-5 text-sm text-gray-600">{provider.email || '-'}</td>
                    <td className="px-6 py-5 text-center">
                      <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border ${
                        provider.estado === 'Activo' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-gray-100 text-gray-500 border-gray-200'
                      }`}>
                        <div className={`w-2 h-2 rounded-full ${provider.estado === 'Activo' ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                        {provider.estado}
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => handleEdit(provider)}
                          className="p-2.5 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all" title="Editar">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(provider)}
                          className="p-2.5 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all" title="Desactivar">
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
    </>
  )
}
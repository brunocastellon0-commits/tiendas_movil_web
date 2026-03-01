'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useFormPersistence } from '@/hooks/useFormPersistence'
import { 
  Search, 
  Tags,
  AlertTriangle, 
  Edit2,
  Trash2,
  X,
  Save,
  Loader2,
  Filter
} from 'lucide-react'

/**
 * Definición del tipo Category
 */
type Category = {
  id: string
  empresa: string | null
  nombre_categoria: string
  linea: string | null
  marca: string | null
  created_at?: string
}

export default function CategoriesTab() {
  const supabase = createClient()
  
  // Estados para datos y UI
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  
  const [formLoading, setFormLoading] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [formSuccess, setFormSuccess] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  
  const {
    formData,
    setFormData,
    clearForm
  } = useFormPersistence('categorias_form', {
    empresa: '',
    nombre_categoria: '',
    linea: '',
    marca: ''
  })

  // Carga inicial
  useEffect(() => {
    fetchCategories()
  }, [])

  /**
   * Obtiene las categorías desde Supabase
   */
  const fetchCategories = async () => {
    try {
      setLoading(true)
      
      const { data, error } = await supabase
        .from('categorias')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      if (data) setCategories(data)

    } catch (error) {
      console.error('Error cargando categorías:', error)
    } finally {
      setLoading(false)
    }
  }

  /**
   * MANEJA LOS CAMBIOS EN LOS INPUTS (Esta era la función que faltaba)
   */
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  /**
   * Maneja el guardado de la categoría.
   * 1. Guarda en Supabase.
   * 2. Envía la solicitud de sincronización al servidor local (SQL Server).
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    setFormSuccess(false)

    if (!formData.nombre_categoria) {
      setFormError('Por favor completa el nombre de la categoría.')
      return
    }

    try {
      setFormLoading(true)

      const categoryData = {
        empresa: formData.empresa || null,
        nombre_categoria: formData.nombre_categoria,
        linea: formData.linea || null,
        marca: formData.marca || null
      }

      // 1. Operación en Supabase
      if (isEditing && editingId) {
        const { error } = await supabase
          .from('categorias')
          .update(categoryData)
          .eq('id', editingId)

        if (error) throw error
      } else {
        const { error } = await supabase
          .from('categorias')
          .insert([categoryData])

        if (error) throw error
      }

      // 2. Sincronización con SQL Server (Puente)
      try {
        const syncResponse = await fetch('/api/sync/master', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            entity: 'CATEGORY', // Identificador para el switch del backend
            data: categoryData
          }),
        });

        if (!syncResponse.ok) {
          console.warn('Advertencia: Categoría guardada en web, pendiente en local.')
        }
      } catch (syncError) {
        console.error('Error de red al sincronizar categoría:', syncError)
      }

      // 3. Finalización exitosa
      setFormSuccess(true)
      clearForm()
      setIsEditing(false)
      setEditingId(null)
      fetchCategories()

      setTimeout(() => {
        setFormSuccess(false)
      }, 3000)

    } catch (err: any) {
      console.error('Error guardando categoría:', err)
      setFormError(err.message || 'Ocurrió un error inesperado')
    } finally {
      setFormLoading(false)
    }
  }

  const handleEdit = (category: Category) => {
    setFormData({
      empresa: category.empresa || '',
      nombre_categoria: category.nombre_categoria,
      linea: category.linea || '',
      marca: category.marca || ''
    })
    setIsEditing(true)
    setEditingId(category.id)
    setFormError(null)
    setFormSuccess(false)
    
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleDelete = async (category: Category) => {
    if (!confirm(`¿Estás seguro de eliminar la categoría "${category.nombre_categoria}"?`)) {
      return
    }

    try {
      const { error } = await supabase
        .from('categorias')
        .delete()
        .eq('id', category.id)

      if (error) throw error

      fetchCategories()

    } catch (err: any) {
      console.error('Error eliminando categoría:', err)
      alert('Error al eliminar la categoría: ' + err.message)
    }
  }

  const filteredCategories = categories.filter(c => 
    c.nombre_categoria.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.empresa?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.linea?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.marca?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const uniqueLineas = new Set(categories.map(c => c.linea).filter(Boolean))
  const uniqueMarcas = new Set(categories.map(c => c.marca).filter(Boolean))

  return (
    <>
      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 p-6 rounded-2xl shadow-lg text-white">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl">
              <Tags className="w-6 h-6" />
            </div>
            <span className="text-xs font-semibold bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full">
              TOTAL
            </span>
          </div>
          <h3 className="text-3xl font-bold mb-1">{categories.length}</h3>
          <p className="text-sm text-purple-100">Categorías registradas</p>
        </div>

        <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-6 rounded-2xl shadow-lg text-white">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl">
              <Filter className="w-6 h-6" />
            </div>
            <span className="text-xs font-semibold bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full">
              LÍNEAS
            </span>
          </div>
          <h3 className="text-3xl font-bold mb-1">{uniqueLineas.size}</h3>
          <p className="text-sm text-blue-100">Líneas diferentes</p>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 p-6 rounded-2xl shadow-lg text-white">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl">
              <Tags className="w-6 h-6" />
            </div>
            <span className="text-xs font-semibold bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full">
              MARCAS
            </span>
          </div>
          <h3 className="text-3xl font-bold mb-1">{uniqueMarcas.size}</h3>
          <p className="text-sm text-green-100">Marcas diferentes</p>
        </div>
      </div>

      {/* FORMULARIO */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-200">
        <div className="bg-gradient-to-r from-purple-50 to-indigo-50 px-8 py-6 border-b border-gray-200 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-purple-600 rounded-xl shadow-lg shadow-purple-900/20">
                <Tags className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  {isEditing ? 'Editar Categoría' : 'Nueva Categoría'}
                </h2>
                <p className="text-sm text-gray-600 mt-0.5">
                  {isEditing ? 'Actualiza la información de la categoría' : 'Completa los datos para agregar una nueva categoría'}
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
              <Tags className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">¡Éxito!</p>
                <p className="text-sm mt-0.5">
                  {isEditing ? 'La categoría ha sido actualizada correctamente.' : 'La categoría ha sido creada correctamente.'}
                </p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700">Empresa</label>
                <input
                  type="text"
                  name="empresa"
                  value={formData.empresa || ''}
                  onChange={handleChange}
                  className="w-full px-4 py-3 text-sm border-2 border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                  placeholder="Ej: Mi Empresa S.A."
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700">
                  Nombre de Categoría <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="nombre_categoria"
                  value={formData.nombre_categoria || ''}
                  onChange={handleChange}
                  className="w-full px-4 py-3 text-sm border-2 border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                  placeholder="Ej: Bebidas"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700">Línea</label>
                <input
                  type="text"
                  name="linea"
                  value={formData.linea || ''}
                  onChange={handleChange}
                  className="w-full px-4 py-3 text-sm border-2 border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                  placeholder="Ej: Refrescos"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700">Marca</label>
                <input
                  type="text"
                  name="marca"
                  value={formData.marca || ''}
                  onChange={handleChange}
                  className="w-full px-4 py-3 text-sm border-2 border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                  placeholder="Ej: Coca Cola"
                />
              </div>
            </div>

            <div className="flex gap-4 pt-6 border-t-2 border-gray-100">
              <button
                type="button"
                onClick={() => {
                  if (confirm('¿Estás seguro de que deseas limpiar el formulario?')) {
                    clearForm()
                    setFormError(null)
                    setFormSuccess(false)
                    setIsEditing(false)
                    setEditingId(null)
                  }
                }}
                className="px-8 py-3.5 border-2 border-orange-200 text-orange-700 bg-orange-50 rounded-xl hover:bg-orange-100 hover:border-orange-300 font-semibold transition-all flex items-center gap-2 shadow-sm hover:shadow"
              >
                <X className="w-5 h-5" />
                Limpiar Formulario
              </button>
              <button
                type="submit"
                disabled={formLoading}
                className={`flex-1 flex items-center justify-center gap-3 px-8 py-3.5 rounded-xl text-white font-semibold transition-all shadow-lg ${
                  formLoading
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 shadow-purple-900/20 hover:shadow-xl'
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
                    {isEditing ? 'Actualizar Categoría' : 'Guardar Categoría'}
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
              <input 
                type="text"
                placeholder="Buscar categoría por empresa, nombre, línea o marca..."
                className="w-full pl-12 pr-4 py-3 text-sm border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-600">Mostrando</span>
              <span className="font-bold text-purple-600">{filteredCategories.length}</span>
              <span className="text-gray-600">registros</span>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gradient-to-r from-gray-50 to-slate-50 border-b-2 border-gray-200">
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Empresa</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Categoría</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Línea</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Marca</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Fecha de Creación</th>
                <th className="px-6 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <Loader2 className="w-10 h-10 text-purple-600 animate-spin" />
                      <p className="text-gray-600 font-medium">Cargando categorías...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredCategories.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center text-gray-500">
                    No se encontraron categorías
                  </td>
                </tr>
              ) : (
                filteredCategories.map((category) => (
                  <tr key={category.id} className="hover:bg-gradient-to-r hover:from-purple-50/30 hover:to-indigo-50/30 transition-all">
                    <td className="px-6 py-5">
                      {category.empresa ? (
                        <span className="text-sm text-gray-700">{category.empresa}</span>
                      ) : (
                        <span className="text-xs text-gray-400 italic">Sin empresa</span>
                      )}
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-100 to-indigo-100 flex items-center justify-center text-purple-700 font-bold shadow-sm">
                          <Tags className="w-5 h-5" />
                        </div>
                        <span className="text-sm font-bold text-gray-900">{category.nombre_categoria}</span>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      {category.linea ? (
                        <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-100 text-blue-700 border border-blue-200">
                          {category.linea}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400 italic">Sin línea</span>
                      )}
                    </td>
                    <td className="px-6 py-5">
                      {category.marca ? (
                        <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold bg-green-100 text-green-700 border border-green-200">
                          {category.marca}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400 italic">Sin marca</span>
                      )}
                    </td>
                    <td className="px-6 py-5">
                      <span className="text-xs text-gray-500">
                        {category.created_at ? new Date(category.created_at).toLocaleDateString('es-BO') : '-'}
                      </span>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center justify-center gap-2">
                        <button 
                          onClick={() => handleEdit(category)}
                          className="p-2.5 text-gray-600 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-all border border-transparent hover:border-purple-200"
                          title="Editar"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDelete(category)}
                          className="p-2.5 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all border border-transparent hover:border-red-200"
                          title="Eliminar"
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
    </>
  )
}
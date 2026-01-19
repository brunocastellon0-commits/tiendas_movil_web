'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useFormPersistence } from '@/hooks/useFormPersistence'
import { 
  Search, 
  Package, 
  AlertTriangle, 
  Tags, 
  Edit2,
  Trash2,
  X,
  Save,
  Loader2
} from 'lucide-react'

// Tipos TypeScript
type Category = {
  id: string
  nombre_categoria: string
  linea: string | null
  zona: string | null
  created_at?: string
}

type Provider = {
  id: string
  codigo: string
  nombre: string
  razon_social: string
  nit_ci: string
}

type Product = {
  id: string
  codigo_producto: string
  nombre_producto: string
  estado: string
  precio_base_venta: number
  unidad_base_venta: string
  stock_actual: number
  stock_min: number
  stock_max: number
  observacion: string | null
  extra_1: string | null
  comision: number | null
  comision2: number | null
  tipo: string | null
  peso_bruto: number | null
  activo: boolean | null
  kg_unidad: number | null
  descuento_volumen: boolean | null
  descuento_temporada: boolean | null
  precios_volumen: boolean | null
  categoria_id: string | null
  proveedor_id: string | null
  created_at?: string
  categoria: Category | null
  proveedor: Provider | null
}

// Componente de Stock Visual
const StockCell = ({ current, min, max }: { current: number, min: number, max: number }) => {
  let colorClass = 'bg-green-500'
  let statusText = 'Óptimo'
  let textColor = 'text-green-700'
  let bgBadge = 'bg-green-100'

  if (current <= min) {
    colorClass = 'bg-red-500'
    statusText = 'Bajo'
    textColor = 'text-red-700'
    bgBadge = 'bg-red-100'
  } else if (current > max) {
    colorClass = 'bg-yellow-500'
    statusText = 'Excedente'
    textColor = 'text-yellow-700'
    bgBadge = 'bg-yellow-100'
  } else if (current === 0) {
    colorClass = 'bg-gray-400'
    statusText = 'Sin Stock'
    textColor = 'text-gray-700'
    bgBadge = 'bg-gray-100'
  }

  const percentage = max > 0 ? Math.min((current / max) * 100, 100) : 0

  return (
    <div className="w-36">
      <div className="flex justify-between items-center mb-1.5">
        <span className="text-xs font-bold text-gray-800">{current} u.</span>
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${bgBadge} ${textColor}`}>
          {statusText}
        </span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
        <div 
          className={`h-1.5 rounded-full transition-all duration-500 ${colorClass}`} 
          style={{ width: `${percentage}%` }} 
        />
      </div>
      <div className="flex justify-between text-[9px] text-gray-400 mt-1">
        <span>Min: {min}</span>
        <span>Max: {max}</span>
      </div>
    </div>
  )
}

export default function InventoryTab() {
  const supabase = createClient()
  
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [providers, setProviders] = useState<Provider[]>([])
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
  } = useFormPersistence('productos_form', {
    codigo_producto: '',
    nombre_producto: '',
    categoria_id: '',
    proveedor_id: '',
    precio_base_venta: '',
    stock_actual: '',
    stock_min: '',
    stock_max: '',
    unidad_base_venta: 'unidad',
    estado: 'Activo',
    observacion: '',
    extra_1: '',
    comision: '',
    comision2: '',
    tipo: '',
    peso_bruto: '',
    activo: 'true',
    kg_unidad: '',
    descuento_volumen: 'false',
    descuento_temporada: 'false',
    precios_volumen: 'false'
  })

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        
        const { data: productsData, error: productsError } = await supabase
          .from('productos')
          .select(`
            *,
            categoria:categorias (id, nombre_categoria),
            proveedor:proveedores (id, nombre, razon_social)
          `)
          .order('created_at', { ascending: false })

        if (productsError) throw productsError
        if (productsData) setProducts(productsData as any)

        const { data: categoriesData, error: categoriesError } = await supabase
          .from('categorias')
          .select('*')
          .order('nombre_categoria')

        if (categoriesError) throw categoriesError
        if (categoriesData) setCategories(categoriesData)

        const { data: providersData, error: providersError } = await supabase
          .from('proveedores')
          .select('*')
          .order('nombre')

        if (providersError) throw providersError
        if (providersData) setProviders(providersData)

      } catch (error) {
        console.error('Error cargando datos:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  const filteredProducts = useMemo(() => {
    return products.filter(p => 
      p.nombre_producto.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.codigo_producto.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.categoria?.nombre_categoria.toLowerCase().includes(searchTerm.toLowerCase())
    )
  }, [products, searchTerm])

  const kpis = useMemo(() => {
    const totalValue = products.reduce((acc, p) => acc + (p.stock_actual * p.precio_base_venta), 0)
    const lowStockCount = products.filter(p => p.stock_actual <= p.stock_min).length
    const totalSKUs = products.length
    
    return { totalValue, lowStockCount, totalSKUs }
  }, [products])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-BO', { style: 'currency', currency: 'BOB' }).format(amount)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleClearForm = () => {
    if (confirm('¿Estás seguro de que deseas limpiar todos los campos del formulario?')) {
      clearForm()
      setFormError(null)
      setFormSuccess(false)
      setIsEditing(false)
      setEditingId(null)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    setFormSuccess(false)

    if (!formData.nombre_producto || !formData.codigo_producto) {
      setFormError('Por favor completa el nombre y código del producto.')
      return
    }

    if (!formData.precio_base_venta || parseFloat(formData.precio_base_venta) <= 0) {
      setFormError('Por favor ingresa un precio válido.')
      return
    }

    try {
      setFormLoading(true)

      if (isEditing && editingId) {
        const { error } = await supabase
          .from('productos')
          .update({
            codigo_producto: formData.codigo_producto,
            nombre_producto: formData.nombre_producto,
            categoria_id: formData.categoria_id || null,
            proveedor_id: formData.proveedor_id || null,
            precio_base_venta: parseFloat(formData.precio_base_venta),
            stock_actual: parseInt(formData.stock_actual) || 0,
            stock_min: parseInt(formData.stock_min) || 0,
            stock_max: parseInt(formData.stock_max) || 100,
            unidad_base_venta: formData.unidad_base_venta,
            estado: formData.estado,
            observacion: formData.observacion || null,
            extra_1: formData.extra_1 || null,
            comision: formData.comision ? parseFloat(formData.comision) : null,
            comision2: formData.comision2 ? parseFloat(formData.comision2) : null,
            tipo: formData.tipo || null,
            peso_bruto: formData.peso_bruto ? parseFloat(formData.peso_bruto) : null,
            activo: formData.activo === 'true',
            kg_unidad: formData.kg_unidad ? parseFloat(formData.kg_unidad) : null,
            descuento_volumen: formData.descuento_volumen === 'true',
            descuento_temporada: formData.descuento_temporada === 'true',
            precios_volumen: formData.precios_volumen === 'true'
          })
          .eq('id', editingId)

        if (error) throw error

        setFormSuccess(true)
        
        const { data: updatedProducts } = await supabase
          .from('productos')
          .select(`
            *,
            categoria:categorias (id, nombre_categoria),
            proveedor:proveedores (id, nombre, razon_social)
          `)
          .order('created_at', { ascending: false })
        
        if (updatedProducts) setProducts(updatedProducts as any)

      } else {
        const { data, error } = await supabase
          .from('productos')
          .insert([{
            codigo_producto: formData.codigo_producto,
            nombre_producto: formData.nombre_producto,
            categoria_id: formData.categoria_id || null,
            proveedor_id: formData.proveedor_id || null,
            precio_base_venta: parseFloat(formData.precio_base_venta),
            stock_actual: parseInt(formData.stock_actual) || 0,
            stock_min: parseInt(formData.stock_min) || 0,
            stock_max: parseInt(formData.stock_max) || 100,
            unidad_base_venta: formData.unidad_base_venta,
            estado: formData.estado,
            observacion: formData.observacion || null,
            extra_1: formData.extra_1 || null,
            comision: formData.comision ? parseFloat(formData.comision) : null,
            comision2: formData.comision2 ? parseFloat(formData.comision2) : null,
            tipo: formData.tipo || null,
            peso_bruto: formData.peso_bruto ? parseFloat(formData.peso_bruto) : null,
            activo: formData.activo === 'true',
            kg_unidad: formData.kg_unidad ? parseFloat(formData.kg_unidad) : null,
            descuento_volumen: formData.descuento_volumen === 'true',
            descuento_temporada: formData.descuento_temporada === 'true',
            precios_volumen: formData.precios_volumen === 'true'
          }])
          .select(`
            *,
            categoria:categorias (id, nombre_categoria),
            proveedor:proveedores (id, nombre, razon_social)
          `)

        if (error) throw error

        setFormSuccess(true)
        
        if (data && data.length > 0) {
          setProducts([data[0] as any, ...products])
        }
      }

      clearForm()
      setIsEditing(false)
      setEditingId(null)

      setTimeout(() => {
        setFormSuccess(false)
      }, 3000)

    } catch (err: any) {
      console.error('Error guardando producto:', err)
      
      let errorMessage = 'Ocurrió un error inesperado'
      if (err.message.includes('duplicate') || err.message.includes('unique')) {
        errorMessage = 'Ya existe un producto con ese código SKU'
      } else if (err.message) {
        errorMessage = err.message
      }
      
      setFormError(errorMessage)
    } finally {
      setFormLoading(false)
    }
  }

  const handleEdit = (product: Product) => {
    setFormData({
      codigo_producto: product.codigo_producto,
      nombre_producto: product.nombre_producto,
      categoria_id: product.categoria?.id || '',
      proveedor_id: product.proveedor?.id || '',
      precio_base_venta: product.precio_base_venta.toString(),
      stock_actual: product.stock_actual.toString(),
      stock_min: product.stock_min.toString(),
      stock_max: product.stock_max.toString(),
      unidad_base_venta: product.unidad_base_venta,
      estado: product.estado,
      observacion: product.observacion || '',
      extra_1: product.extra_1 || '',
      comision: product.comision?.toString() || '',
      comision2: product.comision2?.toString() || '',
      tipo: product.tipo || '',
      peso_bruto: product.peso_bruto?.toString() || '',
      activo: product.activo?.toString() || 'true',
      kg_unidad: product.kg_unidad?.toString() || '',
      descuento_volumen: product.descuento_volumen?.toString() || 'false',
      descuento_temporada: product.descuento_temporada?.toString() || 'false',
      precios_volumen: product.precios_volumen?.toString() || 'false'
    })
    setIsEditing(true)
    setEditingId(product.id)
    setFormError(null)
    setFormSuccess(false)
    
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleDelete = async (product: Product) => {
    if (!confirm(`¿Estás seguro de desactivar el producto "${product.nombre_producto}"?`)) {
      return
    }

    try {
      const { error } = await supabase
        .from('productos')
        .update({ estado: 'Inactivo' })
        .eq('id', product.id)

      if (error) throw error

      setProducts(products.map(p => 
        p.id === product.id ? { ...p, estado: 'Inactivo' } : p
      ))

    } catch (err: any) {
      console.error('Error desactivando producto:', err)
      alert('Error al desactivar el producto')
    }
  }

  return (
    <>
      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-6 rounded-2xl shadow-lg text-white">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl">
              <Package className="w-6 h-6" />
            </div>
            <span className="text-xs font-semibold bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full">
              VALOR TOTAL
            </span>
          </div>
          <h3 className="text-3xl font-bold mb-1">{formatCurrency(kpis.totalValue)}</h3>
          <p className="text-sm text-blue-100">Calculado sobre precio base</p>
        </div>

        <div className="bg-gradient-to-br from-orange-500 to-orange-600 p-6 rounded-2xl shadow-lg text-white">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <span className="text-xs font-semibold bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full">
              ALERTAS
            </span>
          </div>
          <h3 className="text-3xl font-bold mb-1">{kpis.lowStockCount}</h3>
          <p className="text-sm text-orange-100">Productos con stock bajo</p>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 p-6 rounded-2xl shadow-lg text-white">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl">
              <Tags className="w-6 h-6" />
            </div>
            <span className="text-xs font-semibold bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full">
              TOTAL SKUs
            </span>
          </div>
          <h3 className="text-3xl font-bold mb-1">{kpis.totalSKUs}</h3>
          <p className="text-sm text-purple-100">Productos activos</p>
        </div>
      </div>

      {/* FORMULARIO */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-200">
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 px-8 py-6 border-b border-gray-200 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-green-600 rounded-xl shadow-lg shadow-green-900/20">
                <Package className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  {isEditing ? 'Editar Producto' : 'Nuevo Producto'}
                </h2>
                <p className="text-sm text-gray-600 mt-0.5">
                  {isEditing ? 'Actualiza la información del producto' : 'Completa los datos para agregar un nuevo producto'}
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
              <Package className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">¡Éxito!</p>
                <p className="text-sm mt-0.5">
                  {isEditing ? 'El producto ha sido actualizado correctamente.' : 'El producto ha sido creado correctamente.'}
                </p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-8">
            
            {/* Información Básica */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b-2 border-green-100">
                <div className="w-1 h-6 bg-green-600 rounded-full"></div>
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">
                  Información Básica
                </h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">
                    Código SKU <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="codigo_producto"
                    value={formData.codigo_producto}
                    onChange={handleChange}
                    className="w-full px-4 py-3 text-sm border-2 border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                    placeholder="Ej: PRO-001"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">
                    Nombre del Producto <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="nombre_producto"
                    value={formData.nombre_producto}
                    onChange={handleChange}
                    className="w-full px-4 py-3 text-sm border-2 border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                    placeholder="Ej: Coca Cola 2L"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">Categoría</label>
                  <select
                    name="categoria_id"
                    value={formData.categoria_id}
                    onChange={handleChange}
                    className="w-full px-4 py-3 text-sm border-2 border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                  >
                    <option value="">Sin categoría</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.nombre_categoria}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">Proveed

or</label>
                  <select
                    name="proveedor_id"
                    value={formData.proveedor_id}
                    onChange={handleChange}
                    className="w-full px-4 py-3 text-sm border-2 border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                  >
                    <option value="">Sin proveedor</option>
                    {providers.map(prov => (
                      <option key={prov.id} value={prov.id}>{prov.nombre}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Precio y Stock */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b-2 border-blue-100">
                <div className="w-1 h-6 bg-blue-600 rounded-full"></div>
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">
                  Precio y Stock
                </h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">
                    Precio Base (Bs) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    name="precio_base_venta"
                    value={formData.precio_base_venta}
                    onChange={handleChange}
                    step="0.01"
                    min="0"
                    className="w-full px-4 py-3 text-sm border-2 border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                    placeholder="10.50"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">Stock Actual</label>
                  <input
                    type="number"
                    name="stock_actual"
                    value={formData.stock_actual}
                    onChange={handleChange}
                    min="0"
                    className="w-full px-4 py-3 text-sm border-2 border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                    placeholder="100"
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">Unidad</label>
                  <input
                    type="text"
                    name="unidad_base_venta"
                    value={formData.unidad_base_venta}
                    onChange={handleChange}
                    className="w-full px-4 py-3 text-sm border-2 border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                    placeholder="unidad, caja, litro..."
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">Stock Mínimo</label>
                  <input
                    type="number"
                    name="stock_min"
                    value={formData.stock_min}
                    onChange={handleChange}
                    min="0"
                    className="w-full px-4 py-3 text-sm border-2 border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                    placeholder="10"
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700">Stock Máximo</label>
                  <input
                    type="number"
                    name="stock_max"
                    value={formData.stock_max}
                    onChange={handleChange}
                    min="0"
                    className="w-full px-4 py-3 text-sm border-2 border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                    placeholder="500"
                  />
                </div>
              </div>
            </div>

            {/* Información Adicional */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b-2 border-purple-100">
                <div className="w-1 h-6 bg-purple-600 rounded-full"></div>
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">
                  Información Adicional
                </h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">Tipo</label>
                  <input
                    type="text"
                    name="tipo"
                    value={formData.tipo}
                    onChange={handleChange}
                    className="w-full px-4 py-3 text-sm border-2 border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                    placeholder="Ej: Bebida, Snack..."
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">Comisión (%)</label>
                  <input
                    type="number"
                    name="comision"
                    value={formData.comision}
                    onChange={handleChange}
                    step="0.01"
                    min="0"
                    max="100"
                    className="w-full px-4 py-3 text-sm border-2 border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                    placeholder="5.00"
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">Kg por Unidad</label>
                  <input
                    type="number"
                    name="kg_unidad"
                    value={formData.kg_unidad}
                    onChange={handleChange}
                    step="0.001"
                    min="0"
                    className="w-full px-4 py-3 text-sm border-2 border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                    placeholder="0.500"
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">Comisión 2 (%)</label>
                  <input
                    type="number"
                    name="comision2"
                    value={formData.comision2}
                    onChange={handleChange}
                    step="0.01"
                    min="0"
                    max="100"
                    className="w-full px-4 py-3 text-sm border-2 border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                    placeholder="5.00"
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">Peso Bruto (Kg)</label>
                  <input
                    type="number"
                    name="peso_bruto"
                    value={formData.peso_bruto}
                    onChange={handleChange}
                    step="0.01"
                    min="0"
                    className="w-full px-4 py-3 text-sm border-2 border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                    placeholder="50.00"
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">Precios por Volumen</label>
                  <select
                    name="precios_volumen"
                    value={formData.precios_volumen}
                    onChange={handleChange}
                    className="w-full px-4 py-3 text-sm border-2 border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                  >
                    <option value="true">Sí</option>
                    <option value="false">No</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">Descuento por Volumen</label>
                  <select
                    name="descuento_volumen"
                    value={formData.descuento_volumen}
                    onChange={handleChange}
                    className="w-full px-4 py-3 text-sm border-2 border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                  >
                    <option value="true">Sí</option>
                    <option value="false">No</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">Descuento Temporada</label>
                  <select
                    name="descuento_temporada"
                    value={formData.descuento_temporada}
                    onChange={handleChange}
                    className="w-full px-4 py-3 text-sm border-2 border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                  >
                    <option value="true">Sí</option>
                    <option value="false">No</option>
                  </select>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700">Observaciones</label>
                  <input
                    type="text"
                    name="observacion"
                    value={formData.observacion}
                    onChange={handleChange}
                    className="w-full px-4 py-3 text-sm border-2 border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                    placeholder="Notas adicionales sobre el producto..."
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">Campo Extra 1</label>
                  <input
                    type="text"
                    name="extra_1"
                    value={formData.extra_1}
                    onChange={handleChange}
                    className="w-full px-4 py-3 text-sm border-2 border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                    placeholder="Información adicional"
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">Estado Activo</label>
                  <select
                    name="activo"
                    value={formData.activo}
                    onChange={handleChange}
                    className="w-full px-4 py-3 text-sm border-2 border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                  >
                    <option value="true">Sí</option>
                    <option value="false">No</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Botones */}
            <div className="flex gap-4 pt-6 border-t-2 border-gray-100">
              <button
                type="button"
                onClick={handleClearForm}
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
                    {isEditing ? 'Actualizar Producto' : 'Guardar Producto'}
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
                placeholder="Buscar producto por nombre, SKU o categoría..."
                className="w-full pl-12 pr-4 py-3 text-sm border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-600">Mostrando</span>
              <span className="font-bold text-green-600">{filteredProducts.length}</span>
              <span className="text-gray-600">registros</span>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gradient-to-r from-gray-50 to-slate-50 border-b-2 border-gray-200">
                <th className="px-4 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Producto</th>
                <th className="px-4 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Categoría</th>
                <th className="px-4 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Proveedor</th>
                <th className="px-4 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Stock</th>
                <th className="px-4 py-4 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">Precio Base</th>
                <th className="px-4 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Tipo</th>
                <th className="px-4 py-4 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">Comisión %</th>
                <th className="px-4 py-4 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">Kg/Unidad</th>
                <th className="px-4 py-4 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">Peso Límite</th>
                <th className="px-4 py-4 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">Precio Vol.</th>
                <th className="px-4 py-4 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">Desc. Vol. %</th>
                <th className="px-4 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Observaciones</th>
                <th className="px-4 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Extra 1</th>
                <th className="px-4 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">Activo</th>
                <th className="px-4 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">Estado</th>
                <th className="px-4 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={16} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <Loader2 className="w-10 h-10 text-green-600 animate-spin" />
                      <p className="text-gray-600 font-medium">Cargando inventario...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={16} className="px-6 py-16 text-center text-gray-500">
                    No se encontraron productos
                  </td>
                </tr>
              ) : (
                filteredProducts.map((product) => (
                  <tr key={product.id} className="hover:bg-gradient-to-r hover:from-green-50/30 hover:to-emerald-50/30 transition-all">
                    
                    {/* Producto */}
                    <td className="px-4 py-4">
                      <div className="flex flex-col gap-1">
                        <span className="text-sm font-bold text-gray-900">
                          {product.nombre_producto}
                        </span>
                        <span className="text-xs text-gray-500 font-mono flex items-center gap-1.5">
                          <span className="bg-gray-100 px-2 py-0.5 rounded text-[10px] font-semibold border border-gray-200">SKU</span> 
                          {product.codigo_producto}
                        </span>
                      </div>
                    </td>

                    {/* Categoría */}
                    <td className="px-4 py-4">
                      {product.categoria ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-lg text-xs font-semibold bg-blue-100 text-blue-700 border border-blue-200">
                          {product.categoria.nombre_categoria}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400 italic">-</span>
                      )}
                    </td>

                    {/* Proveedor */}
                    <td className="px-4 py-4">
                      {product.proveedor ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-lg text-xs font-semibold bg-purple-100 text-purple-700 border border-purple-200">
                          {product.proveedor.nombre}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400 italic">-</span>
                      )}
                    </td>

                    {/* Stock */}
                    <td className="px-4 py-4">
                      <StockCell 
                        current={product.stock_actual} 
                        min={product.stock_min} 
                        max={product.stock_max} 
                      />
                    </td>

                    {/* Precio Base */}
                    <td className="px-4 py-4 text-right">
                      <div className="text-sm font-bold text-gray-900">
                        {formatCurrency(product.precio_base_venta)}
                      </div>
                      <div className="text-[10px] text-gray-500">
                        por {product.unidad_base_venta || 'unidad'}
                      </div>
                    </td>

                    {/* Tipo */}
                    <td className="px-4 py-4">
                      <span className="text-xs text-gray-700">
                        {product.tipo || '-'}
                      </span>
                    </td>

                    {/* Comisión */}
                    <td className="px-4 py-4 text-right">
                      <span className="text-xs text-gray-700 font-medium">
                        {product.comision ? `${product.comision}%` : '-'}
                      </span>
                    </td>

                    {/* Kg/Unidad */}
                    <td className="px-4 py-4 text-right">
                      <span className="text-xs text-gray-700">
                        {product.kg_unidad ? `${product.kg_unidad} kg` : '-'}
                      </span>
                    </td>

                    {/* Peso Límite */}
                    <td className="px-4 py-4 text-right">
                      <span className="text-xs text-gray-700">
                        {product.peso_bruto ? `${product.peso_bruto} kg` : '-'}
                      </span>
                    </td>

                    {/* Precio Volumen */}
                    <td className="px-4 py-4 text-center">
                      <span className={`text-xs font-medium px-2 py-1 rounded ${product.precios_volumen ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {product.precios_volumen ? 'Sí' : 'No'}
                      </span>
                    </td>

                    {/* Descuento Volumen */}
                    <td className="px-4 py-4 text-center">
                      <span className={`text-xs font-medium px-2 py-1 rounded ${product.descuento_volumen ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {product.descuento_volumen ? 'Sí' : 'No'}
                      </span>
                    </td>

                    {/* Observaciones */}
                    <td className="px-4 py-4">
                      <span className="text-xs text-gray-600 line-clamp-2" title={product.observacion || ''}>
                        {product.observacion || '-'}
                      </span>
                    </td>

                    {/* Extra 1 */}
                    <td className="px-4 py-4">
                      <span className="text-xs text-gray-600">
                        {product.extra_1 || '-'}
                      </span>
                    </td>

                    {/* Activo */}
                    <td className="px-4 py-4 text-center">
                      <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-semibold border ${
                        product.activo 
                          ? 'bg-emerald-100 text-emerald-700 border-emerald-200' 
                          : 'bg-gray-100 text-gray-500 border-gray-200'
                      }`}>
                        <div className={`w-2 h-2 rounded-full ${
                          product.activo ? 'bg-emerald-500' : 'bg-gray-400'
                        }`}></div>
                        {product.activo ? 'Sí' : 'No'}
                      </div>
                    </td>

                    {/* Estado */}
                    <td className="px-4 py-4 text-center">
                       <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-semibold border ${
                         product.estado === 'Activo' || product.estado === 'true'
                           ? 'bg-green-100 text-green-700 border-green-200' 
                           : 'bg-gray-100 text-gray-500 border-gray-200'
                       }`}>
                         <div className={`w-2 h-2 rounded-full ${
                           product.estado === 'Activo' || product.estado === 'true' ? 'bg-green-500' : 'bg-gray-400'
                         }`}></div>
                         {product.estado === 'true' ? 'Activo' : product.estado}
                       </div>
                    </td>

                    {/* Acciones */}
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <button 
                          onClick={() => handleEdit(product)}
                          className="p-2 text-gray-600 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-all border border-transparent hover:border-orange-200"
                          title="Editar"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDelete(product)}
                          className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all border border-transparent hover:border-red-200"
                          title="Desactivar"
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

        <div className="bg-gradient-to-r from-gray-50 to-slate-50 px-6 py-4 border-t-2 border-gray-200 flex items-center justify-between">
           <span className="text-sm text-gray-600">
             Mostrando <span className="font-bold text-gray-900">{filteredProducts.length}</span> de <span className="font-bold text-gray-900">{products.length}</span> productos
           </span>
           <div className="flex gap-2">
             <button className="px-4 py-2 text-sm border-2 border-gray-200 rounded-lg bg-white hover:bg-gray-50 disabled:opacity-50 font-medium transition-all" disabled>Anterior</button>
             <button className="px-4 py-2 text-sm border-2 border-gray-200 rounded-lg bg-white hover:bg-gray-50 disabled:opacity-50 font-medium transition-all" disabled>Siguiente</button>
           </div>
        </div>

      </div>
    </>
  )
}


'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useFormPersistence } from '@/hooks/useFormPersistence'
import { 
  Search, 
  Plus, 
  Filter, 
  MoreHorizontal, 
  Users, 
  Briefcase, 
  ShieldCheck, 
  AlertCircle,
  MapPin,
  Edit2,
  Trash2,
  X,
  Save,
  Loader2
} from 'lucide-react'
import { useRouter } from 'next/navigation'

type Employee = {
  id: string
  full_name: string
  email: string
  phone: string
  role: string
  job_title: string
  status: string
  created_at: string
}

export default function EmployeesManagement() {
  const router = useRouter()
  const supabase = createClient()
  
  const [employees, setEmployees] = useState<Employee[]>([])
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
  } = useFormPersistence('empleados_form', {
    full_name: '',
    email: '',
    phone: '',
    password: '',
    job_title: 'Preventista'
  })

  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const { data, error } = await supabase
          .from('employees')
          .select('*')
          .order('created_at', { ascending: false })
        
        if (error) throw error
        if (data) setEmployees(data as any)
      } catch (error) {
        console.error('Error cargando empleados:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchEmployees()
  }, [])

  const filteredEmployees = employees.filter(emp => 
    emp.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.email.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const totalEmployees = employees.length
  const totalPreventistas = employees.filter(e => e.job_title === 'Preventista').length
  const totalAdmins = employees.filter(e => e.role === 'Administrador').length

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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

    if (!formData.full_name || !formData.email || !formData.phone) {
      setFormError('Por favor completa todos los campos obligatorios.')
      return
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(formData.email)) {
      setFormError('Por favor ingresa un correo electrónico válido.')
      return
    }

    const phoneDigits = formData.phone.replace(/\D/g, '')
    if (phoneDigits.length < 8) {
      setFormError('El teléfono debe tener al menos 8 dígitos.')
      return
    }

    if (!isEditing && (!formData.password || formData.password.length < 6)) {
      setFormError('La contraseña debe tener al menos 6 caracteres.')
      return
    }

    try {
      setFormLoading(true)

      if (isEditing && editingId) {
        const { error } = await supabase
          .from('employees')
          .update({
            full_name: formData.full_name,
            email: formData.email,
            phone: formData.phone,
            job_title: formData.job_title
          })
          .eq('id', editingId)

        if (error) throw error

        setFormSuccess(true)

        setEmployees(employees.map(emp => 
          emp.id === editingId 
            ? { ...emp, full_name: formData.full_name, email: formData.email, phone: formData.phone, job_title: formData.job_title }
            : emp
        ))

      } else {
        const { data, error: functionError } = await supabase.functions.invoke('create-user', {
          body: {
            email: formData.email,
            password: formData.password,
            full_name: formData.full_name,
            job_title: formData.job_title,
            phone: formData.phone
          }
        })

        if (functionError) {
          throw new Error(functionError.message || 'Error al conectar con el servidor')
        }

        if (data?.error) {
          throw new Error(data.error)
        }

        setFormSuccess(true)

        const { data: newEmployees } = await supabase
          .from('employees')
          .select('*')
          .order('created_at', { ascending: false })
        if (newEmployees) setEmployees(newEmployees as any)
      }

      clearForm()
      setIsEditing(false)
      setEditingId(null)

      setTimeout(() => {
        setFormSuccess(false)
      }, 3000)

    } catch (err: any) {
      console.error('Error guardando empleado:', err)
      
      let errorMessage = 'Ocurrió un error inesperado'
      if (err.message.includes('duplicate') || err.message.includes('already exists')) {
        errorMessage = 'Este correo electrónico ya está registrado'
      } else if (err.message.includes('network') || err.message.includes('fetch')) {
        errorMessage = 'Error de conexión. Verifica tu internet'
      } else if (err.message) {
        errorMessage = err.message
      }
      
      setFormError(errorMessage)
    } finally {
      setFormLoading(false)
    }
  }

  const handleEditClick = (employee: Employee) => {
    setFormData({
      full_name: employee.full_name,
      email: employee.email,
      phone: employee.phone,
      password: '',
      job_title: employee.job_title || 'Preventista'
    })
    setIsEditing(true)
    setEditingId(employee.id)
    setFormError(null)
    setFormSuccess(false)
    
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleDeleteEmployee = async (employee: Employee) => {
    if (!confirm(`¿Estás seguro de desactivar al empleado "${employee.full_name}"?`)) {
      return
    }

    try {
      const { error } = await supabase
        .from('employees')
        .update({ status: 'Inactivo' })
        .eq('id', employee.id)

      if (error) throw error

      setEmployees(employees.map(emp => 
        emp.id === employee.id ? { ...emp, status: 'Inactivo' } : emp
      ))

    } catch (err: any) {
      console.error('Error desactivando empleado:', err)
      alert('Error al desactivar el empleado')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6 space-y-8">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
            Gestión de Empleados
          </h1>
          <p className="text-gray-600 text-sm mt-2">Administra tu equipo, asigna roles y controla accesos</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-6 rounded-2xl shadow-lg text-white">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl">
              <Users className="w-6 h-6" />
            </div>
            <span className="text-xs font-semibold bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full">
              TOTAL
            </span>
          </div>
          <h3 className="text-3xl font-bold mb-1">{totalEmployees}</h3>
          <p className="text-sm text-blue-100">Empleados activos</p>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 p-6 rounded-2xl shadow-lg text-white">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl">
              <Briefcase className="w-6 h-6" />
            </div>
            <span className="text-xs font-semibold bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full">
              VENTAS
            </span>
          </div>
          <h3 className="text-3xl font-bold mb-1">{totalPreventistas}</h3>
          <p className="text-sm text-green-100">Preventistas en ruta</p>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 p-6 rounded-2xl shadow-lg text-white">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <span className="text-xs font-semibold bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full">
              ADMINS
            </span>
          </div>
          <h3 className="text-3xl font-bold mb-1">{totalAdmins}</h3>
          <p className="text-sm text-purple-100">Acceso total</p>
        </div>
      </div>

      {/* FORMULARIO */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-200">
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-8 py-6 border-b border-gray-200 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-600 rounded-xl shadow-lg shadow-blue-900/20">
                <Users className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  {isEditing ? 'Editar Empleado' : 'Nuevo Empleado'}
                </h2>
                <p className="text-sm text-gray-600 mt-0.5">
                  {isEditing ? 'Actualiza la información del empleado' : 'Completa los datos para agregar un nuevo empleado'}
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
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
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
                <p className="text-sm mt-0.5">
                  {isEditing ? 'El empleado ha sido actualizado correctamente.' : 'El empleado ha sido registrado correctamente.'}
                </p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-8">
            
            {/* Datos Personales */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b-2 border-blue-100">
                <div className="w-1 h-6 bg-blue-600 rounded-full"></div>
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">
                  Datos Personales
                </h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">
                    Nombre Completo <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="full_name"
                    value={formData.full_name}
                    onChange={handleChange}
                    className="w-full px-4 py-3 text-sm border-2 border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    placeholder="Juan Pérez"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">
                    Correo Electrónico <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    className="w-full px-4 py-3 text-sm border-2 border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    placeholder="empleado@empresa.com"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">
                    Teléfono <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    className="w-full px-4 py-3 text-sm border-2 border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    placeholder="77712345"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Cuenta y Acceso */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b-2 border-purple-100">
                <div className="w-1 h-6 bg-purple-600 rounded-full"></div>
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">
                  Cuenta y Acceso
                </h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                
                <div className="space-y-3">
                  <label className="block text-sm font-semibold text-gray-700">
                    Rol / Cargo <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, job_title: 'Preventista' })}
                      className={`flex flex-col items-center justify-center gap-2 p-4 rounded-xl border-2 transition-all ${
                        formData.job_title === 'Preventista'
                          ? 'bg-gradient-to-br from-green-600 to-emerald-600 text-white border-green-600 shadow-lg shadow-green-900/20'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-green-300 hover:bg-green-50'
                      }`}
                    >
                      <Briefcase className="w-6 h-6" />
                      <span className="text-sm font-semibold">Preventista</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, job_title: 'Administrador' })}
                      className={`flex flex-col items-center justify-center gap-2 p-4 rounded-xl border-2 transition-all ${
                        formData.job_title === 'Administrador'
                          ? 'bg-gradient-to-br from-purple-600 to-indigo-600 text-white border-purple-600 shadow-lg shadow-purple-900/20'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-purple-300 hover:bg-purple-50'
                      }`}
                    >
                      <ShieldCheck className="w-6 h-6" />
                      <span className="text-sm font-semibold">Administrador</span>
                    </button>
                  </div>
                </div>

                {!isEditing && (
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-700">
                      Contraseña Temporal <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="password"
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      className="w-full px-4 py-3 text-sm border-2 border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      placeholder="******"
                      required={!isEditing}
                    />
                    <p className="text-xs text-gray-500 mt-1">Mínimo 6 caracteres</p>
                  </div>
                )}
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
                    : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-blue-900/20 hover:shadow-xl'
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
                    {isEditing ? 'Actualizar Empleado' : 'Crear Empleado'}
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
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input 
                type="text"
                placeholder="Buscar por nombre, correo o cargo..."
                className="w-full pl-12 pr-4 py-3 text-sm border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-600">Mostrando</span>
              <span className="font-bold text-blue-600">{filteredEmployees.length}</span>
              <span className="text-gray-600">resultados</span>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gradient-to-r from-gray-50 to-slate-50 border-b-2 border-gray-200">
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Empleado</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Contacto</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Rol/Cargo</th>
                <th className="px-6 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">Estado</th>
                <th className="px-6 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
                      <p className="text-gray-600 font-medium">Cargando empleados...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-16 text-center text-gray-500">
                    No se encontraron empleados
                  </td>
                </tr>
              ) : (
                filteredEmployees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-gradient-to-r hover:from-blue-50/30 hover:to-indigo-50/30 transition-all">
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center text-blue-700 font-bold text-lg shadow-sm">
                          {emp.full_name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-gray-900">{emp.full_name}</p>
                          <p className="text-xs text-gray-500">ID: {emp.id.slice(0, 8)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="text-sm text-gray-700 font-medium">{emp.email}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{emp.phone}</div>
                    </td>
                    <td className="px-6 py-5">
                      {emp.role === 'Administrador' ? (
                        <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold bg-purple-100 text-purple-700 border border-purple-200">
                          Administrador
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-100 text-blue-700 border border-blue-200">
                          {emp.job_title || 'Preventista'}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-5 text-center">
                      <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold bg-green-100 text-green-700 border border-green-200">
                        <div className="w-2 h-2 rounded-full bg-green-500"></div>
                        Activo
                      </span>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center justify-center gap-2">
                        <button 
                          onClick={() => handleEditClick(emp)}
                          className="p-2.5 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all border border-transparent hover:border-blue-200" 
                          title="Editar"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button 
                          className="p-2.5 text-gray-600 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-all border border-transparent hover:border-orange-200" 
                          title="Ver Rutas"
                        >
                          <MapPin className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDeleteEmployee(emp)}
                          className="p-2.5 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all border border-transparent hover:border-red-200" 
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
            Página 1 de 1
          </span>
          <div className="flex gap-2">
            <button className="px-4 py-2 text-sm border-2 border-gray-200 rounded-lg bg-white hover:bg-gray-50 disabled:opacity-50 font-medium transition-all" disabled>Anterior</button>
            <button className="px-4 py-2 text-sm border-2 border-gray-200 rounded-lg bg-white hover:bg-gray-50 disabled:opacity-50 font-medium transition-all" disabled>Siguiente</button>
          </div>
        </div>
      </div>
    </div>
  )
}
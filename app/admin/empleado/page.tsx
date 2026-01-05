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
  const [mounted, setMounted] = useState(false)
  
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
    setMounted(true)
  }, [])

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
          if (data?.error) {
            throw new Error(data.error)
          }
          throw new Error(functionError.message || 'Error al conectar con el servidor')
        }

        if (data?.error) {
          throw new Error(data.error)
        }

        if (!data?.user) {
          throw new Error('No se recibió información del usuario creado')
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
      let errorMessage = 'Ocurrió un error inesperado'
      if (err.message.includes('duplicate') || err.message.includes('already exists') || err.message.includes('ya existe')) {
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
        .update({ status: 'Deshabilitado' })
        .eq('id', employee.id)

      if (error) throw error

      setEmployees(employees.map(emp => 
        emp.id === employee.id ? { ...emp, status: 'Deshabilitado' } : emp
      ))

    } catch (err: any) {
      console.error('Error desactivando empleado:', err)
      alert('Error al desactivar el empleado')
    }
  }

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 p-4 sm:p-6 lg:p-8">
      
      {/* Patrón de rombos/diamantes armónico - MÁS VISIBLE */}
      <div className="fixed inset-0 z-0 pointer-events-none opacity-35" 
           style={{
             backgroundImage: `
               repeating-linear-gradient(
                 45deg, 
                 transparent, 
                 transparent 35px, 
                 rgba(16, 185, 129, 0.25) 35px, 
                 rgba(16, 185, 129, 0.25) 39px
               ),
               repeating-linear-gradient(
                 -45deg, 
                 transparent, 
                 transparent 35px, 
                 rgba(16, 185, 129, 0.25) 35px, 
                 rgba(16, 185, 129, 0.25) 39px
               )
             `,
           }}>
      </div>
      
      {/* Patrón de puntos sutiles complementario */}
      <div className="fixed inset-0 z-0 pointer-events-none opacity-25" 
           style={{
             backgroundImage: `radial-gradient(circle at 2px 2px, rgba(20, 184, 166, 0.12) 1px, transparent 1px)`,
             backgroundSize: '48px 48px'
           }}>
      </div>
      
      {/* Degradado superior suave */}
      <div className="fixed inset-0 z-0 bg-gradient-to-b from-white/40 via-transparent to-transparent pointer-events-none"></div>
      
      {/* Círculos suaves con blur - Esquina superior izquierda */}
      <div className="fixed -top-24 -left-24 w-96 h-96 bg-green-200/30 rounded-full blur-3xl z-0 pointer-events-none"></div>
      <div className="fixed top-32 left-32 w-64 h-64 bg-emerald-300/20 rounded-full blur-2xl z-0 pointer-events-none"></div>
      
      {/* Círculos suaves - Esquina superior derecha */}
      <div className="fixed -top-32 -right-32 w-[500px] h-[500px] bg-teal-200/25 rounded-full blur-3xl z-0 pointer-events-none"></div>
      
      {/* Círculo central flotante */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-emerald-100/20 rounded-full blur-3xl z-0 pointer-events-none"></div>
      
      {/* Círculos suaves - Esquina inferior */}
      <div className="fixed -bottom-40 -left-20 w-[450px] h-[450px] bg-green-300/25 rounded-full blur-3xl z-0 pointer-events-none"></div>
      <div className="fixed -bottom-20 -right-40 w-80 h-80 bg-emerald-200/30 rounded-full blur-3xl z-0 pointer-events-none"></div>
      
      {/* Figuras geométricas decorativas - MÁS VISIBLES */}
      {/* Superior derecha */}
      <div className="fixed top-20 right-1/4 w-20 h-20 border-3 border-emerald-500/40 rounded-xl rotate-12 z-0 pointer-events-none shadow-lg shadow-emerald-500/10"></div>
      <div className="fixed top-32 right-1/3 w-14 h-14 bg-green-400/15 rounded-lg -rotate-6 z-0 pointer-events-none"></div>
      
      {/* Superior izquierda */}
      <div className="fixed top-40 left-1/4 w-16 h-16 border-3 border-teal-500/35 rounded-full z-0 pointer-events-none shadow-lg shadow-teal-500/10"></div>
      <div className="fixed top-56 left-1/3 w-12 h-12 bg-emerald-300/20 rotate-45 z-0 pointer-events-none"></div>
      
      {/* Centro izquierda */}
      <div className="fixed top-1/2 left-16 w-24 h-24 border-3 border-green-500/40 rotate-45 z-0 pointer-events-none shadow-lg shadow-green-500/10"></div>
      <div className="fixed top-1/2 left-32 w-10 h-10 bg-teal-400/20 rounded-lg -rotate-12 z-0 pointer-events-none"></div>
      
      {/* Centro derecha */}
      <div className="fixed top-1/3 right-20 w-18 h-18 border-3 border-emerald-600/35 rounded-2xl rotate-45 z-0 pointer-events-none shadow-lg shadow-emerald-600/10"></div>
      <div className="fixed top-2/3 right-32 w-22 h-22 border-3 border-green-400/40 rotate-12 rounded-lg z-0 pointer-events-none"></div>
      
      {/* Inferior izquierda */}
      <div className="fixed bottom-1/3 left-20 w-16 h-16 border-3 border-teal-600/40 rounded-full z-0 pointer-events-none shadow-lg shadow-teal-600/10"></div>
      <div className="fixed bottom-1/4 left-40 w-14 h-14 bg-green-300/20 rounded-xl rotate-45 z-0 pointer-events-none"></div>
      
      {/* Inferior derecha */}
      <div className="fixed bottom-20 right-1/4 w-20 h-20 border-3 border-emerald-500/45 rounded-lg -rotate-12 z-0 pointer-events-none shadow-lg shadow-emerald-500/10"></div>
      <div className="fixed bottom-32 right-1/3 w-12 h-12 bg-teal-400/25 rotate-6 z-0 pointer-events-none"></div>
      
      {/* Contenido principal */}
      <div className="relative z-10 space-y-6">
      {/* HEADER - Paleta verde y blanco vibrante - STICKY para que siempre esté visible */}
      <div className="sticky top-0 z-50 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl shadow-lg border-2 border-green-100 backdrop-blur-sm">
        <div>
          <h1 className="text-3xl md:text-4xl font-black bg-gradient-to-r from-green-600 via-green-500 to-emerald-500 bg-clip-text text-transparent">
            Gestión de Empleados
          </h1>
          <p className="text-gray-600 text-sm mt-2 font-medium">Administra tu equipo, asigna roles y controla accesos</p>
        </div>
      </div>

      {/* KPIs - Verde vibrante con blanco */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6">
        
        {/* Total Empleados - Verde principal */}
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
            <h3 className="text-4xl font-black mb-1 text-white">{totalEmployees}</h3>
            <p className="text-sm text-green-50 font-semibold">Empleados activos</p>
          </div>
        </div>

        {/* Preventistas - Verde claro vibrante */}
        <div className="group relative bg-gradient-to-br from-emerald-400 via-green-400 to-teal-500 p-6 rounded-3xl shadow-xl hover:shadow-2xl transition-all duration-300 border-2 border-emerald-300 hover:scale-105">
          <div className="absolute inset-0 bg-white/10 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
          <div className="relative">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-white/20 backdrop-blur-sm rounded-2xl shadow-lg">
                <Briefcase className="w-7 h-7 text-white" />
              </div>
              <span className="text-xs font-bold bg-white text-emerald-600 px-4 py-1.5 rounded-full shadow-md">
                VENTAS
              </span>
            </div>
            <h3 className="text-4xl font-black mb-1 text-white">{totalPreventistas}</h3>
            <p className="text-sm text-emerald-50 font-semibold">Preventistas en ruta</p>
          </div>
        </div>

        {/* Admins - Rojo acento vibrante */}
        <div className="group relative bg-gradient-to-br from-red-500 via-red-600 to-rose-600 p-6 rounded-3xl shadow-xl hover:shadow-2xl transition-all duration-300 border-2 border-red-400 hover:scale-105">
          <div className="absolute inset-0 bg-white/10 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
          <div className="relative">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-white/20 backdrop-blur-sm rounded-2xl shadow-lg">
                <ShieldCheck className="w-7 h-7 text-white" />
              </div>
              <span className="text-xs font-bold bg-white text-red-600 px-4 py-1.5 rounded-full shadow-md">
                ADMINS
              </span>
            </div>
            <h3 className="text-4xl font-black mb-1 text-white">{totalAdmins}</h3>
            <p className="text-sm text-red-50 font-semibold">Acceso total</p>
          </div>
        </div>
      </div>

      {/* FORMULARIO - Blanco con acentos verdes vibrantes */}
      <div className="bg-white rounded-3xl shadow-2xl border-2 border-green-100 overflow-hidden">
        <div className="bg-gradient-to-r from-green-500 via-green-600 to-emerald-600 px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-4 bg-white rounded-2xl shadow-lg">
                <Users className="w-7 h-7 text-green-600" />
              </div>
              <div>
                <h2 className="text-2xl font-black text-white">
                  {isEditing ? 'Editar Empleado' : 'Nuevo Empleado'}
                </h2>
                <p className="text-sm text-green-50 mt-1 font-medium">
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
                className="text-sm text-white hover:text-green-100 font-bold px-4 py-2 bg-white/20 rounded-xl hover:bg-white/30 transition-all"
              >
                Cancelar edición
              </button>
            )}
          </div>
        </div>

        <div className="p-8">
          {formError && (
            <div className="mb-6 flex items-start gap-3 bg-red-50 border-2 border-red-300 text-red-700 p-5 rounded-2xl shadow-lg">
              <AlertCircle className="w-6 h-6 flex-shrink-0 mt-0.5 text-red-600" />
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
                <p className="text-sm mt-1">
                  {isEditing ? 'El empleado ha sido actualizado correctamente.' : 'El empleado ha sido registrado correctamente.'}
                </p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-8">
            
            {/* Datos Personales */}
            <div className="space-y-5">
              <div className="flex items-center gap-3 pb-3 border-b-4 border-green-500">
                <div className="w-2 h-8 bg-gradient-to-b from-green-500 to-emerald-600 rounded-full shadow-lg"></div>
                <h3 className="text-base font-black text-gray-900 uppercase tracking-wider">
                  Datos Personales
                </h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="space-y-2">
                  <label className="block text-sm font-bold text-gray-800">
                    Nombre Completo <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="full_name"
                    value={formData.full_name}
                    onChange={handleChange}
                    className="w-full px-5 py-3.5 text-sm border-2 border-gray-200 rounded-2xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-green-200 focus:border-green-500 transition-all shadow-sm hover:border-green-300"
                    placeholder="Juan Pérez"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-bold text-gray-800">
                    Correo Electrónico <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    className="w-full px-5 py-3.5 text-sm border-2 border-gray-200 rounded-2xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-green-200 focus:border-green-500 transition-all shadow-sm hover:border-green-300"
                    placeholder="empleado@empresa.com"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-bold text-gray-800">
                    Teléfono <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    className="w-full px-5 py-3.5 text-sm border-2 border-gray-200 rounded-2xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-green-200 focus:border-green-500 transition-all shadow-sm hover:border-green-300"
                    placeholder="77712345"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Cuenta y Acceso */}
            <div className="space-y-5">
              <div className="flex items-center gap-3 pb-3 border-b-4 border-green-500">
                <div className="w-2 h-8 bg-gradient-to-b from-green-500 to-emerald-600 rounded-full shadow-lg"></div>
                <h3 className="text-base font-black text-gray-900 uppercase tracking-wider">
                  Cuenta y Acceso
                </h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                
                <div className="space-y-3">
                  <label className="block text-sm font-bold text-gray-800">
                    Rol / Cargo <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    {/* Preventista - Verde vibrante */}
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, job_title: 'Preventista' })}
                      className={`flex flex-col items-center justify-center gap-3 p-5 rounded-2xl border-2 transition-all duration-300 shadow-lg hover:shadow-xl ${
                        (mounted ? formData.job_title : 'Preventista') === 'Preventista'
                          ? 'bg-gradient-to-br from-green-500 to-emerald-600 text-white border-green-400 scale-105'
                          : 'bg-white text-gray-700 border-gray-200 hover:border-green-400 hover:bg-green-50'
                      }`}
                    >
                      <Briefcase className="w-7 h-7" />
                      <span className="text-sm font-black">Preventista</span>
                    </button>

                    {/* Administrador - Rojo acento */}
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, job_title: 'Administrador' })}
                      className={`flex flex-col items-center justify-center gap-3 p-5 rounded-2xl border-2 transition-all duration-300 shadow-lg hover:shadow-xl ${
                        (mounted ? formData.job_title : 'Preventista') === 'Administrador'
                          ? 'bg-gradient-to-br from-red-500 to-rose-600 text-white border-red-400 scale-105'
                          : 'bg-white text-gray-700 border-gray-200 hover:border-red-400 hover:bg-red-50'
                      }`}
                    >
                      <ShieldCheck className="w-7 h-7" />
                      <span className="text-sm font-black">Administrador</span>
                    </button>
                  </div>
                </div>

                {!isEditing && (
                  <div className="space-y-2">
                    <label className="block text-sm font-bold text-gray-800">
                      Contraseña Temporal <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="password"
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      className="w-full px-5 py-3.5 text-sm border-2 border-gray-200 rounded-2xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-green-200 focus:border-green-500 transition-all shadow-sm hover:border-green-300"
                      placeholder="******"
                      required={!isEditing}
                    />
                    <p className="text-xs text-gray-600 mt-1 font-medium">Mínimo 6 caracteres</p>
                  </div>
                )}
              </div>
            </div>

            {/* Botones */}
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
                    {isEditing ? 'Actualizar Empleado' : 'Crear Empleado'}
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* TABLA - Blanco con acentos verdes */}
      <div className="bg-white rounded-3xl shadow-2xl border-2 border-green-100 overflow-hidden">
        
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 px-6 py-5 border-b-2 border-green-200">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="relative flex-1 w-full max-w-2xl">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-green-600" />
              <input 
                type="text"
                placeholder="Buscar por nombre, correo o cargo..."
                className="w-full pl-14 pr-5 py-4 text-sm border-2 border-green-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-green-200 focus:border-green-500 transition-all shadow-sm hover:border-green-300 bg-white font-medium"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2 text-sm bg-white px-5 py-3 rounded-xl border-2 border-green-200 shadow-sm">
              <span className="text-gray-600 font-medium">Mostrando</span>
              <span className="font-black text-green-600 text-base">{filteredEmployees.length}</span>
              <span className="text-gray-600 font-medium">resultados</span>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gradient-to-r from-green-100 to-emerald-100 border-b-4 border-green-300">
                <th className="px-6 py-5 text-left text-xs font-black text-gray-800 uppercase tracking-wider">Empleado</th>
                <th className="px-6 py-5 text-left text-xs font-black text-gray-800 uppercase tracking-wider">Contacto</th>
                <th className="px-6 py-5 text-left text-xs font-black text-gray-800 uppercase tracking-wider">Rol/Cargo</th>
                <th className="px-6 py-5 text-center text-xs font-black text-gray-800 uppercase tracking-wider">Estado</th>
                <th className="px-6 py-5 text-center text-xs font-black text-gray-800 uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center justify-center gap-4">
                      <Loader2 className="w-12 h-12 text-green-600 animate-spin" />
                      <p className="text-gray-700 font-bold text-lg">Cargando empleados...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-20 text-center text-gray-600 font-semibold text-lg">
                    No se encontraron empleados
                  </td>
                </tr>
              ) : (
                filteredEmployees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-gradient-to-r hover:from-green-50/50 hover:to-emerald-50/50 transition-all">
                    <td className="px-6 py-6">
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center text-white font-black text-xl shadow-lg">
                          {emp.full_name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-gray-900">{emp.full_name}</p>
                          <p className="text-xs text-gray-500 font-medium">ID: {emp.id.slice(0, 8)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-6">
                      <div className="text-sm text-gray-800 font-bold">{emp.email}</div>
                      <div className="text-xs text-gray-600 mt-1 font-medium">{emp.phone}</div>
                    </td>
                    <td className="px-6 py-6">
                      {emp.role === 'Administrador' ? (
                        <span className="inline-flex items-center px-4 py-2 rounded-xl text-xs font-black bg-red-100 text-red-700 border-2 border-red-300 shadow-md">
                          Administrador
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-4 py-2 rounded-xl text-xs font-black bg-green-100 text-green-700 border-2 border-green-300 shadow-md">
                          {emp.job_title || 'Preventista'}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-6 text-center">
                      <span className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black bg-emerald-100 text-emerald-700 border-2 border-emerald-300 shadow-md">
                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
                        Activo
                      </span>
                    </td>
                    <td className="px-6 py-6">
                      <div className="flex items-center justify-center gap-2">
                        <button 
                          onClick={() => handleEditClick(emp)}
                          className="p-3 text-gray-700 hover:text-green-600 hover:bg-green-50 rounded-xl transition-all border-2 border-transparent hover:border-green-300 shadow-sm hover:shadow-md" 
                          title="Editar"
                        >
                          <Edit2 className="w-5 h-5" />
                        </button>
                        <button 
                          className="p-3 text-gray-700 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all border-2 border-transparent hover:border-emerald-300 shadow-sm hover:shadow-md" 
                          title="Ver Rutas"
                        >
                          <MapPin className="w-5 h-5" />
                        </button>
                        <button 
                          onClick={() => handleDeleteEmployee(emp)}
                          className="p-3 text-gray-700 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all border-2 border-transparent hover:border-red-300 shadow-sm hover:shadow-md" 
                          title="Desactivar"
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

        <div className="bg-gradient-to-r from-green-50 to-emerald-50 px-6 py-5 border-t-4 border-green-300 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-sm text-gray-700 font-bold">
            Página 1 de 1
          </span>
          <div className="flex gap-3">
            <button className="px-6 py-3 text-sm border-2 border-green-200 rounded-xl bg-white hover:bg-green-50 hover:border-green-400 disabled:opacity-50 disabled:hover:bg-white disabled:hover:border-green-200 font-bold transition-all shadow-md" disabled>Anterior</button>
            <button className="px-6 py-3 text-sm border-2 border-green-200 rounded-xl bg-white hover:bg-green-50 hover:border-green-400 disabled:opacity-50 disabled:hover:bg-white disabled:hover:border-green-200 font-bold transition-all shadow-md" disabled>Siguiente</button>
          </div>
        </div>
      </div>
      </div>
    </div>
  )
}
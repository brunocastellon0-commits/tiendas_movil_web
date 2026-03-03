'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useFormPersistence } from '@/hooks/useFormPersistence'
import {
  Search,
  Users,
  ShieldCheck,
  AlertCircle,
  Edit2,
  Trash2,
  X,
  Save,
  Loader2,
  Briefcase,
  Route,
  Check,
  CheckSquare,
  Square,
} from 'lucide-react'
import { useRouter } from 'next/navigation'

// ─── Tipos ────────────────────────────────────────────────────────────────────
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

type Zone = {
  id: string
  codigo_zona: string
  name: string
  vendedor_id: string | null
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function EmployeesManagement() {
  const router = useRouter()

  // Datos
  const [employees, setEmployees] = useState<Employee[]>([])
  const [zones, setZones] = useState<Zone[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [mounted, setMounted] = useState(false)

  // Modal de asignación de rutas
  const [routeModalEmployee, setRouteModalEmployee] = useState<Employee | null>(null)
  const [selectedZoneIds, setSelectedZoneIds] = useState<Set<string>>(new Set())
  const [zoneSearch, setZoneSearch] = useState('')
  const [savingRoutes, setSavingRoutes] = useState(false)
  const [routeSaveSuccess, setRouteSaveSuccess] = useState(false)

  // Formulario
  const [formLoading, setFormLoading] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [formSuccess, setFormSuccess] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const { formData, setFormData, clearForm } = useFormPersistence('empleados_form', {
    full_name: '',
    email: '',
    phone: '',
    password: '',
    job_title: 'Preventista',
  })

  useEffect(() => { setMounted(true) }, [])

  // Carga inicial
  useEffect(() => {
    const fetchData = async () => {
      const supabase = createClient()
      try {
        const [empRes, zonesRes] = await Promise.all([
          supabase.from('employees').select('*').order('created_at', { ascending: false }),
          supabase.from('zones').select('id, codigo_zona, name, vendedor_id').order('codigo_zona', { ascending: true }),
        ])
        if (empRes.error) throw empRes.error
        if (zonesRes.error) throw zonesRes.error
        if (empRes.data) setEmployees(empRes.data as any)
        if (zonesRes.data) setZones(zonesRes.data as any)
      } catch (error) {
        console.error('Error cargando datos:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const filteredEmployees = employees.filter(emp =>
    emp.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.email.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const totalEmployees = employees.length
  const totalPreventistas = employees.filter(e => e.job_title === 'Preventista').length
  const totalAdmins = employees.filter(e => e.role === 'Administrador').length

  // ── Handlers formulario ──────────────────────────────────────────────────────
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
      const supabase = createClient()
      setFormLoading(true)

      if (isEditing && editingId) {
        const { error } = await supabase
          .from('employees')
          .update({ full_name: formData.full_name, email: formData.email, phone: formData.phone, job_title: formData.job_title })
          .eq('id', editingId)
        if (error) throw error
        setEmployees(employees.map(emp =>
          emp.id === editingId
            ? { ...emp, full_name: formData.full_name, email: formData.email, phone: formData.phone, job_title: formData.job_title }
            : emp
        ))
      } else {
        const { data, error: fnErr } = await supabase.functions.invoke('create-user', {
          body: { email: formData.email, password: formData.password, full_name: formData.full_name, job_title: formData.job_title, phone: formData.phone },
        })
        if (fnErr) throw new Error(fnErr.message || 'Error al conectar con el servidor')
        if (data?.error) throw new Error(data.error)
        if (!data?.user) throw new Error('No se recibió información del usuario creado')

        const { data: newEmps } = await supabase.from('employees').select('*').order('created_at', { ascending: false })
        if (newEmps) setEmployees(newEmps as any)
      }

      // Sincronización SQL Server
      try {
        await fetch('/api/sync/master', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            entity: 'EMPLOYEE',
            data: { code: formData.email, name: formData.full_name, phone: formData.phone, job_title: formData.job_title },
          }),
        })
      } catch (syncErr) {
        console.warn('Sincronización local omitida:', syncErr)
      }

      setFormSuccess(true)
      clearForm()
      setIsEditing(false)
      setEditingId(null)
      setTimeout(() => setFormSuccess(false), 3000)
    } catch (err: any) {
      let msg = 'Ocurrió un error inesperado'
      if (err.message?.includes('duplicate') || err.message?.includes('already exists')) msg = 'Este correo electrónico ya está registrado'
      else if (err.message?.includes('network') || err.message?.includes('fetch')) msg = 'Error de conexión. Verifica tu internet'
      else if (err.message) msg = err.message
      setFormError(msg)
    } finally {
      setFormLoading(false)
    }
  }

  const handleEditClick = (employee: Employee) => {
    setFormData({
      full_name: employee.full_name,
      email: employee.email,
      phone: employee.phone ?? '',
      password: '',
      job_title: employee.job_title || 'Preventista',
    })
    setIsEditing(true)
    setEditingId(employee.id)
    setFormError(null)
    setFormSuccess(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleDeleteEmployee = async (employee: Employee) => {
    const supabase = createClient()
    if (!confirm(`¿Estás seguro de desactivar al empleado "${employee.full_name}"?`)) return
    try {
      const { error } = await supabase.from('employees').update({ status: 'Deshabilitado' }).eq('id', employee.id)
      if (error) throw error
      setEmployees(employees.map(emp => emp.id === employee.id ? { ...emp, status: 'Deshabilitado' } : emp))
    } catch (err: any) {
      console.error('Error desactivando empleado:', err)
      alert('Error al desactivar el empleado')
    }
  }

  // ── Modal de rutas ───────────────────────────────────────────────────────────
  const handleOpenRouteModal = (employee: Employee) => {
    setSelectedZoneIds(new Set(zones.filter(z => z.vendedor_id === employee.id).map(z => z.id)))
    setZoneSearch('')
    setRouteSaveSuccess(false)
    setRouteModalEmployee(employee)
  }

  const toggleZone = (zoneId: string) => {
    setSelectedZoneIds(prev => {
      const next = new Set(prev)
      if (next.has(zoneId)) next.delete(zoneId)
      else next.add(zoneId)
      return next
    })
  }

  const handleSaveRoutes = async () => {
    if (!routeModalEmployee) return
    const supabase = createClient()
    setSavingRoutes(true)
    try {
      const empId = routeModalEmployee.id
      const currentlyAssigned = zones.filter(z => z.vendedor_id === empId).map(z => z.id)
      const toAssign = Array.from(selectedZoneIds).filter(id => !currentlyAssigned.includes(id))
      const toUnassign = currentlyAssigned.filter(id => !selectedZoneIds.has(id))

      await Promise.all([
        ...toAssign.map(id => supabase.from('zones').update({ vendedor_id: empId }).eq('id', id)),
        ...toUnassign.map(id => supabase.from('zones').update({ vendedor_id: null }).eq('id', id)),
      ])

      const { data: updatedZones } = await supabase.from('zones').select('id, codigo_zona, name, vendedor_id').order('codigo_zona')
      if (updatedZones) setZones(updatedZones as any)

      setRouteSaveSuccess(true)
      setTimeout(() => setRouteSaveSuccess(false), 2000)
    } catch (err) {
      console.error('Error asignando rutas:', err)
    } finally {
      setSavingRoutes(false)
    }
  }

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 p-4 sm:p-6 lg:p-8">

      {/* Fondo decorativo */}
      <div className="fixed inset-0 z-0 pointer-events-none opacity-35"
        style={{
          backgroundImage: `
            repeating-linear-gradient(45deg, transparent, transparent 35px, rgba(16,185,129,0.25) 35px, rgba(16,185,129,0.25) 39px),
            repeating-linear-gradient(-45deg, transparent, transparent 35px, rgba(16,185,129,0.25) 35px, rgba(16,185,129,0.25) 39px)
          `,
        }} />

      <div className="relative z-10 max-w-7xl mx-auto space-y-8">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl font-black text-gray-900 tracking-tight">Gestión de Empleados</h1>
            <p className="text-gray-600 mt-1 font-medium">Administra el equipo y sus rutas asignadas</p>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-gradient-to-br from-green-500 to-emerald-600 p-6 rounded-2xl shadow-lg text-white">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-white/20 rounded-xl"><Users className="w-6 h-6" /></div>
              <span className="text-xs font-semibold bg-white/20 px-3 py-1 rounded-full">TOTAL</span>
            </div>
            <h3 className="text-3xl font-bold mb-1">{totalEmployees}</h3>
            <p className="text-sm text-green-100">Empleados registrados</p>
          </div>
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-6 rounded-2xl shadow-lg text-white">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-white/20 rounded-xl"><Briefcase className="w-6 h-6" /></div>
              <span className="text-xs font-semibold bg-white/20 px-3 py-1 rounded-full">PREVENTISTAS</span>
            </div>
            <h3 className="text-3xl font-bold mb-1">{totalPreventistas}</h3>
            <p className="text-sm text-blue-100">Vendedores activos</p>
          </div>
          <div className="bg-gradient-to-br from-red-500 to-rose-600 p-6 rounded-2xl shadow-lg text-white">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-white/20 rounded-xl"><ShieldCheck className="w-6 h-6" /></div>
              <span className="text-xs font-semibold bg-white/20 px-3 py-1 rounded-full">ADMINS</span>
            </div>
            <h3 className="text-3xl font-bold mb-1">{totalAdmins}</h3>
            <p className="text-sm text-red-100">Administradores</p>
          </div>
        </div>

        {/* Formulario */}
        <div className="bg-white rounded-3xl shadow-2xl border-2 border-green-100 overflow-hidden">
          <div className="bg-gradient-to-r from-green-500 to-emerald-600 px-8 py-6">
            <h2 className="text-xl font-black text-white flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-xl"><Users className="w-5 h-5" /></div>
              {isEditing ? 'Editar Empleado' : 'Nuevo Empleado'}
            </h2>
            <p className="text-green-100 text-sm mt-1">
              {isEditing ? 'Modifica los datos del empleado' : 'Completa los datos para agregar un nuevo miembro al equipo'}
            </p>
          </div>

          <div className="p-8">
            {formError && (
              <div className="mb-6 flex items-start gap-3 p-4 bg-red-50 border-2 border-red-200 text-red-700 rounded-2xl">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <p className="text-sm font-semibold">{formError}</p>
              </div>
            )}
            {formSuccess && (
              <div className="mb-6 flex items-start gap-3 p-4 bg-emerald-50 border-2 border-emerald-200 text-emerald-700 rounded-2xl">
                <Check className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <p className="text-sm font-semibold">
                  {isEditing ? '¡Empleado actualizado exitosamente!' : '¡Empleado creado exitosamente!'}
                </p>
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="block text-sm font-bold text-gray-800">Nombre Completo <span className="text-red-500">*</span></label>
                  <input type="text" name="full_name" value={formData.full_name ?? ''} onChange={handleChange}
                    className="w-full px-5 py-3.5 text-sm border-2 border-gray-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-green-200 focus:border-green-500 transition-all"
                    placeholder="Juan Pérez" required />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-bold text-gray-800">Correo Electrónico <span className="text-red-500">*</span></label>
                  <input type="email" name="email" value={formData.email ?? ''} onChange={handleChange}
                    disabled={isEditing}
                    className="w-full px-5 py-3.5 text-sm border-2 border-gray-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-green-200 focus:border-green-500 transition-all disabled:bg-gray-50 disabled:cursor-not-allowed"
                    placeholder="correo@empresa.com" required />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-bold text-gray-800">Teléfono <span className="text-red-500">*</span></label>
                  <input type="tel" name="phone" value={formData.phone ?? ''} onChange={handleChange}
                    className="w-full px-5 py-3.5 text-sm border-2 border-gray-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-green-200 focus:border-green-500 transition-all"
                    placeholder="77712345" required />
                </div>
                {!isEditing && (
                  <div className="space-y-2">
                    <label className="block text-sm font-bold text-gray-800">Contraseña <span className="text-red-500">*</span></label>
                    <input type="password" name="password" value={formData.password ?? ''} onChange={handleChange}
                      className="w-full px-5 py-3.5 text-sm border-2 border-gray-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-green-200 focus:border-green-500 transition-all"
                      placeholder="Mínimo 6 caracteres" />
                  </div>
                )}
                <div className="space-y-2">
                  <label className="block text-sm font-bold text-gray-800">Cargo</label>
                  <select name="job_title" value={formData.job_title ?? 'Preventista'}
                    onChange={(e) => setFormData({ ...formData, job_title: e.target.value })}
                    className="w-full px-5 py-3.5 text-sm border-2 border-gray-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-green-200 focus:border-green-500 transition-all">
                    <option value="Preventista">Preventista</option>
                    <option value="Supervisor">Supervisor</option>
                    <option value="Administrativo">Administrativo</option>
                    <option value="Gerente">Gerente</option>
                  </select>
                </div>
              </div>

              {isEditing && (
                <div className="mt-4 p-3 bg-purple-50 border border-purple-200 rounded-xl text-xs text-purple-700 font-semibold">
                  💡 Para asignar rutas a este empleado, usa el botón <span className="inline-flex items-center gap-1"><Route className="w-3 h-3" /> Rutas</span> en la tabla.
                </div>
              )}

              <div className="flex gap-4 pt-8">
                <button type="button" onClick={handleClearForm}
                  className="px-8 py-4 border-2 border-orange-200 text-orange-700 bg-orange-50 rounded-2xl hover:bg-orange-100 font-bold transition-all flex items-center gap-2">
                  <X className="w-5 h-5" /> Limpiar
                </button>
                <button type="submit" disabled={formLoading}
                  className={`flex-1 flex items-center justify-center gap-3 px-8 py-4 rounded-2xl text-white font-black transition-all shadow-xl ${
                    formLoading ? 'bg-gray-400 cursor-not-allowed' : 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 hover:scale-105'
                  }`}>
                  {formLoading
                    ? <><Loader2 className="w-6 h-6 animate-spin" /> Guardando...</>
                    : <><Save className="w-6 h-6" /> {isEditing ? 'Actualizar Empleado' : 'Crear Empleado'}</>}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Tabla de empleados */}
        <div className="bg-white rounded-3xl shadow-2xl border-2 border-green-100 overflow-hidden">

          <div className="bg-gradient-to-r from-green-50 to-emerald-50 px-6 py-5 border-b-2 border-green-200">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="relative flex-1 w-full max-w-2xl">
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-green-600" />
                <input type="text"
                  placeholder="Buscar por nombre o correo..."
                  className="w-full pl-14 pr-5 py-4 text-sm border-2 border-green-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-green-200 focus:border-green-500 transition-all bg-white font-medium"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)} />
              </div>
              <div className="flex items-center gap-2 text-sm bg-white px-5 py-3 rounded-xl border-2 border-green-200">
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
                  <th className="px-6 py-5 text-left text-xs font-black text-gray-800 uppercase tracking-wider">Cargo</th>
                  <th className="px-6 py-5 text-left text-xs font-black text-gray-800 uppercase tracking-wider">Rutas Asignadas</th>
                  <th className="px-6 py-5 text-center text-xs font-black text-gray-800 uppercase tracking-wider">Estado</th>
                  <th className="px-6 py-5 text-center text-xs font-black text-gray-800 uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-20 text-center">
                      <div className="flex flex-col items-center gap-4">
                        <Loader2 className="w-12 h-12 text-green-600 animate-spin" />
                        <p className="text-gray-700 font-bold text-lg">Cargando empleados...</p>
                      </div>
                    </td>
                  </tr>
                ) : filteredEmployees.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-20 text-center text-gray-600 font-semibold text-lg">
                      No se encontraron empleados
                    </td>
                  </tr>
                ) : (
                  filteredEmployees.map((emp) => {
                    const empZones = zones.filter(z => z.vendedor_id === emp.id)
                    return (
                      <tr key={emp.id} className="hover:bg-gradient-to-r hover:from-green-50/50 hover:to-emerald-50/50 transition-all">

                        {/* Empleado */}
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center text-white font-black text-lg shadow-lg flex-shrink-0">
                              {emp.full_name.charAt(0)}
                            </div>
                            <div>
                              <p className="text-sm font-bold text-gray-900">{emp.full_name}</p>
                              <p className="text-xs text-gray-500 font-medium">ID: {emp.id.slice(0, 8)}</p>
                            </div>
                          </div>
                        </td>

                        {/* Contacto */}
                        <td className="px-6 py-5">
                          <div className="text-sm text-gray-800 font-bold">{emp.email}</div>
                          <div className="text-xs text-gray-600 mt-1 font-medium">{emp.phone}</div>
                        </td>

                        {/* Cargo */}
                        <td className="px-6 py-5">
                          {emp.role === 'Administrador' ? (
                            <span className="inline-flex items-center px-3 py-1.5 rounded-xl text-xs font-black bg-red-100 text-red-700 border-2 border-red-300">
                              Administrador
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-3 py-1.5 rounded-xl text-xs font-black bg-green-100 text-green-700 border-2 border-green-300">
                              {emp.job_title || 'Preventista'}
                            </span>
                          )}
                        </td>

                        {/* Rutas asignadas */}
                        <td className="px-6 py-5">
                          {empZones.length === 0 ? (
                            <span className="text-xs text-gray-400 italic">Sin rutas</span>
                          ) : (
                            <div className="flex flex-wrap gap-1.5 max-w-[240px]">
                              {empZones.map(z => (
                                <span key={z.id}
                                  className="inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-black bg-purple-100 text-purple-700 border border-purple-300"
                                  title={z.name}>
                                  {z.codigo_zona}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>

                        {/* Estado */}
                        <td className="px-6 py-5 text-center">
                          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-black bg-emerald-100 text-emerald-700 border-2 border-emerald-300">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            Activo
                          </span>
                        </td>

                        {/* Acciones */}
                        <td className="px-6 py-5">
                          <div className="flex items-center justify-center gap-2">
                            <button onClick={() => handleEditClick(emp)}
                              className="p-3 text-gray-700 hover:text-green-600 hover:bg-green-50 rounded-xl transition-all border-2 border-transparent hover:border-green-300 shadow-sm"
                              title="Editar">
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <div className="relative">
                              <button onClick={() => handleOpenRouteModal(emp)}
                                className="p-3 text-gray-700 hover:text-purple-600 hover:bg-purple-50 rounded-xl transition-all border-2 border-transparent hover:border-purple-300 shadow-sm"
                                title="Asignar Rutas">
                                <Route className="w-4 h-4" />
                              </button>
                              {empZones.length > 0 && (
                                <span className="absolute -top-1 -right-1 w-4 h-4 bg-purple-500 text-white text-[9px] font-black rounded-full flex items-center justify-center pointer-events-none">
                                  {empZones.length}
                                </span>
                              )}
                            </div>
                            <button onClick={() => handleDeleteEmployee(emp)}
                              className="p-3 text-gray-700 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all border-2 border-transparent hover:border-red-300 shadow-sm"
                              title="Desactivar">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="bg-gradient-to-r from-green-50 to-emerald-50 px-6 py-5 border-t-4 border-green-300 flex items-center justify-between">
            <span className="text-sm text-gray-700 font-bold">
              {filteredEmployees.length} de {totalEmployees} empleados
            </span>
          </div>
        </div>
      </div>

      {/* ── MODAL ASIGNACIÓN DE RUTAS ─────────────────────────────────────────── */}
      {routeModalEmployee && (() => {
        const filteredZonesForModal = zones.filter((z: Zone) =>
          z.codigo_zona.toLowerCase().includes(zoneSearch.toLowerCase()) ||
          z.name.toLowerCase().includes(zoneSearch.toLowerCase())
        )
        return (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">

              {/* Header */}
              <div className="bg-gradient-to-r from-purple-500 to-indigo-600 px-6 py-5 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-white/20 rounded-2xl"><Route className="w-5 h-5 text-white" /></div>
                  <div>
                    <h2 className="text-lg font-black text-white">Asignar Rutas</h2>
                    <p className="text-purple-100 text-xs font-medium">
                      {routeModalEmployee.full_name} · {selectedZoneIds.size} ruta{selectedZoneIds.size !== 1 ? 's' : ''} seleccionada{selectedZoneIds.size !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                <button onClick={() => setRouteModalEmployee(null)}
                  className="p-2 text-white/80 hover:text-white hover:bg-white/20 rounded-xl transition-all">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Barra de búsqueda + atajos */}
              <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3 flex-shrink-0 bg-gray-50">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input type="text" value={zoneSearch} onChange={e => setZoneSearch(e.target.value)}
                    placeholder="Buscar ruta por código o nombre..."
                    className="w-full pl-10 pr-4 py-2.5 text-sm border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-400" />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setSelectedZoneIds(new Set(zones.map(z => z.id)))}
                    className="flex items-center gap-1 px-3 py-2 border-2 border-purple-200 text-purple-700 rounded-xl text-xs font-bold hover:bg-purple-50">
                    <CheckSquare className="w-3.5 h-3.5" /> Todas
                  </button>
                  <button onClick={() => setSelectedZoneIds(new Set())}
                    className="flex items-center gap-1 px-3 py-2 border-2 border-gray-200 text-gray-600 rounded-xl text-xs font-bold hover:bg-gray-50">
                    <Square className="w-3.5 h-3.5" /> Ninguna
                  </button>
                </div>
              </div>

              {/* Lista de zonas */}
              <div className="flex-1 overflow-y-auto px-6 py-4">
                {filteredZonesForModal.length === 0 ? (
                  <p className="text-center text-gray-400 py-8 text-sm">No hay rutas que coincidan</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {filteredZonesForModal.map((zone: Zone) => {
                      const isSelected = selectedZoneIds.has(zone.id)
                      const assignedTo = zone.vendedor_id && zone.vendedor_id !== routeModalEmployee.id
                        ? employees.find(e => e.id === zone.vendedor_id)?.full_name
                        : null
                      return (
                        <button key={zone.id} onClick={() => toggleZone(zone.id)}
                          className={`flex items-center gap-3 p-3 rounded-2xl border-2 text-left transition-all hover:scale-[1.01] ${
                            isSelected ? 'border-purple-400 bg-purple-50' : 'border-gray-200 bg-white hover:border-purple-200'
                          }`}>
                          <div className={`w-5 h-5 rounded-md border-2 flex-shrink-0 flex items-center justify-center transition-all ${
                            isSelected ? 'bg-purple-500 border-purple-500' : 'border-gray-300'
                          }`}>
                            {isSelected && <Check className="w-3 h-3 text-white" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-black text-gray-800">{zone.codigo_zona}</span>
                              {isSelected && (
                                <span className="text-[9px] bg-purple-100 text-purple-700 font-black px-1.5 py-0.5 rounded-full">✓ Asignada</span>
                              )}
                            </div>
                            <p className="text-xs text-gray-500 truncate">{zone.name}</p>
                            {assignedTo && (
                              <p className="text-[10px] text-amber-600 font-semibold mt-0.5">⚠ Asignada a {assignedTo}</p>
                            )}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between gap-3 flex-shrink-0 bg-gray-50">
                <div className="text-sm text-gray-600">
                  <span className="font-black text-purple-700">{selectedZoneIds.size}</span> ruta{selectedZoneIds.size !== 1 ? 's' : ''} de <span className="font-bold">{zones.length}</span> totales
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setRouteModalEmployee(null)}
                    className="px-5 py-2.5 border-2 border-gray-200 text-gray-600 rounded-2xl font-bold text-sm hover:bg-gray-50">
                    Cancelar
                  </button>
                  <button onClick={handleSaveRoutes} disabled={savingRoutes}
                    className={`flex items-center gap-2 px-6 py-2.5 rounded-2xl font-black text-sm shadow-lg transition-all ${
                      routeSaveSuccess
                        ? 'bg-green-500 text-white'
                        : 'bg-gradient-to-r from-purple-500 to-indigo-600 text-white hover:scale-105 disabled:opacity-50'
                    }`}>
                    {savingRoutes
                      ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando...</>
                      : routeSaveSuccess
                        ? <><Check className="w-4 h-4" /> ¡Guardado!</>
                        : <><Save className="w-4 h-4" /> Guardar Asignación</>}
                  </button>
                </div>
              </div>

            </div>
          </div>
        )
      })()}
    </div>
  )
}
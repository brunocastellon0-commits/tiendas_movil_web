'use client'

import { createClient } from '@/utils/supabase/client'
import { Bell, Calendar, ChevronRight, Clock } from 'lucide-react'
import { useEffect, useState } from 'react'

export default function Header() {
  const [showNotifications, setShowNotifications] = useState(false)
  const [userName, setUserName] = useState('Usuario')
  const [userEmail, setUserEmail] = useState('')
  const [userInitials, setUserInitials] = useState('U')
  
  // Obtener datos del usuario desde Supabase
  useEffect(() => {
    const fetchUserData = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (user?.email) {
        setUserEmail(user.email)
        
        // Buscar empleado por su ID real (Evita conflictos si hay correos parecidos o repetidos)
        const { data: employee } = await supabase
          .from('employees')
          .select('full_name, email')
          .eq('id', user.id)
          .single()
        
        if (employee) {
          // Usar el email que viene directo de la BD por seguridad
          setUserEmail(employee.email || user.email)
          setUserName(employee.full_name || 'Empleado')
          // Obtener iniciales del nombre
          const names = employee.full_name.split(' ')
          const initials = names.length > 1 
            ? `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase()
            : names[0].substring(0, 2).toUpperCase()
          setUserInitials(initials)
        } else {
          // Si no hay empleado, usar email
          setUserName(user.email.split('@')[0])
          setUserInitials(user.email[0].toUpperCase())
        }
      }
    }
    
    fetchUserData()
  }, [])
  
  // Obtener fecha y hora actual
  const now = new Date()
  const dateStr = now.toLocaleDateString('es-ES', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  })
  const timeStr = now.toLocaleTimeString('es-ES', { 
    hour: '2-digit', 
    minute: '2-digit' 
  })

  return (
    <header className="h-20 bg-gradient-to-r from-white via-gray-50/50 to-white border-b-2 border-green-100 flex items-center justify-between px-8 sticky top-0 z-20 shadow-lg backdrop-blur-sm">
      
      {/* Left Section - Breadcrumb */}
      <div className="flex items-center gap-6">
        {/* Breadcrumb mejorado */}
        <div className="flex items-center text-sm font-medium">
          <span className="text-gray-600">Panel Administrativo</span>
          <ChevronRight className="w-4 h-4 text-gray-400 mx-1" />
          <span className="font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
            Vista General
          </span>
        </div>
      </div>

      {/* Right Section - Fecha, Notificaciones y Perfil */}
      <div className="flex items-center gap-6">
        
        {/* Fecha y Hora */}
        <div className="hidden xl:flex flex-col items-end">
          <div className="flex items-center gap-2 text-xs text-gray-600 font-medium">
            <Calendar className="w-3.5 h-3.5" />
            <span className="capitalize">{dateStr}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500 font-medium mt-0.5">
            <Clock className="w-3.5 h-3.5" />
            <span>{timeStr}</span>
          </div>
        </div>

        {/* Notificaciones con dropdown */}
        <div className="relative">
          <button 
            onClick={() => setShowNotifications(!showNotifications)}
            className="p-3 text-gray-600 hover:text-green-700 rounded-2xl hover:bg-green-50 relative transition-all hover:scale-105 active:scale-95 border-2 border-transparent hover:border-green-200 shadow-sm hover:shadow-md"
          >
            <Bell className="w-5 h-5" />
            {/* Badge animado */}
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-gradient-to-r from-red-500 to-red-600 rounded-full flex items-center justify-center text-white text-xs font-bold border-2 border-white animate-pulse shadow-lg">
              3
            </span>
          </button>
          
          {/* Dropdown de notificaciones */}
          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-2xl border-2 border-gray-200 py-2 animate-in slide-in-from-top-2">
              <div className="px-4 py-3 border-b border-gray-200">
                <h3 className="font-black text-gray-900">Notificaciones</h3>
                <p className="text-xs text-gray-500 font-medium mt-0.5">Tienes 3 notificaciones nuevas</p>
              </div>
              <div className="max-h-64 overflow-y-auto">
                <div className="px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors border-l-4 border-transparent hover:border-green-500">
                  <p className="text-sm font-bold text-gray-900">Nuevo pedido registrado</p>
                  <p className="text-xs text-gray-500 mt-1">Hace 5 minutos</p>
                </div>
                <div className="px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors border-l-4 border-transparent hover:border-blue-500">
                  <p className="text-sm font-bold text-gray-900">Empleado en ruta</p>
                  <p className="text-xs text-gray-500 mt-1">Hace 15 minutos</p>
                </div>
                <div className="px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors border-l-4 border-transparent hover:border-amber-500">
                  <p className="text-sm font-bold text-gray-900">Stock bajo en productos</p>
                  <p className="text-xs text-gray-500 mt-1">Hace 1 hora</p>
                </div>
              </div>
              <div className="px-4 py-3 border-t border-gray-200">
                <button className="text-sm font-bold text-green-600 hover:text-green-700 transition-colors">
                  Ver todas las notificaciones →
                </button>
              </div>
            </div>
          )}
        </div>
        
        {/* Perfil de usuario con datos reales de Supabase */}
        <div className="flex items-center gap-3 pl-6 border-l-2 border-green-100">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-green-500 via-green-600 to-emerald-600 flex items-center justify-center text-white font-black text-base shadow-lg border-2 border-white overflow-hidden relative group cursor-pointer">
            {/* Efecto hover */}
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-400 to-green-700 opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <span className="relative z-10">{userInitials}</span>
          </div>
          <div className="hidden lg:block">
            <p className="text-sm font-black text-gray-900 truncate max-w-[200px]" title={userName}>
              {userName}
            </p>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <p className="text-xs text-gray-600 font-bold truncate max-w-[180px]" title={userEmail}>
                {userEmail || 'Administrador'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}

'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { 
  Users, 
  MapPin, 
  Package, 
  LogOut, 
  Settings, 
  UserSquare2,
  ChevronRight,
  CircleDot,
  RefreshCw,
  ShoppingCart
} from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'

const menuItems = [
  { name: 'Empleados', href: '/admin/empleado', icon: Users },
  { name: 'Pedidos', href: '/dashboard/pedidos', icon: MapPin },
  { name: 'Ventas', href: '/dashboard/ventas', icon: ShoppingCart },
  { name: 'Productos', href: '/dashboard/productos', icon: Package },
  { name: 'Pareto', href: '/dashboard/reportes', icon: Settings },
  { name: 'Clientes', href: '/dashboard/clientes', icon: UserSquare2 },
  { name: 'Mapa', href: '/dashboard/mapa', icon: MapPin },
  { name: 'Sincronización', href: '/dashboard/sincronizacion', icon: RefreshCw },
]

const supabase = createClient()

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <aside className="w-64 bg-white border-r-2 border-green-100 hidden md:flex flex-col h-screen fixed left-0 top-0 z-50 shadow-xl">
      
      {/* Logo Area - Premium y moderno */}
      <div className="h-20 flex items-center justify-center border-b-2 border-green-100 bg-gradient-to-r from-white to-green-50/50 relative overflow-hidden">
        {/* Decoración de fondo sutil */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-0 right-0 w-32 h-32 bg-green-500 rounded-full blur-3xl"></div>
        </div>
        
        <div className="flex items-center gap-3 relative z-10">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-green-500 via-green-600 to-emerald-600 flex items-center justify-center shadow-lg shadow-green-600/30 border-2 border-white">
            <span className="text-white font-black text-lg">TM</span>
          </div>
          <div>
            <h1 className="text-xl font-black text-gray-900">
              Tiendas <span className="bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">Móvil</span>
            </h1>
            <p className="text-xs text-gray-500 font-medium">Panel de Control</p>
          </div>
        </div>
      </div>

      {/* Separador decorativo */}
      <div className="h-1 bg-gradient-to-r from-transparent via-green-200 to-transparent"></div>

      {/* Navigation Links - Diseño premium */}
      <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto">
        <div className="px-3 py-2">
          <p className="text-xs font-black text-gray-500 uppercase tracking-wider">Navegación</p>
        </div>
        
        {menuItems.map((item, index) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`group relative flex items-center justify-between px-4 py-3.5 text-sm font-bold rounded-2xl transition-all duration-300 ${
                isActive
                  ? 'bg-gradient-to-r from-green-500 via-green-600 to-emerald-600 text-white shadow-lg shadow-green-600/30 scale-[1.02]'
                  : 'text-gray-700 hover:bg-gradient-to-r hover:from-green-50 hover:to-emerald-50 hover:text-green-700 hover:scale-[1.01]'
              }`}
            >
              {/* Indicador activo */}
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-white rounded-r-full"></div>
              )}
              
              <div className="flex items-center flex-1">
                <div className={`mr-3 p-1.5 rounded-lg transition-all ${
                  isActive 
                    ? 'bg-white/20' 
                    : 'bg-gray-100 group-hover:bg-green-100'
                }`}>
                  <item.icon className={`h-5 w-5 ${
                    isActive ? 'text-white' : 'text-gray-600 group-hover:text-green-600'
                  }`} />
                </div>
                <span>{item.name}</span>
              </div>
              
              {/* Flecha indicadora */}
              <ChevronRight className={`h-4 w-4 transition-all ${
                isActive 
                  ? 'text-white opacity-100' 
                  : 'text-gray-400 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5'
              }`} />
            </Link>
          )
        })}
      </nav>

      {/* Logout Section - Diseño mejorado */}
      <div className="p-4 border-t-2 border-green-100 bg-white">
        <button
          onClick={handleSignOut}
          className="flex items-center justify-center w-full px-4 py-3.5 text-sm font-bold text-red-600 rounded-2xl hover:bg-red-50 transition-all border-2 border-transparent hover:border-red-200 hover:shadow-lg hover:shadow-red-600/10 hover:scale-[1.02] active:scale-95"
        >
          <LogOut className="mr-2 h-5 w-5" />
          Cerrar Sesión
        </button>
      </div>
    </aside>
  )
}

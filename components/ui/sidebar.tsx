'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { 
  LayoutDashboard, 
  Users, 
  MapPin, 
  Package, 
  LogOut, 
  Settings, 
  Users2Icon,
  UserSquare2
} from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'

const menuItems = [
  { name: 'Empleados', href: '/admin/empleado', icon: Users },
  { name: 'Pedidos', href: '/dashboard/pedidos', icon: MapPin },
  { name: 'Productos', href: '/dashboard/productos', icon: Package },
  { name: 'Reportes', href: '/dashboard/reportes', icon: Settings },
  { name: 'Clientes', href: '/dashboard/clientes', icon: UserSquare2 },
  { name: 'Mapa', href: '/dashboard/mapa', icon: MapPin },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <aside className="w-64 bg-white border-r border-gray-200 hidden md:flex flex-col h-screen fixed left-0 top-0 z-10">
      {/* Logo Area */}
      <div className="h-16 flex items-center justify-center border-b border-gray-100">
        <h1 className="text-xl font-bold text-green-700">Tiendas Móvil</h1>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {menuItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                isActive
                  ? 'bg-green-50 text-green-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <item.icon className={`mr-3 h-5 w-5 ${isActive ? 'text-green-600' : 'text-gray-400'}`} />
              {item.name}
            </Link>
          )
        })}
      </nav>

      {/* User / Logout Section */}
      <div className="p-4 border-t border-gray-100">
        <button
          onClick={handleSignOut}
          className="flex items-center w-full px-4 py-3 text-sm font-medium text-red-600 rounded-lg hover:bg-red-50 transition-colors"
        >
          <LogOut className="mr-3 h-5 w-5" />
          Cerrar Sesión
        </button>
      </div>
    </aside>
  )
}
'use client'

import { Bell } from 'lucide-react'

export default function Header() {
  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 sticky top-0 z-10">
      {/* Título dinámico o Breadcrumb (opcional) */}
      <div className="text-sm text-gray-500">
        Panel Administrativo &gt; <span className="font-semibold text-gray-800">Vista General</span>
      </div>

      {/* Acciones derecha */}
      <div className="flex items-center space-x-4">
        <button className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 relative">
          <Bell className="w-5 h-5" />
          <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border border-white"></span>
        </button>
        
        <div className="flex items-center space-x-3 pl-4 border-l">
          <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-700 font-bold text-xs">
            AD
          </div>
          <div className="hidden lg:block">
            <p className="text-sm font-medium text-gray-700">Admin User</p>
            <p className="text-xs text-gray-500">Administrador</p>
          </div>
        </div>
      </div>
    </header>
  )
}
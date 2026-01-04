'use client'

import { useState } from 'react'
import { Package, Truck, Tags } from 'lucide-react'
import InventoryTab from './components/InventoryTab'
import CategoriesTab from './components/CategoriesTab'
import ProvidersTab from './components/ProvidersTab'

export default function ProductsPage() {
  const [activeTab, setActiveTab] = useState<'inventario' | 'proveedores' | 'categorias'>('inventario')

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 p-4 sm:p-6 lg:p-8">
      
      {/* Patrón de rombos/diamantes armónico */}
      <div className="fixed inset-0 z-0 pointer-events-none opacity-35" 
           style={{
             backgroundImage: `
               repeating-linear-gradient(45deg, transparent, transparent 35px, rgba(16, 185, 129, 0.25) 35px, rgba(16, 185, 129, 0.25) 39px),
               repeating-linear-gradient(-45deg, transparent, transparent 35px, rgba(16, 185, 129, 0.25) 35px, rgba(16, 185, 129, 0.25) 39px)
             `,
           }}>
      </div>
      
      {/* Patrón de puntos sutiles */}
      <div className="fixed inset-0 z-0 pointer-events-none opacity-25" 
           style={{
             backgroundImage: `radial-gradient(circle at 2px 2px, rgba(20, 184, 166, 0.12) 1px, transparent 1px)`,
             backgroundSize: '48px 48px'
           }}>
      </div>
      
      {/* Degradado superior */}
      <div className="fixed inset-0 z-0 bg-gradient-to-b from-white/40 via-transparent to-transparent pointer-events-none"></div>
      
      {/* Círculos blur */}
      <div className="fixed -top-24 -left-24 w-96 h-96 bg-green-200/30 rounded-full blur-3xl z-0 pointer-events-none"></div>
      <div className="fixed top-32 left-32 w-64 h-64 bg-emerald-300/20 rounded-full blur-2xl z-0 pointer-events-none"></div>
      <div className="fixed -top-32 -right-32 w-[500px] h-[500px] bg-teal-200/25 rounded-full blur-3xl z-0 pointer-events-none"></div>
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-emerald-100/20 rounded-full blur-3xl z-0 pointer-events-none"></div>
      <div className="fixed -bottom-40 -left-20 w-[450px] h-[450px] bg-green-300/25 rounded-full blur-3xl z-0 pointer-events-none"></div>
      <div className="fixed -bottom-20 -right-40 w-80 h-80 bg-emerald-200/30 rounded-full blur-3xl z-0 pointer-events-none"></div>
      
      {/* Figuras geométricas */}
      <div className="fixed top-20 right-1/4 w-20 h-20 border-3 border-emerald-500/40 rounded-xl rotate-12 z-0 pointer-events-none shadow-lg shadow-emerald-500/10"></div>
      <div className="fixed top-32 right-1/3 w-14 h-14 bg-green-400/15 rounded-lg -rotate-6 z-0 pointer-events-none"></div>
      <div className="fixed top-40 left-1/4 w-16 h-16 border-3 border-teal-500/35 rounded-full z-0 pointer-events-none shadow-lg shadow-teal-500/10"></div>
      <div className="fixed top-56 left-1/3 w-12 h-12 bg-emerald-300/20 rotate-45 z-0 pointer-events-none"></div>
      <div className="fixed top-1/2 left-16 w-24 h-24 border-3 border-green-500/40 rotate-45 z-0 pointer-events-none shadow-lg shadow-green-500/10"></div>
      <div className="fixed top-1/2 left-32 w-10 h-10 bg-teal-400/20 rounded-lg -rotate-12 z-0 pointer-events-none"></div>
      <div className="fixed top-1/3 right-20 w-18 h-18 border-3 border-emerald-600/35 rounded-2xl rotate-45 z-0 pointer-events-none shadow-lg shadow-emerald-600/10"></div>
      <div className="fixed top-2/3 right-32 w-22 h-22 border-3 border-green-400/40 rotate-12 rounded-lg z-0 pointer-events-none"></div>
      <div className="fixed bottom-1/3 left-20 w-16 h-16 border-3 border-teal-600/40 rounded-full z-0 pointer-events-none shadow-lg shadow-teal-600/10"></div>
      <div className="fixed bottom-1/4 left-40 w-14 h-14 bg-green-300/20 rounded-xl rotate-45 z-0 pointer-events-none"></div>
      <div className="fixed bottom-20 right-1/4 w-20 h-20 border-3 border-emerald-500/45 rounded-lg -rotate-12 z-0 pointer-events-none shadow-lg shadow-emerald-500/10"></div>
      <div className="fixed bottom-32 right-1/3 w-12 h-12 bg-teal-400/25 rotate-6 z-0 pointer-events-none"></div>
      
      {/* Contenido principal */}
      <div className="relative z-10 space-y-6">
      
      {/* HEADER - Paleta verde vibrante */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl shadow-lg border-2 border-green-100">
        <div>
          <h1 className="text-3xl md:text-4xl font-black bg-gradient-to-r from-green-600 via-green-500 to-emerald-500 bg-clip-text text-transparent">
            Inventario y Productos
          </h1>
          <p className="text-gray-600 text-sm mt-2 font-medium">Gestiona tu catálogo, controla existencias y proveedores</p>
        </div>
      </div>

      {/* PESTAÑAS - Diseño vibrante */}
      <div className="bg-white rounded-3xl shadow-2xl border-2 border-green-100 p-3">
        <nav className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => setActiveTab('inventario')}
            className={`flex-1 flex items-center justify-center gap-3 px-6 py-4 rounded-2xl font-bold text-sm transition-all duration-300 ${
              activeTab === 'inventario'
                ? 'bg-gradient-to-r from-green-500 via-green-600 to-emerald-600 text-white shadow-xl shadow-green-900/30 scale-105 border-2 border-green-400'
                : 'text-gray-700 hover:bg-green-50 border-2 border-transparent hover:border-green-200 hover:scale-102 shadow-sm'
            }`}
          >
            <Package className="w-5 h-5" />
            Inventario General
          </button>
          <button
            onClick={() => setActiveTab('proveedores')}
            className={`flex-1 flex items-center justify-center gap-3 px-6 py-4 rounded-2xl font-bold text-sm transition-all duration-300 ${
              activeTab === 'proveedores'
                ? 'bg-gradient-to-r from-green-500 via-green-600 to-emerald-600 text-white shadow-xl shadow-green-900/30 scale-105 border-2 border-green-400'
                : 'text-gray-700 hover:bg-green-50 border-2 border-transparent hover:border-green-200 hover:scale-102 shadow-sm'
            }`}
          >
            <Truck className="w-5 h-5" />
            Proveedores
          </button>
          <button
            onClick={() => setActiveTab('categorias')}
            className={`flex-1 flex items-center justify-center gap-3 px-6 py-4 rounded-2xl font-bold text-sm transition-all duration-300 ${
              activeTab === 'categorias'
                ? 'bg-gradient-to-r from-green-500 via-green-600 to-emerald-600 text-white shadow-xl shadow-green-900/30 scale-105 border-2 border-green-400'
                : 'text-gray-700 hover:bg-green-50 border-2 border-transparent hover:border-green-200 hover:scale-102 shadow-sm'
            }`}
          >
            <Tags className="w-5 h-5" />
            Categorías
          </button>
        </nav>
      </div>

      {/* CONTENIDO DE TABS */}
      {activeTab === 'inventario' && <InventoryTab />}
      {activeTab === 'categorias' && <CategoriesTab />}
      {activeTab === 'proveedores' && <ProvidersTab />}
      
      </div>
    </div>
  )
}

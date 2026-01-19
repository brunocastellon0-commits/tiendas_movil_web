'use client'

import { BarChart3 } from 'lucide-react'
import ParetoClientes from './components/ParetoClientes'

export default function ReportesPage() {
  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 p-4 sm:p-6 lg:p-8">
      
      {/* Patrón de rombos */}
      <div className="fixed inset-0 z-0 pointer-events-none opacity-35" 
           style={{backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 35px, rgba(16, 185, 129, 0.25) 35px, rgba(16, 185, 129, 0.25) 39px), repeating-linear-gradient(-45deg, transparent, transparent 35px, rgba(16, 185, 129, 0.25) 35px, rgba(16, 185, 129, 0.25) 39px)`}}></div>
      <div className="fixed inset-0 z-0 pointer-events-none opacity-25" 
           style={{backgroundImage: `radial-gradient(circle at 2px 2px, rgba(20, 184, 166, 0.12) 1px, transparent 1px)`, backgroundSize: '48px 48px'}}></div>
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
      
      <div className="relative z-10">
      
      {/* Header - Diseño vibrante */}
      <div className="mb-6 bg-white p-6 rounded-3xl shadow-lg border-2 border-green-100">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl shadow-lg">
            <BarChart3 className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl md:text-4xl font-black bg-gradient-to-r from-green-600 via-green-500 to-emerald-500 bg-clip-text text-transparent">
              Análisis Pareto de Clientes
            </h1>
            <p className="text-gray-600 text-sm mt-1 font-medium">Identificación de clientes estratégicos según el principio 80/20</p>
          </div>
        </div>
      </div>

      {/* Contenido del Pareto */}
      <ParetoClientes />

      </div>
    </div>
  )
}

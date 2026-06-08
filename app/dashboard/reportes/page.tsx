'use client'

import { useState } from 'react'
import { BarChart3, MapPin } from 'lucide-react'
import ParetoClientes from './components/ParetoClientes'
import VisitasReport from './components/VisitasReport'

export default function ReportesPage() {
  const [activeTab, setActiveTab] = useState<'pareto' | 'visitas'>('pareto')

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
      
      <div className="relative z-10">
      
      {/* Header */}
      <div className="mb-6 bg-white p-6 rounded-3xl shadow-lg border-2 border-green-100">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl shadow-lg">
            {activeTab === 'pareto' ? <BarChart3 className="w-6 h-6 text-white" /> : <MapPin className="w-6 h-6 text-white" />}
          </div>
          <div>
            <h1 className="text-3xl md:text-4xl font-black bg-gradient-to-r from-green-600 via-green-500 to-emerald-500 bg-clip-text text-transparent">
              {activeTab === 'pareto' ? 'Análisis Pareto de Clientes' : 'Reporte de Visitas'}
            </h1>
            <p className="text-gray-600 text-sm mt-1 font-medium">
              {activeTab === 'pareto' ? 'Identificación de clientes estratégicos según el principio 80/20' : 'Total de puntos atendidos por día y por mes'}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <nav className="flex gap-3 mb-6 bg-white p-3 rounded-3xl border-2 border-green-100 shadow-lg">
        {(['pareto', 'visitas'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`flex-1 flex items-center justify-center gap-2 px-6 py-4 rounded-2xl font-bold text-sm transition-all capitalize ${
              activeTab === tab ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-lg' : 'text-gray-700 hover:bg-green-50'
            }`}>
            {tab === 'pareto' ? <BarChart3 className="w-5 h-5" /> : <MapPin className="w-5 h-5" />}
            {tab === 'pareto' ? 'Pareto (80/20)' : 'Visitas'}
          </button>
        ))}
      </nav>

      {/* Contenido */}
      {activeTab === 'pareto' ? <ParetoClientes /> : <VisitasReport />}

      </div>
    </div>
  )
}

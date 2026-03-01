'use client'

import { useState } from 'react'
import {
  RefreshCw,
  CheckCircle,
  XCircle,
  ArrowRightLeft,
  ArrowRight,
  ArrowLeft,
  Database,
  Clock,
  AlertCircle,
  Loader2,
  Play,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'

type SyncResult = {
  tabla: string
  direccion: 'SQL→Supabase' | 'Supabase→SQL'
  procesados: number
  errores: number
  mensaje: string
}

type SyncResponse = {
  success: boolean
  timestamp: string
  resumen: {
    tablas: number
    total_procesados: number
    total_errores: number
  }
  resultados: SyncResult[]
  error?: string
}

const TABLE_ICONS: Record<string, string> = {
  employees: '👤',
  categorias: '🏷️',
  proveedores: '🚚',
  productos: '📦',
  clients: '🏪',
  pedidos: '🧾',
  visits: '📍',
}

export default function SyncPage() {
  const [loading, setLoading] = useState(false)
  const [response, setResponse] = useState<SyncResponse | null>(null)
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

  const runFullSync = async () => {
    setLoading(true)
    setResponse(null)

    try {
      const res = await fetch('/api/sync/full')
      const data: SyncResponse = await res.json()
      setResponse(data)
    } catch (err: any) {
      setResponse({
        success: false,
        timestamp: new Date().toISOString(),
        resumen: { tablas: 0, total_procesados: 0, total_errores: 1 },
        resultados: [],
        error: err.message || 'Error de red al llamar al endpoint',
      })
    } finally {
      setLoading(false)
    }
  }

  const toggleRow = (tabla: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev)
      if (next.has(tabla)) next.delete(tabla)
      else next.add(tabla)
      return next
    })
  }

  const formatTime = (iso: string) => {
    return new Date(iso).toLocaleString('es-BO', {
      dateStyle: 'medium',
      timeStyle: 'medium',
    })
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950 p-4 sm:p-6 lg:p-8">
      
      {/* Fondo animado */}
      <div
        className="fixed inset-0 z-0 pointer-events-none opacity-20"
        style={{
          backgroundImage: `
            radial-gradient(circle at 20% 30%, rgba(99,102,241,0.4) 0%, transparent 50%),
            radial-gradient(circle at 80% 70%, rgba(59,130,246,0.3) 0%, transparent 50%)
          `,
        }}
      />

      <div className="relative z-10 max-w-4xl mx-auto space-y-6">

        {/* ── HEADER ── */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-3 bg-indigo-500/20 rounded-2xl border border-indigo-400/30">
                  <ArrowRightLeft className="w-7 h-7 text-indigo-300" />
                </div>
                <h1 className="text-3xl font-black text-white">
                  Sincronización
                </h1>
              </div>
              <p className="text-blue-200 text-sm font-medium ml-1">
                Sincronización bidireccional entre <span className="text-indigo-300 font-bold">SQL Server (Adminisis)</span> ↔ <span className="text-blue-300 font-bold">Supabase (App)</span>
              </p>
            </div>

            <button
              id="btn-full-sync"
              onClick={runFullSync}
              disabled={loading}
              className="flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-indigo-500 via-blue-500 to-cyan-500 text-white font-black rounded-2xl shadow-xl hover:shadow-indigo-500/40 hover:scale-105 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 border border-white/20"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Sincronizando...
                </>
              ) : (
                <>
                  <Play className="w-5 h-5" />
                  Sincronizar Todo
                </>
              )}
            </button>
          </div>
        </div>

        {/* ── MAPA DE TABLAS ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-5 shadow-xl">
            <div className="flex items-center gap-2 mb-4">
              <ArrowLeft className="w-5 h-5 text-emerald-400" />
              <span className="text-sm font-black text-emerald-300 uppercase tracking-wider">
                SQL Server → Supabase
              </span>
            </div>
            <div className="space-y-2">
              {['employees', 'categorias', 'proveedores', 'productos', 'clients'].map((t) => (
                <div key={t} className="flex items-center gap-2 text-sm text-blue-100">
                  <span>{TABLE_ICONS[t]}</span>
                  <span className="font-mono">{t}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-blue-300 mt-3 font-medium">
              Datos maestros del sistema de escritorio
            </p>
          </div>

          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-5 shadow-xl">
            <div className="flex items-center gap-2 mb-4">
              <ArrowRight className="w-5 h-5 text-orange-400" />
              <span className="text-sm font-black text-orange-300 uppercase tracking-wider">
                Supabase → SQL Server
              </span>
            </div>
            <div className="space-y-2">
              {['pedidos', 'visits'].map((t) => (
                <div key={t} className="flex items-center gap-2 text-sm text-blue-100">
                  <span>{TABLE_ICONS[t]}</span>
                  <span className="font-mono">{t}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-orange-300 mt-3 font-medium">
              Transacciones generadas en la app móvil/web
            </p>
          </div>
        </div>

        {/* ── RESULTADOS ── */}
        {response && (
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
            
            {/* Header de resultados */}
            <div className={`px-8 py-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
              response.success
                ? 'bg-emerald-500/10 border-b border-emerald-400/20'
                : 'bg-red-500/10 border-b border-red-400/20'
            }`}>
              <div className="flex items-center gap-3">
                {response.success ? (
                  <CheckCircle className="w-7 h-7 text-emerald-400" />
                ) : (
                  <XCircle className="w-7 h-7 text-red-400" />
                )}
                <div>
                  <p className={`font-black text-lg ${response.success ? 'text-emerald-300' : 'text-red-300'}`}>
                    {response.success ? 'Sincronización completada' : 'Sincronización con errores'}
                  </p>
                  {response.timestamp && (
                    <div className="flex items-center gap-1 text-xs text-blue-300 mt-0.5">
                      <Clock className="w-3 h-3" />
                      {formatTime(response.timestamp)}
                    </div>
                  )}
                </div>
              </div>

              {response.resumen && (
                <div className="flex gap-4">
                  <div className="text-center">
                    <p className="text-2xl font-black text-white">{response.resumen.total_procesados}</p>
                    <p className="text-xs text-blue-300 font-medium">Procesados</p>
                  </div>
                  <div className="text-center">
                    <p className={`text-2xl font-black ${response.resumen.total_errores > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                      {response.resumen.total_errores}
                    </p>
                    <p className="text-xs text-blue-300 font-medium">Errores</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-black text-blue-300">{response.resumen.tablas}</p>
                    <p className="text-xs text-blue-300 font-medium">Tablas</p>
                  </div>
                </div>
              )}
            </div>

            {/* Error general */}
            {response.error && (
              <div className="mx-6 mt-4 flex items-start gap-3 bg-red-500/10 border border-red-400/30 text-red-300 p-4 rounded-2xl">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <p className="text-sm font-medium">{response.error}</p>
              </div>
            )}

            {/* Tabla de resultados */}
            {response.resultados?.length > 0 && (
              <div className="p-6 space-y-2">
                {response.resultados.map((r) => (
                  <div
                    key={`${r.tabla}-${r.direccion}`}
                    className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden"
                  >
                    <button
                      onClick={() => toggleRow(`${r.tabla}-${r.direccion}`)}
                      className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/5 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{TABLE_ICONS[r.tabla] || '🗄️'}</span>
                        <div className="text-left">
                          <span className="font-bold text-white text-sm">{r.tabla}</span>
                          <div className="flex items-center gap-1 mt-0.5">
                            {r.direccion === 'SQL→Supabase' ? (
                              <span className="text-xs bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-400/30 font-bold">
                                SQL → Supabase
                              </span>
                            ) : (
                              <span className="text-xs bg-orange-500/20 text-orange-300 px-2 py-0.5 rounded-full border border-orange-400/30 font-bold">
                                Supabase → SQL
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <p className="text-white font-black text-sm">{r.procesados}</p>
                            <p className="text-blue-400 text-xs">filas</p>
                          </div>
                          {r.errores > 0 ? (
                            <div className="flex items-center gap-1 bg-red-500/20 text-red-300 px-3 py-1 rounded-full border border-red-400/30">
                              <XCircle className="w-3.5 h-3.5" />
                              <span className="text-xs font-bold">{r.errores} err</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 bg-emerald-500/20 text-emerald-300 px-3 py-1 rounded-full border border-emerald-400/30">
                              <CheckCircle className="w-3.5 h-3.5" />
                              <span className="text-xs font-bold">OK</span>
                            </div>
                          )}
                        </div>
                        {expandedRows.has(`${r.tabla}-${r.direccion}`) ? (
                          <ChevronDown className="w-4 h-4 text-blue-300" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-blue-300" />
                        )}
                      </div>
                    </button>

                    {expandedRows.has(`${r.tabla}-${r.direccion}`) && (
                      <div className="px-5 pb-4 border-t border-white/5">
                        <div className="mt-3 flex items-start gap-2 text-sm text-blue-200">
                          <Database className="w-4 h-4 flex-shrink-0 mt-0.5 text-blue-400" />
                          <p>{r.mensaje}</p>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── ESTADO INICIAL ── */}
        {!response && !loading && (
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-16 shadow-xl text-center">
            <RefreshCw className="w-16 h-16 text-blue-400/40 mx-auto mb-4" />
            <p className="text-blue-200 font-semibold text-lg">
              Presiona <span className="text-white font-black">"Sincronizar Todo"</span> para iniciar
            </p>
            <p className="text-blue-400 text-sm mt-2">
              Se sincronizarán todas las tablas entre SQL Server y Supabase
            </p>
          </div>
        )}

        {/* ── CARGANDO ── */}
        {loading && (
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-16 shadow-xl text-center">
            <Loader2 className="w-16 h-16 text-indigo-400 mx-auto mb-4 animate-spin" />
            <p className="text-indigo-200 font-bold text-lg">Sincronizando todas las tablas...</p>
            <p className="text-blue-400 text-sm mt-2">Esto puede tomar unos segundos según el volumen de datos</p>
          </div>
        )}

      </div>
    </div>
  )
}

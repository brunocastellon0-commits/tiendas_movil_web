'use client'

import { login } from './actions'
import { useFormStatus } from 'react-dom'
import { useState } from 'react'
import { Lock, Mail, AlertCircle } from 'lucide-react'

// Componente auxiliar para el botón de submit con estado de carga
function SubmitButton() {
  const { pending } = useFormStatus()
 
  return (
    <button 
      type="submit" 
      disabled={pending}
      className={`w-full flex justify-center items-center gap-3 py-4 px-6 rounded-2xl shadow-xl text-sm font-black text-white transition-all duration-300
        ${pending 
          ? 'bg-gray-400 cursor-not-allowed' 
          : 'bg-gradient-to-r from-green-500 via-green-600 to-emerald-600 hover:from-green-600 hover:via-green-700 hover:to-emerald-700 shadow-green-600/30 hover:shadow-2xl hover:scale-105'
        } 
        focus:outline-none focus:ring-4 focus:ring-offset-2 focus:ring-green-200`}
    >
      {pending ? (
        <>
          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          Verificando...
        </>
      ) : (
        <>
          <Lock className="w-5 h-5" />
          Iniciar Sesión
        </>
      )}
    </button>
  )
}

export default function LoginPage() {
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleSubmit = async (formData: FormData) => {
    setErrorMessage(null)
    
    try {
      await login(formData)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Error al iniciar sesión')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        {/* Logo corporativo verde vibrante */}
        <div className="flex justify-center mb-8">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-green-500 via-green-600 to-emerald-600 flex items-center justify-center shadow-2xl shadow-green-600/40 border-2 border-green-400 hover:scale-110 transition-transform duration-300">
            <span className="text-white font-black text-3xl">TM</span>
          </div>
        </div>
        
        <h2 className="text-center text-4xl font-black bg-gradient-to-r from-green-600 via-green-500 to-emerald-500 bg-clip-text text-transparent mb-3">
          Panel Administrativo
        </h2>
        <p className="text-center text-sm text-gray-600 font-medium">
          Ingresa tus credenciales para continuar
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-10 px-8 shadow-2xl sm:rounded-3xl sm:px-12 border-2 border-green-100">
          
          {/* Mensaje de error - Rojo vibrante */}
          {errorMessage && (
            <div className="mb-6 bg-red-50 border-2 border-red-300 p-5 rounded-2xl shadow-lg">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-black text-red-800">Error de autenticación</p>
                  <p className="text-sm text-red-700 mt-1 font-medium">{errorMessage}</p>
                </div>
              </div>
            </div>
          )}

          <form action={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-bold text-gray-800 mb-2">
                Correo Electrónico
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="tu@email.com"
                  className="appearance-none block w-full pl-12 pr-5 py-4 border-2 border-gray-200 rounded-2xl shadow-sm placeholder-gray-400 text-gray-900 focus:outline-none focus:ring-4 focus:ring-green-200 focus:border-green-500 hover:border-green-300 transition-all sm:text-sm font-medium"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-bold text-gray-800 mb-2">
                Contraseña
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  placeholder="••••••••"
                  className="appearance-none block w-full pl-12 pr-5 py-4 border-2 border-gray-200 rounded-2xl shadow-sm placeholder-gray-400 text-gray-900 focus:outline-none focus:ring-4 focus:ring-green-200 focus:border-green-500 hover:border-green-300 transition-all sm:text-sm font-medium"
                />
              </div>
            </div>

            <div className="pt-2">
              <SubmitButton />
            </div>
          </form>

          {/* Footer adicional */}
          <div className="mt-8 text-center">
            <p className="text-xs text-gray-500 font-medium">
              Tiendas Móvil © 2025 - Sistema seguro
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

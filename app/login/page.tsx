'use client'

import { login } from './actions'
import { useFormStatus } from 'react-dom'
import { useState } from 'react'

// Componente auxiliar para el botón de submit con estado de carga
function SubmitButton() {
  const { pending } = useFormStatus()
 
  return (
    <button 
      type="submit" 
      disabled={pending}
      className={`w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white 
        ${pending ? 'bg-green-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'} 
        focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors`}
    >
      {pending ? 'Verificando...' : 'Iniciar Sesión'}
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
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        {/* Aquí puedes poner tu logo igual que en la app móvil */}
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Panel Administrativo
        </h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          
          {/* Mostramos errores si existen */}
          {errorMessage && (
            <div className="mb-4 bg-red-50 border-l-4 border-red-400 p-4">
              <div className="flex">
                <div className="ml-3">
                  <p className="text-sm text-red-700">{errorMessage}</p>
                </div>
              </div>
            </div>
          )}

          <form action={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Correo Electrónico
              </label>
              <div className="mt-1">
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Contraseña
              </label>
              <div className="mt-1">
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                />
              </div>
            </div>

            <div>
              <SubmitButton />
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
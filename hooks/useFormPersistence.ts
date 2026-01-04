import { useState, useEffect, useRef } from 'react'

/**
 * Hook personalizado para persistir formularios en localStorage
 * Permite que los datos del formulario se mantengan aunque el usuario cambie de ventana
 * Ahora con debouncing para mejor rendimiento
 */
export function useFormPersistence<T extends Record<string, any>>(
  key: string,
  initialState: T,
  debounceMs: number = 500 // Espera 500ms por defecto antes de guardar
) {
  // Estado del formulario
  const [formData, setFormData] = useState<T>(() => {
    // Intentar cargar desde localStorage al inicializar
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(key)
        if (saved) {
          return JSON.parse(saved) as T
        }
      } catch (error) {
        console.error('Error al cargar datos del formulario desde localStorage:', error)
      }
    }
    return initialState
  })

  // Ref para el timeout de debouncing
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Guardar en localStorage con debouncing
  useEffect(() => {
    // Limpiar el timeout anterior si existe
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    // Crear nuevo timeout para guardar después del delay
    timeoutRef.current = setTimeout(() => {
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(key, JSON.stringify(formData))
        } catch (error) {
          console.error('Error al guardar datos del formulario en localStorage:', error)
        }
      }
    }, debounceMs)

    // Cleanup: cancelar el timeout si el componente se desmonta o formData cambia
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [formData, key, debounceMs])

  // Función para limpiar el formulario
  const clearForm = () => {
    setFormData(initialState)
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(key)
      } catch (error) {
        console.error('Error al limpiar datos del formulario:', error)
      }
    }
  }

  // Función para actualizar campos individuales del formulario
  const updateField = (field: keyof T, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  // Función para actualizar múltiples campos
  const updateFields = (updates: Partial<T>) => {
    setFormData(prev => ({
      ...prev,
      ...updates
    }))
  }

  return {
    formData,
    setFormData,
    updateField,
    updateFields,
    clearForm
  }
}

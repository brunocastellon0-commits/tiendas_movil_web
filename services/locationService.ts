import { createClient } from '@/utils/supabase/client'

export interface LocationUpdate {
  latitude: number
  longitude: number
  accuracy?: number
}

/**
 * Actualiza la ubicación GPS del empleado actual en location_history
 * @param employeeId - ID del empleado
 * @param location - Coordenadas GPS (latitud, longitud)
 * @returns Promise con el resultado de la operación
 */
export async function updateEmployeeLocation(
  employeeId: string,
  location: LocationUpdate
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createClient()

    // Crear el objeto GeoJSON Point (formato PostGIS)
    const geoJsonPoint = {
      type: 'Point',
      coordinates: [location.longitude, location.latitude] // [lon, lat] - orden importante!
    }

    // 1. Insertar en location_history (historial de ubicaciones)
    const { error: historyError } = await supabase
      .from('location_history')
      .insert({
        employee_id: employeeId,
        location: geoJsonPoint,
        created_at: new Date().toISOString()
      })

    if (historyError) {
      console.error('Error al guardar en location_history:', historyError)
      throw new Error(`Error en historial: ${historyError.message}`)
    }

    // 2. Actualizar también la ubicación en la tabla employees (última ubicación conocida)
    const { error: employeeError } = await supabase
      .from('employees')
      .update({
        location: geoJsonPoint
      })
      .eq('id', employeeId)

    if (employeeError) {
      console.error('Error al actualizar employees:', employeeError)
      // No lanzamos error aquí porque el historial ya se guardó
    }

    console.log('✅ Ubicación actualizada correctamente:', {
      employeeId,
      latitude: location.latitude,
      longitude: location.longitude,
      accuracy: location.accuracy
    })

    return { success: true }
  } catch (error: any) {
    console.error('❌ Error al actualizar ubicación:', error)
    return {
      success: false,
      error: error.message || 'Error desconocido al actualizar ubicación'
    }
  }
}

/**
 * Obtiene la ubicación GPS actual del navegador
 * @returns Promise con las coordenadas GPS
 */
export function getCurrentLocation(): Promise<LocationUpdate> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocalización no soportada por este navegador'))
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy
        })
      },
      (error) => {
        let errorMessage = 'Error al obtener ubicación'
        
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'Permiso de ubicación denegado. Por favor, habilita el GPS en tu navegador.'
            break
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'Ubicación no disponible. Verifica tu conexión GPS.'
            break
          case error.TIMEOUT:
            errorMessage = 'Tiempo de espera agotado al obtener ubicación.'
            break
        }
        
        reject(new Error(errorMessage))
      },
      {
        enableHighAccuracy: true, // Usar GPS de alta precisión
        timeout: 10000, // 10 segundos máximo
        maximumAge: 0 // No usar caché
      }
    )
  })
}

/**
 * Función combinada: obtiene la ubicación actual y la guarda en Supabase
 * @param employeeId - ID del empleado
 * @returns Promise con el resultado
 */
export async function shareMyLocation(employeeId: string): Promise<{
  success: boolean
  location?: LocationUpdate
  error?: string
}> {
  try {
    // 1. Obtener ubicación GPS actual
    const location = await getCurrentLocation()
    
    // 2. Guardar en Supabase
    const result = await updateEmployeeLocation(employeeId, location)
    
    if (result.success) {
      return { success: true, location }
    } else {
      return { success: false, error: result.error }
    }
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Error al compartir ubicación'
    }
  }
}

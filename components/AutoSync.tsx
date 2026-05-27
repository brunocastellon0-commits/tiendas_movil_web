'use client'

import { useEffect, useState } from 'react'
import { RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react'

export default function AutoSync() {
  const [status, setStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle')
  const [lastSync, setLastSync] = useState<string>('')

  useEffect(() => {
    const runSync = async () => {
      if (document.visibilityState !== 'visible') return

      try {
        setStatus('syncing')
        
        const response = await fetch('/api/sync/pending-orders')
        const data = await response.json()
        
        if (response.ok) {
          setStatus('success')
          setLastSync(new Date().toLocaleTimeString())
          
          if (data.synced && data.synced > 0) {
            console.log(`✅ AutoSync: ${data.message}`)
          }
        } else {
          setStatus('error')
        }
      } catch (error) {
        console.error('AutoSync Error:', error)
        setStatus('error')
      } finally {
        setTimeout(() => setStatus('idle'), 3000)
      }
    }

    runSync()

    const intervalId = setInterval(runSync, 300000)
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        runSync()
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      clearInterval(intervalId)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [])

  // Renderizado visual discreto (esquina inferior derecha)
  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 bg-white/90 backdrop-blur border border-gray-200 p-2 rounded-full shadow-lg text-xs font-medium text-gray-600 transition-all">
      
      {status === 'idle' && (
        <span className="w-2 h-2 bg-gray-400 rounded-full"></span>
      )}
      
      {status === 'syncing' && (
        <>
          <RefreshCw className="w-3 h-3 animate-spin text-blue-500" />
          <span className="text-blue-600">Sincronizando...</span>
        </>
      )}

      {status === 'success' && (
        <>
          <CheckCircle2 className="w-3 h-3 text-green-500" />
          <span className="text-green-600">Actualizado {lastSync}</span>
        </>
      )}

      {status === 'error' && (
        <AlertCircle className="w-3 h-3 text-red-500" />
      )}
    </div>
  )
}
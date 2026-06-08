import Sidebar from '@/components/ui/sidebar'
import Header from '@/components/ui/header'
import AutoSync from '@/components/AutoSync'
import MobileOverlay from '@/components/MobileOverlay'
import { SidebarProvider } from '@/contexts/SidebarContext'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <SidebarProvider>
    <div className="min-h-screen bg-gray-50 flex">
      {/* 1. Sidebar */}
      <Sidebar />

      {/* 2. Área Principal */}
      <div className="flex-1 md:ml-64 flex flex-col min-h-screen transition-all duration-300">
        
        {/* Header */}
        <Header />

        {/* 3. Contenido Dinámico */}
        <main className="flex-1 p-6 overflow-y-auto">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>

      {/* Overlay móvil */}
      <MobileOverlay />

      {/* AutoSync */}
      <AutoSync />
    </div>
    </SidebarProvider>
  )
}



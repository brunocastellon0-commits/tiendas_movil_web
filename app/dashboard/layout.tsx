import Sidebar from '@/components/ui/sidebar'
import Header from '@/components/ui/header'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* 1. Sidebar Fijo */}
      <Sidebar />

      {/* 2. Área Principal (Desplazada a la derecha por el ancho del sidebar) */}
      <div className="flex-1 md:ml-64 flex flex-col min-h-screen transition-all duration-300">
        
        {/* Header Fijo arriba */}
        <Header />

        {/* 3. Contenido Dinámico (Aquí se cargan tus páginas) */}
        <main className="flex-1 p-6 overflow-y-auto">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
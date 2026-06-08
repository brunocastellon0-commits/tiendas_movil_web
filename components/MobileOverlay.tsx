'use client'

import { useSidebar } from '@/contexts/SidebarContext'

export default function MobileOverlay() {
  const { isOpen, close } = useSidebar()
  if (!isOpen) return null
  return (
    <div
      className="fixed inset-0 bg-black/50 z-40 md:hidden"
      onClick={close}
    />
  )
}

'use client'

import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { useCallback, useMemo } from 'react'

export function useFilterParams<T extends Record<string, string>>(defaults: T) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const filters = useMemo(() => {
    const result = { ...defaults }
    for (const key of Object.keys(defaults)) {
      const val = searchParams.get(key)
      if (val !== null) result[key as keyof T] = val as T[keyof T]
    }
    return result
  }, [searchParams, defaults])

  const setFilter = useCallback((key: keyof T, value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value === defaults[key as keyof T] || value === '') {
      params.delete(key as string)
    } else {
      params.set(key as string, value)
    }
    const qs = params.toString()
    router.push(`${pathname}${qs ? `?${qs}` : ''}`, { scroll: false })
  }, [searchParams, router, pathname, defaults])

  const setFilters = useCallback((updates: Partial<T>) => {
    const params = new URLSearchParams(searchParams.toString())
    for (const [key, value] of Object.entries(updates)) {
      if (value === defaults[key as keyof T] || value === '') {
        params.delete(key)
      } else {
        params.set(key, value as string)
      }
    }
    const qs = params.toString()
    router.push(`${pathname}${qs ? `?${qs}` : ''}`, { scroll: false })
  }, [searchParams, router, pathname, defaults])

  const clearFilters = useCallback(() => {
    router.push(pathname, { scroll: false })
  }, [router, pathname])

  const hasActiveFilters = useMemo(() => {
    return Object.entries(filters).some(([key, val]) => val !== defaults[key])
  }, [filters, defaults])

  return { filters, setFilter, setFilters, clearFilters, hasActiveFilters }
}

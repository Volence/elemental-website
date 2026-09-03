'use client'

import { useCallback } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

/**
 * useState backed by a URL search param (router.replace, no scroll reset).
 * Makes tabs, filters and selections bookmarkable and Back-safe.
 * Moved here from ScrimShared so every kit consumer shares one implementation.
 */
export function useUrlParamState(key: string, defaultValue: string): [string, (v: string) => void] {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const value = searchParams?.get(key) ?? defaultValue

  const setValue = useCallback(
    (v: string) => {
      const params = new URLSearchParams(searchParams?.toString() ?? '')
      if (v === defaultValue) params.delete(key)
      else params.set(key, v)
      const qs = params.toString()
      router.replace(`${pathname}${qs ? `?${qs}` : ''}`, { scroll: false })
    },
    [key, defaultValue, pathname, router, searchParams],
  )

  return [value, setValue]
}

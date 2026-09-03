'use client'

import { useCallback } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

/**
 * useState backed by a URL search param (router.replace, no scroll reset).
 * Makes tabs, filters and selections bookmarkable and Back-safe.
 * Moved here from ScrimShared so every kit consumer shares one implementation.
 */
/**
 * Writes made in the same tick are merged into one router.replace. Without this,
 * `setFilter(x); setPage('1')` computed both URLs from the same stale snapshot and
 * the second call threw the first away.
 */
let pendingWrites: Map<string, string | null> | null = null

function queueUrlWrite(
  key: string,
  value: string | null,
  base: () => string,
  commit: (qs: string) => void,
): void {
  if (!pendingWrites) {
    pendingWrites = new Map()
    queueMicrotask(() => {
      const writes = pendingWrites ?? new Map<string, string | null>()
      pendingWrites = null
      const params = new URLSearchParams(base())
      for (const [k, v] of writes) {
        if (v === null) params.delete(k)
        else params.set(k, v)
      }
      commit(params.toString())
    })
  }
  pendingWrites.set(key, value)
}

export function useUrlParamState(key: string, defaultValue: string): [string, (v: string) => void] {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const value = searchParams?.get(key) ?? defaultValue

  const setValue = useCallback(
    (v: string) => {
      queueUrlWrite(
        key,
        v === defaultValue ? null : v,
        // The live URL is fresher than the render snapshot when writes come in quick succession.
        () => (typeof window !== 'undefined' ? window.location.search : searchParams?.toString() ?? ''),
        (qs) => router.replace(`${pathname}${qs ? `?${qs}` : ''}`, { scroll: false }),
      )
    },
    [key, defaultValue, pathname, router, searchParams],
  )

  return [value, setValue]
}

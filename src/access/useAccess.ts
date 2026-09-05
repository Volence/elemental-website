'use client'

import { useCallback, useEffect, useState } from 'react'
import { deserializeAccess, type ResolvedAccess, type SerializedAccess } from './resolve'

let shared: { access: ResolvedAccess | null; at: number } | null = null
let inflight: Promise<ResolvedAccess | null> | null = null
const TTL_MS = 15_000

async function load(): Promise<ResolvedAccess | null> {
  if (shared && Date.now() - shared.at < TTL_MS) return shared.access
  if (inflight) return inflight
  inflight = fetch('/api/access/me', { credentials: 'include' })
    .then(async (r) => (r.ok ? deserializeAccess((await r.json()) as SerializedAccess) : null))
    .catch(() => null)
    .then((access) => {
      shared = { access, at: Date.now() }
      inflight = null
      return access
    })
  return inflight
}

/** Effective access of the logged-in person, shared across components, refreshed every 15 seconds. */
export function useAccess(): { access: ResolvedAccess | null; loading: boolean; refresh: () => void } {
  const [access, setAccess] = useState<ResolvedAccess | null>(shared?.access ?? null)
  const [loading, setLoading] = useState(!shared)
  const refresh = useCallback(() => {
    shared = null
    setLoading(true)
    void load().then((a) => { setAccess(a); setLoading(false) })
  }, [])
  useEffect(() => {
    let live = true
    void load().then((a) => { if (live) { setAccess(a); setLoading(false) } })
    return () => { live = false }
  }, [])
  return { access, loading, refresh }
}

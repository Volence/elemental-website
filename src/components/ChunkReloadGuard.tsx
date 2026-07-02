'use client'

import { useEffect } from 'react'

/**
 * Auto-recover from stale-chunk errors after a deploy.
 *
 * Each deploy replaces the container, and with it every content-hashed
 * /_next/static chunk. Tabs opened before the deploy still reference the old
 * hashes, so their next lazy navigation throws "Loading chunk N failed".
 * The only fix for the user is a reload - do it for them, once.
 *
 * Three hooks, because the error can surface three ways:
 *  - capture-phase 'error' on window catches failed <script src> loads even
 *    when application code catches and displays the thrown error
 *  - 'error' events for uncaught ChunkLoadError throws
 *  - 'unhandledrejection' for dynamic import() promise failures
 *
 * A session flag prevents reload loops: if a reload doesn't fix it (e.g. the
 * server is actually down), we stop after one attempt. The flag clears after
 * the page stays alive for 30s, so the next deploy can trigger again.
 */

const RELOAD_FLAG = 'elemental-chunk-reload'
const CHUNK_ERROR = /Loading chunk [\w-]+ failed|ChunkLoadError/i

function reloadOnce() {
  try {
    if (sessionStorage.getItem(RELOAD_FLAG)) return
    sessionStorage.setItem(RELOAD_FLAG, '1')
  } catch {
    // sessionStorage unavailable - reload anyway, worst case the user loops
    // no worse than the broken state they were already in
  }
  window.location.reload()
}

export default function ChunkReloadGuard() {
  useEffect(() => {
    const clearTimer = setTimeout(() => {
      try {
        sessionStorage.removeItem(RELOAD_FLAG)
      } catch {
        /* ignore */
      }
    }, 30_000)

    const onError = (e: ErrorEvent | Event) => {
      // Resource load failure (capture phase): a chunk <script> 404'd
      const target = e.target as HTMLElement | null
      if (target && target.tagName === 'SCRIPT') {
        const src = (target as HTMLScriptElement).src ?? ''
        if (src.includes('/_next/static/chunks/')) reloadOnce()
        return
      }
      // Uncaught runtime throw
      const message = (e as ErrorEvent).message
      if (typeof message === 'string' && CHUNK_ERROR.test(message)) reloadOnce()
    }

    const onRejection = (e: PromiseRejectionEvent) => {
      const reason = e.reason as { name?: string; message?: string } | string | undefined
      const text = typeof reason === 'string' ? reason : `${reason?.name ?? ''} ${reason?.message ?? ''}`
      if (CHUNK_ERROR.test(text)) reloadOnce()
    }

    window.addEventListener('error', onError, true)
    window.addEventListener('unhandledrejection', onRejection)
    return () => {
      clearTimeout(clearTimer)
      window.removeEventListener('error', onError, true)
      window.removeEventListener('unhandledrejection', onRejection)
    }
  }, [])

  return null
}

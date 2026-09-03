'use client'

import React, { useEffect, useRef } from 'react'

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export interface DialogA11yProps {
  /** Called on Escape. Should be the same handler as the backdrop click. */
  onClose: () => void
}

/**
 * Keyboard and focus behaviour for a hand-rolled overlay that is not (yet) an
 * AdminModal. Render it as the first child of the overlay element:
 *
 * - Escape closes.
 * - Focus moves to the first control inside the `[role="dialog"]` panel (or the
 *   panel itself) when the overlay mounts, and returns to where it was on unmount.
 *
 * AdminModal already does all of this; this exists so the remaining overlays get
 * the same behaviour without rewriting their markup.
 */
export function DialogA11y({ onClose }: DialogA11yProps) {
  const anchor = useRef<HTMLSpanElement>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    const previous = typeof document !== 'undefined' ? (document.activeElement as HTMLElement | null) : null
    const overlay = anchor.current?.parentElement ?? null
    const panel = overlay?.querySelector<HTMLElement>('[role="dialog"]') ?? overlay
    if (panel) {
      const first = panel.querySelector<HTMLElement>(FOCUSABLE)
      if (first) first.focus()
      else {
        if (!panel.hasAttribute('tabindex')) panel.setAttribute('tabindex', '-1')
        panel.focus()
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      onCloseRef.current()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      if (previous && document.contains(previous)) previous.focus()
    }
  }, [])

  return <span ref={anchor} hidden aria-hidden="true" />
}

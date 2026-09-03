'use client'

import React, { useCallback, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

export type AdminModalSize = 'sm' | 'md' | 'lg'

export interface AdminModalProps {
  open: boolean
  onClose: () => void
  title: React.ReactNode
  children: React.ReactNode
  footer?: React.ReactNode
  size?: AdminModalSize
  /** Click on the dimmed backdrop closes the modal. Default true. */
  closeOnBackdrop?: boolean
  /** Hide the header close button (the footer must then offer a way out). */
  hideCloseButton?: boolean
  /** Optional icon rendered before the title. */
  icon?: React.ReactNode
  /** Extra class on the panel for feature-specific tweaks. */
  className?: string
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

let openCount = 0
let previousBodyOverflow: string | null = null

function lockBody() {
  if (typeof document === 'undefined') return
  if (openCount === 0) {
    previousBodyOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
  }
  openCount += 1
}

function unlockBody() {
  if (typeof document === 'undefined') return
  openCount = Math.max(0, openCount - 1)
  if (openCount === 0) {
    document.body.style.overflow = previousBodyOverflow ?? ''
    previousBodyOverflow = null
  }
}

/**
 * The one modal shell for the admin panel.
 *
 * - Portal to body, above everything (--elmt-z-modal).
 * - role="dialog" + aria-modal, labelled by the title.
 * - Escape closes. Backdrop click closes (configurable).
 * - Focus moves into the panel on open, is trapped inside, and returns to the
 *   element that opened it on close.
 * - Body scroll is locked while any modal is open (ref-counted for stacking).
 *
 * ConfirmDialogProvider is built on this, so `useConfirm` / `useAlert` get the
 * same behaviour for free.
 */
export function AdminModal({
  open,
  onClose,
  title,
  children,
  footer,
  size = 'md',
  closeOnBackdrop = true,
  hideCloseButton = false,
  icon,
  className,
}: AdminModalProps) {
  const [mounted, setMounted] = useState(false)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const openerRef = useRef<HTMLElement | null>(null)
  const titleId = useId()

  useEffect(() => setMounted(true), [])
  // Consumers pass inline closures; re-running the focus effect on each render stole focus
  // and forgot the opener. Read the latest handler through a ref instead.
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  // Focus management + scroll lock + Escape, for the lifetime of an open modal.
  useEffect(() => {
    if (!open || !mounted) return
    openerRef.current = (document.activeElement as HTMLElement | null) ?? null
    lockBody()

    const panel = panelRef.current
    // Initial focus: an explicit [data-autofocus], else the first control in the
    // body, else the footer, else the close button, else the panel itself.
    const initial =
      panel?.querySelector<HTMLElement>('[data-autofocus]') ??
      panel?.querySelector<HTMLElement>(`.kit-modal__body ${FOCUSABLE.split(', ').join(', .kit-modal__body ')}`) ??
      panel?.querySelector<HTMLElement>(`.kit-modal__footer ${FOCUSABLE.split(', ').join(', .kit-modal__footer ')}`) ??
      panel?.querySelector<HTMLElement>(FOCUSABLE)
    ;(initial ?? panel)?.focus()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onCloseRef.current()
        return
      }
      if (event.key !== 'Tab' || !panel) return
      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => !el.hasAttribute('hidden') && el.getAttribute('aria-hidden') !== 'true',
      )
      if (focusable.length === 0) {
        event.preventDefault()
        panel.focus()
        return
      }
      const firstEl = focusable[0]
      const lastEl = focusable[focusable.length - 1]
      const active = document.activeElement as HTMLElement | null
      if (event.shiftKey && (active === firstEl || !panel.contains(active))) {
        event.preventDefault()
        lastEl.focus()
      } else if (!event.shiftKey && (active === lastEl || !panel.contains(active))) {
        event.preventDefault()
        firstEl.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown, true)
    return () => {
      document.removeEventListener('keydown', onKeyDown, true)
      unlockBody()
      const opener = openerRef.current
      if (opener && typeof opener.focus === 'function' && document.contains(opener)) {
        opener.focus()
      }
    }
  }, [open, mounted])

  const onBackdropClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (!closeOnBackdrop) return
      if (event.target === event.currentTarget) onClose()
    },
    [closeOnBackdrop, onClose],
  )

  if (!open || !mounted) return null

  return createPortal(
    <div className="kit-modal__backdrop" onMouseDown={onBackdropClick} data-testid="kit-modal-backdrop">
      <div
        ref={panelRef}
        className={`kit-modal kit-modal--${size}${className ? ` ${className}` : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <div className="kit-modal__header">
          {icon && <span className="kit-modal__icon">{icon}</span>}
          <h2 id={titleId} className="kit-modal__title">
            {title}
          </h2>
          {!hideCloseButton && (
            <button type="button" className="kit-modal__close" onClick={onClose} aria-label="Close">
              <X size={16} />
            </button>
          )}
        </div>
        <div className="kit-modal__body">{children}</div>
        {footer && <div className="kit-modal__footer">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}

export default AdminModal

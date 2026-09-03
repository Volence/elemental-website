'use client'

import React, { createContext, useCallback, useContext, useState } from 'react'
import { AlertTriangle, Info, Trash2 } from 'lucide-react'
import { AdminModal } from '@/admin-kit/AdminModal'

/**
 * Promise-based confirm / alert dialogs for the admin panel.
 *
 * Built on AdminModal, so every consumer of useConfirm / useAlert gets Escape
 * to cancel, a focus trap, focus return and body scroll lock without changes.
 * The hook API is unchanged from the previous inline implementation.
 */

type Variant = 'default' | 'danger' | 'info'

interface DialogOptions {
  title?: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: Variant
}

interface DialogState extends DialogOptions {
  resolve: (confirmed: boolean) => void
}

interface AlertState {
  title?: string
  message: string
  variant?: Variant
  resolve: () => void
}

const DialogContext = createContext<{
  confirm: (options: DialogOptions) => Promise<boolean>
  alert: (options: Omit<DialogOptions, 'confirmLabel' | 'cancelLabel'>) => Promise<void>
} | null>(null)

export function useConfirm() {
  const ctx = useContext(DialogContext)
  if (!ctx) throw new Error('useConfirm must be used within ConfirmDialogProvider')
  return ctx.confirm
}

export function useAlert() {
  const ctx = useContext(DialogContext)
  if (!ctx) throw new Error('useAlert must be used within ConfirmDialogProvider')
  return ctx.alert
}

export function useDialog() {
  const ctx = useContext(DialogContext)
  if (!ctx) throw new Error('useDialog must be used within ConfirmDialogProvider')
  return ctx
}

const iconMap: Record<Variant, React.ReactNode> = {
  default: <AlertTriangle size={20} style={{ color: 'var(--elmt-accent-warning)' }} aria-hidden="true" />,
  danger: <Trash2 size={20} style={{ color: 'var(--elmt-accent-error)' }} aria-hidden="true" />,
  info: <Info size={20} style={{ color: 'var(--elmt-accent-info)' }} aria-hidden="true" />,
}

const confirmButtonClass: Record<Variant, string> = {
  default: 'kit-btn kit-btn--primary',
  danger: 'kit-btn kit-btn--danger',
  info: 'kit-btn kit-btn--info',
}

const DEFAULT_TITLES: Record<Variant, string> = {
  default: 'Are you sure?',
  danger: 'Confirm deletion',
  info: 'Notice',
}

function ConfirmModal({ dialog, onResolve }: { dialog: DialogState; onResolve: (v: boolean) => void }) {
  const variant = dialog.variant || 'default'
  return (
    <AdminModal
      open
      size="sm"
      title={dialog.title || DEFAULT_TITLES[variant]}
      icon={iconMap[variant]}
      onClose={() => onResolve(false)}
      hideCloseButton
      footer={
        <>
          <button type="button" className="kit-btn" onClick={() => onResolve(false)}>
            {dialog.cancelLabel || 'Cancel'}
          </button>
          <button type="button" className={confirmButtonClass[variant]} onClick={() => onResolve(true)} data-autofocus>
            {dialog.confirmLabel || 'Confirm'}
          </button>
        </>
      }
    >
      <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{dialog.message}</p>
    </AdminModal>
  )
}

function AlertModal({ alert: a, onClose }: { alert: AlertState; onClose: () => void }) {
  const variant = a.variant || 'info'
  return (
    <AdminModal
      open
      size="sm"
      title={a.title || DEFAULT_TITLES[variant]}
      icon={iconMap[variant]}
      onClose={onClose}
      hideCloseButton
      footer={
        <button type="button" className={confirmButtonClass[variant]} onClick={onClose}>
          OK
        </button>
      }
    >
      <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{a.message}</p>
    </AdminModal>
  )
}

export function ConfirmDialogProvider({ children }: { children: React.ReactNode }) {
  const [dialog, setDialog] = useState<DialogState | null>(null)
  const [alertState, setAlertState] = useState<AlertState | null>(null)

  const confirm = useCallback((options: DialogOptions) => {
    return new Promise<boolean>((resolve) => {
      setDialog({ ...options, resolve })
    })
  }, [])

  const alert = useCallback((options: Omit<DialogOptions, 'confirmLabel' | 'cancelLabel'>) => {
    return new Promise<void>((resolve) => {
      setAlertState({ ...options, resolve })
    })
  }, [])

  const handleConfirmResolve = useCallback(
    (value: boolean) => {
      dialog?.resolve(value)
      setDialog(null)
    },
    [dialog],
  )

  const handleAlertClose = useCallback(() => {
    alertState?.resolve()
    setAlertState(null)
  }, [alertState])

  return (
    <DialogContext.Provider value={{ confirm, alert }}>
      {children}
      {dialog && <ConfirmModal dialog={dialog} onResolve={handleConfirmResolve} />}
      {alertState && <AlertModal alert={alertState} onClose={handleAlertClose} />}
    </DialogContext.Provider>
  )
}

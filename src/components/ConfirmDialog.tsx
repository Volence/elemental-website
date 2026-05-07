'use client'

import React, { createContext, useCallback, useContext, useState } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, Info, Trash2 } from 'lucide-react'

interface DialogOptions {
  title?: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'default' | 'danger' | 'info'
}

interface DialogState extends DialogOptions {
  resolve: (confirmed: boolean) => void
}

interface AlertState {
  title?: string
  message: string
  variant?: 'default' | 'danger' | 'info'
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

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return createPortal(
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 99999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(4px)',
        animation: 'confirmFadeIn 150ms ease-out',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        style={{
          background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 12, padding: '24px', maxWidth: 440, width: '90%',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
          animation: 'confirmSlideIn 150ms ease-out',
        }}
      >
        {children}
      </div>
      <style>{`
        @keyframes confirmFadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes confirmSlideIn { from { opacity: 0; transform: scale(0.95) translateY(10px) } to { opacity: 1; transform: scale(1) translateY(0) } }
      `}</style>
    </div>,
    document.body,
  )
}

const iconMap = {
  default: <AlertTriangle size={20} style={{ color: '#f59e0b' }} />,
  danger: <Trash2 size={20} style={{ color: '#ef4444' }} />,
  info: <Info size={20} style={{ color: '#3b82f6' }} />,
}

const confirmBtnStyles: Record<string, React.CSSProperties> = {
  default: { background: '#6366f1', color: 'white' },
  danger: { background: '#dc2626', color: 'white' },
  info: { background: '#3b82f6', color: 'white' },
}

function ConfirmModal({ dialog, onResolve }: { dialog: DialogState; onResolve: (v: boolean) => void }) {
  const variant = dialog.variant || 'default'
  return (
    <Overlay onClose={() => onResolve(false)}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 20 }}>
        <div style={{ flexShrink: 0, marginTop: 2 }}>{iconMap[variant]}</div>
        <div>
          {dialog.title && (
            <div style={{ fontSize: 16, fontWeight: 600, color: '#e2e8f0', marginBottom: 6 }}>{dialog.title}</div>
          )}
          <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{dialog.message}</div>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <button
          onClick={() => onResolve(false)}
          style={{
            padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer',
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)',
          }}
        >
          {dialog.cancelLabel || 'Cancel'}
        </button>
        <button
          onClick={() => onResolve(true)}
          autoFocus
          style={{
            padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
            border: 'none', ...confirmBtnStyles[variant],
          }}
        >
          {dialog.confirmLabel || 'Confirm'}
        </button>
      </div>
    </Overlay>
  )
}

function AlertModal({ alert: a, onClose }: { alert: AlertState; onClose: () => void }) {
  const variant = a.variant || 'info'
  return (
    <Overlay onClose={onClose}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 20 }}>
        <div style={{ flexShrink: 0, marginTop: 2 }}>{iconMap[variant]}</div>
        <div>
          {a.title && (
            <div style={{ fontSize: 16, fontWeight: 600, color: '#e2e8f0', marginBottom: 6 }}>{a.title}</div>
          )}
          <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{a.message}</div>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          onClick={onClose}
          autoFocus
          style={{
            padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
            border: 'none', ...confirmBtnStyles[variant],
          }}
        >
          OK
        </button>
      </div>
    </Overlay>
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

  const handleConfirmResolve = useCallback((value: boolean) => {
    dialog?.resolve(value)
    setDialog(null)
  }, [dialog])

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

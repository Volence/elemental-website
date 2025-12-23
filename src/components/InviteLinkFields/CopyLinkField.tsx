'use client'

import React, { useState } from 'react'
import { useFormFields } from '@payloadcms/ui'

const CopyLinkField: React.FC = () => {
  const [copied, setCopied] = useState(false)
  const allFields = useFormFields(([fields]) => fields)
  
  // Get token and expiresAt from the form fields
  const token = allFields?.token?.value as string | undefined
  const expiresAt = allFields?.expiresAt?.value as string | undefined

  if (!token) {
    return (
      <div className="field-type ui">
        <div className="label">
          <label>Invite Link</label>
        </div>
        <div style={{ 
          padding: '0.75rem', 
          background: 'var(--theme-elevation-100)', 
          borderRadius: '4px', 
          color: 'var(--theme-elevation-800)',
          border: '1px solid var(--theme-elevation-400)',
        }}>
          Save this invite to generate a link
        </div>
      </div>
    )
  }

  const inviteUrl = `${process.env.NEXT_PUBLIC_SERVER_URL || 'https://elmt.gg'}/invite/${token}`

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  return (
    <div className="field-type ui">
      <div className="label">
        <label>Invite Link</label>
      </div>
      <div style={{ 
        display: 'flex', 
        gap: '0.5rem', 
        alignItems: 'center',
        padding: '0.75rem',
        background: 'var(--theme-elevation-100)',
        border: '1px solid var(--theme-elevation-400)',
        borderRadius: '4px',
      }}>
        <input
          type="text"
          value={inviteUrl}
          readOnly
          style={{
            flex: 1,
            padding: '0.5rem',
            border: '1px solid var(--theme-elevation-400)',
            borderRadius: '4px',
            fontFamily: 'monospace',
            fontSize: '0.875rem',
            background: 'var(--theme-elevation-0)',
            color: 'var(--theme-text)',
          }}
          onClick={(e) => (e.target as HTMLInputElement).select()}
        />
        <button
          type="button"
          onClick={handleCopy}
          style={{
            padding: '0.5rem 1rem',
            background: copied ? '#10b981' : 'var(--theme-elevation-500)',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: '500',
            whiteSpace: 'nowrap',
          }}
        >
          {copied ? '✓ Copied!' : 'Copy Link'}
        </button>
      </div>
      {expiresAt && (
        <div style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: 'var(--theme-elevation-800)' }}>
          Share this link with the person you want to invite. It will expire on{' '}
          {new Date(expiresAt).toLocaleString()}.
        </div>
      )}
    </div>
  )
}

export default CopyLinkField


'use client'

import React, { useState } from 'react'
import { useDocumentInfo } from '@payloadcms/ui'
import type { InviteLink } from '@/payload-types'

const CopyLinkField: React.FC = () => {
  const [copied, setCopied] = useState(false)
  const { docData } = useDocumentInfo()
  
  // Get token and expiresAt from the document
  const token = (docData as InviteLink)?.token
  const expiresAt = (docData as InviteLink)?.expiresAt

  if (!token) {
    return (
      <div className="field-type ui">
        <div className="label">
          <label>Invite Link</label>
        </div>
        <div style={{ padding: '0.75rem', background: '#f3f4f6', borderRadius: '4px', color: '#6b7280' }}>
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
        background: '#f9fafb',
        border: '1px solid #e5e7eb',
        borderRadius: '4px',
      }}>
        <input
          type="text"
          value={inviteUrl}
          readOnly
          style={{
            flex: 1,
            padding: '0.5rem',
            border: '1px solid #d1d5db',
            borderRadius: '4px',
            fontFamily: 'monospace',
            fontSize: '0.875rem',
          }}
          onClick={(e) => (e.target as HTMLInputElement).select()}
        />
        <button
          type="button"
          onClick={handleCopy}
          style={{
            padding: '0.5rem 1rem',
            background: copied ? '#10b981' : '#3b82f6',
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
        <div style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: '#6b7280' }}>
          Share this link with the person you want to invite. It will expire on{' '}
          {new Date(expiresAt).toLocaleString()}.
        </div>
      )}
    </div>
  )
}

export default CopyLinkField


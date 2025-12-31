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
        <div className="copy-link-field__placeholder">
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
      <div className="copy-link-field__container">
        <input
          type="text"
          value={inviteUrl}
          readOnly
          className="copy-link-field__input"
          onClick={(e) => (e.target as HTMLInputElement).select()}
        />
        <button
          type="button"
          onClick={handleCopy}
          className={`copy-link-field__button ${copied ? 'copy-link-field__button--copied' : 'copy-link-field__button--copy'}`}
        >
          {copied ? '✓ Copied!' : 'Copy Link'}
        </button>
      </div>
      {expiresAt && (
        <div className="copy-link-field__hint">
          Share this link with the person you want to invite. It will expire on{' '}
          {new Date(expiresAt).toLocaleString()}.
        </div>
      )}
    </div>
  )
}

export default CopyLinkField


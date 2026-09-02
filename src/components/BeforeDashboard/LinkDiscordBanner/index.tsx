'use client'

import React, { useEffect, useState } from 'react'
import { useAuth } from '@payloadcms/ui'
import type { Person } from '@/payload-types'

const KEY = 'identity-link-banner-dismissed'

/** Shown to any logged-in person with no Discord ID. Dismissible per browser session. */
const LinkDiscordBanner: React.FC = () => {
  const { user } = useAuth<Person>()
  const [dismissed, setDismissed] = useState(true)

  useEffect(() => {
    try {
      setDismissed(sessionStorage.getItem(KEY) === '1')
    } catch {
      setDismissed(false)
    }
  }, [])

  if (!user || (user as any).discordId || dismissed) return null

  return (
    <div
      role="status"
      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', marginBottom: 16, borderRadius: 8, background: 'rgba(88,101,242,0.12)', border: '1px solid rgba(88,101,242,0.4)' }}
    >
      <div style={{ flex: 1 }}>
        <strong>Link your Discord account to keep access.</strong>
        <div style={{ fontSize: 13, opacity: 0.8 }}>Password login is going away. Linking takes ten seconds.</div>
      </div>
      <a href="/api/auth/discord?link=true&returnUrl=/admin" style={{ padding: '8px 14px', borderRadius: 6, background: '#5865F2', color: '#fff', textDecoration: 'none', fontWeight: 500 }}>
        Link Discord
      </a>
      <button
        type="button"
        onClick={() => { try { sessionStorage.setItem(KEY, '1') } catch {} ; setDismissed(true) }}
        style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer', opacity: 0.7 }}
        aria-label="Dismiss"
      >
        x
      </button>
    </div>
  )
}

export default LinkDiscordBanner

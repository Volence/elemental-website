'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Hash, AtSign, Save, Check, Loader2, AlertCircle, Send } from 'lucide-react'

const ID_RE = /^\d{17,20}$/

/**
 * Admin-only settings for the social media dashboard: where the weekly
 * Discord digest goes and which role it pings.
 */
export function SettingsTab() {
  const [channelId, setChannelId] = useState('')
  const [roleId, setRoleId] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/globals/social-media-settings?depth=0', { credentials: 'include' })
      if (!res.ok) throw new Error('Failed to load settings')
      const data = await res.json()
      setChannelId(data.digestChannelId ?? '')
      setRoleId(data.digestRoleId ?? '')
    } catch (err) {
      console.error('Settings load error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchSettings() }, [fetchSettings])

  const handleSave = async () => {
    if (channelId && !ID_RE.test(channelId)) {
      setErrorMsg('Channel ID must be 17-20 digits')
      setSaveStatus('error')
      return
    }
    if (roleId && !ID_RE.test(roleId)) {
      setErrorMsg('Role ID must be 17-20 digits')
      setSaveStatus('error')
      return
    }
    setSaving(true)
    setErrorMsg('')
    try {
      const res = await fetch('/api/globals/social-media-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ digestChannelId: channelId || null, digestRoleId: roleId || null }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.errors?.[0]?.message ?? 'Failed to save')
      }
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2500)
    } catch (err: any) {
      setSaveStatus('error')
      setErrorMsg(err.message ?? 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', opacity: 0.5 }} />
      </div>
    )
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '0.5rem 0.65rem', fontSize: '0.85rem',
    background: 'var(--theme-elevation-0)', border: '1px solid var(--theme-elevation-200)',
    borderRadius: '4px', color: 'var(--theme-text)', fontFamily: 'monospace',
  }

  return (
    <div style={{ padding: '0 0.5rem 1rem', maxWidth: 700 }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--theme-text)', margin: '0 0 0.25rem' }}>
          Social Media Settings
        </h2>
        <p style={{ fontSize: '0.85rem', color: 'var(--theme-elevation-500)', margin: 0 }}>
          Admin-only configuration for the weekly Discord digest
        </p>
      </div>

      <div style={{
        background: 'var(--theme-elevation-50)',
        border: '1px solid var(--theme-elevation-150)',
        borderRadius: '8px',
        padding: '1.25rem',
      }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--theme-text)', margin: '0 0 0.25rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Send size={16} /> Weekly Digest
        </h3>
        <p style={{ fontSize: '0.8rem', color: 'var(--theme-elevation-500)', margin: '0 0 1rem' }}>
          The calendar&apos;s &quot;Post Week to Discord&quot; button sends the week&apos;s schedule here. Right-click a channel or role in Discord and choose Copy ID (Developer Mode must be on).
        </p>

        <div style={{ display: 'grid', gap: '0.9rem' }}>
          <label style={{ display: 'grid', gap: '0.3rem', fontSize: '0.8rem', color: 'var(--theme-elevation-600)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}><Hash size={12} /> Channel ID</span>
            <input type="text" value={channelId} onChange={(e) => setChannelId(e.target.value.trim())} placeholder="e.g. 1234567890123456789" style={inputStyle} />
          </label>
          <label style={{ display: 'grid', gap: '0.3rem', fontSize: '0.8rem', color: 'var(--theme-elevation-600)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}><AtSign size={12} /> Role ID to ping (optional)</span>
            <input type="text" value={roleId} onChange={(e) => setRoleId(e.target.value.trim())} placeholder="e.g. the Social Manager role" style={inputStyle} />
          </label>
        </div>

        <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
              padding: '0.5rem 1rem', fontSize: '0.85rem', fontWeight: 600,
              background: 'rgba(6, 182, 212, 0.12)', border: '1px solid rgba(6, 182, 212, 0.3)',
              borderRadius: '6px', color: '#06b6d4', cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
              : saveStatus === 'saved' ? <><Check size={14} /> Saved!</>
              : <><Save size={14} /> Save Settings</>}
          </button>
          {saveStatus === 'error' && errorMsg && (
            <span style={{ fontSize: '0.8rem', color: '#f87171', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <AlertCircle size={12} /> {errorMsg}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

export default SettingsTab

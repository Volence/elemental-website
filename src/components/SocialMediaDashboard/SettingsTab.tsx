'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { toast } from '@payloadcms/ui'
import { Hash, AtSign, Save, Check, Loader2, AlertCircle, Send, Sun, Eye } from 'lucide-react'

const ID_RE = /^\d{17,20}$/
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/

const TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Berlin',
  'Australia/Sydney',
  'UTC',
]

const card: React.CSSProperties = {
  background: 'var(--theme-elevation-50)',
  border: '1px solid var(--theme-elevation-150)',
  borderRadius: '8px',
  padding: '1.25rem',
}
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '0.5rem 0.65rem', fontSize: '0.85rem',
  background: 'var(--theme-elevation-0)', border: '1px solid var(--theme-elevation-200)',
  borderRadius: '4px', color: 'var(--theme-text)', fontFamily: 'monospace',
}
const labelStyle: React.CSSProperties = { display: 'grid', gap: '0.3rem', fontSize: '0.8rem', color: 'var(--theme-elevation-600)' }
const labelRow: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '0.3rem' }
const btn = (disabled?: boolean): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
  padding: '0.5rem 1rem', fontSize: '0.85rem', fontWeight: 600,
  background: 'rgba(6, 182, 212, 0.12)', border: '1px solid rgba(6, 182, 212, 0.3)',
  borderRadius: '6px', color: '#06b6d4', cursor: disabled ? 'not-allowed' : 'pointer',
  opacity: disabled ? 0.6 : 1,
})
const btnGhost = (disabled?: boolean): React.CSSProperties => ({
  ...btn(disabled), background: 'transparent', border: '1px solid var(--theme-elevation-200)', color: 'var(--theme-text)', fontWeight: 500,
})

/**
 * Admin-only settings for the social media dashboard: the weekly Discord
 * digest target and the morning-of "posts due today" ping.
 */
export function SettingsTab() {
  const [channelId, setChannelId] = useState('')
  const [roleId, setRoleId] = useState('')
  const [pingEnabled, setPingEnabled] = useState(false)
  const [pingChannelId, setPingChannelId] = useState('')
  const [pingTime, setPingTime] = useState('09:00')
  const [pingTimezone, setPingTimezone] = useState('America/New_York')
  const [pingLastSent, setPingLastSent] = useState<string | null>(null)
  const [pingPreview, setPingPreview] = useState<string | null | undefined>(undefined)
  const [pingBusy, setPingBusy] = useState(false)

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
      setPingEnabled(data.dailyPingEnabled === true)
      setPingChannelId(data.dailyPingChannelId ?? '')
      setPingTime(data.dailyPingTime || '09:00')
      setPingTimezone(data.dailyPingTimezone || 'America/New_York')
      setPingLastSent(data.dailyPingLastSent ?? null)
    } catch (err) {
      console.error('Settings load error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchSettings() }, [fetchSettings])

  const handleSave = async () => {
    const problems: string[] = []
    if (channelId && !ID_RE.test(channelId)) problems.push('Digest channel ID must be 17-20 digits')
    if (roleId && !ID_RE.test(roleId)) problems.push('Role ID must be 17-20 digits')
    if (pingChannelId && !ID_RE.test(pingChannelId)) problems.push('Daily ping channel ID must be 17-20 digits')
    if (!TIME_RE.test(pingTime)) problems.push('Daily ping time must be HH:mm (24h)')
    if (pingEnabled && !pingChannelId) problems.push('Pick a channel before turning the daily ping on')
    if (problems.length) {
      setErrorMsg(problems[0])
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
        body: JSON.stringify({
          digestChannelId: channelId || null,
          digestRoleId: roleId || null,
          dailyPingEnabled: pingEnabled,
          dailyPingChannelId: pingChannelId || null,
          dailyPingTime: pingTime,
          dailyPingTimezone: pingTimezone,
        }),
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

  const previewPing = async () => {
    setPingBusy(true)
    try {
      const res = await fetch('/api/social-media/daily-ping', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: '{}' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Failed to preview')
      setPingPreview(data.text)
    } catch (err: any) {
      toast.error(err.message || 'Failed to preview')
    } finally {
      setPingBusy(false)
    }
  }

  const sendPingNow = async () => {
    if (!pingChannelId) {
      toast.error('Set and save a daily ping channel first')
      return
    }
    setPingBusy(true)
    try {
      const res = await fetch('/api/social-media/daily-ping', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ send: true }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Failed to send')
      toast.success(data.sent ? 'Daily ping sent' : 'Nothing due today, nothing sent (day marked as done)')
      setPingLastSent(data.dateKey)
    } catch (err: any) {
      toast.error(err.message || 'Failed to send')
    } finally {
      setPingBusy(false)
    }
  }

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', opacity: 0.5 }} />
      </div>
    )
  }

  return (
    <div style={{ padding: '0 0.5rem 1rem', maxWidth: 720, display: 'grid', gap: '1.25rem' }}>
      <div>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--theme-text)', margin: '0 0 0.25rem' }}>
          Social Media Settings
        </h2>
        <p style={{ fontSize: '0.85rem', color: 'var(--theme-elevation-500)', margin: 0 }}>
          Admin-only configuration for Discord notifications. Right-click a channel or role in Discord and choose Copy ID (Developer Mode must be on).
        </p>
      </div>

      {/* Weekly digest */}
      <div style={card}>
        <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--theme-text)', margin: '0 0 0.25rem', ...labelRow }}>
          <Send size={16} /> Weekly Digest
        </h3>
        <p style={{ fontSize: '0.8rem', color: 'var(--theme-elevation-500)', margin: '0 0 1rem' }}>
          The calendar&apos;s &quot;Post Week to Discord&quot; button sends the week&apos;s schedule here. Once posted, the message is edited in place when posts are reassigned, moved, or completed.
        </p>
        <div style={{ display: 'grid', gap: '0.9rem' }}>
          <label style={labelStyle}>
            <span style={labelRow}><Hash size={12} /> Channel ID</span>
            <input type="text" value={channelId} onChange={(e) => setChannelId(e.target.value.trim())} placeholder="e.g. 1234567890123456789" style={inputStyle} />
          </label>
          <label style={labelStyle}>
            <span style={labelRow}><AtSign size={12} /> Role ID to ping (optional)</span>
            <input type="text" value={roleId} onChange={(e) => setRoleId(e.target.value.trim())} placeholder="e.g. the Social Manager role" style={inputStyle} />
          </label>
        </div>
      </div>

      {/* Daily ping */}
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', marginBottom: '1rem' }}>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--theme-text)', margin: '0 0 0.25rem', ...labelRow }}>
              <Sun size={16} /> Daily &quot;posts due today&quot; ping
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--theme-elevation-500)', margin: 0 }}>
              Every morning, posts due that day with their assignee pinged. Stays quiet on days with nothing due. Can go to a different channel than the weekly digest.
            </p>
          </div>
          <label style={{ ...labelRow, gap: '0.5rem', fontSize: '0.85rem', color: 'var(--theme-text)', whiteSpace: 'nowrap', cursor: 'pointer' }}>
            <input type="checkbox" checked={pingEnabled} onChange={(e) => setPingEnabled(e.target.checked)} style={{ width: 18, height: 18 }} />
            {pingEnabled ? 'On' : 'Off'}
          </label>
        </div>
        <div style={{ display: 'grid', gap: '0.9rem', gridTemplateColumns: '1fr 1fr' }}>
          <label style={{ ...labelStyle, gridColumn: '1 / -1' }}>
            <span style={labelRow}><Hash size={12} /> Channel ID</span>
            <input type="text" value={pingChannelId} onChange={(e) => setPingChannelId(e.target.value.trim())} placeholder="e.g. 1234567890123456789" style={inputStyle} />
          </label>
          <label style={labelStyle}>
            <span>Time (24h)</span>
            <input type="time" value={pingTime} onChange={(e) => setPingTime(e.target.value)} style={inputStyle} />
          </label>
          <label style={labelStyle}>
            <span>Timezone</span>
            <select value={pingTimezone} onChange={(e) => setPingTimezone(e.target.value)} style={{ ...inputStyle, fontFamily: 'inherit' }}>
              {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
            </select>
          </label>
        </div>
        <div style={{ marginTop: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button type="button" onClick={previewPing} disabled={pingBusy} style={btnGhost(pingBusy)}><Eye size={14} /> Preview today&apos;s ping</button>
          <button type="button" onClick={sendPingNow} disabled={pingBusy || !pingChannelId} style={btnGhost(pingBusy || !pingChannelId)} title="Sends right now to the saved channel"><Send size={14} /> Send now</button>
          <span style={{ fontSize: '0.75rem', color: 'var(--theme-elevation-500)' }}>
            {pingLastSent ? `Last ran ${pingLastSent}` : 'Has not run yet'}
          </span>
        </div>
        {pingPreview !== undefined && (
          <pre className="digest-modal__readonly digest-modal__readonly--multiline" style={{ marginTop: '0.75rem', fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '0.78rem' }}>
            {pingPreview ?? 'Nothing due today - no message would be sent.'}
          </pre>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <button onClick={handleSave} disabled={saving} style={btn(saving)}>
          {saving ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
            : saveStatus === 'saved' ? <><Check size={14} /> Saved!</>
            : <><Save size={14} /> Save Settings</>}
        </button>
        {saveStatus === 'error' && errorMsg && (
          <span style={{ fontSize: '0.8rem', color: '#f87171', ...labelRow }}>
            <AlertCircle size={12} /> {errorMsg}
          </span>
        )}
      </div>
    </div>
  )
}

export default SettingsTab

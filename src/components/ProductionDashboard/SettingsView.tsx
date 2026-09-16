'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Bell, Plus, Trash2, Save, Check, Loader2, AlertCircle, Hash, Send, Radio } from 'lucide-react'

type ChannelEntry = {
  id?: string
  channelId: string
  label: string
}

type StreamChannel = {
  id?: string
  label: string
  url: string
}

const CHANNEL_ID_RE = /^\d{17,20}$/
const URL_RE = /^https?:\/\/\S+$/

const inputStyle: React.CSSProperties = {
  padding: '0.4rem 0.6rem', fontSize: '0.8rem',
  background: 'var(--theme-elevation-0)', border: '1px solid var(--theme-elevation-200)',
  borderRadius: '4px', color: 'var(--theme-text)',
}

export function SettingsView() {
  const [channels, setChannels] = useState<ChannelEntry[]>([])
  const [scheduleStaffChannelId, setScheduleStaffChannelId] = useState('')
  const [schedulePublicChannelId, setSchedulePublicChannelId] = useState('')
  const [streamChannels, setStreamChannels] = useState<StreamChannel[]>([])
  const [streamPingRoleId, setStreamPingRoleId] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/globals/production-dashboard?depth=0')
      if (!res.ok) throw new Error('Failed to load settings')
      const data = await res.json()
      setChannels(data.rescheduleNotificationChannels ?? [])
      setScheduleStaffChannelId(data.scheduleStaffChannelId ?? '')
      setSchedulePublicChannelId(data.schedulePublicChannelId ?? '')
      setStreamChannels(data.streamChannels ?? [])
      setStreamPingRoleId(data.streamPingRoleId ?? '')
    } catch (err) {
      console.error('Settings load error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchSettings() }, [fetchSettings])

  const addChannel = () => {
    setChannels(prev => [...prev, { channelId: '', label: '' }])
  }

  const removeChannel = (index: number) => {
    setChannels(prev => prev.filter((_, i) => i !== index))
  }

  const updateChannel = (index: number, field: 'channelId' | 'label', value: string) => {
    setChannels(prev => prev.map((ch, i) => i === index ? { ...ch, [field]: value } : ch))
  }

  const handleSave = async () => {
    // Validate
    const invalidChannels = channels.filter(ch => ch.channelId && !CHANNEL_ID_RE.test(ch.channelId))
    const scheduleIds = [scheduleStaffChannelId.trim(), schedulePublicChannelId.trim()]
    if (invalidChannels.length > 0 || scheduleIds.some(id => id && !CHANNEL_ID_RE.test(id))) {
      setErrorMsg('Channel IDs must be 17-20 digits')
      setSaveStatus('error')
      return
    }
    const pingRoleId = streamPingRoleId.trim()
    if (pingRoleId && !CHANNEL_ID_RE.test(pingRoleId)) {
      setErrorMsg('The ping role ID must be 17-20 digits')
      setSaveStatus('error')
      return
    }
    const validStreams = streamChannels
      .map(sc => ({ ...sc, label: sc.label.trim(), url: sc.url.trim() }))
      .filter(sc => sc.label || sc.url)
    if (validStreams.some(sc => !sc.label || !URL_RE.test(sc.url))) {
      setErrorMsg('Each stream needs a name and a full https:// link')
      setSaveStatus('error')
      return
    }

    // Filter out empty rows
    const validChannels = channels.filter(ch => ch.channelId && ch.label)

    setSaving(true)
    setErrorMsg('')
    try {
      const res = await fetch('/api/globals/production-dashboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scheduleStaffChannelId: scheduleIds[0] || null,
          schedulePublicChannelId: scheduleIds[1] || null,
          streamPingRoleId: pingRoleId || null,
          streamChannels: validStreams,
          rescheduleNotificationChannels: validChannels.map((ch, idx) => ({
            ...ch,
            // Bypass Payload 3 Postgres ID mismatch bug: if no ID exists, Payload tries to 
            // construct a MongoDB ObjectID string, which crashes the Postgres insert.
            // By supplying a temporary negative integer ID, we bypass the auto-generator
            // and satisfy the integer constraint safely without sequence collisions.
            id: ch.id ? parseInt(String(ch.id), 10) : -(Math.floor(Math.random() * 1000000) + idx)
          }))
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.errors?.[0]?.message ?? 'Failed to save')
      }
      const data = await res.json()
      setChannels(data.result?.rescheduleNotificationChannels ?? validChannels)
      setStreamChannels(data.result?.streamChannels ?? validStreams)
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

  return (
    <div style={{ padding: '0 1.5rem 2rem', maxWidth: 700 }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--theme-text)', margin: '0 0 0.25rem' }}>
          Production Settings
        </h2>
        <p style={{ fontSize: '0.85rem', color: 'var(--theme-elevation-500)', margin: 0 }}>
          Admin-only configuration for production notifications
        </p>
      </div>

      {/* Broadcast schedule channels */}
      <div style={{
        background: 'var(--theme-elevation-50)',
        border: '1px solid var(--theme-elevation-150)',
        borderRadius: '8px',
        padding: '1.25rem',
        marginBottom: '1rem',
      }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--theme-text)', margin: '0 0 0.25rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Send size={16} /> Broadcast Schedule Channels
        </h3>
        <p style={{ fontSize: '0.8rem', color: 'var(--theme-elevation-500)', margin: '0 0 1rem' }}>
          Where the Schedule Builder posts the weekly broadcast schedule. Leave one empty to skip that post.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {[
            { label: 'Staff channel (internal post with pings)', value: scheduleStaffChannelId, set: setScheduleStaffChannelId },
            { label: 'Announcements channel (public post)', value: schedulePublicChannelId, set: setSchedulePublicChannelId },
          ].map((field) => (
            <label key={field.label} style={{
              display: 'flex', gap: '0.5rem', alignItems: 'center',
              padding: '0.5rem 0.75rem',
              background: 'var(--theme-elevation-100)',
              border: '1px solid var(--theme-elevation-150)',
              borderRadius: '6px',
            }}>
              <Hash size={14} style={{ opacity: 0.4, flexShrink: 0 }} />
              <span style={{ flex: 1, fontSize: '0.8rem', color: 'var(--theme-text)' }}>{field.label}</span>
              <input
                type="text"
                value={field.value}
                onChange={(e) => field.set(e.target.value)}
                placeholder="Channel ID"
                style={{
                  flex: '0 0 220px', padding: '0.4rem 0.6rem', fontSize: '0.8rem',
                  background: 'var(--theme-elevation-0)', border: '1px solid var(--theme-elevation-200)',
                  borderRadius: '4px', color: 'var(--theme-text)', fontFamily: 'monospace',
                }}
              />
            </label>
          ))}
        </div>
      </div>

      {/* Stream announcements */}
      <div style={{
        background: 'var(--theme-elevation-50)',
        border: '1px solid var(--theme-elevation-150)',
        borderRadius: '8px',
        padding: '1.25rem',
        marginBottom: '1rem',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', gap: '0.75rem' }}>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--theme-text)', margin: '0 0 0.25rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Radio size={16} /> Stream Announcements
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--theme-elevation-500)', margin: 0 }}>
              The Announce buttons on the staff post offer these streams, then post &quot;We&apos;re LIVE&quot; to the announcements channel with this role pinged.
            </p>
          </div>
          <button
            onClick={() => setStreamChannels(prev => [...prev, { label: '', url: '' }])}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.35rem', flexShrink: 0,
              padding: '0.4rem 0.75rem', fontSize: '0.8rem', fontWeight: 500,
              background: 'rgba(6, 182, 212, 0.1)', border: '1px solid rgba(6, 182, 212, 0.3)',
              borderRadius: '6px', color: '#06b6d4', cursor: 'pointer',
            }}
          >
            <Plus size={14} /> Add Stream
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <label style={{
            display: 'flex', gap: '0.5rem', alignItems: 'center',
            padding: '0.5rem 0.75rem',
            background: 'var(--theme-elevation-100)',
            border: '1px solid var(--theme-elevation-150)',
            borderRadius: '6px',
          }}>
            <Bell size={14} style={{ opacity: 0.4, flexShrink: 0 }} />
            <span style={{ flex: 1, fontSize: '0.8rem', color: 'var(--theme-text)' }}>Ping role ID (empty uses Stream Ping)</span>
            <input
              type="text"
              value={streamPingRoleId}
              onChange={(e) => setStreamPingRoleId(e.target.value)}
              placeholder="Role ID"
              style={{ ...inputStyle, flex: '0 0 220px', fontFamily: 'monospace' }}
            />
          </label>
          {streamChannels.length === 0 && (
            <div style={{ padding: '0.75rem', textAlign: 'center', fontSize: '0.8rem', color: 'var(--theme-elevation-500)' }}>
              No streams listed. Announce will offer elmt_gg and elmt_gg_2.
            </div>
          )}
          {streamChannels.map((sc, i) => (
            <div key={sc.id ?? `new-${i}`} style={{
              display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap',
              padding: '0.5rem 0.75rem',
              background: 'var(--theme-elevation-100)',
              border: '1px solid var(--theme-elevation-150)',
              borderRadius: '6px',
            }}>
              <input
                type="text"
                value={sc.label}
                onChange={(e) => setStreamChannels(prev => prev.map((x, j) => j === i ? { ...x, label: e.target.value } : x))}
                placeholder="Name (e.g. elmt_gg_2)"
                style={{ ...inputStyle, flex: '0 0 160px' }}
              />
              <input
                type="text"
                value={sc.url}
                onChange={(e) => setStreamChannels(prev => prev.map((x, j) => j === i ? { ...x, url: e.target.value } : x))}
                placeholder="https://www.twitch.tv/elmt_gg_2"
                style={{ ...inputStyle, flex: 1, minWidth: 0 }}
              />
              <button
                onClick={() => setStreamChannels(prev => prev.filter((_, j) => j !== i))}
                style={{
                  padding: '0.3rem', background: 'none', border: 'none',
                  color: 'var(--theme-elevation-400)', cursor: 'pointer',
                  borderRadius: '4px', flexShrink: 0,
                }}
                title="Remove stream"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Reschedule Notification Channels */}
      <div style={{
        background: 'var(--theme-elevation-50)',
        border: '1px solid var(--theme-elevation-150)',
        borderRadius: '8px',
        padding: '1.25rem',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--theme-text)', margin: '0 0 0.25rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Bell size={16} /> Reschedule Notification Channels
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--theme-elevation-500)', margin: 0 }}>
              Discord channels that receive notifications when matches are rescheduled
            </p>
          </div>
          <button
            onClick={addChannel}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
              padding: '0.4rem 0.75rem', fontSize: '0.8rem', fontWeight: 500,
              background: 'rgba(6, 182, 212, 0.1)', border: '1px solid rgba(6, 182, 212, 0.3)',
              borderRadius: '6px', color: '#06b6d4', cursor: 'pointer',
            }}
          >
            <Plus size={14} /> Add Channel
          </button>
        </div>

        {channels.length === 0 ? (
          <div style={{
            padding: '1.5rem', textAlign: 'center',
            background: 'var(--theme-elevation-100)', borderRadius: '6px',
            color: 'var(--theme-elevation-500)', fontSize: '0.85rem',
          }}>
            No notification channels configured. Reschedule notifications won&apos;t be sent.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {channels.map((ch, i) => (
              <div key={i} style={{
                display: 'flex', gap: '0.5rem', alignItems: 'center',
                padding: '0.5rem 0.75rem',
                background: 'var(--theme-elevation-100)',
                border: '1px solid var(--theme-elevation-150)',
                borderRadius: '6px',
              }}>
                <Hash size={14} style={{ opacity: 0.4, flexShrink: 0 }} />
                <input
                  type="text"
                  value={ch.channelId}
                  onChange={(e) => updateChannel(i, 'channelId', e.target.value)}
                  placeholder="Channel ID"
                  style={{
                    flex: '0 0 200px', padding: '0.4rem 0.6rem', fontSize: '0.8rem',
                    background: 'var(--theme-elevation-0)', border: '1px solid var(--theme-elevation-200)',
                    borderRadius: '4px', color: 'var(--theme-text)', fontFamily: 'monospace',
                  }}
                />
                <input
                  type="text"
                  value={ch.label}
                  onChange={(e) => updateChannel(i, 'label', e.target.value)}
                  placeholder="Label (e.g. Production Alerts)"
                  style={{
                    flex: 1, padding: '0.4rem 0.6rem', fontSize: '0.8rem',
                    background: 'var(--theme-elevation-0)', border: '1px solid var(--theme-elevation-200)',
                    borderRadius: '4px', color: 'var(--theme-text)',
                  }}
                />
                <button
                  onClick={() => removeChannel(i)}
                  style={{
                    padding: '0.3rem', background: 'none', border: 'none',
                    color: 'var(--theme-elevation-400)', cursor: 'pointer',
                    borderRadius: '4px', flexShrink: 0,
                  }}
                  title="Remove channel"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Save button */}
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

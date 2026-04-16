'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Bell, Plus, Trash2, Save, Check, Loader2, AlertCircle, Hash } from 'lucide-react'

type ChannelEntry = {
  id?: string
  channelId: string
  label: string
}

export function SettingsView() {
  const [channels, setChannels] = useState<ChannelEntry[]>([])
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
    const invalidChannels = channels.filter(ch => ch.channelId && !/^\d{17,20}$/.test(ch.channelId))
    if (invalidChannels.length > 0) {
      setErrorMsg('Channel IDs must be 17-20 digits')
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
          rescheduleNotificationChannels: validChannels.map(({ id, ...rest }) => rest) 
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.errors?.[0]?.message ?? 'Failed to save')
      }
      const data = await res.json()
      setChannels(data.result?.rescheduleNotificationChannels ?? validChannels)
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
            No notification channels configured. Reschedule notifications won't be sent.
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
              : <><Save size={14} /> Save Channels</>}
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

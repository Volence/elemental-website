'use client'

import React, { useEffect, useState } from 'react'

interface ChannelOption { id: string; name: string }
interface Props { serverId: string | null }

const CATEGORIES: Array<{ key: string; label: string }> = [
  { key: 'messageLogChannelId', label: 'Message log' },
  { key: 'joinLeaveLogChannelId', label: 'Join / leave log' },
  { key: 'memberLogChannelId', label: 'Member log (roles, nickname, timeouts)' },
  { key: 'profileLogChannelId', label: 'Profile log (avatar, username) - optional' },
  { key: 'serverLogChannelId', label: 'Server log (channels, roles, audit feed)' },
]

export default function LoggingTab({ serverId }: Props) {
  const [channels, setChannels] = useState<ChannelOption[]>([])
  const [settings, setSettings] = useState<Record<string, any>>({})
  const [status, setStatus] = useState<string>('')

  useEffect(() => {
    const q = serverId ? `?serverId=${serverId}` : ''
    fetch(`/api/discord/server/structure${q}`)
      .then((r) => r.json())
      .then((d) => {
        const flat: ChannelOption[] = []
        for (const cat of d.categories ?? []) for (const ch of cat.channels ?? []) flat.push({ id: ch.id, name: ch.name })
        for (const ch of d.uncategorized ?? []) flat.push({ id: ch.id, name: ch.name })
        setChannels(flat)
      })
      .catch(() => setChannels([]))
    fetch(`/api/discord/server/logging-settings${q}`)
      .then((r) => r.json())
      .then((d) => setSettings(d.settings ?? {}))
      .catch(() => setSettings({}))
  }, [serverId])

  const update = (k: string, v: any) => setSettings((s) => ({ ...s, [k]: v }))

  const save = async () => {
    setStatus('Saving...')
    try {
      const res = await fetch('/api/discord/server/logging-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serverId, ...settings }),
      })
      setStatus(res.ok ? 'Saved' : 'Save failed')
    } catch {
      setStatus('Save failed')
    }
  }

  return (
    <div className="logging-tab">
      <div className="logging-tab__header">
        <h3>Server Logging</h3>
        <p>Choose which Discord events get logged and where. Leave a channel as &ldquo;not logged&rdquo; to skip that category.</p>
      </div>

      <label className="logging-tab__toggle">
        <input type="checkbox" checked={!!settings.enableLogging} onChange={(e) => update('enableLogging', e.target.checked)} />
        <span>Enable logging for this server</span>
      </label>

      <div className="logging-tab__grid">
        {CATEGORIES.map(({ key, label }) => (
          <div key={key} className="logging-tab__field">
            <label>{label}</label>
            <select
              className="logging-tab__select"
              value={settings[key] ?? ''}
              onChange={(e) => update(key, e.target.value || null)}
            >
              <option value="">- not logged -</option>
              {channels.map((c) => (
                <option key={c.id} value={c.id}>
                  #{c.name}
                </option>
              ))}
            </select>
          </div>
        ))}

        <div className="logging-tab__field">
          <label>Flag accounts newer than (days)</label>
          <input
            type="number"
            className="logging-tab__input"
            value={settings.newAccountFlagDays ?? 7}
            onChange={(e) => update('newAccountFlagDays', Number(e.target.value))}
          />
        </div>
      </div>

      <label className="logging-tab__toggle">
        <input type="checkbox" checked={settings.attachProfileLink !== false} onChange={(e) => update('attachProfileLink', e.target.checked)} />
        <span>Append website profile link when available</span>
      </label>

      <div className="logging-tab__actions">
        <button className="logging-tab__save" onClick={save}>
          Save logging settings
        </button>
        {status && <span className="logging-tab__status">{status}</span>}
      </div>
    </div>
  )
}

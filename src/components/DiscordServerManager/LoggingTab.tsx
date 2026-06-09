'use client'

import React, { useEffect, useMemo, useState } from 'react'

interface RawChannel { id: string; name: string; type: number }
interface Props { serverId: string | null }

// Channel types that can actually receive a posted log embed.
const TEXT_TYPES = new Set([0, 5]) // GUILD_TEXT, GUILD_ANNOUNCEMENT

const CATEGORIES: Array<{ key: string; label: string }> = [
  { key: 'messageLogChannelId', label: 'Message log' },
  { key: 'joinLeaveLogChannelId', label: 'Join / leave log' },
  { key: 'memberLogChannelId', label: 'Member log (roles, nickname, timeouts)' },
  { key: 'profileLogChannelId', label: 'Profile log (avatar, username) - optional' },
  { key: 'serverLogChannelId', label: 'Server log (channels, roles, audit feed)' },
]

export default function LoggingTab({ serverId }: Props) {
  const [allChannels, setAllChannels] = useState<RawChannel[]>([])
  const [channelsLoaded, setChannelsLoaded] = useState(false)
  const [settings, setSettings] = useState<Record<string, any>>({})
  const [status, setStatus] = useState<string>('')

  useEffect(() => {
    setChannelsLoaded(false)
    const q = serverId ? `?serverId=${serverId}` : ''
    fetch(`/api/discord/server/structure${q}`)
      .then((r) => r.json())
      .then((d) => {
        const flat: RawChannel[] = []
        for (const cat of d.categories ?? []) for (const ch of cat.channels ?? []) flat.push({ id: ch.id, name: ch.name, type: ch.type })
        for (const ch of d.uncategorized ?? []) flat.push({ id: ch.id, name: ch.name, type: ch.type })
        setAllChannels(flat)
      })
      .catch(() => setAllChannels([]))
      .finally(() => setChannelsLoaded(true))
    fetch(`/api/discord/server/logging-settings${q}`)
      .then((r) => r.json())
      .then((d) => setSettings(d.settings ?? {}))
      .catch(() => setSettings({}))
  }, [serverId])

  const textChannels = useMemo(() => allChannels.filter((c) => TEXT_TYPES.has(c.type)), [allChannels])
  const byId = useMemo(() => new Map(allChannels.map((c) => [c.id, c])), [allChannels])

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
        {CATEGORIES.map(({ key, label }) => {
          const current = settings[key] ? String(settings[key]) : ''
          // If the saved channel isn't a selectable text channel (e.g. an older forum/voice
          // pick, or a deleted channel), still show it - marked - so it never silently vanishes.
          const savedInList = current && textChannels.some((c) => c.id === current)
          const savedMeta = current ? byId.get(current) : undefined
          return (
            <div key={key} className="logging-tab__field">
              <label>{label}</label>
              {!channelsLoaded ? (
                <select className="logging-tab__select" disabled value="">
                  <option>Loading channels…</option>
                </select>
              ) : (
                <select
                  className="logging-tab__select"
                  value={current}
                  onChange={(e) => update(key, e.target.value || null)}
                >
                  <option value="">- not logged -</option>
                  {current && !savedInList && (
                    <option value={current}>
                      {savedMeta ? `#${savedMeta.name} (not a text channel - change it)` : `current selection ${current} (unavailable)`}
                    </option>
                  )}
                  {textChannels.map((c) => (
                    <option key={c.id} value={c.id}>
                      #{c.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )
        })}

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

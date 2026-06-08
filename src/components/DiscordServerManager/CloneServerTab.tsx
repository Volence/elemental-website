'use client'

import React, { useState } from 'react'

interface SourceRole { id: string; name: string; managed: boolean; isEveryone: boolean }
interface SourceChannel { id: string; name: string; type: number }
interface SourceCategory { id: string; name: string; channels: SourceChannel[] }
interface Source {
  roles: SourceRole[]
  categories: SourceCategory[]
  emojis: { id: string; name: string }[]
  stickers: { id: string; name: string }[]
}

const CloneServerTab = () => {
  const [targetGuildId, setTargetGuildId] = useState('')
  const [source, setSource] = useState<Source | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [roleIds, setRoleIds] = useState<Set<string>>(new Set())
  const [categoryIds, setCategoryIds] = useState<Set<string>>(new Set())
  const [channelIds, setChannelIds] = useState<Set<string>>(new Set())
  const [includeEmojis, setIncludeEmojis] = useState(true)
  const [includeStickers, setIncludeStickers] = useState(true)
  const [includeSettings, setIncludeSettings] = useState(true)

  const [jobId, setJobId] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [progress, setProgress] = useState<any>(null)
  const [report, setReport] = useState<any[]>([])

  const intervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null)

  React.useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])

  const loadSource = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/discord/server/clone-source')
      const data = await res.json()
      if (!data.success) throw new Error(data.error)
      const src: Source = data.source
      setSource(src)
      setRoleIds(new Set(src.roles.filter((r) => !r.isEveryone && !r.managed).map((r) => r.id)))
      setCategoryIds(new Set(src.categories.map((c) => c.id)))
      setChannelIds(new Set(src.categories.flatMap((c) => c.channels.map((ch) => ch.id))))
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const toggle = (set: Set<string>, id: string, setter: (s: Set<string>) => void) => {
    const next = new Set(set)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setter(next)
  }

  const toggleCategory = (cat: SourceCategory) => {
    const next = new Set(categoryIds)
    const nextCh = new Set(channelIds)
    if (next.has(cat.id)) {
      next.delete(cat.id)
      cat.channels.forEach((ch) => nextCh.delete(ch.id))
    } else {
      next.add(cat.id)
      cat.channels.forEach((ch) => nextCh.add(ch.id))
    }
    setCategoryIds(next)
    setChannelIds(nextCh)
  }

  const toggleChannel = (cat: SourceCategory, ch: SourceChannel) => {
    const nextCh = new Set(channelIds)
    if (nextCh.has(ch.id)) {
      nextCh.delete(ch.id)
    } else {
      nextCh.add(ch.id)
      // A channel only clones if its category is also selected, so ensure it is.
      if (!categoryIds.has(cat.id)) {
        const nextCat = new Set(categoryIds)
        nextCat.add(cat.id)
        setCategoryIds(nextCat)
      }
    }
    setChannelIds(nextCh)
  }

  const startClone = async () => {
    setError(null)
    try {
      const selection = {
        roleIds: Array.from(roleIds),
        categoryIds: Array.from(categoryIds),
        channelIds: Array.from(channelIds),
        includeEmojis,
        includeStickers,
        includeSettings,
      }
      const res = await fetch('/api/discord/server/clone-start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetGuildId, selection }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error)
      setJobId(data.jobId)
      setStatus('pending')
      pollStatus(data.jobId)
    } catch (e: any) {
      setError(e.message)
    }
  }

  const pollStatus = (id: string) => {
    intervalRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/discord/server/clone-status?jobId=${id}`)
        const data = await res.json()
        if (!data.success) {
          setError(data.error || 'Lost track of the clone job')
          if (intervalRef.current) clearInterval(intervalRef.current)
          intervalRef.current = null
          return
        }
        setStatus(data.status)
        setProgress(data.progress)
        setReport(data.report || [])
        if (data.status === 'completed' || data.status === 'failed') {
          if (intervalRef.current) clearInterval(intervalRef.current)
          intervalRef.current = null
        }
      } catch {
        /* keep polling */
      }
    }, 1500)
  }

  return (
    <div style={{ padding: '1rem' }}>
      <h3>Clone Server</h3>
      <p>One-shot copy of the primary server&apos;s roles, channels, emojis, and settings into a target server the bot has already joined.</p>
      <p style={{ fontSize: '0.85em', opacity: 0.8 }}>
        Best run against a freshly-created, empty server. Items that already exist by name are skipped, and re-running will not re-sync later permission or structure changes.
      </p>

      <div style={{ margin: '1rem 0' }}>
        <input
          type="text"
          placeholder="Target server (guild) ID"
          value={targetGuildId}
          onChange={(e) => setTargetGuildId(e.target.value)}
          style={{ width: 320, marginRight: 8 }}
        />
        <button onClick={loadSource} disabled={loading}>
          {loading ? 'Loading…' : 'Load source structure'}
        </button>
      </div>

      {error && <p style={{ color: 'red' }}>{error}</p>}

      {source && (
        <div>
          <div style={{ display: 'flex', gap: '2rem' }}>
            <div>
              <h4>Roles</h4>
              {source.roles
                .filter((r) => !r.isEveryone && !r.managed)
                .map((r) => (
                  <label key={r.id} style={{ display: 'block' }}>
                    <input type="checkbox" checked={roleIds.has(r.id)} onChange={() => toggle(roleIds, r.id, setRoleIds)} /> {r.name}
                  </label>
                ))}
            </div>
            <div>
              <h4>Categories &amp; channels</h4>
              {source.categories.map((c) => (
                <div key={c.id} style={{ marginBottom: 8 }}>
                  <label style={{ fontWeight: 600 }}>
                    <input type="checkbox" checked={categoryIds.has(c.id)} onChange={() => toggleCategory(c)} /> {c.name}
                  </label>
                  <div style={{ paddingLeft: 16 }}>
                    {c.channels.map((ch) => (
                      <label key={ch.id} style={{ display: 'block' }}>
                        <input type="checkbox" checked={channelIds.has(ch.id)} onChange={() => toggleChannel(c, ch)} /> {ch.name}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 12 }}>
            <label style={{ marginRight: 12 }}>
              <input type="checkbox" checked={includeEmojis} onChange={(e) => setIncludeEmojis(e.target.checked)} /> Emojis ({source.emojis.length})
            </label>
            <label style={{ marginRight: 12 }}>
              <input type="checkbox" checked={includeStickers} onChange={(e) => setIncludeStickers(e.target.checked)} /> Stickers ({source.stickers.length})
            </label>
            <label>
              <input type="checkbox" checked={includeSettings} onChange={(e) => setIncludeSettings(e.target.checked)} /> Server settings
            </label>
          </div>

          <button onClick={startClone} disabled={!targetGuildId || status === 'running' || status === 'pending'} style={{ marginTop: 16 }}>
            Start clone
          </button>
        </div>
      )}

      {jobId && (
        <div style={{ marginTop: 16 }}>
          <p>
            <strong>Status:</strong> {status} {progress?.phase ? `(${progress.phase})` : ''}
          </p>
          {progress?.rolesTotal != null && <p>Roles: {progress.rolesDone}/{progress.rolesTotal}</p>}
          {progress?.channelsTotal != null && <p>Channels: {progress.channelsDone}/{progress.channelsTotal}</p>}
          {report.length > 0 && (
            <details>
              <summary>Report ({report.length} items)</summary>
              <ul>
                {report.map((item, i) => (
                  <li key={i}>
                    {item.kind} <strong>{item.name}</strong>: {item.outcome}
                    {item.detail ? ` — ${item.detail}` : ''}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  )
}

export default CloneServerTab

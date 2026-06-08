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

  const [expanded, setExpanded] = useState<Set<string>>(new Set())

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

  const toggleExpanded = (catId: string) => {
    const next = new Set(expanded)
    if (next.has(catId)) next.delete(catId)
    else next.add(catId)
    setExpanded(next)
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
    <div className="clone-server-tab">
      <h3>Clone Server</h3>
      <p className="clone-server-tab__intro">One-shot copy of the primary server&apos;s roles, channels, emojis, and settings into a target server the bot has already joined.</p>
      <p className="clone-server-tab__caveat">
        Best run against a freshly-created, empty server. Items that already exist by name are skipped, and re-running will not re-sync later permission or structure changes.
      </p>

      <div className="clone-server-tab__target-row">
        <input
          type="text"
          placeholder="Target server (guild) ID"
          value={targetGuildId}
          onChange={(e) => setTargetGuildId(e.target.value)}
          className="clone-server-tab__target-input"
        />
        <button className="clone-server-tab__load-btn" onClick={loadSource} disabled={loading}>
          {loading ? 'Loading…' : 'Load source structure'}
        </button>
      </div>

      {error && <p className="clone-server-tab__error">{error}</p>}

      {source && (
        <div>
          <div className="clone-server-tab__columns">
            <div className="clone-server-tab__col">
              <h4>Roles</h4>
              {source.roles
                .filter((r) => !r.isEveryone && !r.managed)
                .map((r) => (
                  <label key={r.id} className="clone-server-tab__check-label">
                    <input type="checkbox" checked={roleIds.has(r.id)} onChange={() => toggle(roleIds, r.id, setRoleIds)} /> {r.name}
                  </label>
                ))}
            </div>
            <div className="clone-server-tab__col">
              <h4>Categories &amp; channels</h4>
              <div className="clone-server-tab__expand-all-row">
                <button
                  type="button"
                  className="clone-server-tab__expand-all"
                  onClick={() => {
                    const allIds = source.categories.map((c) => c.id)
                    const allExpanded = allIds.every((id) => expanded.has(id))
                    setExpanded(allExpanded ? new Set() : new Set(allIds))
                  }}
                >
                  {source.categories.every((c) => expanded.has(c.id)) ? 'Collapse all' : 'Expand all'}
                </button>
              </div>
              {source.categories.map((c) => {
                const isExpanded = expanded.has(c.id)
                const channelGlyph = (type: number): string => {
                  if (type === 2 || type === 13) return '🔊'
                  return '#'
                }
                return (
                  <div key={c.id} className="clone-server-tab__category">
                    <div className="clone-server-tab__category-row">
                      <input
                        type="checkbox"
                        checked={categoryIds.has(c.id)}
                        onChange={() => toggleCategory(c)}
                        className="clone-server-tab__category-checkbox"
                      />
                      <span
                        className="clone-server-tab__category-name"
                        onClick={() => toggleExpanded(c.id)}
                      >
                        {c.name}
                      </span>
                      <span className="clone-server-tab__count">({c.channels.length})</span>
                      <span
                        className="clone-server-tab__caret"
                        onClick={() => toggleExpanded(c.id)}
                        aria-label={isExpanded ? 'Collapse' : 'Expand'}
                      >
                        {isExpanded ? '▾' : '▸'}
                      </span>
                    </div>
                    {isExpanded && (
                      <div className="clone-server-tab__channels">
                        {c.channels.map((ch) => (
                          <div key={ch.id} className="clone-server-tab__channel-row">
                            <span className="clone-server-tab__channel-glyph">{channelGlyph(ch.type)}</span>
                            <span className="clone-server-tab__channel-name">{ch.name}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          <div className="clone-server-tab__toggles">
            <label className="clone-server-tab__check-label">
              <input type="checkbox" checked={includeEmojis} onChange={(e) => setIncludeEmojis(e.target.checked)} /> Emojis ({source.emojis.length})
            </label>
            <label className="clone-server-tab__check-label">
              <input type="checkbox" checked={includeStickers} onChange={(e) => setIncludeStickers(e.target.checked)} /> Stickers ({source.stickers.length})
            </label>
            <label className="clone-server-tab__check-label">
              <input type="checkbox" checked={includeSettings} onChange={(e) => setIncludeSettings(e.target.checked)} /> Server settings
            </label>
          </div>

          <button
            className="clone-server-tab__start-btn"
            onClick={startClone}
            disabled={!targetGuildId || status === 'running' || status === 'pending'}
          >
            Start clone
          </button>
        </div>
      )}

      {jobId && (
        <div className="clone-server-tab__progress">
          <p>
            <strong>Status:</strong> {status} {progress?.phase ? `(${progress.phase})` : ''}
          </p>
          {progress?.rolesTotal != null && <p>Roles: {progress.rolesDone}/{progress.rolesTotal}</p>}
          {progress?.channelsTotal != null && <p>Channels: {progress.channelsDone}/{progress.channelsTotal}</p>}
          {report.length > 0 && (
            <details className="clone-server-tab__report">
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

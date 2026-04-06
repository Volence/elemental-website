'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { CheckCircle, Circle, Clock, Eye, Gamepad2, Lightbulb, Monitor, Plus, Power, PowerOff, RefreshCw, Shield, Timer, Trash2, Video, X, XCircle } from 'lucide-react'

interface TwitchStreamer {
  id: string | number
  twitchUsername: string
  twitchUserId?: string
  displayName?: string
  profileImageUrl?: string
  category: 'content-creator' | 'player'
  bio?: string
  person?: { id: string | number; name: string } | string | number | null
  active: boolean
  isLive: boolean
  currentStreamTitle?: string
  currentGame?: string
  viewerCount?: number
  thumbnailUrl?: string
  streamStartedAt?: string
}

interface PersonOption {
  id: string | number
  name: string
}

const TwitchLiveTab: React.FC = () => {
  const [streamers, setStreamers] = useState<TwitchStreamer[]>([])
  const [people, setPeople] = useState<PersonOption[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [newInput, setNewInput] = useState('')
  const [newCategory, setNewCategory] = useState<'content-creator' | 'player'>('content-creator')
  const [newBio, setNewBio] = useState('')
  const [newPerson, setNewPerson] = useState<string>('')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const loadStreamers = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/discord/twitch/streamers')
      if (!response.ok) throw new Error('Failed to load streamers')
      const data = await response.json()
      setStreamers(data.docs || [])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  const loadPeople = useCallback(async () => {
    try {
      const response = await fetch('/api/people?limit=200&depth=0&sort=name')
      if (!response.ok) return
      const data = await response.json()
      setPeople((data.docs || []).map((p: any) => ({ id: p.id, name: p.name })))
    } catch {
      // Silently fail — person is optional
    }
  }, [])

  useEffect(() => {
    loadStreamers()
    loadPeople()
  }, [loadStreamers, loadPeople])

  const showSuccess = (msg: string) => {
    setSuccessMessage(msg)
    setTimeout(() => setSuccessMessage(null), 3000)
  }

  const handleAdd = async () => {
    if (!newInput.trim()) return

    try {
      setAdding(true)
      setError(null)
      const response = await fetch('/api/discord/twitch/streamers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: newInput.trim(),
          category: newCategory,
          bio: newBio.trim() || null,
          person: newPerson || null,
        }),
      })

      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to add streamer')
      }

      setNewInput('')
      setNewBio('')
      setNewPerson('')
      await loadStreamers()
      showSuccess(`Added ${data.displayName || data.twitchUsername} as ${newCategory === 'player' ? 'Player' : 'Content Creator'}`)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setAdding(false)
    }
  }

  const handleToggle = async (streamer: TwitchStreamer) => {
    try {
      setError(null)
      await fetch('/api/discord/twitch/streamers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: streamer.twitchUsername,
          active: !streamer.active,
        }),
      })
      await loadStreamers()
    } catch (err: any) {
      setError(err.message)
    }
  }

  const handleDelete = async (streamer: TwitchStreamer) => {
    if (!confirm(`Remove ${streamer.displayName || streamer.twitchUsername} from tracking?`)) return

    try {
      setError(null)
      await fetch(`/api/discord/twitch/streamers?id=${streamer.id}`, {
        method: 'DELETE',
      })
      await loadStreamers()
      showSuccess(`Removed ${streamer.displayName || streamer.twitchUsername}`)
    } catch (err: any) {
      setError(err.message)
    }
  }

  const handleRefresh = async () => {
    try {
      setRefreshing(true)
      setError(null)
      const response = await fetch('/api/discord/twitch/refresh', {
        method: 'POST',
      })
      const result = await response.json()
      await loadStreamers()
      showSuccess(`${result.live} of ${result.total} streamers are live`)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setRefreshing(false)
    }
  }

  const formatDuration = (startedAt?: string) => {
    if (!startedAt) return ''
    const elapsed = Date.now() - new Date(startedAt).getTime()
    const hours = Math.floor(elapsed / 3600000)
    const minutes = Math.floor((elapsed % 3600000) / 60000)
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`
  }

  const getPersonName = (streamer: TwitchStreamer): string | null => {
    if (!streamer.person) return null
    if (typeof streamer.person === 'object' && streamer.person.name) return streamer.person.name
    // If person is just an ID, look it up
    const found = people.find(p => String(p.id) === String(streamer.person))
    return found?.name || null
  }

  // Group by category
  const creators = streamers.filter(s => s.category !== 'player')
  const players = streamers.filter(s => s.category === 'player')

  const renderStreamerCard = (streamer: TwitchStreamer) => {
    const isLive = streamer.isLive && streamer.active
    const cardClass = `streamer-card ${isLive ? 'live' : 'offline'} ${!streamer.active ? 'disabled' : ''}`
    const personName = getPersonName(streamer)

    return (
      <div key={streamer.id} className={cardClass}>
        <div className="streamer-avatar">
          {streamer.profileImageUrl ? (
            <img src={streamer.profileImageUrl} alt={streamer.displayName || streamer.twitchUsername} />
          ) : (
            <div className="avatar-placeholder"><Monitor size={14} /></div>
          )}
          {isLive && <span className="live-indicator" />}
        </div>
        <div className="streamer-info">
          <div className="streamer-name">
            <a
              href={`https://twitch.tv/${streamer.twitchUsername}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              {streamer.displayName || streamer.twitchUsername}
            </a>
            {!streamer.active && <span className="disabled-badge">Disabled</span>}
          </div>
          {(streamer.bio || personName) && (
            <div className="streamer-meta">
              {streamer.bio && <span className="streamer-bio">{streamer.bio}</span>}
              {personName && <span className="streamer-person"><Shield size={12} /> {personName}</span>}
            </div>
          )}
          {isLive && (
            <>
              <div className="streamer-stream-info">
                <span className="stream-game"><Gamepad2 size={14} /> {streamer.currentGame || 'Unknown'}</span>
                <span className="stream-viewers"><Eye size={14} /> {(streamer.viewerCount || 0).toLocaleString()}</span>
                {streamer.streamStartedAt && (
                  <span className="stream-duration"><Timer size={14} /> {formatDuration(streamer.streamStartedAt)}</span>
                )}
              </div>
              {streamer.currentStreamTitle && (
                <div className="streamer-title">{streamer.currentStreamTitle}</div>
              )}
            </>
          )}
        </div>
        <div className="account-actions">
          {!isLive && (
            <button
              className={`toggle-button ${streamer.active ? 'active' : 'inactive'}`}
              onClick={() => handleToggle(streamer)}
              title={streamer.active ? 'Disable' : 'Enable'}
            >
              {streamer.active ? <Power size={16} /> : <PowerOff size={16} />}
            </button>
          )}
          <button
            className="delete-button"
            onClick={() => handleDelete(streamer)}
            title="Remove"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    )
  }

  const renderCategorySection = (title: string, icon: React.ReactNode, categoryStreamers: TwitchStreamer[]) => {
    const live = categoryStreamers.filter(s => s.isLive && s.active)
    const offline = categoryStreamers.filter(s => !s.isLive || !s.active)

    return (
      <div className="streamers-category-group">
        <h4 className="category-group-title">
          {icon} {title}
          <span className="category-count">{categoryStreamers.length} tracked{live.length > 0 ? ` • ${live.length} live` : ''}</span>
        </h4>

        {live.length > 0 && (
          <div className="streamers-section">
            <h5 className="section-title live-title">
              <span className="live-dot" />
              Live ({live.length})
            </h5>
            <div className="streamers-list">
              {live.map(renderStreamerCard)}
            </div>
          </div>
        )}

        {offline.length > 0 && (
          <div className="streamers-section">
            <h5 className="section-title offline-title">
              Offline ({offline.length})
            </h5>
            <div className="streamers-list">
              {offline.map(renderStreamerCard)}
            </div>
          </div>
        )}

        {categoryStreamers.length === 0 && (
          <div className="tab-empty tab-empty--compact">
            <p className="tab-empty-hint">No streamers in this category yet.</p>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="integration-tab twitch-tab">
      <div className="tab-header">
        <div className="tab-header-text">
          <h3><Circle size={12} /> Twitch Live Roster</h3>
          <p>Track streamers across two channels — one for content creators, one for players.</p>
        </div>
        <button
          className="check-now-button"
          onClick={handleRefresh}
          disabled={refreshing || streamers.length === 0}
        >
          <RefreshCw size={16} className={refreshing ? 'spinning' : ''} />
          {refreshing ? 'Refreshing...' : 'Refresh Now'}
        </button>
      </div>

      {error && (
        <div className="tab-alert tab-alert-error">
          <span><XCircle size={12} /></span> {error}
          <button onClick={() => setError(null)}><X size={10} /></button>
        </div>
      )}

      {successMessage && (
        <div className="tab-alert tab-alert-success">
          <span><CheckCircle size={12} /></span> {successMessage}
        </div>
      )}

      {/* Add Streamer Form */}
      <div className="add-form">
        <div className="add-form-inputs">
          <input
            type="text"
            value={newInput}
            onChange={(e) => setNewInput(e.target.value)}
            placeholder="twitch.tv/username or just username"
            className="text-input streamer-input"
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          />
          <select
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value as 'content-creator' | 'player')}
            className="text-input category-select"
          >
            <option value="content-creator"><Video size={14} /> Content Creator</option>
            <option value="player"><Gamepad2 size={14} /> Player</option>
          </select>
        </div>
        <div className="add-form-inputs add-form-inputs--extra">
          <input
            type="text"
            value={newBio}
            onChange={(e) => setNewBio(e.target.value)}
            placeholder="Bio tagline (optional) — e.g. Flex DPS, Variety streamer"
            className="text-input bio-input"
          />
          <select
            value={newPerson}
            onChange={(e) => setNewPerson(e.target.value)}
            className="text-input category-select person-select"
          >
            <option value="">No linked person</option>
            {people.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <button
            className="add-button"
            onClick={handleAdd}
            disabled={adding || !newInput.trim()}
          >
            <Plus size={16} />
            {adding ? 'Adding...' : 'Add'}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="tab-loading">Loading streamers...</div>
      ) : streamers.length === 0 ? (
        <div className="tab-empty">
          <p>No streamers tracked yet.</p>
          <p className="tab-empty-hint">Add a Twitch username or URL above to start tracking streams.</p>
        </div>
      ) : (
        <div className="category-groups">
          {renderCategorySection('Content Creators', <Video size={14} />, creators)}
          {renderCategorySection('Players', <Gamepad2 size={14} />, players)}
        </div>
      )}

      <div className="tab-footer-note">
        <p><Lightbulb size={14} /> Polls Twitch every 3 minutes. Each live streamer gets their own embed card in Discord.</p>
      </div>
    </div>
  )
}

export default TwitchLiveTab

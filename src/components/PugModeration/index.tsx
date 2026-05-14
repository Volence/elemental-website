'use client'

import React, { useState, useEffect, useCallback } from 'react'

type BannedPlayer = {
  id: number
  name: string
  bannedUntil: string
  reason: string
  offenseCount: number
}

type SearchResult = {
  id: number
  name: string
  pugActiveBan: { bannedUntil?: string; reason?: string } | null
  pugBanOffenseCount: number
}

const DURATION_PRESETS = [
  { label: '24 hours', hours: 24 },
  { label: '3 days', hours: 72 },
  { label: '1 week', hours: 168 },
  { label: '2 weeks', hours: 336 },
  { label: '1 month', hours: 720 },
]

export function PugModerationPanel() {
  const [bans, setBans] = useState<BannedPlayer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Ban form
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [selectedPlayer, setSelectedPlayer] = useState<SearchResult | null>(null)
  const [banDuration, setBanDuration] = useState(24)
  const [banReason, setBanReason] = useState('')
  const [incrementOffense, setIncrementOffense] = useState(true)
  const [banning, setBanning] = useState(false)

  const fetchBans = useCallback(async () => {
    try {
      const res = await fetch('/api/pug/admin/bans')
      if (res.ok) {
        const data = await res.json()
        setBans(data.bans ?? [])
      }
    } catch {
      setError('Failed to load bans')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchBans()
  }, [fetchBans])

  async function handleSearch() {
    if (!searchQuery.trim()) return
    setSearching(true)
    setError(null)
    try {
      const res = await fetch(`/api/pug/admin/bans?search=${encodeURIComponent(searchQuery.trim())}`)
      if (res.ok) {
        const data = await res.json()
        setSearchResults(data.players ?? [])
      }
    } catch {
      setError('Search failed')
    } finally {
      setSearching(false)
    }
  }

  async function handleBan() {
    if (!selectedPlayer || !banReason.trim()) return
    setBanning(true)
    setError(null)
    setSuccess(null)
    try {
      const res = await fetch('/api/pug/admin/bans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedPlayer.id,
          durationHours: banDuration,
          reason: banReason.trim(),
          incrementOffense,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setSuccess(`Banned ${selectedPlayer.name} until ${new Date(data.bannedUntil).toLocaleString()}`)
        setSelectedPlayer(null)
        setBanReason('')
        setSearchQuery('')
        setSearchResults([])
        fetchBans()
      } else {
        setError(data.error || 'Failed to ban player')
      }
    } catch {
      setError('Failed to ban player')
    } finally {
      setBanning(false)
    }
  }

  async function handleUnban(userId: number, name: string) {
    setError(null)
    setSuccess(null)
    try {
      const res = await fetch(`/api/pug/admin/bans/${userId}`, { method: 'DELETE' })
      if (res.ok) {
        setSuccess(`Unbanned ${name}`)
        fetchBans()
      } else {
        const data = await res.json()
        setError(data.error || 'Failed to unban')
      }
    } catch {
      setError('Failed to unban player')
    }
  }

  return (
    <div style={{ maxWidth: 800 }}>
      {error && (
        <div style={{ padding: '0.75rem 1rem', marginBottom: '1rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, color: '#f87171', fontSize: 14 }}>
          {error}
        </div>
      )}
      {success && (
        <div style={{ padding: '0.75rem 1rem', marginBottom: '1rem', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 8, color: '#4ade80', fontSize: 14 }}>
          {success}
        </div>
      )}

      {/* Ban Player Section */}
      <section style={{ marginBottom: '2rem' }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: '0.75rem', color: 'rgba(255,255,255,0.9)' }}>Ban Player</h3>
        <div style={{ display: 'flex', gap: 8, marginBottom: '0.75rem' }}>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Search player by name..."
            style={{
              flex: 1, padding: '0.5rem 0.75rem', background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, color: 'white', fontSize: 14,
            }}
          />
          <button
            onClick={handleSearch}
            disabled={searching || !searchQuery.trim()}
            style={{
              padding: '0.5rem 1rem', background: 'rgba(59,130,246,0.8)', border: 'none',
              borderRadius: 8, color: 'white', fontSize: 14, cursor: 'pointer', opacity: searching ? 0.5 : 1,
            }}
          >
            {searching ? 'Searching...' : 'Search'}
          </button>
        </div>

        {/* Search results */}
        {searchResults.length > 0 && !selectedPlayer && (
          <div style={{ border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, overflow: 'hidden', marginBottom: '0.75rem' }}>
            {searchResults.map((p) => {
              const isBanned = p.pugActiveBan?.bannedUntil && new Date(p.pugActiveBan.bannedUntil) > new Date()
              return (
                <button
                  key={p.id}
                  onClick={() => setSelectedPlayer(p)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    width: '100%', padding: '0.5rem 0.75rem', background: 'transparent',
                    border: 'none', borderBottom: '1px solid rgba(255,255,255,0.05)',
                    color: 'white', cursor: 'pointer', fontSize: 14, textAlign: 'left',
                  }}
                >
                  <span>{p.name}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {isBanned && (
                      <span style={{ fontSize: 11, padding: '2px 8px', background: 'rgba(239,68,68,0.2)', color: '#f87171', borderRadius: 20 }}>
                        BANNED
                      </span>
                    )}
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
                      {p.pugBanOffenseCount} offense{p.pugBanOffenseCount !== 1 ? 's' : ''}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        )}

        {/* Ban form for selected player */}
        {selectedPlayer && (
          <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <span style={{ fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>
                {selectedPlayer.name}
              </span>
              <button
                onClick={() => setSelectedPlayer(null)}
                style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: 12 }}
              >
                Cancel
              </button>
            </div>

            <div style={{ marginBottom: '0.75rem' }}>
              <label style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', display: 'block', marginBottom: 4 }}>Duration</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {DURATION_PRESETS.map((preset) => (
                  <button
                    key={preset.hours}
                    onClick={() => setBanDuration(preset.hours)}
                    style={{
                      padding: '4px 12px', borderRadius: 6, fontSize: 13, cursor: 'pointer', border: 'none',
                      background: banDuration === preset.hours ? 'rgba(59,130,246,0.8)' : 'rgba(255,255,255,0.08)',
                      color: banDuration === preset.hours ? 'white' : 'rgba(255,255,255,0.6)',
                    }}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: '0.75rem' }}>
              <label style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', display: 'block', marginBottom: 4 }}>Reason</label>
              <input
                type="text"
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
                placeholder="Reason for ban..."
                style={{
                  width: '100%', padding: '0.5rem 0.75rem', background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, color: 'white', fontSize: 14,
                }}
              />
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '0.75rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={incrementOffense}
                onChange={(e) => setIncrementOffense(e.target.checked)}
              />
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>
                Increment offense count (currently {selectedPlayer.pugBanOffenseCount})
              </span>
            </label>

            <button
              onClick={handleBan}
              disabled={banning || !banReason.trim()}
              style={{
                width: '100%', padding: '0.5rem', background: 'rgba(239,68,68,0.8)', border: 'none',
                borderRadius: 8, color: 'white', fontSize: 14, fontWeight: 600, cursor: 'pointer',
                opacity: banning || !banReason.trim() ? 0.5 : 1,
              }}
            >
              {banning ? 'Banning...' : `Ban ${selectedPlayer.name}`}
            </button>
          </div>
        )}
      </section>

      {/* Active Bans Section */}
      <section>
        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: '0.75rem', color: 'rgba(255,255,255,0.9)' }}>
          Active Bans ({bans.length})
        </h3>
        {loading ? (
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>Loading...</p>
        ) : bans.length === 0 ? (
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>No active bans.</p>
        ) : (
          <div style={{ border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                  <th style={{ textAlign: 'left', padding: '0.5rem 0.75rem', color: 'rgba(255,255,255,0.4)', fontWeight: 500, fontSize: 12 }}>Player</th>
                  <th style={{ textAlign: 'left', padding: '0.5rem 0.75rem', color: 'rgba(255,255,255,0.4)', fontWeight: 500, fontSize: 12 }}>Reason</th>
                  <th style={{ textAlign: 'left', padding: '0.5rem 0.75rem', color: 'rgba(255,255,255,0.4)', fontWeight: 500, fontSize: 12 }}>Expires</th>
                  <th style={{ textAlign: 'center', padding: '0.5rem 0.75rem', color: 'rgba(255,255,255,0.4)', fontWeight: 500, fontSize: 12 }}>Offenses</th>
                  <th style={{ textAlign: 'right', padding: '0.5rem 0.75rem' }}></th>
                </tr>
              </thead>
              <tbody>
                {bans.map((ban) => (
                  <tr key={ban.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: '0.5rem 0.75rem', color: 'rgba(255,255,255,0.9)', fontWeight: 500 }}>{ban.name}</td>
                    <td style={{ padding: '0.5rem 0.75rem', color: 'rgba(255,255,255,0.5)' }}>{ban.reason}</td>
                    <td style={{ padding: '0.5rem 0.75rem', color: 'rgba(255,255,255,0.5)' }}>
                      {new Date(ban.bannedUntil).toLocaleString()}
                    </td>
                    <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center', color: 'rgba(255,255,255,0.5)' }}>{ban.offenseCount}</td>
                    <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>
                      <button
                        onClick={() => handleUnban(ban.id, ban.name)}
                        style={{
                          padding: '3px 10px', background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)',
                          borderRadius: 6, color: '#4ade80', fontSize: 12, cursor: 'pointer',
                        }}
                      >
                        Unban
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

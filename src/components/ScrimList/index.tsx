'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'

interface ScrimMap {
  id: number
  name: string
  mapDataId: number | null
  opponent: string | null
  score: string | null
  result: 'win' | 'loss' | 'draw' | null
  estimated?: boolean
}

interface Scrim {
  id: number
  name: string
  date: string
  createdAt: string
  creatorEmail: string
  teamName: string | null
  teamName2: string | null
  payloadTeamId: number | null
  payloadTeamId2: number | null
  opponentName: string | null
  mapCount: number
  maps: ScrimMap[]
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

/* ─── Clean Glow Design Tokens ─── */
const BG = '#0a0e1a'
const BG_CARD = 'rgba(255,255,255,0.03)'
const BORDER = 'rgba(255,255,255,0.06)'
const TEXT_PRIMARY = 'rgba(255,255,255,0.95)'
const TEXT_SECONDARY = 'rgba(255,255,255,0.55)'
const TEXT_DIM = 'rgba(255,255,255,0.35)'
const CYAN = '#06b6d4'
const GREEN = '#22c55e'
const RED = '#ef4444'
const AMBER = '#f59e0b'

const CARD_STYLE: React.CSSProperties = {
  background: BG_CARD,
  border: `1px solid ${BORDER}`,
  borderRadius: '12px',
  backdropFilter: 'blur(12px)',
}

const RESULT_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  win: { bg: `${GREEN}18`, text: GREEN, label: 'W' },
  loss: { bg: `${RED}18`, text: RED, label: 'L' },
  draw: { bg: `${AMBER}18`, text: AMBER, label: 'D' },
}

/**
 * Admin view — list of uploaded scrims with search, team filter, and rich expanded cards.
 * Accessible at /admin/scrims.
 */
export default function ScrimListView() {
  const [scrims, setScrims] = useState<Scrim[]>([])
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [deleting, setDeleting] = useState<number | null>(null)
  const [hoveredId, setHoveredId] = useState<number | null>(null)
  const [hoveredMapId, setHoveredMapId] = useState<number | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  // Opponent rename state
  const [editingOpponentScrimId, setEditingOpponentScrimId] = useState<number | null>(null)
  const [opponentInput, setOpponentInput] = useState('')
  const [opponentSuggestions, setOpponentSuggestions] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [savingOpponent, setSavingOpponent] = useState(false)
  const opponentInputRef = useRef<HTMLInputElement>(null)
  const suggestionsRef = useRef<HTMLDivElement>(null)
  const opponentDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Fetch opponent suggestions
  const fetchOpponentSuggestions = useCallback(async (q: string) => {
    try {
      const res = await fetch(`/api/scrim-opponents?q=${encodeURIComponent(q)}`)
      const data = await res.json()
      setOpponentSuggestions(data.opponents ?? [])
      setShowSuggestions(true)
    } catch {
      setOpponentSuggestions([])
    }
  }, [])

  // Handle opponent input change with debounce
  const handleOpponentInputChange = useCallback((val: string) => {
    setOpponentInput(val)
    if (opponentDebounce.current) clearTimeout(opponentDebounce.current)
    opponentDebounce.current = setTimeout(() => {
      fetchOpponentSuggestions(val)
    }, 200)
  }, [fetchOpponentSuggestions])

  // Save opponent name
  const saveOpponentName = useCallback(async (scrimId: number, name: string) => {
    setSavingOpponent(true)
    try {
      await fetch('/api/scrim-rename', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scrimId, opponentName: name }),
      })
      // Update local state
      setScrims(prev => prev.map(s =>
        s.id === scrimId
          ? {
              ...s,
              opponentName: name.trim() || null,
              maps: s.maps.map(m => ({
                ...m,
                opponent: name.trim() || m.opponent,
              })),
            }
          : s
      ))
    } catch {
      // silently fail
    }
    setSavingOpponent(false)
    setEditingOpponentScrimId(null)
    setShowSuggestions(false)
  }, [])

  // Start editing opponent
  const startEditingOpponent = useCallback((scrim: Scrim) => {
    setEditingOpponentScrimId(scrim.id)
    // Pre-fill with current override or first map's opponent
    const current = scrim.opponentName ?? scrim.maps[0]?.opponent ?? ''
    setOpponentInput(current)
    fetchOpponentSuggestions(current)
    setTimeout(() => opponentInputRef.current?.focus(), 50)
  }, [fetchOpponentSuggestions])

  // Close suggestions on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(e.target as Node) &&
        opponentInputRef.current &&
        !opponentInputRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Search & filter state
  const [searchText, setSearchText] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Debounce search input
  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(() => {
      setDebouncedSearch(searchText)
    }, 300)
    return () => { if (searchTimeout.current) clearTimeout(searchTimeout.current) }
  }, [searchText])

  const fetchScrims = useCallback(async (page = 1) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: '10' })
      if (debouncedSearch) params.set('search', debouncedSearch)
      const res = await fetch(`/api/scrims?${params}`)
      const data = await res.json()
      setScrims(data.scrims)
      setPagination(data.pagination)
    } catch {
      setScrims([])
    }
    setLoading(false)
  }, [debouncedSearch])

  useEffect(() => {
    fetchScrims()
  }, [fetchScrims])

  const handleDelete = (scrimId: number) => {
    setDeleteError(null)
    setConfirmDeleteId(scrimId)
  }

  const executeDelete = async () => {
    if (confirmDeleteId === null) return
    setDeleting(confirmDeleteId)
    setConfirmDeleteId(null)
    try {
      await fetch(`/api/scrims?id=${confirmDeleteId}`, { method: 'DELETE' })
      fetchScrims(pagination?.page)
    } catch {
      setDeleteError('Failed to delete scrim. Please try again.')
    }
    setDeleting(null)
  }

  const formatDate = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  return (
    <div style={{
      background: BG,
      minHeight: '100%',
      padding: '40px',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      color: TEXT_PRIMARY,
    }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>
          <div>
            <h1 style={{
              fontSize: '28px',
              fontWeight: 800,
              margin: 0,
              color: CYAN,
              textShadow: `0 0 30px ${CYAN}33`,
              letterSpacing: '-0.5px',
            }}>
              Scrim Analytics
            </h1>
            <div style={{
              width: '60px',
              height: '3px',
              background: `linear-gradient(90deg, ${CYAN}, ${CYAN}00)`,
              borderRadius: '2px',
              marginTop: '8px',
            }} />
            <p style={{ color: TEXT_DIM, fontSize: '13px', marginTop: '8px' }}>
              {pagination ? `${pagination.total} scrim${pagination.total !== 1 ? 's' : ''} uploaded` : 'Loading…'}
            </p>
          </div>
          <a
            href="/admin/scrim-upload"
            style={{
              padding: '10px 20px',
              borderRadius: '8px',
              background: `linear-gradient(135deg, ${CYAN}, ${CYAN}cc)`,
              color: '#fff',
              textDecoration: 'none',
              fontWeight: 700,
              fontSize: '13px',
              boxShadow: `0 0 20px ${CYAN}33, 0 4px 12px rgba(0,0,0,0.3)`,
              transition: 'all 0.2s',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            + Upload Scrim
          </a>
        </div>

        {/* Navigation */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          <a
            href="/admin/scrim-players"
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              ...CARD_STYLE,
              textDecoration: 'none',
              color: TEXT_SECONDARY,
              fontSize: '12px',
              fontWeight: 600,
              transition: 'all 0.2s',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            👤 All Players
          </a>
        </div>

        {/* Search Bar */}
        <div style={{
          display: 'flex',
          gap: '10px',
          marginBottom: '20px',
          alignItems: 'center',
        }}>
          <div style={{
            flex: 1,
            position: 'relative',
          }}>
            <span style={{
              position: 'absolute',
              left: '14px',
              top: '50%',
              transform: 'translateY(-50%)',
              fontSize: '14px',
              color: TEXT_DIM,
              pointerEvents: 'none',
            }}>🔍</span>
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Search scrims..."
              style={{
                width: '100%',
                padding: '10px 14px 10px 40px',
                borderRadius: '10px',
                border: `1px solid ${BORDER}`,
                background: BG_CARD,
                color: TEXT_PRIMARY,
                fontSize: '13px',
                fontFamily: "'Inter', sans-serif",
                outline: 'none',
                transition: 'border-color 0.2s, box-shadow 0.2s',
                backdropFilter: 'blur(12px)',
                boxSizing: 'border-box',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = `${CYAN}44`
                e.currentTarget.style.boxShadow = `0 0 12px ${CYAN}11`
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = BORDER
                e.currentTarget.style.boxShadow = 'none'
              }}
            />
          </div>
          {searchText && (
            <button
              onClick={() => setSearchText('')}
              style={{
                background: 'none',
                border: `1px solid ${BORDER}`,
                borderRadius: '8px',
                color: TEXT_DIM,
                cursor: 'pointer',
                fontSize: '12px',
                padding: '10px 14px',
                fontFamily: "'Inter', sans-serif",
                transition: 'all 0.2s',
              }}
            >
              Clear
            </button>
          )}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '80px 0', color: TEXT_DIM }}>
            <div style={{ fontSize: '24px', marginBottom: '12px', opacity: 0.5 }}>⏳</div>
            Loading scrims…
          </div>
        ) : scrims.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '80px 0',
            color: TEXT_DIM,
            ...CARD_STYLE,
            borderStyle: 'dashed',
          }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>📊</div>
            <p style={{ fontWeight: 600, color: TEXT_SECONDARY, fontSize: '15px' }}>
              {debouncedSearch ? 'No scrims match your search' : 'No scrims uploaded yet'}
            </p>
            <p style={{ fontSize: '13px', marginTop: '6px' }}>
              {debouncedSearch ? 'Try a different search term' : 'Upload ScrimTime log files to get started'}
            </p>
          </div>
        ) : (
          <>
            {/* Group scrims by team */}
            {(() => {
              type ScrimEntry = { scrim: Scrim; viewingAsTeam2: boolean }
              const teamGroups = new Map<string, ScrimEntry[]>()
              for (const s of scrims) {
                const key = s.teamName ?? 'Other'
                const group = teamGroups.get(key) ?? []
                group.push({ scrim: s, viewingAsTeam2: false })
                teamGroups.set(key, group)
                // Also group under team2 for dual-team (internal) scrims
                if (s.teamName2 && s.teamName2 !== s.teamName) {
                  const key2 = s.teamName2
                  const group2 = teamGroups.get(key2) ?? []
                  group2.push({ scrim: s, viewingAsTeam2: true })
                  teamGroups.set(key2, group2)
                }
              }
              // Render named teams first, "Other" last
              const sortedKeys = [...teamGroups.keys()].sort((a, b) => {
                if (a === 'Other') return 1
                if (b === 'Other') return -1
                return a.localeCompare(b)
              })
              return sortedKeys.map((teamKey) => {
                const teamEntries = teamGroups.get(teamKey)!
                return (
                  <div key={teamKey} style={{ marginBottom: '28px' }}>
                    {/* Team section header */}
                    {(() => {
                      const firstEntry = teamEntries[0]
                      const firstScrim = firstEntry?.scrim
                      // Resolve the correct team ID for the link (may be team2 for dual-team scrims)
                      const teamIdForLink = firstEntry?.viewingAsTeam2 && firstScrim?.payloadTeamId2
                        ? firstScrim.payloadTeamId2
                        : firstScrim?.payloadTeamId ?? null
                      const teamHref = teamIdForLink
                        ? `/admin/scrim-team?teamId=${teamIdForLink}`
                        : null
                      return (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                      {teamHref ? (
                        <a
                          href={teamHref}
                          style={{
                            fontSize: '16px',
                            fontWeight: 700,
                            margin: 0,
                            color: TEXT_PRIMARY,
                            letterSpacing: '-0.2px',
                            textDecoration: 'none',
                            transition: 'color 0.2s',
                          }}
                          onMouseOver={e => { e.currentTarget.style.color = '#06b6d4' }}
                          onMouseOut={e => { e.currentTarget.style.color = TEXT_PRIMARY }}
                        >
                          {teamKey} →
                        </a>
                      ) : (
                        <h2 style={{
                          fontSize: '16px',
                          fontWeight: 700,
                          margin: 0,
                          color: TEXT_PRIMARY,
                          letterSpacing: '-0.2px',
                        }}>
                          {teamKey}
                        </h2>
                      )}
                      <span style={{
                        display: 'inline-block',
                        padding: '2px 10px',
                        borderRadius: '999px',
                        fontSize: '11px',
                        fontWeight: 600,
                        background: teamKey !== 'Other' ? `${AMBER}15` : 'rgba(255,255,255,0.04)',
                        color: teamKey !== 'Other' ? AMBER : TEXT_DIM,
                        border: `1px solid ${teamKey !== 'Other' ? `${AMBER}25` : BORDER}`,
                      }}>
                        {teamEntries.length} scrim{teamEntries.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                      )
                    })()}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {teamEntries.map(({ scrim, viewingAsTeam2 }) => {
                        const isExpanded = expandedId === scrim.id
                        const isHovered = hoveredId === scrim.id

                        // For dual-team scrims viewed from team2's perspective, flip results
                        const flipResult = (r: 'win' | 'loss' | 'draw' | null) => {
                          if (!viewingAsTeam2 || !r) return r
                          if (r === 'win') return 'loss' as const
                          if (r === 'loss') return 'win' as const
                          return r
                        }
                        const flipScore = (score: string | null) => {
                          if (!viewingAsTeam2 || !score) return score
                          const parts = score.split('-').map(s => s.trim())
                          return parts.length === 2 ? `${parts[1]}-${parts[0]}` : score
                        }
                        // Opponent name from the other team's perspective
                        const effectiveOpponent = viewingAsTeam2
                          ? (scrim.teamName ?? scrim.maps[0]?.opponent ?? 'Unknown')
                          : (scrim.opponentName ?? scrim.maps[0]?.opponent ?? 'Unknown')

                        // Compute quick record for expanded card (with perspective flip)
                        const record = scrim.maps.reduce(
                          (acc, m) => {
                            const result = flipResult(m.result)
                            if (result === 'win') acc.wins++
                            else if (result === 'loss') acc.losses++
                            else if (result === 'draw') acc.draws++
                            return acc
                          },
                          { wins: 0, losses: 0, draws: 0 },
                        )

                return (
                  <div
                    key={scrim.id}
                    style={{
                      ...CARD_STYLE,
                      overflow: 'hidden',
                      transition: 'all 0.2s',
                      borderColor: isExpanded ? `${CYAN}33` : isHovered ? `${CYAN}22` : BORDER,
                      boxShadow: isExpanded
                        ? `0 0 24px ${CYAN}11, 0 4px 12px rgba(0,0,0,0.2)`
                        : isHovered
                          ? `0 0 16px ${CYAN}08`
                          : 'none',
                    }}
                    onMouseEnter={() => setHoveredId(scrim.id)}
                    onMouseLeave={() => setHoveredId(null)}
                  >
                    {/* Scrim header row */}
                    <div
                      onClick={() => setExpandedId(isExpanded ? null : scrim.id)}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '16px 20px',
                        cursor: 'pointer',
                        transition: 'background 0.15s',
                        background: isHovered ? 'rgba(6, 182, 212, 0.03)' : 'transparent',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                        <span style={{
                          fontSize: '11px',
                          color: isExpanded ? CYAN : TEXT_DIM,
                          transition: 'all 0.2s',
                          transform: isExpanded ? 'rotate(90deg)' : 'none',
                          display: 'inline-block',
                        }}>
                          ▶
                        </span>
                        <div>
                          <div style={{
                            fontWeight: 700,
                            fontSize: '15px',
                            color: TEXT_PRIMARY,
                            letterSpacing: '-0.2px',
                          }}>
                            {scrim.name}
                          </div>
                          <div style={{
                            fontSize: '12px',
                            color: TEXT_DIM,
                            marginTop: '3px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                          }}>
                            <span>{formatDate(scrim.date)}</span>
                            <span style={{
                              width: '3px',
                              height: '3px',
                              borderRadius: '50%',
                              background: TEXT_DIM,
                              display: 'inline-block',
                            }} />
                            <span style={{ color: CYAN }}>
                              {scrim.mapCount} map{scrim.mapCount !== 1 ? 's' : ''}
                            </span>
                            {/* Team badge */}
                            {scrim.teamName && (
                              <>
                                <span style={{
                                  width: '3px',
                                  height: '3px',
                                  borderRadius: '50%',
                                  background: TEXT_DIM,
                                  display: 'inline-block',
                                }} />
                                <span style={{
                                  color: AMBER,
                                  fontWeight: 600,
                                  fontSize: '11px',
                                  padding: '1px 8px',
                                  borderRadius: '10px',
                                  background: `${AMBER}12`,
                                  border: `1px solid ${AMBER}22`,
                                  letterSpacing: '0.3px',
                                }}>
                                  {scrim.teamName}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{
                          fontSize: '10px',
                          padding: '3px 10px',
                          borderRadius: '12px',
                          background: 'rgba(255,255,255,0.04)',
                          border: `1px solid ${BORDER}`,
                          color: TEXT_DIM,
                          fontWeight: 500,
                          letterSpacing: '0.3px',
                        }}>
                          {scrim.creatorEmail.split('@')[0]}
                        </span>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(scrim.id) }}
                          disabled={deleting === scrim.id}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: RED,
                            cursor: 'pointer',
                            fontSize: '14px',
                            padding: '4px 8px',
                            borderRadius: '6px',
                            opacity: deleting === scrim.id ? 0.4 : 0.6,
                            transition: 'opacity 0.2s',
                          }}
                          title="Delete scrim"
                        >
                          {deleting === scrim.id ? '⏳' : '🗑'}
                        </button>
                      </div>
                    </div>

                    {/* Expanded map list with scores */}
                    {isExpanded && (
                      <div style={{
                        borderTop: `1px solid ${BORDER}`,
                        padding: '12px 20px 16px',
                        background: 'rgba(6, 182, 212, 0.02)',
                      }}>
                        {/* Opponent name + inline edit */}
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          marginBottom: '12px',
                          paddingBottom: '10px',
                          borderBottom: `1px solid ${BORDER}`,
                        }}>
                          <span style={{ fontSize: '12px', color: TEXT_DIM, flexShrink: 0 }}>Opponent:</span>
                          {editingOpponentScrimId === scrim.id ? (
                            <div style={{ position: 'relative', flex: 1, maxWidth: '280px' }}>
                              <input
                                ref={opponentInputRef}
                                type="text"
                                value={opponentInput}
                                onChange={e => handleOpponentInputChange(e.target.value)}
                                onFocus={() => setShowSuggestions(true)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault()
                                    saveOpponentName(scrim.id, opponentInput)
                                  } else if (e.key === 'Escape') {
                                    setEditingOpponentScrimId(null)
                                    setShowSuggestions(false)
                                  }
                                }}
                                placeholder="Type opponent name..."
                                disabled={savingOpponent}
                                style={{
                                  width: '100%',
                                  padding: '5px 10px',
                                  borderRadius: '6px',
                                  border: `1px solid ${CYAN}44`,
                                  background: 'rgba(6, 182, 212, 0.06)',
                                  color: TEXT_PRIMARY,
                                  fontSize: '12px',
                                  fontFamily: "'Inter', sans-serif",
                                  outline: 'none',
                                  boxSizing: 'border-box',
                                }}
                              />
                              {showSuggestions && opponentSuggestions.length > 0 && (
                                <div
                                  ref={suggestionsRef}
                                  style={{
                                    position: 'absolute',
                                    top: '100%',
                                    left: 0,
                                    right: 0,
                                    marginTop: '4px',
                                    background: '#111827',
                                    border: `1px solid ${BORDER}`,
                                    borderRadius: '8px',
                                    maxHeight: '200px',
                                    overflowY: 'auto',
                                    zIndex: 100,
                                    boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                                  }}
                                >
                                  {opponentSuggestions.map(name => (
                                    <button
                                      key={name}
                                      onClick={() => {
                                        setOpponentInput(name)
                                        saveOpponentName(scrim.id, name)
                                      }}
                                      style={{
                                        display: 'block',
                                        width: '100%',
                                        padding: '8px 12px',
                                        border: 'none',
                                        background: 'transparent',
                                        color: TEXT_SECONDARY,
                                        fontSize: '12px',
                                        textAlign: 'left',
                                        cursor: 'pointer',
                                        fontFamily: "'Inter', sans-serif",
                                        transition: 'background 0.1s, color 0.1s',
                                      }}
                                      onMouseEnter={e => {
                                        e.currentTarget.style.background = `${CYAN}11`
                                        e.currentTarget.style.color = TEXT_PRIMARY
                                      }}
                                      onMouseLeave={e => {
                                        e.currentTarget.style.background = 'transparent'
                                        e.currentTarget.style.color = TEXT_SECONDARY
                                      }}
                                    >
                                      {name}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          ) : (
                            <>
                              <span style={{
                                fontSize: '12px',
                                color: (viewingAsTeam2 || scrim.opponentName) ? CYAN : TEXT_DIM,
                                fontWeight: (viewingAsTeam2 || scrim.opponentName) ? 600 : 400,
                              }}>
                                {effectiveOpponent}
                                {scrim.opponentName && (
                                  <span style={{ fontSize: '10px', color: TEXT_DIM, fontWeight: 400, marginLeft: '6px' }}>✓ renamed</span>
                                )}
                              </span>
                              <button
                                onClick={e => { e.stopPropagation(); startEditingOpponent(scrim) }}
                                title="Rename opponent"
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  cursor: 'pointer',
                                  fontSize: '12px',
                                  color: TEXT_DIM,
                                  padding: '2px 4px',
                                  borderRadius: '4px',
                                  transition: 'color 0.15s',
                                  flexShrink: 0,
                                }}
                                onMouseEnter={e => { e.currentTarget.style.color = CYAN }}
                                onMouseLeave={e => { e.currentTarget.style.color = TEXT_DIM }}
                              >
                                ✏️
                              </button>
                            </>
                          )}
                        </div>

                        {/* Quick record summary */}
                        {(record.wins > 0 || record.losses > 0 || record.draws > 0) && (
                          <div style={{
                            display: 'flex',
                            gap: '12px',
                            marginBottom: '12px',
                            paddingBottom: '10px',
                            borderBottom: `1px solid ${BORDER}`,
                          }}>
                            <span style={{ fontSize: '12px', color: TEXT_DIM }}>Record:</span>
                            {record.wins > 0 && (
                              <span style={{ fontSize: '12px', color: GREEN, fontWeight: 600 }}>
                                {record.wins}W
                              </span>
                            )}
                            {record.losses > 0 && (
                              <span style={{ fontSize: '12px', color: RED, fontWeight: 600 }}>
                                {record.losses}L
                              </span>
                            )}
                            {record.draws > 0 && (
                              <span style={{ fontSize: '12px', color: AMBER, fontWeight: 600 }}>
                                {record.draws}D
                              </span>
                            )}
                          </div>
                        )}

                        {scrim.maps.length === 0 ? (
                          <p style={{ fontSize: '13px', color: TEXT_DIM, padding: '12px 0', textAlign: 'center' }}>
                            No maps found
                          </p>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {scrim.maps.map((map) => {
                              const isMapHovered = hoveredMapId === map.id
                              const effectiveResult = flipResult(map.result)
                              const effectiveScore = flipScore(map.score)
                              const effectiveMapOpponent = viewingAsTeam2
                                ? (scrim.teamName ?? map.opponent)
                                : map.opponent
                              const resultInfo = effectiveResult ? RESULT_COLORS[effectiveResult] : null

                              return (
                                <a
                                  key={map.id}
                                  href={map.mapDataId ? `/admin/scrim-map?mapId=${map.mapDataId}` : '#'}
                                  style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    padding: '10px 14px',
                                    borderRadius: '8px',
                                    background: isMapHovered ? 'rgba(6, 182, 212, 0.06)' : 'rgba(255,255,255,0.02)',
                                    border: `1px solid ${isMapHovered ? `${CYAN}22` : BORDER}`,
                                    textDecoration: 'none',
                                    color: 'inherit',
                                    fontSize: '13px',
                                    transition: 'all 0.15s',
                                  }}
                                  onMouseEnter={() => setHoveredMapId(map.id)}
                                  onMouseLeave={() => setHoveredMapId(null)}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                                    {/* Map name */}
                                    <span style={{
                                      fontWeight: 600,
                                      color: isMapHovered ? TEXT_PRIMARY : TEXT_SECONDARY,
                                      transition: 'color 0.15s',
                                      minWidth: '120px',
                                    }}>
                                      🗺 {map.name}
                                    </span>

                                    {/* Opponent */}
                                    {effectiveMapOpponent && (
                                      <span style={{
                                        fontSize: '12px',
                                        color: TEXT_DIM,
                                      }}>
                                        vs {effectiveMapOpponent}
                                      </span>
                                    )}

                                    {/* Score + result badge */}
                                    {effectiveScore && resultInfo && (
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                                        title={map.estimated ? 'Estimated — match ended without a final score record (e.g. practice mode). Score derived from available round data.' : undefined}
                                      >
                                        <span style={{
                                          fontSize: '12px',
                                          fontWeight: 700,
                                          color: map.estimated ? AMBER : TEXT_SECONDARY,
                                          fontVariantNumeric: 'tabular-nums',
                                        }}>
                                          {map.estimated ? '~' : ''}{effectiveScore}
                                        </span>
                                        <span style={{
                                          fontSize: '10px',
                                          fontWeight: 700,
                                          padding: '2px 6px',
                                          borderRadius: '4px',
                                          background: resultInfo.bg,
                                          color: resultInfo.text,
                                          letterSpacing: '0.5px',
                                        }}>
                                          {resultInfo.label}
                                        </span>
                                        {map.estimated && (
                                          <span style={{
                                            fontSize: '9px',
                                            fontWeight: 700,
                                            padding: '1px 5px',
                                            borderRadius: '3px',
                                            background: `${AMBER}12`,
                                            color: AMBER,
                                            border: `1px solid ${AMBER}22`,
                                            letterSpacing: '0.5px',
                                            textTransform: 'uppercase',
                                          }}>
                                            est
                                          </span>
                                        )}
                                      </div>
                                    )}
                                  </div>

                                  {/* View Stats link */}
                                  {map.mapDataId ? (
                                    <span style={{
                                      fontSize: '12px',
                                      color: GREEN,
                                      fontWeight: 600,
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                      textShadow: `0 0 12px ${GREEN}33`,
                                      flexShrink: 0,
                                    }}>
                                      View Stats →
                                    </span>
                                  ) : (
                                    <span style={{ fontSize: '12px', color: TEXT_DIM, flexShrink: 0 }}>
                                      No data
                                    </span>
                                  )}
                                </a>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
                      })}
                    </div>
                  </div>
                )
              })
            })()}

            {/* Pagination */}
            {pagination && pagination.totalPages > 1 && (
              <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: '8px',
                marginTop: '32px',
              }}>
                <button
                  onClick={() => fetchScrims(pagination.page - 1)}
                  disabled={pagination.page <= 1}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: `1px solid ${BORDER}`,
                    background: BG_CARD,
                    color: TEXT_PRIMARY,
                    cursor: pagination.page <= 1 ? 'not-allowed' : 'pointer',
                    opacity: pagination.page <= 1 ? 0.3 : 1,
                    fontSize: '13px',
                    fontWeight: 600,
                    transition: 'all 0.2s',
                    fontFamily: "'Inter', sans-serif",
                  }}
                >
                  ← Previous
                </button>
                <span style={{
                  padding: '8px 16px',
                  fontSize: '12px',
                  color: TEXT_DIM,
                  fontWeight: 500,
                }}>
                  Page {pagination.page} of {pagination.totalPages}
                </span>
                <button
                  onClick={() => fetchScrims(pagination.page + 1)}
                  disabled={pagination.page >= pagination.totalPages}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: `1px solid ${BORDER}`,
                    background: BG_CARD,
                    color: TEXT_PRIMARY,
                    cursor: pagination.page >= pagination.totalPages ? 'not-allowed' : 'pointer',
                    opacity: pagination.page >= pagination.totalPages ? 0.3 : 1,
                    fontSize: '13px',
                    fontWeight: 600,
                    transition: 'all 0.2s',
                    fontFamily: "'Inter', sans-serif",
                  }}
                >
                  Next →
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Delete confirmation modal */}
      {confirmDeleteId !== null && (
        <div
          onClick={() => setConfirmDeleteId(null)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            animation: 'fadeIn 0.15s ease-out',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#111827',
              border: `1px solid ${BORDER}`,
              borderRadius: '16px',
              padding: '28px 32px',
              maxWidth: '420px',
              width: '90%',
              boxShadow: `0 0 40px rgba(0,0,0,0.5), 0 0 80px ${RED}11`,
              animation: 'slideUp 0.2s ease-out',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                background: `${RED}15`,
                border: `1px solid ${RED}25`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '18px',
                flexShrink: 0,
              }}>
                🗑
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: TEXT_PRIMARY }}>
                  Delete Scrim
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: '13px', color: TEXT_SECONDARY }}>
                  This action cannot be undone
                </p>
              </div>
            </div>
            <p style={{
              margin: '0 0 24px',
              fontSize: '13px',
              color: TEXT_SECONDARY,
              lineHeight: 1.5,
            }}>
              Are you sure you want to delete this scrim and all its data? This includes all map stats, player records, and analytics.
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setConfirmDeleteId(null)}
                style={{
                  padding: '9px 20px',
                  borderRadius: '8px',
                  border: `1px solid ${BORDER}`,
                  background: 'rgba(255,255,255,0.04)',
                  color: TEXT_SECONDARY,
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: 600,
                  fontFamily: "'Inter', sans-serif",
                  transition: 'all 0.15s',
                }}
              >
                Cancel
              </button>
              <button
                onClick={executeDelete}
                style={{
                  padding: '9px 20px',
                  borderRadius: '8px',
                  border: `1px solid ${RED}44`,
                  background: `${RED}18`,
                  color: RED,
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: 700,
                  fontFamily: "'Inter', sans-serif",
                  transition: 'all 0.15s',
                }}
              >
                Delete Scrim
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error toast */}
      {deleteError && (
        <div
          onClick={() => setDeleteError(null)}
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            zIndex: 9998,
            padding: '12px 20px',
            borderRadius: '10px',
            background: '#1c1012',
            border: `1px solid ${RED}33`,
            color: RED,
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            boxShadow: `0 4px 20px rgba(0,0,0,0.4), 0 0 20px ${RED}11`,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            animation: 'slideUp 0.2s ease-out',
          }}
        >
          <span>❌</span>
          {deleteError}
        </div>
      )}

      {/* Modal animations */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(10px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  )
}

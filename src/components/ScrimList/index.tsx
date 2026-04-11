'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Search, Trash2, ChevronRight, Edit3, Users, X, BarChart3 } from 'lucide-react'
import ScrimAnalyticsTabs from '@/components/ScrimAnalyticsTabs'

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

/* ─── Result color mapping ─── */
const RESULT_INFO: Record<string, { cls: string; label: string }> = {
  win: { cls: 'scrim-map-row__result--win', label: 'W' },
  loss: { cls: 'scrim-map-row__result--loss', label: 'L' },
  draw: { cls: 'scrim-map-row__result--draw', label: 'D' },
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
    <>
    <ScrimAnalyticsTabs activeTab="scrims" />
    <div className="scrim-page">
      <div className="scrim-page__container">
        {/* Header */}
        <div className="scrim-page__header">
          <div>
            <h1 className="scrim-page__title">Scrim Analytics</h1>
            <p className="scrim-page__subtitle">
              {pagination ? `${pagination.total} scrim${pagination.total !== 1 ? 's' : ''} uploaded` : 'Loading…'}
            </p>
          </div>
          <a href="/admin/scrim-upload" className="scrim-upload-btn">
            + Upload Scrim
          </a>
        </div>

        {/* Navigation */}
        <div className="scrim-nav">
          <a href="/admin/scrim-players" className="scrim-nav__link">
            <Users size={14} /> All Players
          </a>
        </div>

        {/* Search Bar */}
        <div className="scrim-search">
          <div className="scrim-search__input-wrapper">
            <Search size={14} className="scrim-search__icon" />
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Search scrims..."
              className="scrim-search__input"
            />
          </div>
          {searchText && (
            <button onClick={() => setSearchText('')} className="scrim-search__clear">
              <X size={14} /> Clear
            </button>
          )}
        </div>

        {loading ? (
          <div className="scrim-loading">
            Loading scrims…
          </div>
        ) : scrims.length === 0 ? (
          <div className="scrim-empty">
            <div className="scrim-empty__icon"><BarChart3 size={40} /></div>
            <p className="scrim-empty__title">
              {debouncedSearch ? 'No scrims match your search' : 'No scrims uploaded yet'}
            </p>
            <p className="scrim-empty__hint">
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
                if (s.teamName2 && s.teamName2 !== s.teamName) {
                  const key2 = s.teamName2
                  const group2 = teamGroups.get(key2) ?? []
                  group2.push({ scrim: s, viewingAsTeam2: true })
                  teamGroups.set(key2, group2)
                }
              }
              const sortedKeys = [...teamGroups.keys()].sort((a, b) => {
                if (a === 'Other') return 1
                if (b === 'Other') return -1
                return a.localeCompare(b)
              })
              return sortedKeys.map((teamKey) => {
                const teamEntries = teamGroups.get(teamKey)!
                return (
                  <div key={teamKey} className="scrim-team-group">
                    {(() => {
                      const firstEntry = teamEntries[0]
                      const firstScrim = firstEntry?.scrim
                      const teamIdForLink = firstEntry?.viewingAsTeam2 && firstScrim?.payloadTeamId2
                        ? firstScrim.payloadTeamId2
                        : firstScrim?.payloadTeamId ?? null
                      const teamHref = teamIdForLink
                        ? `/admin/scrim-team?teamId=${teamIdForLink}`
                        : null
                      return (
                        <div className="scrim-team-group__header">
                          {teamHref ? (
                            <a href={teamHref} className="scrim-team-group__name">
                              {teamKey} →
                            </a>
                          ) : (
                            <h2 className="scrim-team-group__name">{teamKey}</h2>
                          )}
                          <span className="scrim-team-group__count">
                            {teamEntries.length} scrim{teamEntries.length !== 1 ? 's' : ''}
                          </span>
                        </div>
                      )
                    })()}
                    <div className="scrim-team-group__scrims">
                      {teamEntries.map(({ scrim, viewingAsTeam2 }) => {
                        const isExpanded = expandedId === scrim.id

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
                        const effectiveOpponent = viewingAsTeam2
                          ? (scrim.teamName ?? scrim.maps[0]?.opponent ?? 'Unknown')
                          : (scrim.opponentName ?? scrim.maps[0]?.opponent ?? 'Unknown')

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
                            className={`scrim-card ${isExpanded ? 'scrim-card--expanded' : ''}`}
                          >
                            {/* Scrim header row */}
                            <div
                              onClick={() => setExpandedId(isExpanded ? null : scrim.id)}
                              className="scrim-card__row"
                              style={{ cursor: 'pointer' }}
                            >
                              <div className="scrim-card__info">
                                <ChevronRight
                                  size={12}
                                  className={`scrim-card__expand-icon ${isExpanded ? 'scrim-card__expand-icon--open' : ''}`}
                                />
                                <div>
                                  <div className="scrim-card__title">{scrim.name}</div>
                                  <div className="scrim-card__meta">
                                    <span>{formatDate(scrim.date)}</span>
                                    <span className="scrim-dot" />
                                    <span className="scrim-card__maps-count">
                                      {scrim.mapCount} map{scrim.mapCount !== 1 ? 's' : ''}
                                    </span>
                                    {scrim.teamName && (
                                      <>
                                        <span className="scrim-dot" />
                                        <span className="scrim-card__team-badge">{scrim.teamName}</span>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="scrim-card__actions">
                                <span className="scrim-card__creator">
                                  {scrim.creatorEmail.split('@')[0]}
                                </span>
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleDelete(scrim.id) }}
                                  disabled={deleting === scrim.id}
                                  className="scrim-card__delete-btn"
                                  title="Delete scrim"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>

                            {/* Expanded map list */}
                            {isExpanded && (
                              <div className="scrim-expanded">
                                {/* Opponent name + inline edit */}
                                <div className="scrim-expanded-meta">
                                  <span className="scrim-expanded-meta__label">Opponent:</span>
                                  {editingOpponentScrimId === scrim.id ? (
                                    <div className="scrim-opponent-edit">
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
                                        className="scrim-opponent-edit__input"
                                      />
                                      {showSuggestions && opponentSuggestions.length > 0 && (
                                        <div ref={suggestionsRef} className="scrim-opponent-edit__suggestions">
                                          {opponentSuggestions.map(name => (
                                            <button
                                              key={name}
                                              onClick={() => {
                                                setOpponentInput(name)
                                                saveOpponentName(scrim.id, name)
                                              }}
                                              className="scrim-opponent-edit__suggestion"
                                            >
                                              {name}
                                            </button>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    <>
                                      <span className={`scrim-expanded-meta__value ${(viewingAsTeam2 || scrim.opponentName) ? 'scrim-expanded-meta__value--highlighted' : ''}`}>
                                        {effectiveOpponent}
                                        {scrim.opponentName && (
                                          <span className="scrim-expanded-meta__label" style={{ marginLeft: '6px' }}>✓ renamed</span>
                                        )}
                                      </span>
                                      <button
                                        onClick={e => { e.stopPropagation(); startEditingOpponent(scrim) }}
                                        title="Rename opponent"
                                        className="scrim-opponent-edit__cancel-btn"
                                      >
                                        <Edit3 size={12} />
                                      </button>
                                    </>
                                  )}
                                </div>

                                {/* Quick record summary */}
                                {(record.wins > 0 || record.losses > 0 || record.draws > 0) && (
                                  <div className="scrim-expanded-meta">
                                    <span className="scrim-expanded-meta__label">Record:</span>
                                    <div className="scrim-record">
                                      {record.wins > 0 && <span className="scrim-record__win">{record.wins}W</span>}
                                      {record.losses > 0 && <span className="scrim-record__loss">{record.losses}L</span>}
                                      {record.draws > 0 && <span className="scrim-record__draw">{record.draws}D</span>}
                                    </div>
                                  </div>
                                )}

                                {scrim.maps.length === 0 ? (
                                  <p className="scrim-expanded-meta__label" style={{ padding: '12px 0', textAlign: 'center' }}>
                                    No maps found
                                  </p>
                                ) : (
                                  <div className="scrim-expanded__maps">
                                    {scrim.maps.map((map) => {
                                      const effectiveResult = flipResult(map.result)
                                      const effectiveScore = flipScore(map.score)
                                      const effectiveMapOpponent = viewingAsTeam2
                                        ? (scrim.teamName ?? map.opponent)
                                        : map.opponent
                                      const resultInfo = effectiveResult ? RESULT_INFO[effectiveResult] : null

                                      return (
                                        <a
                                          key={map.id}
                                          href={map.mapDataId ? `/admin/scrim-map?mapId=${map.mapDataId}` : '#'}
                                          className="scrim-map-row"
                                        >
                                          <div className="scrim-map-row__info">
                                            <span className="scrim-map-row__name">{map.name}</span>
                                            {effectiveMapOpponent && (
                                              <span className="scrim-map-row__opponent">vs {effectiveMapOpponent}</span>
                                            )}
                                            {effectiveScore && resultInfo && (
                                              <div className="scrim-map-row__score-group"
                                                title={map.estimated ? 'Estimated — match ended without a final score record' : undefined}
                                              >
                                                <span className={`scrim-map-row__score ${map.estimated ? 'scrim-stat--highlight' : ''}`}>
                                                  {map.estimated ? '~' : ''}{effectiveScore}
                                                </span>
                                                <span className={`scrim-map-row__result ${resultInfo.cls}`}>
                                                  {resultInfo.label}
                                                </span>
                                                {map.estimated && (
                                                  <span className="scrim-est-badge">est</span>
                                                )}
                                              </div>
                                            )}
                                          </div>
                                          {map.mapDataId ? (
                                            <span className="scrim-map-row__view-link">View Stats →</span>
                                          ) : (
                                            <span className="scrim-expanded-meta__label">No data</span>
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
              <div className="scrim-pagination">
                <button
                  onClick={() => fetchScrims(pagination.page - 1)}
                  disabled={pagination.page <= 1}
                  className="scrim-pagination__btn"
                >
                  ← Previous
                </button>
                <span className="scrim-pagination__info">
                  Page {pagination.page} of {pagination.totalPages}
                </span>
                <button
                  onClick={() => fetchScrims(pagination.page + 1)}
                  disabled={pagination.page >= pagination.totalPages}
                  className="scrim-pagination__btn"
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
        <div className="scrim-modal-backdrop" onClick={() => setConfirmDeleteId(null)}>
          <div className="scrim-modal" onClick={(e) => e.stopPropagation()}>
            <div className="scrim-modal__header">
              <div className="scrim-modal__icon scrim-modal__icon--danger">
                <Trash2 size={18} />
              </div>
              <div>
                <h3 className="scrim-modal__title">Delete Scrim</h3>
                <p className="scrim-modal__subtitle">This action cannot be undone</p>
              </div>
            </div>
            <p className="scrim-modal__body">
              Are you sure you want to delete this scrim and all its data? This includes all map stats, player records, and analytics.
            </p>
            <div className="scrim-modal__actions">
              <button onClick={() => setConfirmDeleteId(null)} className="scrim-modal__btn scrim-modal__btn--cancel">
                Cancel
              </button>
              <button onClick={executeDelete} className="scrim-modal__btn scrim-modal__btn--danger">
                Delete Scrim
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error toast */}
      {deleteError && (
        <div onClick={() => setDeleteError(null)} className="scrim-toast scrim-toast--error">
          <X size={14} />
          {deleteError}
        </div>
      )}
    </div>
    </>
  )
}

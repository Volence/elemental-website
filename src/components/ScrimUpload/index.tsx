'use client'

import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react'

type UploadState = 'idle' | 'uploading' | 'success' | 'error'

interface UploadResult {
  message: string
  scrims?: Array<{
    scrimId: number
    name: string
    mapsProcessed: number
    mapNames: string[]
  }>
  scrimId: number
  name: string
  mapsProcessed: number
  mapNames: string[]
  error?: string
}

interface TeamOption {
  id: number
  name: string
}

interface PersonOption {
  id: number
  name: string
  gameAliases: string[]
}

interface PreviewData {
  maps: { fileName: string; mapName: string; mapType: string; team1: string; team2: string }[]
  players: Record<string, string[]>
  team1: string
  team2: string
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

type Step = 'form' | 'mapping'

/**
 * Admin view for uploading ScrimTime log files.
 * Two-step flow:
 *   Step 1: Select team, name, and files
 *   Step 2: Preview parsed data & map player names to People
 */
export default function ScrimUploadView() {
  // ── Step 1 state ──
  const [files, setFiles] = useState<File[]>([])
  const [scrimName, setScrimName] = useState('')
  const [teamId, setTeamId] = useState<string>('')
  const [teams, setTeams] = useState<TeamOption[]>([])
  const [teamsLoading, setTeamsLoading] = useState(true)
  const [teamDropdownOpen, setTeamDropdownOpen] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // ── Step 2 state ──
  const [step, setStep] = useState<Step>('form')
  const [preview, setPreview] = useState<PreviewData | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [ourTeam, setOurTeam] = useState<string>('')
  const [people, setPeople] = useState<PersonOption[]>([])
  const [playerMappings, setPlayerMappings] = useState<Record<string, string>>({}) // playerName → personId
  const [mappingDropdownOpen, setMappingDropdownOpen] = useState<string | null>(null)

  // ── Search in mapping dropdowns ──
  const [mappingSearch, setMappingSearch] = useState<string>('')
  const [searchResults, setSearchResults] = useState<PersonOption[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [extraPeople, setExtraPeople] = useState<PersonOption[]>([]) // cache for search-selected people not on roster

  // ── Dual team (internal scrims) ──
  const [dualTeam, setDualTeam] = useState(false)
  const [teamId2, setTeamId2] = useState<string>('')
  const [teamId2DropdownOpen, setTeamId2DropdownOpen] = useState(false)
  const [people2, setPeople2] = useState<PersonOption[]>([])
  const [playerMappings2, setPlayerMappings2] = useState<Record<string, string>>({})
  const [mappingDropdownOpen2, setMappingDropdownOpen2] = useState<string | null>(null)
  const [mappingSearch2, setMappingSearch2] = useState<string>('')

  // ── Opponent name override state ──
  const [opponentNameOverride, setOpponentNameOverride] = useState('')
  const [opponentSuggestions, setOpponentSuggestions] = useState<string[]>([])
  const [showOpponentSuggestions, setShowOpponentSuggestions] = useState(false)
  const opponentInputRef = useRef<HTMLInputElement>(null)
  const opponentSuggestionsRef = useRef<HTMLDivElement>(null)
  const opponentDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Upload state ──
  const [state, setState] = useState<UploadState>('idle')
  const [result, setResult] = useState<UploadResult | null>(null)

  const selectedTeamName = useMemo(() => {
    if (teamsLoading) return 'Loading teams…'
    if (!teamId) return 'Select a team'
    return teams.find((t) => String(t.id) === teamId)?.name || 'Select a team'
  }, [teamId, teams, teamsLoading])

  const opponentTeamName = useMemo(() => {
    if (!preview) return ''
    return ourTeam === preview.team1 ? preview.team2 : preview.team1
  }, [preview, ourTeam])

  const opponentPlayers = useMemo(() => {
    if (!preview || !opponentTeamName) return []
    return preview.players[opponentTeamName] || []
  }, [preview, opponentTeamName])

  const selectedTeam2Name = useMemo(() => {
    if (!teamId2) return 'Select second team'
    return teams.find((t) => String(t.id) === teamId2)?.name || 'Select second team'
  }, [teamId2, teams])

  // Fetch teams on mount
  useEffect(() => {
    fetch('/api/team-list')
      .then((res) => res.json())
      .then((data) => {
        setTeams(data.teams || [])
        setTeamsLoading(false)
      })
      .catch(() => setTeamsLoading(false))
  }, [])

  // Fetch people when team changes (for auto-resolved initial matches)
  useEffect(() => {
    if (!teamId) {
      setPeople([])
      return
    }
    fetch(`/api/people-by-team?teamId=${teamId}`)
      .then((res) => res.json())
      .then((data) => setPeople(data.people || []))
      .catch(() => setPeople([]))
  }, [teamId])

  // Fetch people for team 2 when it changes
  useEffect(() => {
    if (!teamId2) {
      setPeople2([])
      return
    }
    fetch(`/api/people-by-team?teamId=${teamId2}`)
      .then((res) => res.json())
      .then((data) => setPeople2(data.people || []))
      .catch(() => setPeople2([]))
  }, [teamId2])

  // Search people globally (across all People) when typing in mapping dropdown
  const handleMappingSearch = useCallback((q: string) => {
    setMappingSearch(q)
    if (searchDebounce.current) clearTimeout(searchDebounce.current)
    if (q.length < 2) {
      setSearchResults([])
      return
    }
    setSearchLoading(true)
    searchDebounce.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/people-search?q=${encodeURIComponent(q)}`)
        const data = await res.json()
        setSearchResults(data.people || [])
      } catch {
        setSearchResults([])
      } finally {
        setSearchLoading(false)
      }
    }, 250)
  }, []);

  // Auto-resolve player mappings when preview data or people change
  useEffect(() => {
    if (!preview || !ourTeam || people.length === 0) return

    const ourPlayers = preview.players[ourTeam] || []
    const newMappings: Record<string, string> = {}

    for (const playerName of ourPlayers) {
      const match = people.find((p) =>
        p.gameAliases.some((alias) => alias.toLowerCase() === playerName.toLowerCase()),
      )
      if (match) {
        newMappings[playerName] = String(match.id)
      }
    }

    setPlayerMappings(newMappings)
  }, [preview, ourTeam, people])

  // Auto-resolve player mappings for team 2
  useEffect(() => {
    if (!preview || !dualTeam || !opponentTeamName || people2.length === 0) return

    const team2Players = preview.players[opponentTeamName] || []
    const newMappings: Record<string, string> = {}

    for (const playerName of team2Players) {
      const match = people2.find((p) =>
        p.gameAliases.some((alias) => alias.toLowerCase() === playerName.toLowerCase()),
      )
      if (match) {
        newMappings[playerName] = String(match.id)
      }
    }

    setPlayerMappings2(newMappings)
  }, [preview, dualTeam, people2, opponentTeamName])

  // ── File handlers ──
  const handleFiles = useCallback((newFiles: FileList | File[]) => {
    const txtFiles = Array.from(newFiles).filter(
      (f) => f.name.endsWith('.txt') || f.name.endsWith('.csv'),
    )
    setFiles((prev) => [...prev, ...txtFiles])
    setResult(null)
    setState('idle')
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setDragActive(false)
      if (e.dataTransfer.files) handleFiles(e.dataTransfer.files)
    },
    [handleFiles],
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
  }, [])

  const removeFile = useCallback((index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }, [])

  // ── Preview (Step 1 → Step 2) ──
  const handlePreview = useCallback(async () => {
    if (files.length === 0 || !teamId) return

    setPreviewLoading(true)
    const formData = new FormData()
    files.forEach((file) => formData.append('files', file))

    try {
      const res = await fetch('/api/scrim-preview', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()

      if (res.ok) {
        setPreview(data)
        setOurTeam(data.team1) // Default to team 1
        setStep('mapping')
      } else {
        setState('error')
        setResult({ message: data.error || 'Preview failed', error: data.error } as UploadResult)
      }
    } catch {
      setState('error')
      setResult({ message: 'Network error', error: 'Network error' } as UploadResult)
    } finally {
      setPreviewLoading(false)
    }
  }, [files, teamId])

  // ── Opponent Autocomplete Logic ──
  const fetchOpponentSuggestions = useCallback(async (q: string) => {
    try {
      const res = await fetch(`/api/scrim-opponents?q=${encodeURIComponent(q)}`)
      const data = await res.json()
      setOpponentSuggestions(data.opponents ?? [])
      setShowOpponentSuggestions(true)
    } catch {
      setOpponentSuggestions([])
    }
  }, [])

  const handleOpponentInputChange = useCallback((val: string) => {
    setOpponentNameOverride(val)
    if (opponentDebounce.current) clearTimeout(opponentDebounce.current)
    opponentDebounce.current = setTimeout(() => {
      fetchOpponentSuggestions(val)
    }, 200)
  }, [fetchOpponentSuggestions])

  // Close opponent suggestions on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (
        opponentSuggestionsRef.current &&
        !opponentSuggestionsRef.current.contains(e.target as Node) &&
        opponentInputRef.current &&
        !opponentInputRef.current.contains(e.target as Node)
      ) {
        setShowOpponentSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Initialize opponent name from preview data when it loads
  useEffect(() => {
    if (preview && ourTeam) {
      const opponent = ourTeam === preview.team1 ? preview.team2 : preview.team1
      setOpponentNameOverride(opponent || '')
    }
  }, [preview, ourTeam])

  const ourPlayers = useMemo(() => {
    if (!preview || !ourTeam) return []
    return preview.players[ourTeam] || []
  }, [preview, ourTeam])



  // ── Upload (Step 2 → Commit) ──
  const handleUpload = useCallback(async () => {
    if (files.length === 0 || !teamId) return

    setState('uploading')
    setResult(null)

    const formData = new FormData()
    files.forEach((file) => formData.append('files', file))
    if (scrimName.trim()) {
      formData.append('scrimName', scrimName.trim())
    }
    formData.append('teamId', teamId)
    formData.append('playerMappings', JSON.stringify(playerMappings))

    // Dual-team data
    if (dualTeam && teamId2) {
      formData.append('teamId2', teamId2)
      formData.append('playerMappings2', JSON.stringify(playerMappings2))
      // Auto-set opponent name to the selected second team's name
      const team2Name = teams.find((t) => String(t.id) === teamId2)?.name
      if (team2Name && team2Name !== opponentTeamName) {
        formData.append('opponentName', team2Name)
      }
    } else {
      // Send opponent name override if it differs from the raw detected name
      const rawOpponent = opponentTeamName
      const trimmedOverride = opponentNameOverride.trim()
      if (trimmedOverride && trimmedOverride !== rawOpponent) {
        formData.append('opponentName', trimmedOverride)
      }
    }

    try {
      const res = await fetch('/api/scrim-upload', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()

      if (res.ok) {
        setState('success')
        setResult(data)
        setFiles([])
        setScrimName('')
        setStep('form')
        setPreview(null)
        setOpponentNameOverride('')
        setDualTeam(false)
        setTeamId2('')
        setPlayerMappings2({})
      } else {
        setState('error')
        setResult({ message: data.error || 'Upload failed', error: data.error } as UploadResult)
      }
    } catch {
      setState('error')
      setResult({ message: 'Network error - could not reach the server', error: 'Network error' } as UploadResult)
    }
  }, [files, scrimName, teamId, playerMappings, opponentNameOverride, opponentTeamName, dualTeam, teamId2, playerMappings2])

  // ─────── RENDER ───────

  return (
    <div
      style={{
        background: BG,
        minHeight: '100%',
        padding: '40px',
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
        color: TEXT_PRIMARY,
      }}
    >
      <div style={{ maxWidth: '720px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <a
              href="/admin/scrims"
              style={{
                color: TEXT_DIM,
                textDecoration: 'none',
                fontSize: '13px',
                transition: 'color 0.2s',
              }}
            >
              ← Back to scrims
            </a>
          </div>
          <h1
            style={{
              fontSize: '28px',
              fontWeight: 800,
              margin: '8px 0 0 0',
              color: CYAN,
              textShadow: `0 0 30px ${CYAN}33`,
              letterSpacing: '-0.5px',
            }}
          >
            Scrim Log Upload
          </h1>
          <div
            style={{
              width: '60px',
              height: '3px',
              background: `linear-gradient(90deg, ${CYAN}, ${CYAN}00)`,
              borderRadius: '2px',
              marginTop: '8px',
            }}
          />

          {/* Step indicator */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginTop: '16px',
              fontSize: '13px',
            }}
          >
            <span
              style={{
                color: step === 'form' ? CYAN : GREEN,
                fontWeight: 600,
              }}
            >
              {step === 'form' ? '① Select Files' : '✓ Files Selected'}
            </span>
            <span style={{ color: TEXT_DIM }}>→</span>
            <span
              style={{
                color: step === 'mapping' ? CYAN : TEXT_DIM,
                fontWeight: step === 'mapping' ? 600 : 400,
              }}
            >
              ② Map Players
            </span>
          </div>
        </div>

        {/* ════════════════════════════════════════════
            STEP 1: File Selection Form
            ════════════════════════════════════════════ */}
        {step === 'form' && (
          <>
            {/* Description */}
            <p
              style={{
                color: TEXT_SECONDARY,
                marginTop: '-16px',
                marginBottom: '24px',
                fontSize: '14px',
                lineHeight: 1.5,
              }}
            >
              Upload{' '}
              <code
                style={{
                  background: 'rgba(6, 182, 212, 0.1)',
                  border: `1px solid ${CYAN}33`,
                  borderRadius: '4px',
                  padding: '1px 6px',
                  fontSize: '12px',
                  color: CYAN,
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              >
                .txt
              </code>{' '}
              log files from the ScrimTime workshop code (
              <code
                style={{
                  background: 'rgba(6, 182, 212, 0.1)',
                  border: `1px solid ${CYAN}33`,
                  borderRadius: '4px',
                  padding: '1px 6px',
                  fontSize: '12px',
                  color: CYAN,
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              >
                DKEEH
              </code>
              ). Each file represents one map.
            </p>

            {/* Scrim Name */}
            <div style={{ marginBottom: '24px' }}>
              <label
                htmlFor="scrimName"
                style={{
                  display: 'block',
                  marginBottom: '8px',
                  fontWeight: 600,
                  fontSize: '13px',
                  color: TEXT_SECONDARY,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}
              >
                Scrim Name{' '}
                <span style={{ color: TEXT_DIM, fontWeight: 400, textTransform: 'none' }}>
                  (optional)
                </span>
              </label>
              <input
                id="scrimName"
                type="text"
                value={scrimName}
                onChange={(e) => setScrimName(e.target.value)}
                placeholder="e.g. vs Team Neon - Week 3"
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: `1px solid ${BORDER}`,
                  borderRadius: '10px',
                  background: BG_CARD,
                  color: TEXT_PRIMARY,
                  fontSize: '14px',
                  fontFamily: "'Inter', sans-serif",
                  outline: 'none',
                  transition: 'border-color 0.2s, box-shadow 0.2s',
                  boxSizing: 'border-box',
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = `${CYAN}44`
                  e.target.style.boxShadow = `0 0 16px ${CYAN}11`
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = BORDER
                  e.target.style.boxShadow = 'none'
                }}
              />
              <p style={{ margin: '6px 0 0', fontSize: '11px', color: TEXT_DIM }}>
                Usually formatted as <span style={{ color: TEXT_SECONDARY }}>YourTeam vs EnemyTeam</span> (e.g. &quot;Rock vs Lunar&quot;)
              </p>
            </div>

            {/* Team Selection — Custom dropdown */}
            <div style={{ marginBottom: '24px', position: 'relative' }}>
              <label
                style={{
                  display: 'block',
                  marginBottom: '8px',
                  fontWeight: 600,
                  fontSize: '13px',
                  color: TEXT_SECONDARY,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}
              >
                Team <span style={{ color: RED, fontWeight: 400 }}>*</span>
              </label>
              <button
                type="button"
                onClick={() => setTeamDropdownOpen(!teamDropdownOpen)}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: `1px solid ${teamId ? BORDER : 'rgba(239, 68, 68, 0.3)'}`,
                  borderRadius: '10px',
                  background: BG_CARD,
                  color: teamId ? TEXT_PRIMARY : TEXT_DIM,
                  fontSize: '14px',
                  fontFamily: "'Inter', sans-serif",
                  outline: 'none',
                  transition: 'border-color 0.2s, box-shadow 0.2s',
                  boxSizing: 'border-box',
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <span>{selectedTeamName}</span>
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 16 16"
                  fill="none"
                  style={{
                    transform: teamDropdownOpen ? 'rotate(180deg)' : 'none',
                    transition: 'transform 0.2s',
                    flexShrink: 0,
                  }}
                >
                  <path
                    d="M4 6L8 10L12 6"
                    stroke="rgba(255,255,255,0.4)"
                    strokeWidth="1.5"
                    fill="none"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
              {teamDropdownOpen && (
                <>
                  <div
                    onClick={() => setTeamDropdownOpen(false)}
                    style={{ position: 'fixed', inset: 0, zIndex: 99 }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      marginTop: '4px',
                      background: '#141824',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '10px',
                      boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                      zIndex: 100,
                      maxHeight: '240px',
                      overflowY: 'auto',
                      padding: '4px',
                    }}
                  >
                    {teams.map((team) => (
                      <button
                        key={team.id}
                        type="button"
                        onClick={() => {
                          setTeamId(String(team.id))
                          setTeamDropdownOpen(false)
                        }}
                        style={{
                          width: '100%',
                          padding: '10px 14px',
                          background:
                            String(team.id) === teamId
                              ? 'rgba(6, 182, 212, 0.12)'
                              : 'transparent',
                          color: String(team.id) === teamId ? CYAN : TEXT_PRIMARY,
                          border: 'none',
                          borderRadius: '6px',
                          fontSize: '14px',
                          fontFamily: "'Inter', sans-serif",
                          cursor: 'pointer',
                          textAlign: 'left',
                          transition: 'background 0.15s',
                          display: 'block',
                        }}
                        onMouseEnter={(e) => {
                          if (String(team.id) !== teamId) {
                            e.currentTarget.style.background = 'rgba(255,255,255,0.06)'
                          }
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background =
                            String(team.id) === teamId
                              ? 'rgba(6, 182, 212, 0.12)'
                              : 'transparent'
                        }}
                      >
                        {team.name}
                      </button>
                    ))}
                  </div>
                </>
              )}
              <p style={{ color: TEXT_DIM, fontSize: '12px', marginTop: '6px' }}>
                Which team does this scrim belong to?
              </p>
            </div>

            {/* Drop Zone */}
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => inputRef.current?.click()}
              style={{
                border: `2px dashed ${dragActive ? GREEN : 'rgba(255,255,255,0.12)'}`,
                borderRadius: '14px',
                padding: '56px 24px',
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'all 0.25s',
                background: dragActive ? 'rgba(34, 197, 94, 0.05)' : BG_CARD,
                marginBottom: '24px',
                backdropFilter: 'blur(12px)',
                boxShadow: dragActive ? `0 0 24px ${GREEN}11` : 'none',
              }}
            >
              <input
                ref={inputRef}
                type="file"
                accept=".txt,.csv"
                multiple
                onChange={(e) => e.target.files && handleFiles(e.target.files)}
                style={{ display: 'none' }}
              />
              <div style={{ fontSize: '36px', marginBottom: '12px', opacity: 0.7 }}>📂</div>
              <p
                style={{
                  fontWeight: 600,
                  fontSize: '15px',
                  color: dragActive ? GREEN : TEXT_PRIMARY,
                  transition: 'color 0.2s',
                }}
              >
                {dragActive ? 'Drop files here' : 'Drag & drop log files, or click to browse'}
              </p>
              <p style={{ color: TEXT_DIM, fontSize: '12px', marginTop: '8px' }}>
                Accepts .txt and .csv files
              </p>
            </div>

            {/* File List */}
            {files.length > 0 && (
              <div style={{ marginBottom: '24px' }}>
                <h3
                  style={{
                    fontSize: '13px',
                    fontWeight: 600,
                    marginBottom: '10px',
                    color: TEXT_SECONDARY,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}
                >
                  {files.length} file{files.length !== 1 ? 's' : ''} selected
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {files.map((file, i) => (
                    <div
                      key={`${file.name}-${i}`}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '10px 14px',
                        background: BG_CARD,
                        border: `1px solid ${BORDER}`,
                        borderRadius: '8px',
                        fontSize: '13px',
                      }}
                    >
                      <span
                        style={{
                          fontFamily: "'JetBrains Mono', monospace",
                          fontSize: '12px',
                          color: TEXT_SECONDARY,
                        }}
                      >
                        📄 {file.name}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          removeFile(i)
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: RED,
                          cursor: 'pointer',
                          fontSize: '14px',
                          padding: '2px 6px',
                          opacity: 0.6,
                          transition: 'opacity 0.2s',
                        }}
                        title="Remove file"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Preview & Continue Button */}
            <button
              onClick={handlePreview}
              disabled={files.length === 0 || !teamId || previewLoading}
              style={{
                width: '100%',
                padding: '14px',
                borderRadius: '10px',
                border: 'none',
                background:
                  previewLoading
                    ? 'rgba(255,255,255,0.08)'
                    : files.length === 0 || !teamId
                      ? 'rgba(255,255,255,0.05)'
                      : `linear-gradient(135deg, ${CYAN}, ${CYAN}cc)`,
                color: '#fff',
                fontWeight: 700,
                fontSize: '14px',
                cursor: files.length === 0 || !teamId || previewLoading ? 'not-allowed' : 'pointer',
                opacity: files.length === 0 || !teamId ? 0.4 : 1,
                transition: 'all 0.25s',
                fontFamily: "'Inter', sans-serif",
                boxShadow:
                  files.length > 0 && teamId && !previewLoading
                    ? `0 0 20px ${CYAN}33, 0 4px 12px rgba(0,0,0,0.3)`
                    : 'none',
              }}
            >
              {previewLoading ? '⏳ Parsing files…' : 'Preview & Map Players →'}
            </button>
          </>
        )}

        {/* ════════════════════════════════════════════
            STEP 2: Player Mapping
            ════════════════════════════════════════════ */}
        {step === 'mapping' && preview && (
          <>
            {/* Back button */}
            <button
              type="button"
              onClick={() => setStep('form')}
              style={{
                background: 'none',
                border: 'none',
                color: TEXT_DIM,
                cursor: 'pointer',
                fontSize: '13px',
                padding: 0,
                marginBottom: '16px',
                transition: 'color 0.2s',
              }}
            >
              ← Back to file selection
            </button>

            {/* Map Summary */}
            <div
              style={{
                padding: '16px 20px',
                background: BG_CARD,
                border: `1px solid ${BORDER}`,
                borderRadius: '12px',
                marginBottom: '24px',
              }}
            >
              <h3
                style={{
                  fontSize: '13px',
                  fontWeight: 600,
                  color: TEXT_SECONDARY,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  marginBottom: '12px',
                }}
              >
                {preview.maps.length} Map{preview.maps.length !== 1 ? 's' : ''} Found
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {preview.maps.map((map, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      fontSize: '13px',
                    }}
                  >
                    <span style={{ color: CYAN, fontWeight: 600 }}>{map.mapName}</span>
                    <span style={{ color: TEXT_DIM }}>·</span>
                    <span style={{ color: TEXT_DIM }}>{map.mapType}</span>
                    <span style={{ color: TEXT_DIM }}>·</span>
                    <span style={{ color: TEXT_SECONDARY }}>
                      {map.team1} vs {map.team2}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Team Selector: Which team is yours? */}
            <div
              style={{
                padding: '16px 20px',
                background: BG_CARD,
                border: `1px solid ${BORDER}`,
                borderRadius: '12px',
                marginBottom: '24px',
              }}
            >
              <h3
                style={{
                  fontSize: '13px',
                  fontWeight: 600,
                  color: TEXT_SECONDARY,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  marginBottom: '12px',
                }}
              >
                Which team is yours?
              </h3>
              <div style={{ display: 'flex', gap: '8px' }}>
                {[preview.team1, preview.team2].map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setOurTeam(t)}
                    style={{
                      flex: 1,
                      padding: '12px',
                      borderRadius: '8px',
                      border: `1px solid ${ourTeam === t ? CYAN : BORDER}`,
                      background: ourTeam === t ? `${CYAN}11` : 'transparent',
                      color: ourTeam === t ? CYAN : TEXT_SECONDARY,
                      fontWeight: ourTeam === t ? 600 : 400,
                      fontSize: '14px',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      fontFamily: "'Inter', sans-serif",
                    }}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Player Mapping Table */}
            <div
              style={{
                padding: '16px 20px',
                background: BG_CARD,
                border: `1px solid ${BORDER}`,
                borderRadius: '12px',
                marginBottom: '24px',
              }}
            >
              <h3
                style={{
                  fontSize: '13px',
                  fontWeight: 600,
                  color: TEXT_SECONDARY,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  marginBottom: '4px',
                }}
              >
                Player Mapping: {ourTeam}
              </h3>
              <p style={{ color: TEXT_DIM, fontSize: '12px', marginBottom: '16px' }}>
                Link in-game names to roster members. Auto-matched players are shown in green.
              </p>

              {ourPlayers.length === 0 ? (
                <p style={{ color: TEXT_DIM, fontSize: '13px', fontStyle: 'italic' }}>
                  No players found for this team in the log files.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {ourPlayers.map((playerName) => {
                    const mappedId = playerMappings[playerName]
                    const mappedPerson = mappedId
                      ? people.find((p) => String(p.id) === mappedId) || extraPeople.find((p) => String(p.id) === mappedId)
                      : null
                    const isOpen = mappingDropdownOpen === playerName

                    return (
                      <div
                        key={playerName}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 14px',
                          background: 'rgba(255,255,255,0.02)',
                          border: `1px solid ${BORDER}`,
                          borderRadius: '8px',
                          gap: '12px',
                        }}
                      >
                        {/* Log name */}
                        <span
                          style={{
                            fontFamily: "'JetBrains Mono', monospace",
                            fontSize: '13px',
                            color: TEXT_PRIMARY,
                            minWidth: '120px',
                          }}
                        >
                          {playerName}
                        </span>

                        <span style={{ color: TEXT_DIM }}>→</span>

                        {/* Person dropdown */}
                        <div style={{ flex: 1, position: 'relative' }}>
                          <button
                            type="button"
                            onClick={() =>
                              setMappingDropdownOpen(isOpen ? null : playerName)
                            }
                            style={{
                              width: '100%',
                              padding: '8px 12px',
                              border: `1px solid ${mappedPerson ? `${GREEN}44` : BORDER}`,
                              borderRadius: '6px',
                              background: mappedPerson
                                ? 'rgba(34, 197, 94, 0.06)'
                                : 'transparent',
                              color: mappedPerson ? GREEN : TEXT_DIM,
                              fontSize: '13px',
                              fontFamily: "'Inter', sans-serif",
                              cursor: 'pointer',
                              textAlign: 'left',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                            }}
                          >
                            <span>
                              {mappedPerson ? `✓ ${mappedPerson.name}` : 'Select person…'}
                            </span>
                            <svg
                              width="10"
                              height="10"
                              viewBox="0 0 16 16"
                              fill="none"
                              style={{ flexShrink: 0 }}
                            >
                              <path
                                d="M4 6L8 10L12 6"
                                stroke="rgba(255,255,255,0.3)"
                                strokeWidth="1.5"
                                fill="none"
                                strokeLinecap="round"
                              />
                            </svg>
                          </button>
                          {isOpen && (
                            <>
                              <div
                                onClick={() => setMappingDropdownOpen(null)}
                                style={{ position: 'fixed', inset: 0, zIndex: 99 }}
                              />
                              <div
                                style={{
                                  position: 'absolute',
                                  top: '100%',
                                  left: 0,
                                  right: 0,
                                  marginTop: '4px',
                                  background: '#141824',
                                  border: '1px solid rgba(255,255,255,0.1)',
                                  borderRadius: '8px',
                                  boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                                  zIndex: 100,
                                  maxHeight: '260px',
                                  overflowY: 'auto',
                                  padding: '4px',
                                }}
                              >
                                {/* Search input */}
                                <div style={{ padding: '4px 4px 6px' }}>
                                  <input
                                    autoFocus
                                    placeholder="Search all people…"
                                    value={mappingSearch}
                                    onChange={(e) => handleMappingSearch(e.target.value)}
                                    style={{
                                      width: '100%',
                                      padding: '8px 10px',
                                      border: `1px solid ${BORDER}`,
                                      borderRadius: '6px',
                                      background: 'rgba(255,255,255,0.04)',
                                      color: TEXT_PRIMARY,
                                      fontSize: '12px',
                                      fontFamily: "'Inter', sans-serif",
                                      outline: 'none',
                                      boxSizing: 'border-box',
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                </div>
                                {/* Skip option */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setPlayerMappings((prev) => {
                                      const next = { ...prev }
                                      delete next[playerName]
                                      return next
                                    })
                                    setMappingDropdownOpen(null)
                                  }}
                                  style={{
                                    width: '100%',
                                    padding: '8px 12px',
                                    background:
                                      !mappedId ? 'rgba(255,255,255,0.06)' : 'transparent',
                                    color: TEXT_DIM,
                                    border: 'none',
                                    borderRadius: '4px',
                                    fontSize: '13px',
                                    fontFamily: "'Inter', sans-serif",
                                    cursor: 'pointer',
                                    textAlign: 'left',
                                    fontStyle: 'italic',
                                  }}
                                >
                                  Skip (unmapped)
                                </button>
                                {people.map((person) => (
                                  <button
                                    key={person.id}
                                    type="button"
                                    onClick={() => {
                                      setPlayerMappings((prev) => ({
                                        ...prev,
                                        [playerName]: String(person.id),
                                      }))
                                      setMappingDropdownOpen(null)
                                    }}
                                    style={{
                                      width: '100%',
                                      padding: '8px 12px',
                                      background:
                                        String(person.id) === mappedId
                                          ? 'rgba(6, 182, 212, 0.12)'
                                          : 'transparent',
                                      color:
                                        String(person.id) === mappedId ? CYAN : TEXT_PRIMARY,
                                      border: 'none',
                                      borderRadius: '4px',
                                      fontSize: '13px',
                                      fontFamily: "'Inter', sans-serif",
                                      cursor: 'pointer',
                                      textAlign: 'left',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                    }}
                                    onMouseEnter={(e) => {
                                      if (String(person.id) !== mappedId) {
                                        e.currentTarget.style.background =
                                          'rgba(255,255,255,0.06)'
                                      }
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.background =
                                        String(person.id) === mappedId
                                          ? 'rgba(6, 182, 212, 0.12)'
                                          : 'transparent'
                                    }}
                                  >
                                    <span>{person.name}</span>
                                    {person.gameAliases.length > 0 && (
                                      <span
                                        style={{
                                          fontSize: '11px',
                                          color: TEXT_DIM,
                                          fontFamily: "'JetBrains Mono', monospace",
                                        }}
                                      >
                                        {person.gameAliases.join(', ')}
                                      </span>
                                    )}
                                  </button>
                                ))}
                                {/* Global search results */}
                                {mappingSearch.length >= 2 && (
                                  <>
                                    <div style={{ padding: '4px 12px', fontSize: '11px', color: TEXT_DIM, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.3px', marginTop: '4px' }}>
                                      {searchLoading ? 'Searching…' : `Search Results${searchResults.length > 0 ? ` (${searchResults.length})` : ''}`}
                                    </div>
                                    {searchResults.filter(sr => !people.some(p => p.id === sr.id)).map((person) => (
                                      <button
                                        key={`search-${person.id}`}
                                        type="button"
                                        onClick={() => {
                                          setPlayerMappings((prev) => ({
                                            ...prev,
                                            [playerName]: String(person.id),
                                          }))
                                          setExtraPeople((prev) => prev.some(p => p.id === person.id) ? prev : [...prev, person])
                                          setMappingDropdownOpen(null)
                                          setMappingSearch('')
                                          setSearchResults([])
                                        }}
                                        style={{
                                          width: '100%',
                                          padding: '8px 12px',
                                          background: String(person.id) === mappedId ? 'rgba(6, 182, 212, 0.12)' : 'transparent',
                                          color: String(person.id) === mappedId ? CYAN : TEXT_PRIMARY,
                                          border: 'none',
                                          borderRadius: '4px',
                                          fontSize: '13px',
                                          fontFamily: "'Inter', sans-serif",
                                          cursor: 'pointer',
                                          textAlign: 'left',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'space-between',
                                        }}
                                        onMouseEnter={(e) => { if (String(person.id) !== mappedId) e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
                                        onMouseLeave={(e) => { e.currentTarget.style.background = String(person.id) === mappedId ? 'rgba(6, 182, 212, 0.12)' : 'transparent' }}
                                      >
                                        <span>{person.name}</span>
                                        {person.gameAliases.length > 0 && (
                                          <span style={{ fontSize: '11px', color: TEXT_DIM, fontFamily: "'JetBrains Mono', monospace" }}>
                                            {person.gameAliases.join(', ')}
                                          </span>
                                        )}
                                      </button>
                                    ))}
                                  </>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Mapping summary */}
              {ourPlayers.length > 0 && (
                <div
                  style={{
                    marginTop: '12px',
                    fontSize: '12px',
                    color: TEXT_DIM,
                  }}
                >
                  {Object.keys(playerMappings).length} of {ourPlayers.length} players mapped
                  {Object.keys(playerMappings).length === ourPlayers.length && (
                    <span style={{ color: GREEN, marginLeft: '8px' }}>✓ All mapped</span>
                  )}
                </div>
              )}
            </div>

            {/* ═══ Dual Team Section ═══ */}
            <div
              style={{
                padding: '16px 20px',
                background: BG_CARD,
                border: `1px solid ${BORDER}`,
                borderRadius: '12px',
                marginBottom: '24px',
              }}
            >
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  color: TEXT_SECONDARY,
                }}
              >
                <input
                  type="checkbox"
                  checked={dualTeam}
                  onChange={(e) => {
                    setDualTeam(e.target.checked)
                    if (!e.target.checked) {
                      setTeamId2('')
                      setPlayerMappings2({})
                    }
                  }}
                  style={{
                    width: '16px',
                    height: '16px',
                    accentColor: CYAN,
                    cursor: 'pointer',
                  }}
                />
                Both teams are internal (map players for both sides)
              </label>

              {dualTeam && (
                <div style={{ marginTop: '16px' }}>
                  {/* Second team selector */}
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ fontSize: '12px', color: TEXT_DIM, marginBottom: '6px', display: 'block' }}>
                      Second Team (opponent side)
                    </label>
                    <div style={{ position: 'relative' }}>
                      <button
                        type="button"
                        onClick={() => setTeamId2DropdownOpen(!teamId2DropdownOpen)}
                        style={{
                          width: '100%',
                          padding: '10px 14px',
                          border: `1px solid ${teamId2 ? BORDER : 'rgba(239, 68, 68, 0.3)'}`,
                          borderRadius: '8px',
                          background: BG_CARD,
                          color: teamId2 ? TEXT_PRIMARY : TEXT_DIM,
                          fontSize: '13px',
                          fontFamily: "'Inter', sans-serif",
                          outline: 'none',
                          cursor: 'pointer',
                          textAlign: 'left',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}
                      >
                        <span>{selectedTeam2Name}</span>
                        <svg width="10" height="10" viewBox="0 0 16 16" fill="none" style={{ transform: teamId2DropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}>
                          <path d="M4 6L8 10L12 6" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" fill="none" strokeLinecap="round" />
                        </svg>
                      </button>
                      {teamId2DropdownOpen && (
                        <>
                          <div onClick={() => setTeamId2DropdownOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 99 }} />
                          <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '4px', background: '#141824', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', boxShadow: '0 8px 32px rgba(0,0,0,0.5)', zIndex: 100, maxHeight: '200px', overflowY: 'auto', padding: '4px' }}>
                            {teams.filter(t => String(t.id) !== teamId).map((team) => (
                              <button
                                key={team.id}
                                type="button"
                                onClick={() => { setTeamId2(String(team.id)); setTeamId2DropdownOpen(false) }}
                                style={{
                                  width: '100%',
                                  padding: '8px 12px',
                                  background: String(team.id) === teamId2 ? 'rgba(6, 182, 212, 0.12)' : 'transparent',
                                  color: String(team.id) === teamId2 ? CYAN : TEXT_PRIMARY,
                                  border: 'none',
                                  borderRadius: '4px',
                                  fontSize: '13px',
                                  fontFamily: "'Inter', sans-serif",
                                  cursor: 'pointer',
                                  textAlign: 'left',
                                }}
                                onMouseEnter={(e) => { if (String(team.id) !== teamId2) e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
                                onMouseLeave={(e) => { e.currentTarget.style.background = String(team.id) === teamId2 ? 'rgba(6, 182, 212, 0.12)' : 'transparent' }}
                              >
                                {team.name}
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Team 2 Player Mapping */}
                  {teamId2 && opponentPlayers.length > 0 && (
                    <>
                      <h4 style={{ fontSize: '12px', fontWeight: 600, color: TEXT_SECONDARY, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
                        Player Mapping: {opponentTeamName}
                      </h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {opponentPlayers.map((playerName) => {
                          const mappedId = playerMappings2[playerName]
                          const mappedPerson = mappedId ? people2.find((p) => String(p.id) === mappedId) || extraPeople.find((p) => String(p.id) === mappedId) : null
                          const isOpen = mappingDropdownOpen2 === playerName

                          return (
                            <div key={playerName} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(255,255,255,0.02)', border: `1px solid ${BORDER}`, borderRadius: '8px', gap: '12px' }}>
                              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px', color: TEXT_PRIMARY, minWidth: '120px' }}>{playerName}</span>
                              <span style={{ color: TEXT_DIM }}>→</span>
                              <div style={{ flex: 1, position: 'relative' }}>
                                <button
                                  type="button"
                                  onClick={() => setMappingDropdownOpen2(isOpen ? null : playerName)}
                                  style={{
                                    width: '100%', padding: '8px 12px',
                                    border: `1px solid ${mappedPerson ? `${GREEN}44` : BORDER}`,
                                    borderRadius: '6px',
                                    background: mappedPerson ? 'rgba(34, 197, 94, 0.06)' : 'transparent',
                                    color: mappedPerson ? GREEN : TEXT_DIM,
                                    fontSize: '13px', fontFamily: "'Inter', sans-serif",
                                    cursor: 'pointer', textAlign: 'left',
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                  }}
                                >
                                  <span>{mappedPerson ? `✓ ${mappedPerson.name}` : 'Select person…'}</span>
                                  <svg width="10" height="10" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}><path d="M4 6L8 10L12 6" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" fill="none" strokeLinecap="round" /></svg>
                                </button>
                                {isOpen && (
                                  <>
                                    <div onClick={() => setMappingDropdownOpen2(null)} style={{ position: 'fixed', inset: 0, zIndex: 99 }} />
                                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '4px', background: '#141824', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', boxShadow: '0 8px 32px rgba(0,0,0,0.5)', zIndex: 100, maxHeight: '260px', overflowY: 'auto', padding: '4px' }}>
                                      {/* Search */}
                                      <div style={{ padding: '4px 4px 6px' }}>
                                        <input
                                          autoFocus
                                          placeholder="Search all people…"
                                          value={mappingSearch2}
                                          onChange={(e) => { setMappingSearch2(e.target.value); handleMappingSearch(e.target.value) }}
                                          style={{ width: '100%', padding: '8px 10px', border: `1px solid ${BORDER}`, borderRadius: '6px', background: 'rgba(255,255,255,0.04)', color: TEXT_PRIMARY, fontSize: '12px', fontFamily: "'Inter', sans-serif", outline: 'none', boxSizing: 'border-box' }}
                                          onClick={(e) => e.stopPropagation()}
                                        />
                                      </div>
                                      {/* Skip */}
                                      <button type="button" onClick={() => { setPlayerMappings2((prev) => { const next = { ...prev }; delete next[playerName]; return next }); setMappingDropdownOpen2(null) }} style={{ width: '100%', padding: '8px 12px', background: !mappedId ? 'rgba(255,255,255,0.06)' : 'transparent', color: TEXT_DIM, border: 'none', borderRadius: '4px', fontSize: '13px', fontFamily: "'Inter', sans-serif", cursor: 'pointer', textAlign: 'left', fontStyle: 'italic' }}>
                                        Skip (unmapped)
                                      </button>
                                      {/* Team roster */}
                                      {people2.map((person) => (
                                        <button key={person.id} type="button" onClick={() => { setPlayerMappings2((prev) => ({ ...prev, [playerName]: String(person.id) })); setMappingDropdownOpen2(null); setMappingSearch2(''); setSearchResults([]) }} style={{ width: '100%', padding: '8px 12px', background: String(person.id) === mappedId ? 'rgba(6, 182, 212, 0.12)' : 'transparent', color: String(person.id) === mappedId ? CYAN : TEXT_PRIMARY, border: 'none', borderRadius: '4px', fontSize: '13px', fontFamily: "'Inter', sans-serif", cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }} onMouseEnter={(e) => { if (String(person.id) !== mappedId) e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }} onMouseLeave={(e) => { e.currentTarget.style.background = String(person.id) === mappedId ? 'rgba(6, 182, 212, 0.12)' : 'transparent' }}>
                                          <span>{person.name}</span>
                                          {person.gameAliases.length > 0 && (<span style={{ fontSize: '11px', color: TEXT_DIM, fontFamily: "'JetBrains Mono', monospace" }}>{person.gameAliases.join(', ')}</span>)}
                                        </button>
                                      ))}
                                      {/* Global search results */}
                                      {mappingSearch2.length >= 2 && (
                                        <>
                                          <div style={{ padding: '4px 12px', fontSize: '11px', color: TEXT_DIM, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.3px', marginTop: '4px' }}>
                                            {searchLoading ? 'Searching…' : `Search Results${searchResults.length > 0 ? ` (${searchResults.length})` : ''}`}
                                          </div>
                                          {searchResults.filter(sr => !people2.some(p => p.id === sr.id)).map((person) => (
                                            <button key={`search-${person.id}`} type="button" onClick={() => { setPlayerMappings2((prev) => ({ ...prev, [playerName]: String(person.id) })); setExtraPeople((prev) => prev.some(p => p.id === person.id) ? prev : [...prev, person]); setMappingDropdownOpen2(null); setMappingSearch2(''); setSearchResults([]) }} style={{ width: '100%', padding: '8px 12px', background: String(person.id) === mappedId ? 'rgba(6, 182, 212, 0.12)' : 'transparent', color: String(person.id) === mappedId ? CYAN : TEXT_PRIMARY, border: 'none', borderRadius: '4px', fontSize: '13px', fontFamily: "'Inter', sans-serif", cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }} onMouseEnter={(e) => { if (String(person.id) !== mappedId) e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }} onMouseLeave={(e) => { e.currentTarget.style.background = String(person.id) === mappedId ? 'rgba(6, 182, 212, 0.12)' : 'transparent' }}>
                                              <span>{person.name}</span>
                                              {person.gameAliases.length > 0 && (<span style={{ fontSize: '11px', color: TEXT_DIM, fontFamily: "'JetBrains Mono', monospace" }}>{person.gameAliases.join(', ')}</span>)}
                                            </button>
                                          ))}
                                        </>
                                      )}
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                      {/* Mapping summary for team 2 */}
                      <div style={{ marginTop: '8px', fontSize: '12px', color: TEXT_DIM }}>
                        {Object.keys(playerMappings2).length} of {opponentPlayers.length} players mapped
                        {Object.keys(playerMappings2).length === opponentPlayers.length && (
                          <span style={{ color: GREEN, marginLeft: '8px' }}>✓ All mapped</span>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Opponent team info — editable with autocomplete (hidden when dual-team with team selected) */}
            {!dualTeam && opponentTeamName && preview.players[opponentTeamName] && (
              <div
                style={{
                  padding: '16px 20px',
                  background: BG_CARD,
                  border: `1px solid ${BORDER}`,
                  borderRadius: '12px',
                  marginBottom: '24px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                  <span style={{ fontSize: '12px', color: TEXT_DIM, flexShrink: 0 }}>Opponent Name:</span>
                  <div style={{ position: 'relative', flex: 1 }}>
                    <input
                      ref={opponentInputRef}
                      type="text"
                      value={opponentNameOverride}
                      onChange={e => handleOpponentInputChange(e.target.value)}
                      onFocus={() => { fetchOpponentSuggestions(opponentNameOverride); setShowOpponentSuggestions(true) }}
                      placeholder="Type opponent name..."
                      style={{
                        width: '100%',
                        padding: '7px 12px',
                        borderRadius: '8px',
                        border: `1px solid ${CYAN}33`,
                        background: 'rgba(6, 182, 212, 0.05)',
                        color: TEXT_PRIMARY,
                        fontSize: '13px',
                        fontFamily: "'Inter', sans-serif",
                        outline: 'none',
                        boxSizing: 'border-box',
                        transition: 'border-color 0.15s',
                      }}
                    />
                    {showOpponentSuggestions && opponentSuggestions.length > 0 && (
                      <div
                        ref={opponentSuggestionsRef}
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
                              setOpponentNameOverride(name)
                              setShowOpponentSuggestions(false)
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
                  {opponentNameOverride.trim() !== opponentTeamName && opponentNameOverride.trim() && (
                    <span style={{ fontSize: '10px', color: CYAN, flexShrink: 0, fontWeight: 600 }}>✓ renamed</span>
                  )}
                </div>
                <div style={{ fontSize: '12px' }}>
                  <span style={{ color: TEXT_DIM }}>Players: </span>
                  <span style={{ color: TEXT_SECONDARY }}>
                    {preview.players[opponentTeamName].join(', ')}
                  </span>
                </div>
              </div>
            )}

            {/* Upload Button */}
            <button
              onClick={handleUpload}
              disabled={state === 'uploading'}
              style={{
                width: '100%',
                padding: '14px',
                borderRadius: '10px',
                border: 'none',
                background:
                  state === 'uploading'
                    ? 'rgba(255,255,255,0.08)'
                    : `linear-gradient(135deg, ${GREEN}, ${GREEN}cc)`,
                color: '#fff',
                fontWeight: 700,
                fontSize: '14px',
                cursor: state === 'uploading' ? 'not-allowed' : 'pointer',
                transition: 'all 0.25s',
                fontFamily: "'Inter', sans-serif",
                boxShadow:
                  state !== 'uploading'
                    ? `0 0 20px ${GREEN}33, 0 4px 12px rgba(0,0,0,0.3)`
                    : 'none',
              }}
            >
              {state === 'uploading'
                ? '⏳ Uploading & Processing…'
                : `Confirm & Upload ${files.length} File${files.length !== 1 ? 's' : ''}`}
            </button>
          </>
        )}

        {/* ════════════════════════════════════════════
            Result / Error
            ════════════════════════════════════════════ */}
        {result && (
          <div
            style={{
              marginTop: '24px',
              padding: '20px',
              borderRadius: '12px',
              background:
                state === 'success'
                  ? 'rgba(34, 197, 94, 0.06)'
                  : 'rgba(239, 68, 68, 0.06)',
              border: `1px solid ${state === 'success' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
              backdropFilter: 'blur(12px)',
            }}
          >
            <p
              style={{
                fontWeight: 700,
                fontSize: '14px',
                marginBottom: result.scrims ? '12px' : '0',
                color: state === 'success' ? GREEN : RED,
              }}
            >
              {state === 'success' ? '✅' : '❌'} {result.message || (state === 'success' ? 'Scrim uploaded successfully!' : 'Upload failed')}
            </p>

            {state === 'success' && (
              <a
                href="/admin/scrims"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  marginTop: '16px',
                  color: CYAN,
                  textDecoration: 'none',
                  fontSize: '13px',
                  fontWeight: 600,
                }}
              >
                ← View all scrims
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

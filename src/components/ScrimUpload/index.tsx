'use client'

import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import {
  Upload,
  FileText,
  X,
  ArrowLeft,
  Check,
  ChevronDown,
  Loader2,
  AlertCircle,
  FolderOpen,
} from 'lucide-react'
import ScrimAnalyticsTabs from '@/components/ScrimAnalyticsTabs'

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

  const ourPlayers = useMemo(() => {
    if (!preview || !ourTeam) return []
    return preview.players[ourTeam] || []
  }, [preview, ourTeam])

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

    const teamPlayers = preview.players[ourTeam] || []
    const newMappings: Record<string, string> = {}

    for (const playerName of teamPlayers) {
      const match = people.find((p) =>
        p.gameAliases.some((alias) => alias.toLowerCase() === playerName.toLowerCase()),
      )
      if (match) {
        newMappings[playerName] = String(match.id)
      }
    }

    setPlayerMappings((prev) => ({ ...prev, ...newMappings }))
  }, [preview, ourTeam, people])

  // Auto-resolve player mappings for team 2
  useEffect(() => {
    if (!preview || !opponentTeamName || people2.length === 0) return

    const teamPlayers = preview.players[opponentTeamName] || []
    const newMappings: Record<string, string> = {}

    for (const playerName of teamPlayers) {
      const match = people2.find((p) =>
        p.gameAliases.some((alias) => alias.toLowerCase() === playerName.toLowerCase()),
      )
      if (match) {
        newMappings[playerName] = String(match.id)
      }
    }

    setPlayerMappings2((prev) => ({ ...prev, ...newMappings }))
  }, [preview, opponentTeamName, people2])

  // Close opponent suggestions on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        opponentSuggestionsRef.current &&
        !opponentSuggestionsRef.current.contains(e.target as Node) &&
        opponentInputRef.current &&
        !opponentInputRef.current.contains(e.target as Node)
      ) {
        setShowOpponentSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // ── Handlers ──

  const handleFiles = useCallback((fileList: FileList) => {
    const validFiles = Array.from(fileList).filter(
      (f) => f.name.endsWith('.txt') || f.name.endsWith('.csv'),
    )
    setFiles((prev) => [...prev, ...validFiles])
  }, [])

  const removeFile = useCallback((index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragActive(false)
      if (e.dataTransfer.files) handleFiles(e.dataTransfer.files)
    },
    [handleFiles],
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(true)
  }, [])

  const handleDragLeave = useCallback(() => setDragActive(false), [])

  const fetchOpponentSuggestions = useCallback(async (q: string) => {
    if (opponentDebounce.current) clearTimeout(opponentDebounce.current)
    if (q.length < 1) {
      setOpponentSuggestions([])
      return
    }
    opponentDebounce.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/opponent-teams?q=${encodeURIComponent(q)}`)
        const data = await res.json()
        setOpponentSuggestions(data.teams || [])
      } catch {
        setOpponentSuggestions([])
      }
    }, 200)
  }, [])

  const handleOpponentInputChange = useCallback((val: string) => {
    setOpponentNameOverride(val)
    fetchOpponentSuggestions(val)
    setShowOpponentSuggestions(true)
  }, [fetchOpponentSuggestions])

  const handlePreview = useCallback(async () => {
    if (files.length === 0 || !teamId) return
    setPreviewLoading(true)
    try {
      const formData = new FormData()
      files.forEach((f) => formData.append('files', f))
      formData.append('teamId', teamId)
      const res = await fetch('/api/scrim-preview', { method: 'POST', body: formData })
      const data = await res.json()
      if (data.error) {
        alert(data.error)
      } else {
        setPreview(data)
        setStep('mapping')
        if (data.team1) {
          setOurTeam(data.team1)
          setOpponentNameOverride(data.team2 || '')
        }
      }
    } catch {
      alert('Failed to preview files')
    } finally {
      setPreviewLoading(false)
    }
  }, [files, teamId])

  const handleUpload = useCallback(async () => {
    if (!preview || !ourTeam || files.length === 0 || !teamId) return
    setState('uploading')
    try {
      const formData = new FormData()
      files.forEach((f) => formData.append('files', f))
      formData.append('teamId', teamId)
      if (scrimName) formData.append('name', scrimName)
      formData.append('ourTeam', ourTeam)
      formData.append('mappings', JSON.stringify(playerMappings))
      if (opponentNameOverride.trim() && opponentNameOverride.trim() !== opponentTeamName) {
        formData.append('opponentName', opponentNameOverride.trim())
      }
      if (dualTeam && teamId2) {
        formData.append('teamId2', teamId2)
        formData.append('mappings2', JSON.stringify(playerMappings2))
      }
      const res = await fetch('/api/scrim-upload', { method: 'POST', body: formData })
      const data = await res.json()
      if (res.ok) {
        setState('success')
        setResult(data)
      } else {
        setState('error')
        setResult({ message: data.error || 'Upload failed', error: data.error } as UploadResult)
      }
    } catch {
      setState('error')
      setResult({ message: 'Network error - could not reach the server', error: 'Network error' } as UploadResult)
    }
  }, [files, scrimName, teamId, playerMappings, opponentNameOverride, opponentTeamName, dualTeam, teamId2, playerMappings2])

  // ── Helper: render a player mapping row (reused for team 1 and team 2) ──
  const renderMappingRow = (
    playerName: string,
    mappings: Record<string, string>,
    setMappings: React.Dispatch<React.SetStateAction<Record<string, string>>>,
    peopleList: PersonOption[],
    openDropdown: string | null,
    setOpenDropdown: React.Dispatch<React.SetStateAction<string | null>>,
    search: string,
    setSearch: React.Dispatch<React.SetStateAction<string>>,
  ) => {
    const mappedId = mappings[playerName]
    const mappedPerson = mappedId
      ? peopleList.find((p) => String(p.id) === mappedId) || extraPeople.find((p) => String(p.id) === mappedId)
      : null
    const isOpen = openDropdown === playerName

    return (
      <div key={playerName} className="scrim-upload__mapping-row">
        <span className="scrim-upload__mapping-name">{playerName}</span>
        <span className="scrim-upload__mapping-arrow">→</span>
        <div className="scrim-upload__mapping-dropdown-wrap">
          <button
            type="button"
            onClick={() => setOpenDropdown(isOpen ? null : playerName)}
            className={`scrim-upload__person-trigger ${mappedPerson ? 'scrim-upload__person-trigger--mapped' : ''}`}
          >
            <span>{mappedPerson ? `✓ ${mappedPerson.name}` : 'Select person…'}</span>
            <ChevronDown size={10} className="scrim-upload__dropdown-chevron" />
          </button>
          {isOpen && (
            <>
              <div className="scrim-upload__dropdown-backdrop" onClick={() => setOpenDropdown(null)} />
              <div className="scrim-upload__dropdown-menu">
                <div className="scrim-upload__menu-search">
                  <input
                    autoFocus
                    placeholder="Search all people…"
                    value={search}
                    onChange={(e) => handleMappingSearch(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
                <button
                  type="button"
                  className={`scrim-upload__menu-item scrim-upload__menu-item--skip ${!mappedId ? 'scrim-upload__menu-item--active' : ''}`}
                  onClick={() => {
                    setMappings((prev) => {
                      const next = { ...prev }
                      delete next[playerName]
                      return next
                    })
                    setOpenDropdown(null)
                  }}
                >
                  Skip (unmapped)
                </button>
                {peopleList.map((person) => (
                  <button
                    key={person.id}
                    type="button"
                    className={`scrim-upload__menu-item ${String(person.id) === mappedId ? 'scrim-upload__menu-item--selected' : ''}`}
                    onClick={() => {
                      setMappings((prev) => ({ ...prev, [playerName]: String(person.id) }))
                      setOpenDropdown(null)
                    }}
                  >
                    <span>{person.name}</span>
                    {person.gameAliases.length > 0 && (
                      <span className="scrim-upload__menu-item-aliases">
                        {person.gameAliases.join(', ')}
                      </span>
                    )}
                  </button>
                ))}
                {search.length >= 2 && (
                  <>
                    <div className="scrim-upload__menu-divider">
                      {searchLoading ? 'Searching…' : `Search Results${searchResults.length > 0 ? ` (${searchResults.length})` : ''}`}
                    </div>
                    {searchResults.filter(sr => !peopleList.some(p => p.id === sr.id)).map((person) => (
                      <button
                        key={`search-${person.id}`}
                        type="button"
                        className={`scrim-upload__menu-item ${String(person.id) === mappedId ? 'scrim-upload__menu-item--selected' : ''}`}
                        onClick={() => {
                          setMappings((prev) => ({ ...prev, [playerName]: String(person.id) }))
                          setExtraPeople((prev) => prev.some(p => p.id === person.id) ? prev : [...prev, person])
                          setOpenDropdown(null)
                          setSearch('')
                          setSearchResults([])
                        }}
                      >
                        <span>{person.name}</span>
                        {person.gameAliases.length > 0 && (
                          <span className="scrim-upload__menu-item-aliases">
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
  }

  // ─────── RENDER ───────

  return (
    <>
    <ScrimAnalyticsTabs activeTab="upload" />
    <div className="scrim-upload">
      <div className="scrim-upload__container">
        {/* Header */}
        <div className="scrim-upload__header-wrap">
          <div className="scrim-upload__back-row">
            <a href="/admin/scrims" className="scrim-upload__back-link">
              <ArrowLeft size={12} className="scrim-upload__inline-icon" />
              Back to scrims
            </a>
          </div>
          <h1 className="scrim-upload__title">Scrim Log Upload</h1>
          <div className="scrim-upload__accent-bar" />

          {/* Step indicator */}
          <div className="scrim-upload__steps">
            <span className={`scrim-upload__step ${step === 'form' ? 'scrim-upload__step--active' : 'scrim-upload__step--completed'}`}>
              {step === 'form' ? '① Select Files' : '✓ Files Selected'}
            </span>
            <span className="scrim-upload__step-arrow">→</span>
            <span className={`scrim-upload__step ${step === 'mapping' ? 'scrim-upload__step--active' : 'scrim-upload__step--inactive'}`}>
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
            <p className="scrim-upload__description">
              Upload <code className="scrim-upload__code">.txt</code>{' '}
              log files from the ScrimTime workshop code (
              <code className="scrim-upload__code">DKEEH</code>
              ). Each file represents one map.
            </p>

            {/* Scrim Name */}
            <div className="scrim-upload__field">
              <label htmlFor="scrimName" className="scrim-upload__label">
                Scrim Name{' '}
                <span className="scrim-upload__label-optional">(optional)</span>
              </label>
              <input
                id="scrimName"
                type="text"
                value={scrimName}
                onChange={(e) => setScrimName(e.target.value)}
                placeholder="e.g. vs Team Neon - Week 3"
                className="scrim-upload__input"
              />
              <p className="scrim-upload__hint">
                Usually formatted as <span className="scrim-upload__hint-em">YourTeam vs EnemyTeam</span> (e.g. &quot;Rock vs Lunar&quot;)
              </p>
            </div>

            {/* Team Selection — Custom dropdown */}
            <div className="scrim-upload__field scrim-upload__relative">
              <label className="scrim-upload__label">
                Team <span className="scrim-upload__required">*</span>
              </label>
              <button
                type="button"
                onClick={() => setTeamDropdownOpen(!teamDropdownOpen)}
                className={`scrim-upload__dropdown-trigger ${!teamId ? 'scrim-upload__dropdown-trigger--empty' : ''} ${!teamId ? 'scrim-upload__dropdown-trigger--error' : ''}`}
              >
                <span>{selectedTeamName}</span>
                <ChevronDown
                  size={12}
                  className={`scrim-upload__dropdown-chevron ${teamDropdownOpen ? 'scrim-upload__dropdown-chevron--open' : ''}`}
                />
              </button>
              {teamDropdownOpen && (
                <>
                  <div
                    className="scrim-upload__dropdown-backdrop"
                    onClick={() => setTeamDropdownOpen(false)}
                  />
                  <div className="scrim-upload__dropdown-menu">
                    {teams.map((team) => (
                      <button
                        key={team.id}
                        type="button"
                        onClick={() => {
                          setTeamId(String(team.id))
                          setTeamDropdownOpen(false)
                        }}
                        className={`scrim-upload__dropdown-item ${String(team.id) === teamId ? 'scrim-upload__dropdown-item--selected' : ''}`}
                      >
                        {team.name}
                      </button>
                    ))}
                  </div>
                </>
              )}
              <p className="scrim-upload__hint">
                Which team does this scrim belong to?
              </p>
            </div>

            {/* Drop Zone */}
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => inputRef.current?.click()}
              className={`scrim-upload__dropzone ${dragActive ? 'scrim-upload__dropzone--active' : ''}`}
            >
              <input
                ref={inputRef}
                type="file"
                accept=".txt,.csv"
                multiple
                onChange={(e) => e.target.files && handleFiles(e.target.files)}
                className="scrim-upload__hidden-input"
              />
              <div className="scrim-upload__dropzone-icon">
                <FolderOpen size={36} />
              </div>
              <p className={`scrim-upload__dropzone-text ${dragActive ? 'scrim-upload__dropzone-text--active' : ''}`}>
                {dragActive ? 'Drop files here' : 'Drag & drop log files, or click to browse'}
              </p>
              <p className="scrim-upload__dropzone-hint">
                Accepts .txt and .csv files
              </p>
            </div>

            {/* File List */}
            {files.length > 0 && (
              <div className="scrim-upload__file-list">
                <h3 className="scrim-upload__file-list-header">
                  {files.length} file{files.length !== 1 ? 's' : ''} selected
                </h3>
                <div className="scrim-upload__file-items">
                  {files.map((file, i) => (
                    <div key={`${file.name}-${i}`} className="scrim-upload__file-item">
                      <span className="scrim-upload__file-name">
                        <FileText size={14} /> {file.name}
                      </span>
                      <button
                        onClick={(e) => { e.stopPropagation(); removeFile(i) }}
                        className="scrim-upload__file-remove"
                        title="Remove file"
                      >
                        <X size={14} />
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
              className={`scrim-upload__submit-btn ${previewLoading ? 'scrim-upload__submit-btn--loading' : files.length > 0 && teamId ? 'scrim-upload__submit-btn--preview' : ''}`}
            >
              {previewLoading ? (
                <><Loader2 size={14} className="scrim-upload__spinner" /> Parsing files…</>
              ) : (
                'Preview & Map Players →'
              )}
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
              className="scrim-upload__back-link scrim-upload__step-back"
            >
              <ArrowLeft size={12} className="scrim-upload__inline-icon" />
              Back to file selection
            </button>

            {/* Map Summary */}
            <div className="scrim-upload__section">
              <h3 className="scrim-upload__section-title">
                {preview.maps.length} Map{preview.maps.length !== 1 ? 's' : ''} Found
              </h3>
              <div className="scrim-upload__column">
                {preview.maps.map((map, i) => (
                  <div key={i} className="scrim-upload__map-preview">
                    <span className="scrim-upload__map-name">{map.mapName}</span>
                    <span className="scrim-upload__map-type">·</span>
                    <span className="scrim-upload__map-type">{map.mapType}</span>
                    <span className="scrim-upload__map-type">·</span>
                    <span className="scrim-upload__map-teams">
                      {map.team1} vs {map.team2}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Team Selector: Which team is yours? */}
            <div className="scrim-upload__section">
              <h3 className="scrim-upload__section-title">Which team is yours?</h3>
              <div className="scrim-upload__team-choice">
                {[preview.team1, preview.team2].map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setOurTeam(t)}
                    className={`scrim-upload__team-choice-btn ${ourTeam === t ? 'scrim-upload__team-choice-btn--selected' : ''}`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Player Mapping Table */}
            <div className="scrim-upload__section">
              <h3 className="scrim-upload__section-title">
                Player Mapping: {ourTeam}
              </h3>
              <p className="scrim-upload__section-subtitle">
                Link in-game names to roster members. Auto-matched players are shown in green.
              </p>

              {ourPlayers.length === 0 ? (
                <p className="scrim-upload__hint scrim-upload__hint--italic">
                  No players found for this team in the log files.
                </p>
              ) : (
                <div className="scrim-upload__column">
                  {ourPlayers.map((playerName) =>
                    renderMappingRow(
                      playerName, playerMappings, setPlayerMappings,
                      people, mappingDropdownOpen, setMappingDropdownOpen,
                      mappingSearch, setMappingSearch,
                    )
                  )}
                </div>
              )}

              {/* Mapping summary */}
              {ourPlayers.length > 0 && (
                <div className="scrim-upload__mapping-summary">
                  {Object.keys(playerMappings).length} of {ourPlayers.length} players mapped
                  {Object.keys(playerMappings).length === ourPlayers.length && (
                    <span className="scrim-upload__mapping-complete">
                      <Check size={12} className="scrim-upload__inline-icon--sm" />
                      All mapped
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* ═══ Dual Team Section ═══ */}
            <div className="scrim-upload__section">
              <label className="scrim-upload__checkbox-label">
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
                  className="scrim-upload__checkbox"
                />
                Both teams are internal (map players for both sides)
              </label>

              {dualTeam && (
                <div className="scrim-upload__dual-section">
                  {/* Second team selector */}
                  <div className="scrim-upload__dual-field">
                    <label className="scrim-upload__hint scrim-upload__dual-label">
                      Second Team (opponent side)
                    </label>
                    <div className="scrim-upload__relative">
                      <button
                        type="button"
                        onClick={() => setTeamId2DropdownOpen(!teamId2DropdownOpen)}
                        className={`scrim-upload__dropdown-trigger scrim-upload__dropdown-trigger--compact ${!teamId2 ? 'scrim-upload__dropdown-trigger--empty scrim-upload__dropdown-trigger--error' : ''}`}
                      >
                        <span>{selectedTeam2Name}</span>
                        <ChevronDown
                          size={10}
                          className={`scrim-upload__dropdown-chevron ${teamId2DropdownOpen ? 'scrim-upload__dropdown-chevron--open' : ''}`}
                        />
                      </button>
                      {teamId2DropdownOpen && (
                        <>
                          <div className="scrim-upload__dropdown-backdrop" onClick={() => setTeamId2DropdownOpen(false)} />
                          <div className="scrim-upload__dropdown-menu scrim-upload__dropdown-menu--short">
                            {teams.filter(t => String(t.id) !== teamId).map((team) => (
                              <button
                                key={team.id}
                                type="button"
                                onClick={() => { setTeamId2(String(team.id)); setTeamId2DropdownOpen(false) }}
                                className={`scrim-upload__dropdown-item scrim-upload__dropdown-item--compact ${String(team.id) === teamId2 ? 'scrim-upload__dropdown-item--selected' : ''}`}
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
                      <h4 className="scrim-upload__section-title scrim-upload__section-title--sm">
                        Player Mapping: {opponentTeamName}
                      </h4>
                      <div className="scrim-upload__column">
                        {opponentPlayers.map((playerName) =>
                          renderMappingRow(
                            playerName, playerMappings2, setPlayerMappings2,
                            people2, mappingDropdownOpen2, setMappingDropdownOpen2,
                            mappingSearch2, setMappingSearch2,
                          )
                        )}
                      </div>
                      {/* Mapping summary for team 2 */}
                      <div className="scrim-upload__mapping-summary scrim-upload__mapping-summary--tight">
                        {Object.keys(playerMappings2).length} of {opponentPlayers.length} players mapped
                        {Object.keys(playerMappings2).length === opponentPlayers.length && (
                          <span className="scrim-upload__mapping-complete">
                            <Check size={12} className="scrim-upload__inline-icon--sm" />
                            All mapped
                          </span>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Opponent team info — editable with autocomplete (hidden when dual-team with team selected) */}
            {!dualTeam && opponentTeamName && preview.players[opponentTeamName] && (
              <div className="scrim-upload__section">
                <div className="scrim-upload__opponent-row">
                  <span className="scrim-upload__opponent-label">Opponent Name:</span>
                  <div className="scrim-upload__opponent-input-wrap">
                    <input
                      ref={opponentInputRef}
                      type="text"
                      value={opponentNameOverride}
                      onChange={e => handleOpponentInputChange(e.target.value)}
                      onFocus={() => { fetchOpponentSuggestions(opponentNameOverride); setShowOpponentSuggestions(true) }}
                      placeholder="Type opponent name..."
                      className="scrim-upload__opponent-input"
                    />
                    {showOpponentSuggestions && opponentSuggestions.length > 0 && (
                      <div ref={opponentSuggestionsRef} className="scrim-upload__suggestions">
                        {opponentSuggestions.map(name => (
                          <button
                            key={name}
                            onClick={() => {
                              setOpponentNameOverride(name)
                              setShowOpponentSuggestions(false)
                            }}
                            className="scrim-upload__suggestion-item"
                          >
                            {name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {opponentNameOverride.trim() !== opponentTeamName && opponentNameOverride.trim() && (
                    <span className="scrim-upload__opponent-badge">
                      <Check size={10} className="scrim-upload__inline-icon--sm" />
                      renamed
                    </span>
                  )}
                </div>
                <div className="scrim-upload__opponent-players">
                  <span className="scrim-upload__opponent-label">Players: </span>
                  <span className="scrim-upload__hint-em">
                    {preview.players[opponentTeamName].join(', ')}
                  </span>
                </div>
              </div>
            )}

            {/* Upload Button */}
            <button
              onClick={handleUpload}
              disabled={state === 'uploading'}
              className={`scrim-upload__submit-btn ${state === 'uploading' ? 'scrim-upload__submit-btn--loading' : 'scrim-upload__submit-btn--upload'}`}
            >
              {state === 'uploading' ? (
                <><Loader2 size={14} className="scrim-upload__spinner" /> Uploading & Processing…</>
              ) : (
                <>
                  <Upload size={14} className="scrim-upload__btn-icon" />
                  {`Confirm & Upload ${files.length} File${files.length !== 1 ? 's' : ''}`}
                </>
              )}
            </button>
          </>
        )}

        {/* ════════════════════════════════════════════
            Result / Error
            ════════════════════════════════════════════ */}
        {result && (
          <div className={`scrim-upload__result ${state === 'success' ? 'scrim-upload__result--success' : 'scrim-upload__result--error'}`}>
            <p className={`scrim-upload__result-message ${state === 'success' ? 'scrim-upload__result-message--success' : 'scrim-upload__result-message--error'}`}
              style={{ marginBottom: result.scrims ? '12px' : '0' }}
            >
              {state === 'success' ? <Check size={14} className="scrim-upload__inline-icon" /> : <AlertCircle size={14} className="scrim-upload__inline-icon" />}
              {result.message || (state === 'success' ? 'Scrim uploaded successfully!' : 'Upload failed')}
            </p>

            {state === 'success' && (
              <a href="/admin/scrims" className="scrim-upload__result-link">
                <ArrowLeft size={12} /> View all scrims
              </a>
            )}
          </div>
        )}
      </div>
    </div>
    </>
  )
}

'use client'

import React, { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

interface OpponentTeam {
  id: number
  name: string
  previousNames?: Array<{ name: string; changedDate?: string }>
  rank?: string
  status?: string
  region?: string
  contact?: string // Legacy
  managerContact?: string
  battleNet?: string
  currentRoster?: Array<{
    person?: { id: number; name?: string; displayName?: string; username?: string } | number
    position?: string
    playerNotes?: string
  }>
  previousRoster?: Array<{
    person?: { id: number; name?: string; displayName?: string; username?: string } | number
    position?: string
    leftDate?: string
    notes?: string
  }>
  generalNotes?: any
}

interface ScrimOutcome {
  id: number
  yourTeam?: { id: number; name: string } | number
  opponentTeam?: { id: number; name: string } | number
  scrimDate: string
  rating: string
  worthScrimAgain: string
  mapsPlayed?: Array<{ map: string; result: string; score?: string; notes?: string }>
  overallNotes?: string
}

interface ScoutReport {
  id: number
  opponentTeam?: { id: number; name: string } | number
  patchVersion?: string
  status: string
  // New data model - rosterSnapshot
  rosterSnapshot?: Array<{
    person?: { id: number; name?: string; displayName?: string; username?: string } | number
    position?: string
    nickname?: string
  }>
  // New data model - mapGames
  mapGames?: Array<{
    map?: { id: number; name: string; type?: string } | number
    mapResult?: string
    replayCode?: string
    mapNotes?: any
    bans?: Array<{
      hero?: { id: number; name: string } | number
      direction?: string
    }>
    rounds?: Array<{
      roundName?: string
      roundResult?: string
      heroPicksText?: string
      roundNotes?: string
    }>
  }>
  overallNotes?: any
  weaknesses?: any
  recommendations?: any
  createdAt: string
  updatedAt: string
}

// Wrapper component with Suspense for SSR compatibility
export default function OpponentWikiView() {
  return (
    <Suspense fallback={
      <div className="opponent-wiki" data-section="scouting">
        <div className="opponent-wiki__loading">Loading...</div>
      </div>
    }>
      <OpponentWikiContent />
    </Suspense>
  )
}

function OpponentWikiContent() {
  const searchParams = useSearchParams()
  const teamId = searchParams.get('team')

  const [activeTab, setActiveTab] = useState('overview')
  const [team, setTeam] = useState<OpponentTeam | null>(null)
  const [scrimHistory, setScrimHistory] = useState<ScrimOutcome[]>([])
  const [scoutReports, setScoutReports] = useState<ScoutReport[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch team data
  useEffect(() => {
    if (!teamId) {
      setLoading(false)
      return
    }

    async function fetchData() {
      try {
        setLoading(true)
        
        // Fetch opponent team
        const teamRes = await fetch(`/api/opponent-teams/${teamId}?depth=1`)
        if (!teamRes.ok) throw new Error('Failed to fetch team')
        const teamData = await teamRes.json()
        setTeam(teamData)

        // Fetch scrim outcomes for this opponent
        const scrimsRes = await fetch(`/api/scrim-outcomes?where[opponentTeam][equals]=${teamId}&depth=1&limit=50`)
        if (scrimsRes.ok) {
          const scrimsData = await scrimsRes.json()
          setScrimHistory(scrimsData.docs || [])
        }

        // Fetch scout reports for this opponent (depth=2 to get nested person data in rosterSnapshot)
        const reportsRes = await fetch(`/api/scout-reports?where[opponentTeam][equals]=${teamId}&depth=2&limit=50`)
        if (reportsRes.ok) {
          const reportsData = await reportsRes.json()
          setScoutReports(reportsData.docs || [])
        }

        setLoading(false)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data')
        setLoading(false)
      }
    }

    fetchData()
  }, [teamId])

  // No team selected - show list of scouted teams
  if (!teamId) {
    return <TeamsWithReportsView />
  }

  if (loading) {
    return (
      <div className="opponent-wiki" data-section="scouting">
        <div className="opponent-wiki__loading">Loading team data...</div>
      </div>
    )
  }

  if (error || !team) {
    return (
      <div className="opponent-wiki" data-section="scouting">
        <div className="opponent-wiki__error">
          {error || 'Team not found'}
        </div>
      </div>
    )
  }

  // Active scout report (most recent active one)
  const activeReport = scoutReports.find(r => r.status === 'active')
  const archivedReports = scoutReports.filter(r => r.status === 'archived')

  // Aggregate ban data from all reports
  const banAggregation = aggregateBans(scoutReports)

  return (
    <div className="opponent-wiki" data-section="scouting">
      {/* Header */}
      <div className="opponent-wiki__header">
        <div className="opponent-wiki__team-info">
          <h1>{team.name}</h1>
          <div className="opponent-wiki__badges">
            {team.rank && <span className="badge badge-info">{team.rank}</span>}
            {team.region && <span className="badge">{team.region.toUpperCase()}</span>}
            {team.status && (
              <span className={`badge ${team.status === 'active' ? 'badge-success' : 'badge-warning'}`}>
                {team.status}
              </span>
            )}
          </div>
          {team.previousNames && team.previousNames.length > 0 && (
            <div className="opponent-wiki__previous-names">
              <small>Previously: {team.previousNames.map(n => n.name).join(', ')}</small>
            </div>
          )}
        </div>
        {(team.managerContact || team.battleNet) && (
          <div className="opponent-wiki__contacts">
            {team.managerContact && (
              <div className="opponent-wiki__contact">
                💬 {team.managerContact}
              </div>
            )}
            {team.battleNet && (
              <div className="opponent-wiki__contact">
                🎮 {team.battleNet}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Tabs */}
      <nav className="opponent-wiki__tabs">
        <button
          className={`opponent-wiki__tab ${activeTab === 'overview' ? 'opponent-wiki__tab--active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button
          className={`opponent-wiki__tab ${activeTab === 'intel' ? 'opponent-wiki__tab--active' : ''}`}
          onClick={() => setActiveTab('intel')}
        >
          Current Intel {activeReport && '✓'}
        </button>
        <button
          className={`opponent-wiki__tab ${activeTab === 'scrims' ? 'opponent-wiki__tab--active' : ''}`}
          onClick={() => setActiveTab('scrims')}
        >
          Scrim History ({scrimHistory.length})
        </button>
        <button
          className={`opponent-wiki__tab ${activeTab === 'bans' ? 'opponent-wiki__tab--active' : ''}`}
          onClick={() => setActiveTab('bans')}
        >
          Ban Analysis
        </button>
        {archivedReports.length > 0 && (
          <button
            className={`opponent-wiki__tab ${activeTab === 'archive' ? 'opponent-wiki__tab--active' : ''}`}
            onClick={() => setActiveTab('archive')}
          >
            Archive ({archivedReports.length})
          </button>
        )}
      </nav>

      {/* Tab Content */}
      <div className="opponent-wiki__content">
        {activeTab === 'overview' && <OverviewTab team={team} reports={scoutReports} />}
        {activeTab === 'intel' && <IntelTab report={activeReport} teamId={team.id} />}
        {activeTab === 'scrims' && <ScrimHistoryTab scrims={scrimHistory} />}
        {activeTab === 'bans' && <BanAnalysisTab bans={banAggregation} />}
        {activeTab === 'archive' && <ArchiveTab reports={archivedReports} />}
      </div>
    </div>
  )
}
// ============================================
// TAB COMPONENTS
// ============================================

function OverviewTab({ team, reports }: { team: OpponentTeam; reports: ScoutReport[] }) {
  const positionOrder = ['tank', 'hitscan', 'fdps', 'ms', 'fs']
  const positionLabels: Record<string, string> = {
    tank: 'Tank',
    hitscan: 'Hitscan',
    fdps: 'Flex DPS',
    ms: 'Main Support',
    fs: 'Flex Support',
  }

  // Use team's current roster from Opponent Teams collection
  const sortedRoster = [...(team.currentRoster || [])].sort((a, b) => {
    const aIndex = positionOrder.indexOf(a.position || '')
    const bIndex = positionOrder.indexOf(b.position || '')
    return aIndex - bIndex
  })

  // Aggregate map stats from all reports
  const mapStats = aggregateMapStats(reports)

  return (
    <div className="opponent-wiki__overview">
      {/* Roster from Opponent Team */}
      <div className="opponent-wiki__roster-section">
        <h3>Current Roster</h3>
        {sortedRoster.length > 0 ? (
          <div className="opponent-wiki__roster-grid">
            {sortedRoster.map((member, idx) => {
              const personName = typeof member.person === 'object' 
                ? (member.person?.name || member.person?.displayName || member.person?.username || 'Unknown')
                : 'Unknown'
              return (
                <div key={idx} className="opponent-wiki__roster-card">
                  <div className="opponent-wiki__roster-position">
                    {positionLabels[member.position || ''] || member.position}
                  </div>
                  <div className="opponent-wiki__roster-name">{personName}</div>
                  {member.playerNotes && (
                    <div className="opponent-wiki__roster-notes">{member.playerNotes}</div>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          <p className="opponent-wiki__empty">No roster information yet</p>
        )}
      </div>

      {/* Aggregated Map Stats */}
      {mapStats.size > 0 && (
        <div className="opponent-wiki__map-stats">
          <h3>Map Performance</h3>
          <div className="opponent-wiki__stats-grid">
            {Array.from(mapStats.entries())
              .sort((a, b) => b[1].played - a[1].played)
              .map(([mapName, stats]) => (
                <div key={mapName} className={`opponent-wiki__stat-card opponent-wiki__stat-card--${getWinRateClass(stats.wins, stats.played)}`}>
                  <div className="opponent-wiki__stat-map">{mapName}</div>
                  <div className="opponent-wiki__stat-record">
                    {stats.wins}W - {stats.losses}L
                    {stats.draws > 0 && ` - ${stats.draws}D`}
                  </div>
                  <div className="opponent-wiki__stat-winrate">
                    {stats.played > 0 ? Math.round((stats.wins / stats.played) * 100) : 0}% win rate
                  </div>
                  <div className="opponent-wiki__stat-played">{stats.played} games</div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Previous Roster from team */}
      {team.previousRoster && team.previousRoster.length > 0 && (
        <div className="opponent-wiki__previous-roster">
          <h4>Previous Players</h4>
          <ul>
            {team.previousRoster.map((member, idx) => {
              const personName = typeof member.person === 'object'
                ? (member.person?.name || member.person?.displayName || member.person?.username || 'Unknown')
                : 'Unknown'
              return (
                <li key={idx}>
                  {personName} ({positionLabels[member.position || ''] || member.position})
                  {member.leftDate && ` - Left ${new Date(member.leftDate).toLocaleDateString()}`}
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}

// Aggregate map stats across all reports
interface MapStat {
  played: number
  wins: number
  losses: number
  draws: number
}

function aggregateMapStats(reports: ScoutReport[]): Map<string, MapStat> {
  const stats = new Map<string, MapStat>()
  
  for (const report of reports) {
    if (!report.mapGames) continue
    
    for (const game of report.mapGames) {
      const mapName = typeof game.map === 'object' ? game.map?.name : 'Unknown'
      if (!mapName) continue
      
      const existing = stats.get(mapName) || { played: 0, wins: 0, losses: 0, draws: 0 }
      existing.played++
      if (game.mapResult === 'win') existing.wins++
      else if (game.mapResult === 'loss') existing.losses++
      else if (game.mapResult === 'draw') existing.draws++
      
      stats.set(mapName, existing)
    }
  }
  
  return stats
}

function getWinRateClass(wins: number, played: number): string {
  if (played === 0) return 'neutral'
  const rate = wins / played
  if (rate >= 0.6) return 'strong'
  if (rate >= 0.4) return 'neutral'
  return 'weak'
}

function IntelTab({ report, teamId }: { report?: ScoutReport; teamId: number }) {
  const positionLabels: Record<string, string> = {
    tank: 'Tank',
    hitscan: 'Hitscan',
    fdps: 'Flex DPS',
    ms: 'Main Support',
    fs: 'Flex Support',
  }

  if (!report) {
    return (
      <div className="opponent-wiki__intel opponent-wiki__empty">
        <p>No active scout report for this team.</p>
        <a href={`/admin/collections/scout-reports/create?opponentTeam=${teamId}`} className="btn btn-success">
          Create Scout Report
        </a>
      </div>
    )
  }

  return (
    <div className="opponent-wiki__intel">
      <div className="opponent-wiki__intel-header">
        <span className="badge badge-info">{report.patchVersion || 'Current Patch'}</span>
        <small>Updated {new Date(report.updatedAt).toLocaleDateString()}</small>
        <a href={`/admin/collections/scout-reports/${report.id}`} className="btn btn-small">Edit Report</a>
      </div>

      {/* Roster Snapshot */}
      {report.rosterSnapshot && report.rosterSnapshot.length > 0 && (
        <div className="opponent-wiki__roster-section">
          <h4>Roster Snapshot</h4>
          <div className="opponent-wiki__roster-grid">
            {report.rosterSnapshot.map((member, idx) => {
              const personName = typeof member.person === 'object'
                ? (member.person?.name || member.person?.displayName || member.person?.username || 'Unknown')
                : 'Unknown'
              return (
                <div key={idx} className="opponent-wiki__roster-card">
                  <div className="opponent-wiki__roster-position">
                    {positionLabels[member.position || ''] || member.position || 'Unknown'}
                  </div>
                  <div className="opponent-wiki__roster-name">
                    {personName}
                    {member.nickname && <span className="opponent-wiki__nickname"> ({member.nickname})</span>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
      {/* Map Performance - Same format as Overview but for this report only */}
      {report.mapGames && report.mapGames.length > 0 && (
        <div className="opponent-wiki__map-stats">
          <h4>Map Performance</h4>
          <div className="opponent-wiki__stats-grid">
            {(() => {
              // Aggregate by map name for this report
              const mapStats = new Map<string, { played: number; wins: number; losses: number; draws: number }>()
              for (const game of report.mapGames!) {
                const mapName = typeof game.map === 'object' ? game.map?.name : 'Unknown'
                if (!mapName) continue
                const existing = mapStats.get(mapName) || { played: 0, wins: 0, losses: 0, draws: 0 }
                existing.played++
                if (game.mapResult === 'win') existing.wins++
                else if (game.mapResult === 'loss') existing.losses++
                else if (game.mapResult === 'draw') existing.draws++
                mapStats.set(mapName, existing)
              }
              return Array.from(mapStats.entries())
                .sort((a, b) => b[1].played - a[1].played)
                .map(([mapName, stats]) => (
                  <div key={mapName} className={`opponent-wiki__stat-card opponent-wiki__stat-card--${getWinRateClass(stats.wins, stats.played)}`}>
                    <div className="opponent-wiki__stat-map">{mapName}</div>
                    <div className="opponent-wiki__stat-record">
                      {stats.wins}W - {stats.losses}L
                      {stats.draws > 0 && ` - ${stats.draws}D`}
                    </div>
                    <div className="opponent-wiki__stat-winrate">
                      {stats.played > 0 ? Math.round((stats.wins / stats.played) * 100) : 0}% win rate
                    </div>
                    <div className="opponent-wiki__stat-played">{stats.played} games</div>
                  </div>
                ))
            })()}
          </div>
        </div>
      )}

      {/* Map Games Details */}
      {report.mapGames && report.mapGames.length > 0 && (
        <div className="opponent-wiki__map-analysis">
          <h4>Map Games ({report.mapGames.length})</h4>
          <div className="opponent-wiki__map-list">
            {report.mapGames.map((game, idx) => {
              const mapName = typeof game.map === 'object' ? game.map?.name : 'Unknown Map'
              const resultClass = game.mapResult === 'win' ? 'win' : game.mapResult === 'loss' ? 'loss' : ''
              return (
                <div key={idx} className={`opponent-wiki__game-card opponent-wiki__game-card--${resultClass}`}>
                  <div className="opponent-wiki__game-header">
                    <span className="opponent-wiki__game-map">{mapName}</span>
                    {game.mapResult && (
                      <span className={`badge badge-${game.mapResult === 'win' ? 'success' : game.mapResult === 'loss' ? 'error' : 'info'}`}>
                        {game.mapResult.toUpperCase()}
                      </span>
                    )}
                    {game.replayCode && <span className="opponent-wiki__replay-code">🎮 {game.replayCode}</span>}
                  </div>

                  {/* Bans */}
                  {game.bans && game.bans.length > 0 && (
                    <div className="opponent-wiki__game-bans">
                      <strong>Bans:</strong>
                      {game.bans.map((ban, bidx) => {
                        const heroName = typeof ban.hero === 'object' ? ban.hero?.name : 'Unknown'
                        return (
                          <span key={bidx} className="opponent-wiki__ban-chip">
                            {ban.direction === 'theyban' ? '🚫' : '🎯'} {heroName}
                          </span>
                        )
                      })}
                    </div>
                  )}

                  {/* Rounds */}
                  {game.rounds && game.rounds.length > 0 && (
                    <div className="opponent-wiki__game-rounds">
                      {game.rounds.map((round, ridx) => (
                        <div key={ridx} className="opponent-wiki__round">
                          <div className="opponent-wiki__round-header">
                            <span className="opponent-wiki__round-name">{round.roundName || `Round ${ridx + 1}`}</span>
                            {round.roundResult && (
                              <span className={`badge badge-${round.roundResult === 'win' ? 'success' : 'error'}`}>
                                {round.roundResult.toUpperCase()}
                              </span>
                            )}
                          </div>
                          {round.heroPicksText && (
                            <pre className="opponent-wiki__hero-picks">{round.heroPicksText}</pre>
                          )}
                          {round.roundNotes && (
                            <div className="opponent-wiki__round-notes">{round.roundNotes}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Overall Notes & Weaknesses */}
      {(report.overallNotes || report.weaknesses || report.recommendations) && (
        <div className="opponent-wiki__notes-section">
          {report.overallNotes && (
            <div className="opponent-wiki__note-block">
              <h4>📋 Overall Notes</h4>
              <div className="opponent-wiki__rich-text" dangerouslySetInnerHTML={{ __html: renderRichText(report.overallNotes) }} />
            </div>
          )}
          {report.weaknesses && (
            <div className="opponent-wiki__note-block opponent-wiki__note-block--weakness">
              <h4>⚠️ Weaknesses</h4>
              <div className="opponent-wiki__rich-text" dangerouslySetInnerHTML={{ __html: renderRichText(report.weaknesses) }} />
            </div>
          )}
          {report.recommendations && (
            <div className="opponent-wiki__note-block opponent-wiki__note-block--recommendation">
              <h4>💡 Recommendations</h4>
              <div className="opponent-wiki__rich-text" dangerouslySetInnerHTML={{ __html: renderRichText(report.recommendations) }} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Simple rich text renderer (converts Payload's lexical format to HTML)
function renderRichText(content: any): string {
  if (!content) return ''
  if (typeof content === 'string') return content
  
  // Handle Payload's lexical rich text format
  if (content.root && content.root.children) {
    return content.root.children.map((node: any) => {
      if (node.type === 'paragraph') {
        const text = node.children?.map((child: any) => child.text || '').join('') || ''
        return `<p>${text}</p>`
      }
      return ''
    }).join('')
  }
  
  return JSON.stringify(content)
}

function ScrimHistoryTab({ scrims }: { scrims: ScrimOutcome[] }) {
  const ratingEmoji: Record<string, string> = {
    easywin: '✅',
    closewin: '🔥',
    neutral: '😐',
    closeloss: '😓',
    gotrolled: '💀',
  }

  const worthEmoji: Record<string, string> = {
    yes: '👍',
    maybe: '🤔',
    no: '👎',
  }

  if (scrims.length === 0) {
    return (
      <div className="opponent-wiki__scrims opponent-wiki__empty">
        <p>No scrim history with this team yet.</p>
      </div>
    )
  }

  return (
    <div className="opponent-wiki__scrims">
      <div className="opponent-wiki__scrim-list">
        {scrims.map(scrim => (
          <div key={scrim.id} className="opponent-wiki__scrim-card">
            <div className="opponent-wiki__scrim-header">
              <span className="opponent-wiki__scrim-date">
                {new Date(scrim.scrimDate).toLocaleDateString()}
              </span>
              <span className="opponent-wiki__scrim-rating">
                {ratingEmoji[scrim.rating] || '❓'} {scrim.rating}
              </span>
              <span className="opponent-wiki__scrim-worth">
                {worthEmoji[scrim.worthScrimAgain] || '❓'} Scrim again?
              </span>
            </div>
            {scrim.mapsPlayed && scrim.mapsPlayed.length > 0 && (
              <div className="opponent-wiki__scrim-maps">
                {scrim.mapsPlayed.map((m, idx) => (
                  <span key={idx} className={`opponent-wiki__map-result opponent-wiki__map-result--${m.result}`}>
                    {m.map}: {m.result} {m.score && `(${m.score})`}
                  </span>
                ))}
              </div>
            )}
            {scrim.overallNotes && (
              <div className="opponent-wiki__scrim-notes">{scrim.overallNotes}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function BanAnalysisTab({ bans }: { bans: Map<string, BanAggregate> }) {
  if (bans.size === 0) {
    return (
      <div className="opponent-wiki__bans opponent-wiki__empty">
        <p>No ban analysis data available yet.</p>
      </div>
    )
  }

  const sortedBans = Array.from(bans.entries()).sort((a, b) => b[1].count - a[1].count)

  return (
    <div className="opponent-wiki__bans">
      <h4>Hero Ban Patterns</h4>
      <div className="opponent-wiki__ban-list">
        {sortedBans.map(([heroName, data]) => (
          <div key={heroName} className="opponent-wiki__ban-card">
            <div className="opponent-wiki__ban-hero">{heroName}</div>
            <div className="opponent-wiki__ban-count">{data.count} bans</div>
            {data.wins + data.losses > 0 && (
              <div className="opponent-wiki__ban-record">
                Win rate: {Math.round((data.wins / (data.wins + data.losses)) * 100)}%
              </div>
            )}
            {data.maps.length > 0 && (
              <div className="opponent-wiki__ban-maps">
                Maps: {Array.from(new Set(data.maps)).join(', ')}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function ArchiveTab({ reports }: { reports: ScoutReport[] }) {
  return (
    <div className="opponent-wiki__archive">
      <h4>Archived Scout Reports</h4>
      <div className="opponent-wiki__archive-list">
        {reports.map(report => (
          <a 
            key={report.id} 
            href={`/admin/collections/scout-reports/${report.id}`}
            className="opponent-wiki__archive-card"
          >
            <span className="opponent-wiki__archive-patch">{report.patchVersion || 'Unknown Patch'}</span>
            <span className="opponent-wiki__archive-date">
              {new Date(report.createdAt).toLocaleDateString()}
            </span>
          </a>
        ))}
      </div>
    </div>
  )
}

// ============================================
// HELPERS
// ============================================

interface BanAggregate {
  count: number
  wins: number
  losses: number
  maps: string[]
}

function aggregateBans(reports: ScoutReport[]): Map<string, BanAggregate> {
  const banMap = new Map<string, BanAggregate>()

  for (const report of reports) {
    // New structure: mapGames -> bans
    if (!report.mapGames) continue

    for (const game of report.mapGames) {
      if (!game.bans) continue
      
      const mapName = typeof game.map === 'object' ? game.map?.name : 'Unknown'
      
      for (const ban of game.bans) {
        // Only include bans made BY the opponent team (theyban), not bans made against them
        if (ban.direction !== 'theyban') continue
        
        const heroName = typeof ban.hero === 'object' ? (ban.hero?.name || 'Unknown') : 'Unknown'
        
        const existing = banMap.get(heroName) || { count: 0, wins: 0, losses: 0, maps: [] }
        existing.count += 1
        // Track map-level win/loss for ban analysis
        if (game.mapResult === 'win') existing.wins += 1
        if (game.mapResult === 'loss') existing.losses += 1
        if (mapName) existing.maps.push(mapName)
        
        banMap.set(heroName, existing)
      }
    }
  }

  return banMap
}

function getComfortLabel(comfort?: string): string {
  const labels: Record<string, string> = {
    dominate: '🟢 Dominate',
    exceed: '🟢 Exceed',
    neutral: '🟡 Neutral',
    struggle: '🔴 Struggle',
    gotrolled: '🔴 Got Rolled',
    notplayed: '⬛ Not Played',
  }
  return labels[comfort || ''] || comfort || 'Unknown'
}

// ============================================
// TEAMS WITH REPORTS VIEW (Landing Page)
// ============================================

interface TeamWithReports {
  id: number
  name: string
  rank?: string
  status?: string
  region?: string
  reportCount: number
  latestReportDate?: string
}

function TeamsWithReportsView() {
  const [teams, setTeams] = useState<TeamWithReports[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchTeamsWithReports() {
      try {
        // Fetch all scout reports with their opponent teams
        const res = await fetch('/api/scout-reports?depth=1&limit=200')
        if (!res.ok) throw new Error('Failed to fetch reports')
        const data = await res.json()
        
        // Aggregate by team
        const teamMap = new Map<number, TeamWithReports>()
        
        for (const report of data.docs || []) {
          const opponentTeam = report.opponentTeam
          if (!opponentTeam || typeof opponentTeam !== 'object') continue
          
          const teamId = opponentTeam.id
          const existing = teamMap.get(teamId)
          
          if (existing) {
            existing.reportCount++
            // Track latest report date
            if (report.updatedAt > (existing.latestReportDate || '')) {
              existing.latestReportDate = report.updatedAt
            }
          } else {
            teamMap.set(teamId, {
              id: teamId,
              name: opponentTeam.name || 'Unknown Team',
              rank: opponentTeam.rank,
              status: opponentTeam.status,
              region: opponentTeam.region,
              reportCount: 1,
              latestReportDate: report.updatedAt,
            })
          }
        }
        
        // Sort by report count (most scouted first)
        const sorted = Array.from(teamMap.values()).sort((a, b) => b.reportCount - a.reportCount)
        setTeams(sorted)
        setLoading(false)
      } catch (err) {
        console.error('Failed to fetch teams with reports:', err)
        setLoading(false)
      }
    }

    fetchTeamsWithReports()
  }, [])

  return (
    <div className="opponent-wiki" data-section="scouting">
      <div className="opponent-wiki__header">
        <h1>📖 Opponent Wiki</h1>
        <p>Teams with intelligence profiles</p>
      </div>
      
      {loading ? (
        <div className="opponent-wiki__loading">Loading scouted teams...</div>
      ) : teams.length === 0 ? (
        <div className="opponent-wiki__empty">
          <p>No teams have been scouted yet.</p>
          <a href="/admin/collections/scout-reports/create" className="btn btn-success">
            Create First Scout Report
          </a>
        </div>
      ) : (
        <div className="opponent-wiki__team-grid">
          {teams.map(team => (
            <a 
              key={team.id}
              href={`/admin/globals/opponent-wiki?team=${team.id}`}
              className="opponent-wiki__team-card"
            >
              <div className="opponent-wiki__team-name">{team.name}</div>
              <div className="opponent-wiki__team-meta">
                {team.rank && <span className="badge">{team.rank}</span>}
                {team.region && <span className="badge">{team.region.toUpperCase()}</span>}
                <span className="opponent-wiki__report-count">
                  📄 {team.reportCount} report{team.reportCount !== 1 ? 's' : ''}
                </span>
              </div>
              {team.latestReportDate && (
                <div className="opponent-wiki__team-date">
                  Updated {new Date(team.latestReportDate).toLocaleDateString()}
                </div>
              )}
            </a>
          ))}
        </div>
      )}
    </div>
  )
}

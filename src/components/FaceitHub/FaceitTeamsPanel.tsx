'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Button, toast } from '@payloadcms/ui'
import { AlertTriangle, CheckCircle, ExternalLink, Link2, RefreshCw, Settings2, Trophy, Users } from 'lucide-react'
import { AdminTable, Badge, SectionCard, formatRelative, type AdminTableColumn } from '@/admin-kit'
import { parseFaceitUrl, isValidFaceitId } from '@/utilities/faceitUrlParser'
import { faceitTeamStatus, needsAttention, type FaceitOverviewLeague, type FaceitTeamRow } from '@/utilities/faceitTeamStatus'

/**
 * Every team's FACEIT setup on one screen, problems first, with the fixes
 * inline: paste a team id or URL, pick a league, tick Withdrawn, Sync.
 */

interface Overview {
  latestSeasonNumber: number | null
  leagues: FaceitOverviewLeague[]
  teams: FaceitTeamRow[]
  registrationCheckedAt: string | null
  registrationPending: boolean
  warnings: string[]
}

const POLL_MS = 3000
const POLL_MAX = 30

/** Fired after any team change so the header (season pill, warning count) refreshes. */
export const FACEIT_TEAMS_CHANGED = 'faceit:teams-changed'
const notifyChanged = () => {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(FACEIT_TEAMS_CHANGED))
}

type Filter = 'attention' | 'all'

export default function FaceitTeamsPanel() {
  const [data, setData] = useState<Overview | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Default to everything, problems first: a row that gets fixed stays visible
  // (flipping to OK) instead of vanishing from a filtered list.
  const [filter, setFilter] = useState<Filter>('all')
  const [bulkRunning, setBulkRunning] = useState(false)
  const [busy, setBusy] = useState<Record<number, string>>({})
  const [idDrafts, setIdDrafts] = useState<Record<number, string>>({})

  const load = useCallback(async (refresh = false) => {
    try {
      if (refresh) setRefreshing(true)
      const res = await fetch(`/api/faceit/teams-overview${refresh ? '?refresh=1' : ''}`, { credentials: 'include' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || 'Could not load teams')
      setData(json)
      setError(null)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // The registration lookup runs server-side in the background; poll until it lands.
  useEffect(() => {
    if (!data?.registrationPending) return
    let polls = 0
    const timer = setInterval(() => {
      polls += 1
      if (polls > POLL_MAX) {
        clearInterval(timer)
        return
      }
      load()
    }, POLL_MS)
    return () => clearInterval(timer)
  }, [data?.registrationPending, load])

  const rows = useMemo(() => {
    if (!data) return []
    const withStatus = data.teams
      .filter((t) => t.active)
      .map((t) => ({ ...t, status: faceitTeamStatus(t, data.latestSeasonNumber) }))
    const filtered = filter === 'attention' ? withStatus.filter((r) => needsAttention(r.status)) : withStatus
    return filtered.sort((a, b) => {
      const aa = needsAttention(a.status) ? 0 : 1
      const bb = needsAttention(b.status) ? 0 : 1
      if (aa !== bb) return aa - bb
      return (a.region || '').localeCompare(b.region || '') || a.name.localeCompare(b.name)
    })
  }, [data, filter])

  const attentionCount = useMemo(
    () => (data ? data.teams.filter((t) => t.active && needsAttention(faceitTeamStatus(t, data.latestSeasonNumber))).length : 0),
    [data],
  )

  const withBusy = async (teamId: number, what: string, fn: () => Promise<void>) => {
    setBusy((b) => ({ ...b, [teamId]: what }))
    try {
      await fn()
      notifyChanged()
    } catch (err: any) {
      toast.error(err.message || 'Failed')
    } finally {
      setBusy((b) => {
        const next = { ...b }
        delete next[teamId]
        return next
      })
    }
  }

  const patchTeam = async (teamId: number, body: Record<string, unknown>) => {
    const res = await fetch(`/api/teams/${teamId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      throw new Error(json.errors?.[0]?.message || json.message || 'Save failed')
    }
  }

  /** A FACEIT team id, from a bare id or the team's FACEIT page URL. */
  const teamIdFrom = (value: string): string | null => {
    const v = value.trim()
    if (!v) return null
    if (isValidFaceitId(v)) return v
    const parsed = parseFaceitUrl(v)
    return parsed.teamId && isValidFaceitId(parsed.teamId) ? parsed.teamId : null
  }

  const saveFaceitId = (row: FaceitTeamRow, value?: string) => {
    const draft = (value ?? idDrafts[row.id] ?? '').trim()
    if (!draft || draft === row.faceitTeamId) return
    const id = teamIdFrom(draft)
    if (!id) {
      toast.error('Paste the team page URL from faceit.com (faceit.com/en/teams/...) or the team id')
      return
    }
    if (id === row.faceitTeamId) return
    withBusy(row.id, 'id', async () => {
      // Sending the enable flag and league with the id lets the season hook run
      await patchTeam(row.id, { faceitTeamId: id, faceitEnabled: true, currentFaceitLeague: row.league?.id ?? null })
      setIdDrafts((d) => {
        const next = { ...d }
        delete next[row.id]
        return next
      })
      toast.success(`${row.name}: FACEIT id saved`)
      await load()
    })
  }

  const setLeague = (row: FaceitTeamRow, leagueId: number | null) =>
    withBusy(row.id, 'league', async () => {
      await patchTeam(row.id, {
        currentFaceitLeague: leagueId,
        faceitEnabled: true,
        faceitTeamId: row.faceitTeamId,
        ...(leagueId ? { faceitWithdrawn: false } : {}),
      })
      toast.success(`${row.name}: league updated`)
      await load()
    })

  const setWithdrawn = (row: FaceitTeamRow, value: boolean) =>
    withBusy(row.id, 'withdrawn', async () => {
      await patchTeam(row.id, { faceitWithdrawn: value })
      toast.success(value ? `${row.name} marked withdrawn` : `${row.name} back in the season`)
      await load()
    })

  const setEnabled = (row: FaceitTeamRow, value: boolean) =>
    withBusy(row.id, 'enabled', async () => {
      await patchTeam(row.id, { faceitEnabled: value })
      await load()
    })

  const runAction = (row: FaceitTeamRow, action: 'sync' | 'clearLeague' | 'assignRegistered') =>
    withBusy(row.id, action, async () => {
      const res = await fetch('/api/faceit/teams-overview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action, teamId: row.id }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || 'Action failed')
      if (action === 'sync') toast.success(`${row.name}: synced (${json.matchesCreated ?? 0} created, ${json.matchesUpdated ?? 0} updated)`)
      else if (action === 'assignRegistered') {
        toast.success(`${row.name}: now in ${json.league}${json.leagueCreated ? ' (template created)' : ''} and synced`)
        if (json.sync && !json.sync.ok) toast.error(`${row.name}: sync failed, ${json.sync.error}`)
      } else toast.success(`${row.name}: league cleared`)
      await load()
    })

  /** FACEIT knows the division; the team is not on it yet. */
  const canTakeRegistered = (row: FaceitTeamRow) =>
    row.faceitEnabled && !row.faceitWithdrawn && row.registration === 'registered' && !!row.registeredLeague && row.league?.name !== row.registeredLeague

  const bulkCount = useMemo(() => (data ? data.teams.filter((t) => t.active && canTakeRegistered(t)).length : 0), [data])

  const assignAll = async () => {
    setBulkRunning(true)
    try {
      const res = await fetch('/api/faceit/teams-overview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'assignAllRegistered' }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || 'Bulk update failed')
      const failed = (json.results || []).filter((r: any) => !r.ok || r.error)
      toast.success(`${json.moved} team${json.moved === 1 ? '' : 's'} moved to the division FACEIT lists`)
      for (const f of failed) toast.error(`${f.teamName}: ${f.error}`)
      await load()
      notifyChanged()
    } catch (err: any) {
      toast.error(err.message || 'Bulk update failed')
    } finally {
      setBulkRunning(false)
    }
  }

  const applySuggestion = (row: FaceitTeamRow, s: FaceitTeamRow['suggestions'][number]) =>
    withBusy(row.id, 'suggest', async () => {
      await patchTeam(row.id, {
        faceitTeamId: s.faceitTeamId,
        faceitEnabled: true,
        currentFaceitLeague: s.leagueId ?? row.league?.id ?? null,
        faceitWithdrawn: false,
      })
      toast.success(`${row.name}: now ${s.faceitName}${s.leagueId ? ` in ${s.leagueName}` : ''}`)
      await load(true)
    })

  type Row = FaceitTeamRow & { status: ReturnType<typeof faceitTeamStatus> }

  const columns: AdminTableColumn<Row>[] = [
    {
      key: 'name',
      header: 'Team',
      render: (r) => (
        <div className="faceit-teams__team">
          <a href={`/admin/collections/teams/${r.id}`} className="faceit-teams__team-name">{r.name}</a>
          <span className="faceit-teams__team-region">{r.region || '-'}</span>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (r) => (
        <div className="faceit-teams__status">
          <Badge tone={r.status.tone} size="sm">{r.status.label}</Badge>
          {r.faceitEnabled && !r.faceitWithdrawn && r.registration !== 'registered' && (
            <span className="faceit-teams__reg-note">
              {r.registration === 'not-registered'
                ? `FACEIT has no Season ${data?.latestSeasonNumber ?? ''} registration for this team id`
                : r.registration === 'conflict'
                  ? 'FACEIT lists this id in two divisions'
                  : data?.registrationPending
                    ? 'Checking FACEIT registrations...'
                    : 'FACEIT registration unknown'}
            </span>
          )}
          {canTakeRegistered(r) && (
            <button type="button" className="faceit-rollover__chip" disabled={!!busy[r.id]} onClick={() => runAction(r, 'assignRegistered')}>
              {busy[r.id] === 'assignRegistered' ? 'Setting...' : `Set league from FACEIT: ${r.registeredLeague}`}
            </button>
          )}
          {r.suggestions.length > 0 && (
            <div className="faceit-teams__suggestions">
              {r.suggestions.map((s) => (
                <button key={s.faceitTeamId} type="button" className="faceit-rollover__chip" disabled={!!busy[r.id]} onClick={() => applySuggestion(r, s)}>
                  Use &quot;{s.faceitName}&quot; ({s.leagueName})
                </button>
              ))}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'enabled',
      header: 'FaceIt',
      align: 'center',
      render: (r) => (
        <input
          type="checkbox"
          checked={r.faceitEnabled}
          disabled={!!busy[r.id]}
          onChange={(e) => setEnabled(r, e.target.checked)}
          aria-label={`FaceIt enabled for ${r.name}`}
        />
      ),
    },
    {
      key: 'faceitTeamId',
      header: 'FACEIT team (paste page URL)',
      render: (r) => (
        <div className="faceit-teams__id-cell">
          <input
            type="text"
            className="faceit-teams__input faceit-teams__input--id"
            value={idDrafts[r.id] ?? r.faceitTeamId ?? ''}
            placeholder="Paste faceit.com/en/teams/... URL"
            disabled={!!busy[r.id]}
            onChange={(e) => {
              const value = e.target.value
              setIdDrafts((d) => ({ ...d, [r.id]: value }))
              // A pasted team page URL saves straight away; a bare id waits for blur or Enter
              if (/faceit\.com\//i.test(value) && teamIdFrom(value)) saveFaceitId(r, value)
            }}
            onBlur={() => saveFaceitId(r)}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            aria-label={`FACEIT team for ${r.name}`}
          />
          {r.faceitTeamId && (
            <a
              className="faceit-teams__icon-link"
              href={`https://www.faceit.com/en/teams/${r.faceitTeamId}`}
              target="_blank"
              rel="noreferrer"
              title="Open this team on FACEIT to check it is the right one"
              aria-label={`Open ${r.name} on FACEIT`}
            >
              <ExternalLink size={13} />
            </a>
          )}
        </div>
      ),
    },
    {
      key: 'league',
      header: 'League',
      render: (r) => (
        <select
          className="faceit-teams__input"
          value={r.league?.id ?? ''}
          disabled={!!busy[r.id] || !r.faceitEnabled}
          onChange={(e) => setLeague(r, e.target.value ? Number(e.target.value) : null)}
          aria-label={`League for ${r.name}`}
        >
          <option value="">None</option>
          {r.league && !data?.leagues.some((l) => l.id === r.league!.id) && (
            <option value={r.league.id}>{r.league.name} (inactive)</option>
          )}
          {data?.leagues.map((l) => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
        </select>
      ),
    },
    {
      key: 'withdrawn',
      header: 'Withdrawn',
      align: 'center',
      render: (r) => (
        <input
          type="checkbox"
          checked={r.faceitWithdrawn}
          disabled={!!busy[r.id] || !r.faceitEnabled}
          onChange={(e) => setWithdrawn(r, e.target.checked)}
          aria-label={`Withdrawn for ${r.name}`}
        />
      ),
    },
    {
      key: 'lastSynced',
      header: 'Last synced',
      nowrap: true,
      hideOnMobile: true,
      render: (r) => (r.season?.lastSynced ? formatRelative(r.season.lastSynced) : '-'),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (r) => (
        <div className="faceit-teams__actions">
          <a className="faceit-teams__icon-link" href={`/admin/collections/teams/${r.id}`} title="Open the team page" aria-label={`Open ${r.name} team page`}>
            <Settings2 size={13} />
          </a>
          {r.status.code === 'stale-pointer' ? (
            <Button size="small" buttonStyle="secondary" disabled={!!busy[r.id]} onClick={() => runAction(r, 'clearLeague')}>
              Clear league
            </Button>
          ) : (
            <Button size="small" buttonStyle="secondary" disabled={!!busy[r.id] || !r.faceitEnabled || !r.league || r.faceitWithdrawn} onClick={() => runAction(r, 'sync')}>
              {busy[r.id] === 'sync' ? 'Syncing...' : 'Sync'}
            </Button>
          )}
        </div>
      ),
    },
  ]

  return (
    <SectionCard
      id="faceit-teams"
      className="faceit-teams"
      title={<><Users size={16} /> Teams</>}
      description={
        data?.registrationPending
          ? `Checking FACEIT registrations for Season ${data.latestSeasonNumber ?? ''}... statuses update when it finishes.`
          : data?.registrationCheckedAt
            ? `FACEIT registrations for Season ${data.latestSeasonNumber ?? ''} checked ${formatRelative(data.registrationCheckedAt)}.`
            : 'FACEIT registrations not checked yet.'
      }
      actions={
        <div className="faceit-teams__toolbar">
          <div className="faceit-teams__filter" role="group" aria-label="Filter teams">
            <button type="button" className={`faceit-teams__filter-btn ${filter === 'attention' ? 'is-active' : ''}`} onClick={() => setFilter('attention')}>
              <AlertTriangle size={12} /> Needs attention{data ? ` (${attentionCount})` : ''}
            </button>
            <button type="button" className={`faceit-teams__filter-btn ${filter === 'all' ? 'is-active' : ''}`} onClick={() => setFilter('all')}>
              All{data ? ` (${data.teams.filter((t) => t.active).length})` : ''}
            </button>
          </div>
          {bulkCount > 0 && (
            <Button size="small" buttonStyle="primary" disabled={bulkRunning || Object.keys(busy).length > 0} onClick={assignAll}>
              <Trophy size={12} /> {bulkRunning ? 'Moving teams...' : `Set all ${bulkCount} from FACEIT`}
            </Button>
          )}
          <Button size="small" buttonStyle="secondary" disabled={refreshing || !!data?.registrationPending} onClick={() => load(true)}>
            <RefreshCw size={12} /> {refreshing || data?.registrationPending ? 'Checking FACEIT...' : 'Recheck registrations'}
          </Button>
        </div>
      }
      flush
    >
      {error && <p className="faceit-rollover__error"><AlertTriangle size={14} /> {error}</p>}
      {data?.warnings.map((w) => (
        <p key={w} className="faceit-rollover__warning"><AlertTriangle size={14} /> {w}</p>
      ))}
      <AdminTable<Row>
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        loading={loading}
        dense
        aria-label="FACEIT teams"
        emptyTitle={filter === 'attention' ? 'Every team is set up' : 'No teams'}
        emptyHint={filter === 'attention' ? <><CheckCircle size={12} /> Switch to All to see the full list.</> : undefined}
        footer={
          <span className="faceit-teams__footer">
            <Link2 size={12} /> To fix a team id, open the team on faceit.com and paste its page URL into the box; the id is pulled out and saved. The arrow next to an id opens that team on FACEIT so you can check it.
          </span>
        }
      />
    </SectionCard>
  )
}

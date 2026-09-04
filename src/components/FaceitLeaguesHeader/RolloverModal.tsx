'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { Button } from '@payloadcms/ui'
import { AlertTriangle, CheckCircle, RefreshCw, Trophy, Users } from 'lucide-react'
import { AdminModal } from '@/admin-kit'
import type { RolloverPlan } from '@/utilities/faceitRollover'
import type { RolloverOverrides, RolloverReport } from '@/discord/services/faceitRolloverApply'

/**
 * Review and apply a FACEIT season rollover. Loads the dry-run plan from the
 * rollover API, lets the admin fix unmatched teams (pick a division, or take a
 * suggested FACEIT team id), then applies and shows the report.
 */

export interface RolloverModalProps {
  open: boolean
  onClose: () => void
  seasonId: string
  seasonNumber: number
  onApplied: () => void
}

const SKIP = '__skip__'

function fmtDate(iso: string | null): string {
  if (!iso) return ''
  // FACEIT season boundaries are midnight UTC; show the UTC calendar day
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

type TeamRow = {
  teamId: number
  teamName: string
  from: string | null
  status: 'matched' | 'unmatched' | 'conflict'
  suggestions: RolloverPlan['unmatched'][number]['suggestions']
}

export default function RolloverModal({ open, onClose, seasonId, seasonNumber, onApplied }: RolloverModalProps) {
  const [plan, setPlan] = useState<RolloverPlan | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // teamId -> stageId of the chosen league, or SKIP
  const [choices, setChoices] = useState<Record<number, string>>({})
  const [applying, setApplying] = useState(false)
  const [report, setReport] = useState<RolloverReport | null>(null)

  useEffect(() => {
    if (!open) return
    setPlan(null)
    setReport(null)
    setError(null)
    setChoices({})
    setLoading(true)
    fetch(`/api/faceit/rollover?seasonId=${encodeURIComponent(seasonId)}`, { credentials: 'include' })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error || 'Could not build the plan')
        return data.plan as RolloverPlan
      })
      .then((p) => {
        setPlan(p)
        const initial: Record<number, string> = {}
        for (const a of p.assignments) {
          const league = p.leagues.find((l) => l.key === a.toKey)
          if (league) initial[a.teamId] = league.stageId
        }
        for (const u of p.unmatched) initial[u.teamId] = SKIP
        for (const c of p.conflicts) initial[c.teamId] = SKIP
        setChoices(initial)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [open, seasonId])

  const teamRows = useMemo<TeamRow[]>(() => {
    if (!plan) return []
    const rows: TeamRow[] = []
    for (const u of plan.unmatched) rows.push({ teamId: u.teamId, teamName: u.teamName, from: null, status: 'unmatched', suggestions: u.suggestions })
    for (const c of plan.conflicts) rows.push({ teamId: c.teamId, teamName: c.teamName, from: null, status: 'conflict', suggestions: [] })
    for (const a of plan.assignments) rows.push({ teamId: a.teamId, teamName: a.teamName, from: a.fromLeague, status: 'matched', suggestions: [] })
    return rows
  }, [plan])

  const moveCount = Object.values(choices).filter((v) => v !== SKIP).length
  const createCount = plan?.leagues.filter((l) => !l.existingId).length ?? 0

  const handleApply = async () => {
    if (!plan) return
    setApplying(true)
    setError(null)
    try {
      const overrides: RolloverOverrides = {}
      for (const [teamId, stageId] of Object.entries(choices)) overrides[teamId] = stageId === SKIP ? null : stageId
      const res = await fetch('/api/faceit/rollover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ seasonId, overrides }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Rollover failed')
      setReport(data as RolloverReport)
      onApplied()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setApplying(false)
    }
  }

  const applySuggestion = async (teamId: number, faceitTeamId: string, stageId: string) => {
    // Fix the team's FACEIT id right away so the plan and the apply agree
    const res = await fetch(`/api/teams/${teamId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ faceitTeamId }),
    })
    if (!res.ok) {
      setError('Could not update the team FACEIT id')
      return
    }
    setChoices((c) => ({ ...c, [teamId]: stageId }))
  }

  const footer = report ? (
    <Button buttonStyle="primary" onClick={onClose}>Done</Button>
  ) : (
    <div className="faceit-rollover__actions">
      <Button buttonStyle="secondary" onClick={onClose} disabled={applying}>Cancel</Button>
      <Button buttonStyle="primary" onClick={handleApply} disabled={!plan || applying || loading}>
        {applying ? <><RefreshCw size={14} /> Rolling over...</> : `Create ${createCount} leagues, move ${moveCount} teams`}
      </Button>
    </div>
  )

  return (
    <AdminModal
      open={open}
      onClose={() => !applying && onClose()}
      title={`Roll over to Season ${seasonNumber}`}
      icon={<Trophy size={16} />}
      size="lg"
      footer={footer}
    >
      {loading && <p className="faceit-rollover__muted">Reading the season from FACEIT...</p>}
      {error && <p className="faceit-rollover__error"><AlertTriangle size={14} /> {error}</p>}

      {plan && !report && (
        <>
          <p className="faceit-rollover__muted">
            Season {plan.season.number}: {fmtDate(plan.season.start)} to {fmtDate(plan.season.end)}.
          </p>
          {plan.warnings.map((w) => (
            <p key={w} className="faceit-rollover__warning"><AlertTriangle size={14} /> {w}</p>
          ))}

          <h4 className="faceit-rollover__heading"><Trophy size={14} /> Leagues</h4>
          <table className="faceit-rollover__table">
            <tbody>
              {plan.leagues.map((l) => (
                <tr key={l.key} className={l.existingId ? 'faceit-rollover__row--existing' : ''}>
                  <td>{l.name}</td>
                  <td>{l.existingId ? 'already exists' : 'create'}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h4 className="faceit-rollover__heading"><Users size={14} /> Teams</h4>
          <table className="faceit-rollover__table">
            <thead>
              <tr><th>Team</th><th>Now</th><th>Season {plan.season.number}</th></tr>
            </thead>
            <tbody>
              {teamRows.map((row) => (
                <tr key={row.teamId} className={row.status !== 'matched' ? 'faceit-rollover__row--attention' : ''}>
                  <td>
                    {row.status !== 'matched' && <AlertTriangle size={12} />} {row.teamName}
                    {row.status === 'unmatched' && row.suggestions.length > 0 && (
                      <div className="faceit-rollover__suggestions">
                        {row.suggestions.map((s) => {
                          const league = plan.leagues.find((l) => l.key === s.leagueKey)
                          if (!league) return null
                          return (
                            <button
                              key={s.faceitTeamId}
                              type="button"
                              className="faceit-rollover__chip"
                              onClick={() => applySuggestion(row.teamId, s.faceitTeamId, league.stageId)}
                            >
                              Use &quot;{s.faceitName}&quot; ({s.leagueName})
                            </button>
                          )
                        })}
                      </div>
                    )}
                    {row.status === 'unmatched' && row.suggestions.length === 0 && (
                      <div className="faceit-rollover__muted">Not found in any registration list. Check the team&apos;s FACEIT team id.</div>
                    )}
                    {row.status === 'conflict' && <div className="faceit-rollover__muted">Registered in more than one division.</div>}
                  </td>
                  <td>{row.from ?? '-'}</td>
                  <td>
                    <select
                      value={choices[row.teamId] ?? SKIP}
                      onChange={(e) => setChoices((c) => ({ ...c, [row.teamId]: e.target.value }))}
                      aria-label={`Season ${plan.season.number} league for ${row.teamName}`}
                    >
                      <option value={SKIP}>Skip</option>
                      {plan.leagues.map((l) => <option key={l.key} value={l.stageId}>{l.name}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <h4 className="faceit-rollover__heading">Housekeeping</h4>
          <ul className="faceit-rollover__list">
            <li>
              {plan.finalize.length} older league(s) still active will be finalized
              {plan.finalize.length ? `: ${plan.finalize.map((f) => f.name).join(', ')}` : ''}
            </li>
            <li>{plan.stalePointers.length} disabled or inactive team(s) will stop pointing at a league</li>
            <li>Playoff flags left on old seasons will be cleared</li>
          </ul>
        </>
      )}

      {report && (
        <div className="faceit-rollover__report">
          <p className="faceit-rollover__ok">
            <CheckCircle size={14} /> Season {report.season}: {report.leaguesCreated} leagues created, {report.leaguesReused} reused, {report.leaguesFinalized} finalized.
          </p>
          <p>
            {report.teamsAssigned.length} teams moved, {report.stalePointersCleared} stale pointers cleared, {report.playoffFlagsCleared} playoff flags cleared.
          </p>
          {report.teamsSkipped.length > 0 && (
            <>
              <h4 className="faceit-rollover__heading">Skipped</h4>
              <ul className="faceit-rollover__list">
                {report.teamsSkipped.map((t) => <li key={t.teamId}>{t.teamName}: {t.reason}</li>)}
              </ul>
            </>
          )}
          <h4 className="faceit-rollover__heading">Sync</h4>
          <ul className="faceit-rollover__list">
            {report.sync.map((s) => (
              <li key={s.teamId}>
                {s.ok ? <CheckCircle size={12} /> : <AlertTriangle size={12} />} {s.teamName}:{' '}
                {s.ok ? `${s.matchesCreated} created, ${s.matchesUpdated} updated` : s.error}
              </li>
            ))}
          </ul>
          {(report.errors.length > 0 || report.finalizeErrors.length > 0) && (
            <>
              <h4 className="faceit-rollover__heading">Errors</h4>
              <ul className="faceit-rollover__list faceit-rollover__list--error">
                {[...report.finalizeErrors, ...report.errors].map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </>
          )}
        </div>
      )}
    </AdminModal>
  )
}

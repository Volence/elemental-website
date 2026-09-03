'use client'

/**
 * Teams index - /admin/scrim-teams
 *
 * The team pages were previously reachable only from the sidebar links,
 * which made them invisible to anyone browsing the tab bar. One row per
 * team in scope, linking to the team detail page.
 */

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { Flag } from 'lucide-react'
import ScrimAnalyticsTabs from '@/components/ScrimAnalyticsTabs'
import { ScrimBreadcrumbs, LoadingCard, ErrorCard, EmptyCard } from '@/components/ScrimShared'
import { SCRIM_COLORS } from '@/components/ScrimShared/tokens'

interface TeamRow {
  teamId: number | null
  externalTeamName?: string | null
  name: string
  count: number
  lastPlayed: string
}

export default function ScrimTeamListView() {
  const [teams, setTeams] = useState<TeamRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/scrim-teams')
        const data = await res.json()
        if (!cancelled) setTeams(data.teams ?? [])
      } catch {
        if (!cancelled) setError('Failed to load teams')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="scrim-page">
      <ScrimAnalyticsTabs activeTab="teams" />
      <ScrimBreadcrumbs items={[{ label: 'Scrim Analytics', href: '/admin/scrim-dashboard' }, { label: 'Teams' }]} />
      <div className="scrim-page__header">
        <h1 className="scrim-page__title">Teams</h1>
      </div>

      {error ? (
        <ErrorCard message={error} backHref="/admin/scrims" backLabel="Back to Scrims" />
      ) : teams == null ? (
        <LoadingCard message="Loading teams…" />
      ) : teams.length === 0 ? (
        <EmptyCard message="No teams with scrims yet" hint="Teams appear here once a scrim is uploaded for them" />
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {teams.map((t) => {
            const href =
              t.teamId != null
                ? `/admin/scrim-team?teamId=${t.teamId}`
                : `/admin/scrims`
            return (
              <Link
                key={t.teamId != null ? `t${t.teamId}` : `x${t.externalTeamName}`}
                href={href}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  background: SCRIM_COLORS.bgCard,
                  border: `1px solid ${SCRIM_COLORS.bgCardBorder}`,
                  borderRadius: 10,
                  padding: '14px 18px',
                  textDecoration: 'none',
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 10, color: SCRIM_COLORS.textPrimary, fontWeight: 700 }}>
                  <Flag size={14} color={SCRIM_COLORS.cyan} />
                  {t.name}
                </span>
                <span style={{ display: 'flex', gap: 18, color: SCRIM_COLORS.textMuted, fontSize: 12 }}>
                  <span>{t.count} scrim{t.count === 1 ? '' : 's'}</span>
                  <span>last played {new Date(t.lastPlayed).toLocaleDateString()}</span>
                </span>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

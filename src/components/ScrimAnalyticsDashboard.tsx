'use client'

/**
 * Scrim Analytics landing dashboard - /admin/scrim-dashboard
 *
 * Previously an alias that rendered the Scrims list under a second URL
 * (the tab bar then highlighted "Scrims" but linked elsewhere - instant
 * disorientation). Now a real landing page: your team's recent form,
 * latest scrims, and jump-off links into each section.
 */

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@payloadcms/ui'
import { BarChart3, Flag, Users, Shield, Swords } from 'lucide-react'
import type { Person } from '@/payload-types'
import ScrimAnalyticsTabs from '@/components/ScrimAnalyticsTabs'
import { LoadingCard, EmptyCard, StatCard } from '@/components/ScrimShared'
import { SCRIM_COLORS } from '@/components/ScrimShared/tokens'

interface TeamRow {
  teamId: number | null
  externalTeamName?: string | null
  name: string
  count: number
  lastPlayed: string
}

interface RecentScrim {
  id: number
  name: string
  date: string
  teamName: string | null
  mapCount: number
  maps: { result: 'win' | 'loss' | 'draw' | null }[]
}

export default function ScrimAnalyticsDashboard() {
  const { user } = useAuth<Person>()
  const [teams, setTeams] = useState<TeamRow[] | null>(null)
  const [recent, setRecent] = useState<RecentScrim[] | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [teamsRes, scrimsRes] = await Promise.all([
          fetch('/api/scrim-teams'),
          fetch('/api/scrims?limit=5'),
        ])
        const teamsData = await teamsRes.json()
        const scrimsData = await scrimsRes.json()
        if (cancelled) return
        setTeams(teamsData.teams ?? [])
        setRecent(scrimsData.scrims ?? [])
      } catch {
        if (!cancelled) {
          setTeams([])
          setRecent([])
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const firstName = (user?.name as string | undefined)?.split(' ')[0]

  return (
    <div className="scrim-page scrim-analytics-dashboard">
      <ScrimAnalyticsTabs activeTab="scrims" />
      <div className="scrim-page__header">
        <h1 className="scrim-page__title">Scrim Analytics{firstName ? ` · ${firstName}` : ''}</h1>
      </div>

      {teams == null || recent == null ? (
        <LoadingCard message="Loading dashboard…" />
      ) : (
        <>
          {/* Teams overview */}
          {teams.length === 0 ? (
            <EmptyCard
              message="No scrims in your scope yet"
              hint="Upload a log from the Upload tab to get started"
            />
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginBottom: 24 }}>
              {teams.slice(0, 4).map((t) => (
                <StatCard
                  key={t.teamId != null ? `t${t.teamId}` : `x${t.externalTeamName}`}
                  label={t.name}
                  value={
                    t.teamId != null ? (
                      <Link
                        href={`/admin/scrim-team?teamId=${t.teamId}`}
                        style={{ color: SCRIM_COLORS.cyanSoft, textDecoration: 'none', fontSize: 18 }}
                      >
                        {t.count} scrims →
                      </Link>
                    ) : (
                      <span style={{ fontSize: 18 }}>{t.count} scrims</span>
                    )
                  }
                  sub={`last played ${new Date(t.lastPlayed).toLocaleDateString()}`}
                />
              ))}
            </div>
          )}

          {/* Recent scrims */}
          {recent.length > 0 && (
            <>
              <h2 style={{ fontSize: 14, fontWeight: 700, color: SCRIM_COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 10px' }}>
                Recent Scrims
              </h2>
              <div style={{ display: 'grid', gap: 8, marginBottom: 24 }}>
                {recent.map((s) => {
                  const wins = s.maps.filter((m) => m.result === 'win').length
                  const losses = s.maps.filter((m) => m.result === 'loss').length
                  return (
                    <Link
                      key={s.id}
                      href={`/admin/scrim?scrimId=${s.id}`}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 12,
                        background: SCRIM_COLORS.bgCard,
                        border: `1px solid ${SCRIM_COLORS.bgCardBorder}`,
                        borderRadius: 10,
                        padding: '12px 16px',
                        textDecoration: 'none',
                      }}
                    >
                      <span style={{ color: SCRIM_COLORS.textPrimary, fontWeight: 600 }}>{s.name}</span>
                      <span style={{ display: 'flex', gap: 14, fontSize: 12, color: SCRIM_COLORS.textMuted }}>
                        <span>{new Date(s.date).toLocaleDateString()}</span>
                        <span>{s.mapCount} map{s.mapCount === 1 ? '' : 's'}</span>
                        <span style={{ color: wins >= losses ? SCRIM_COLORS.green : SCRIM_COLORS.red, fontWeight: 700 }}>
                          {wins}W {losses}L
                        </span>
                      </span>
                    </Link>
                  )
                })}
              </div>
            </>
          )}

          {/* Section links */}
          <h2 style={{ fontSize: 14, fontWeight: 700, color: SCRIM_COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 10px' }}>
            Explore
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
            {[
              { href: '/admin/scrims', icon: <BarChart3 size={16} />, title: 'Scrims', desc: 'Every scrim, grouped by team' },
              { href: '/admin/scrim-teams', icon: <Flag size={16} />, title: 'Teams', desc: 'Records, rosters, teamfight analysis' },
              { href: '/admin/scrim-players', icon: <Users size={16} />, title: 'Players', desc: 'Per-player stats across scrims' },
              { href: '/admin/scrim-heroes', icon: <Shield size={16} />, title: 'Heroes', desc: 'Hero pools and per-10 rates' },
              ...(teams.some((t) => t.teamId != null)
                ? [{
                    href: `/admin/scrim-team?teamId=${teams.find((t) => t.teamId != null)!.teamId}&tab=teamfights`,
                    icon: <Swords size={16} />,
                    title: 'Teamfights',
                    desc: 'Ult economy, discipline, and fight win rates',
                  }]
                : []),
            ].map((card) => (
              <Link
                key={card.href}
                href={card.href}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                  background: SCRIM_COLORS.bgCard,
                  border: `1px solid ${SCRIM_COLORS.bgCardBorder}`,
                  borderRadius: 10,
                  padding: '14px 16px',
                  textDecoration: 'none',
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, color: SCRIM_COLORS.cyan, fontWeight: 700 }}>
                  {card.icon} <span style={{ color: SCRIM_COLORS.textPrimary }}>{card.title}</span>
                </span>
                <span style={{ fontSize: 12, color: SCRIM_COLORS.textMuted }}>{card.desc}</span>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

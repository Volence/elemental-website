'use client'

/**
 * Scrim page - /admin/scrim?scrimId=N
 *
 * A scrim previously existed only as an expandable row in the list, so
 * reviewing a multi-map night meant repeatedly opening a map and losing the
 * accordion on Back. This page lists every map of one scrim with scores and
 * links, and is the target of "Recent Scrims" style links.
 */

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Map as MapIcon } from 'lucide-react'
import ScrimAnalyticsTabs from '@/components/ScrimAnalyticsTabs'
import {
  ScrimBreadcrumbs,
  BackLink,
  LoadingCard,
  ErrorCard,
  EmptyCard,
  StatCard,
} from '@/components/ScrimShared'
import { SCRIM_COLORS } from '@/components/ScrimShared/tokens'

interface ScrimMapRow {
  id: number
  name: string
  mapDataId: number | null
  opponent: string | null
  score: string | null
  result: 'win' | 'loss' | 'draw' | null
  estimated: boolean
}

interface ScrimData {
  id: number
  name: string
  date: string
  teamName: string | null
  teamName2: string | null
  externalTeamName: string | null
  opponentName: string | null
  payloadTeamId: number | null
  maps: ScrimMapRow[]
}

const RESULT_COLOR: Record<string, string> = {
  win: SCRIM_COLORS.green,
  loss: SCRIM_COLORS.red,
  draw: SCRIM_COLORS.amber,
}

export default function ScrimDetailView() {
  const searchParams = useSearchParams()
  const scrimId = searchParams.get('scrimId')
  const [scrim, setScrim] = useState<ScrimData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!scrimId) {
      setError('No scrim specified')
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`/api/scrims?scrimId=${encodeURIComponent(scrimId)}&limit=1`)
        const data = await res.json()
        if (cancelled) return
        const s = (data.scrims ?? [])[0]
        if (!s) setError('Scrim not found (or not in your scope)')
        else setScrim(s)
      } catch {
        if (!cancelled) setError('Failed to load scrim')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [scrimId])

  if (error) {
    return (
      <div className="scrim-page">
        <ScrimAnalyticsTabs activeTab="scrims" />
        <ErrorCard message={error} backHref="/admin/scrims" backLabel="Back to Scrims" />
      </div>
    )
  }
  if (!scrim) {
    return (
      <div className="scrim-page">
        <ScrimAnalyticsTabs activeTab="scrims" />
        <LoadingCard message="Loading scrim…" />
      </div>
    )
  }

  const wins = scrim.maps.filter((m) => m.result === 'win').length
  const losses = scrim.maps.filter((m) => m.result === 'loss').length
  const draws = scrim.maps.filter((m) => m.result === 'draw').length
  const opponent = scrim.maps.find((m) => m.opponent)?.opponent ?? scrim.opponentName

  return (
    <div className="scrim-page">
      <ScrimAnalyticsTabs activeTab="scrims" />
      <ScrimBreadcrumbs
        items={[
          { label: 'Scrim Analytics', href: '/admin/scrim-dashboard' },
          { label: 'Scrims', href: '/admin/scrims' },
          { label: scrim.name },
        ]}
      />
      <BackLink href="/admin/scrims" label="Back to Scrims" />
      <div className="scrim-page__header">
        <h1 className="scrim-page__title">{scrim.name}</h1>
      </div>
      <div style={{ color: SCRIM_COLORS.textMuted, fontSize: 12, marginBottom: 16 }}>
        {new Date(scrim.date).toLocaleDateString()}
        {scrim.teamName ? ` · ${scrim.teamName}` : ''}
        {opponent ? ` vs ${opponent}` : ''}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 20 }}>
        <StatCard label="Maps" value={scrim.maps.length} />
        <StatCard
          label="Map Record"
          value={`${wins}W ${losses}L${draws ? ` ${draws}D` : ''}`}
          color={wins > losses ? SCRIM_COLORS.green : wins < losses ? SCRIM_COLORS.red : undefined}
        />
        {scrim.teamName && scrim.payloadTeamId != null && (
          <StatCard
            label="Team"
            value={
              <Link href={`/admin/scrim-team?teamId=${scrim.payloadTeamId}`} style={{ color: SCRIM_COLORS.cyanSoft, textDecoration: 'none', fontSize: 16 }}>
                {scrim.teamName} →
              </Link>
            }
          />
        )}
      </div>

      {scrim.maps.length === 0 ? (
        <EmptyCard message="No maps in this scrim" />
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {scrim.maps.map((m, i) => (
            <Link
              key={m.id}
              href={m.mapDataId ? `/admin/scrim-map?mapId=${m.mapDataId}` : '#'}
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
              <span style={{ display: 'flex', alignItems: 'center', gap: 10, color: SCRIM_COLORS.textPrimary, fontWeight: 600 }}>
                <MapIcon size={14} color={SCRIM_COLORS.cyan} />
                <span style={{ color: SCRIM_COLORS.textFaint, fontSize: 12 }}>Map {i + 1}</span>
                {m.name}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 12 }}>
                {m.score && (
                  <span style={{ color: SCRIM_COLORS.textMuted }}>
                    {m.score}
                    {m.estimated ? '*' : ''}
                  </span>
                )}
                {m.result && (
                  <span style={{ color: RESULT_COLOR[m.result], fontWeight: 800, textTransform: 'uppercase' }}>
                    {m.result === 'win' ? 'W' : m.result === 'loss' ? 'L' : 'D'}
                  </span>
                )}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

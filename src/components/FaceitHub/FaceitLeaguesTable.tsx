'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { Button } from '@payloadcms/ui'
import { Plus, Trophy } from 'lucide-react'
import { AdminTable, Badge, SectionCard, type AdminTableColumn } from '@/admin-kit'

/**
 * The league templates, replacing Payload's stock list on the FaceIt page.
 * Rows open the template's edit form; Create New still exists for the odd
 * league outside the FACEIT season tree.
 */

interface LeagueRow {
  id: number
  name: string
  division: string
  region: string
  seasonNumber: number | null
  conference?: string | null
  isActive: boolean
  updatedAt?: string
}

export default function FaceitLeaguesTable() {
  const [rows, setRows] = useState<LeagueRow[]>([])
  const [loading, setLoading] = useState(true)
  const [showInactive, setShowInactive] = useState(false)

  useEffect(() => {
    fetch('/api/faceit-leagues?limit=200&depth=0&sort=-seasonNumber', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setRows(d.docs || []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false))
  }, [])

  const visible = useMemo(() => {
    const list = showInactive ? rows : rows.filter((r) => r.isActive)
    return [...list].sort(
      (a, b) => (b.seasonNumber ?? 0) - (a.seasonNumber ?? 0) || a.region.localeCompare(b.region) || a.name.localeCompare(b.name),
    )
  }, [rows, showInactive])

  const columns: AdminTableColumn<LeagueRow>[] = [
    { key: 'name', header: 'Name', render: (r) => <span className="faceit-leagues-table__name">{r.name}</span> },
    { key: 'division', header: 'Division', nowrap: true },
    { key: 'region', header: 'Region', nowrap: true },
    { key: 'seasonNumber', header: 'Season', align: 'right', nowrap: true, render: (r) => r.seasonNumber ?? '-' },
    { key: 'conference', header: 'Conference', hideOnMobile: true, render: (r) => r.conference || '-' },
    {
      key: 'isActive',
      header: 'Status',
      nowrap: true,
      render: (r) => <Badge tone={r.isActive ? 'success' : 'neutral'} size="sm">{r.isActive ? 'Active' : 'Finalized'}</Badge>,
    },
  ]

  return (
    <SectionCard
      className="faceit-leagues-table"
      title={<><Trophy size={16} /> League templates</>}
      description="One per division and region. Created by the season rollover; edit one only for an unusual league."
      actions={
        <div className="faceit-teams__toolbar">
          <label className="faceit-leagues-table__toggle">
            <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} /> Show finalized
          </label>
          <Button size="small" buttonStyle="secondary" el="link" url="/admin/collections/faceit-leagues/create">
            <Plus size={12} /> Create New
          </Button>
        </div>
      }
      flush
    >
      <AdminTable<LeagueRow>
        columns={columns}
        rows={visible}
        rowKey={(r) => r.id}
        rowHref={(r) => `/admin/collections/faceit-leagues/${r.id}`}
        loading={loading}
        dense
        aria-label="FaceIt league templates"
        emptyTitle="No active league templates"
        emptyHint="Run the season rollover above to create them."
      />
    </SectionCard>
  )
}

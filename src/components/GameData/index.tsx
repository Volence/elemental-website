'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Plus, Sparkles } from 'lucide-react'
import {
  AdminPage,
  AdminPageHeader,
  AdminTable,
  AdminTabs,
  Badge,
  ErrorState,
  SearchInput,
  EMPTY,
  formatNumber,
  tabPanelProps,
  useUrlParamState,
} from '@/admin-kit'
import type { AdminTab, AdminTableColumn, BadgeTone } from '@/admin-kit'

const TABS_ID = 'game-data'
const TABS: AdminTab[] = [
  { id: 'heroes', label: 'Heroes' },
  { id: 'maps', label: 'Maps' },
]

type Upload = { url?: string | null; thumbnailURL?: string | null } | number | null | undefined
type Hero = { id: number; name: string; role: 'tank' | 'dps' | 'support'; image?: Upload; active?: boolean | null; updatedAt?: string }
type GameMap = {
  id: number
  name: string
  type: 'control' | 'hybrid' | 'flashpoint' | 'push' | 'escort' | 'clash'
  settingsEntry?: string | null
  image?: Upload
  submaps?: { name?: string | null }[] | null
  updatedAt?: string
}

const HERO_ROLE: Record<Hero['role'], { label: string; tone: BadgeTone }> = {
  tank: { label: 'Tank', tone: 'info' },
  dps: { label: 'DPS', tone: 'danger' },
  support: { label: 'Support', tone: 'success' },
}
const MAP_TYPE: Record<GameMap['type'], string> = {
  control: 'Control',
  hybrid: 'Hybrid',
  flashpoint: 'Flashpoint',
  push: 'Push',
  escort: 'Escort',
  clash: 'Clash',
}

function thumb(upload: Upload): string | null {
  if (!upload || typeof upload !== 'object') return null
  return upload.thumbnailURL ?? upload.url ?? null
}

function useCollection<T>(slug: string) {
  const [rows, setRows] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/${slug}?limit=500&depth=1&sort=name`, { credentials: 'include' })
      if (!res.ok) throw new Error(`Could not load ${slug} (HTTP ${res.status})`)
      const data = await res.json()
      setRows(data.docs ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : `Could not load ${slug}`)
    } finally {
      setLoading(false)
    }
  }, [slug])
  useEffect(() => {
    void load()
  }, [load])
  return { rows, loading, error, reload: load }
}

function Thumb({ src, alt }: { src: string | null; alt: string }) {
  if (!src) return <span className="game-data__thumb game-data__thumb--empty" aria-hidden />
  return <img className="game-data__thumb" src={src} alt={alt} loading="lazy" decoding="async" width={28} height={28} />
}

function HeroesTab() {
  const { rows, loading, error, reload } = useCollection<Hero>('heroes')
  const [q, setQ] = useUrlParamState('q', '')
  const [role, setRole] = useUrlParamState('role', 'all')

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return rows.filter((h) => (role === 'all' || h.role === role) && (!needle || h.name.toLowerCase().includes(needle)))
  }, [rows, q, role])

  const columns: AdminTableColumn<Hero>[] = [
    {
      key: 'name',
      header: 'Hero',
      render: (h) => (
        <span className="game-data__name">
          <Thumb src={thumb(h.image)} alt="" />
          <span>{h.name}</span>
        </span>
      ),
    },
    { key: 'role', header: 'Role', render: (h) => <Badge tone={HERO_ROLE[h.role]?.tone ?? 'neutral'}>{HERO_ROLE[h.role]?.label ?? h.role}</Badge> },
    {
      key: 'active',
      header: 'Status',
      render: (h) => (h.active === false ? <Badge tone="warning">Disabled</Badge> : <Badge tone="success" dot>Active</Badge>),
    },
  ]

  return (
    <>
      <div className="pug-list__toolbar">
        <SearchInput value={q} onChange={setQ} placeholder="Search heroes" aria-label="Search heroes" size="sm" />
        <div className="ps-tabs" role="group" aria-label="Role">
          {(['all', 'tank', 'dps', 'support'] as const).map((r) => (
            <button key={r} type="button" className={`ps-tab${role === r ? ' ps-tab-active' : ''}`} onClick={() => setRole(r)} aria-pressed={role === r}>
              {r === 'all' ? 'All roles' : HERO_ROLE[r].label}
            </button>
          ))}
        </div>
        <span className="pug-list__count">{formatNumber(visible.length)} of {formatNumber(rows.length)}</span>
        <Link className="ps-btn ps-btn-primary game-data__add" href="/admin/collections/heroes/create">
          <Plus size={14} aria-hidden /> Add hero
        </Link>
      </div>
      {error ? (
        <ErrorState message={error} onRetry={() => void reload()} />
      ) : (
        <AdminTable
          aria-label="Heroes"
          columns={columns}
          rows={visible}
          rowKey={(h) => h.id}
          loading={loading}
          rowHref={(h) => `/admin/collections/heroes/${h.id}`}
          emptyTitle={rows.length === 0 ? 'No heroes yet' : 'No heroes match'}
          emptyHint={rows.length === 0 ? 'Add the hero roster so scrim and PUG stats can name them.' : undefined}
        />
      )}
    </>
  )
}

function MapsTab() {
  const { rows, loading, error, reload } = useCollection<GameMap>('maps')
  const [q, setQ] = useUrlParamState('q', '')
  const [type, setType] = useUrlParamState('type', 'all')

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return rows.filter((m) => (type === 'all' || m.type === type) && (!needle || m.name.toLowerCase().includes(needle)))
  }, [rows, q, type])

  const columns: AdminTableColumn<GameMap>[] = [
    {
      key: 'name',
      header: 'Map',
      render: (m) => (
        <span className="game-data__name">
          <Thumb src={thumb(m.image)} alt="" />
          <span>{m.name}</span>
        </span>
      ),
    },
    { key: 'type', header: 'Mode', render: (m) => <Badge>{MAP_TYPE[m.type] ?? m.type}</Badge> },
    {
      key: 'submaps',
      header: 'Sub-maps',
      hideOnMobile: true,
      render: (m) => (m.submaps?.length ? m.submaps.map((s) => s.name).filter(Boolean).join(', ') : <span className="pug-list__muted">{EMPTY}</span>),
    },
    {
      key: 'settingsEntry',
      header: 'Settings code',
      hideOnMobile: true,
      render: (m) => m.settingsEntry ? <code className="game-data__code">{m.settingsEntry}</code> : <span className="pug-list__muted">{EMPTY}</span>,
    },
  ]

  return (
    <>
      <div className="pug-list__toolbar">
        <SearchInput value={q} onChange={setQ} placeholder="Search maps" aria-label="Search maps" size="sm" />
        <select className="ps-select" value={type} onChange={(e) => setType(e.target.value)} aria-label="Mode">
          <option value="all">All modes</option>
          {Object.entries(MAP_TYPE).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <span className="pug-list__count">{formatNumber(visible.length)} of {formatNumber(rows.length)}</span>
        <Link className="ps-btn ps-btn-primary game-data__add" href="/admin/collections/maps/create">
          <Plus size={14} aria-hidden /> Add map
        </Link>
      </div>
      {error ? (
        <ErrorState message={error} onRetry={() => void reload()} />
      ) : (
        <AdminTable
          aria-label="Maps"
          columns={columns}
          rows={visible}
          rowKey={(m) => m.id}
          loading={loading}
          rowHref={(m) => `/admin/collections/maps/${m.id}`}
          emptyTitle={rows.length === 0 ? 'No maps yet' : 'No maps match'}
        />
      )}
    </>
  )
}

/** Heroes and Maps as one reference page with tabs, in place of two sidebar entries. */
export default function GameDataView() {
  const [tabParam] = useUrlParamState('tab', 'heroes')
  const tab = TABS.some((t) => t.id === tabParam) ? tabParam : 'heroes'
  return (
    <AdminPage width="default" className="game-data">
      <AdminPageHeader
        title="Heroes & Maps"
        subtitle="The Overwatch reference data behind scrim and PUG stats, settings codes and map pools."
        icon={<Sparkles size={22} />}
        breadcrumbs={[{ label: 'Heroes & Maps' }]}
      />
      <AdminTabs mode="url" id={TABS_ID} tabs={TABS} defaultTab="heroes" label="Game data" />
      <div className="ps-wrap" {...tabPanelProps(TABS_ID, tab)}>
        {tab === 'heroes' ? <HeroesTab /> : <MapsTab />}
      </div>
    </AdminPage>
  )
}

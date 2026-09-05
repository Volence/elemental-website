'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ArrowLeft, ArrowRight, BookOpen, Check, CircleDashed, ExternalLink, RotateCcw, Settings2 } from 'lucide-react'
import { AdminPage, AdminPageHeader, Badge, EmptyState, ErrorState, LoadingState, SectionCard } from '@/admin-kit'
import { sectionsDone, toggleSectionDone, type GuideProgress } from '@/guides/audience'
import { GuideBody } from './GuideBody'

type GuideSection = { id: string; heading: string; body: string | null; linkLabel: string | null; linkHref: string | null; imageUrl: string | null }
type Guide = {
  id: number
  slug: string
  title: string
  summary: string | null
  order: number
  published: boolean
  forViewer: boolean
  hasDefault: boolean
  sections: GuideSection[]
}
type GuidesResponse = { guides: Guide[]; progress: GuideProgress | null; isAdmin: boolean; installed: string[]; missingDefaults: string[] }

function progressOf(g: Guide, progress: GuideProgress | null) {
  const done = sectionsDone(progress, g.slug)
  const total = g.sections.length
  const count = g.sections.filter((s) => done.has(s.id)).length
  return { done, total, count, pct: total ? Math.round((count / total) * 100) : 0 }
}

/**
 * Me > Guides. Reference material people come back to, not a one-off tour:
 * a list of the guides that fit the viewer, and a reader with per-section
 * "done" ticks and deep links into the tool each step talks about.
 */
export default function GuidesView() {
  const searchParams = useSearchParams()
  const activeSlug = searchParams.get('g')
  const [data, setData] = useState<GuidesResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const res = await fetch('/api/my-guides', { credentials: 'include' })
      if (!res.ok) throw new Error(`Could not load guides (HTTP ${res.status})`)
      setData(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load guides')
    }
  }, [])
  useEffect(() => { void load() }, [load])

  const setDone = async (slug: string, sectionId: string, done: boolean) => {
    // Optimistic: the tick is the whole interaction, a round trip would feel broken.
    setData((d) => (d ? { ...d, progress: toggleSectionDone(d.progress, slug, sectionId, done) } : d))
    try {
      const res = await fetch('/api/my-guides/progress', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, sectionId, done }),
      })
      if (!res.ok) throw new Error()
    } catch {
      setData((d) => (d ? { ...d, progress: toggleSectionDone(d.progress, slug, sectionId, !done) } : d))
      setError('Could not save your progress. Try again.')
    }
  }

  const adminAction = async (action: 'install-missing' | 'restore', slug?: string) => {
    setBusy(slug ?? action)
    try {
      const res = await fetch('/api/my-guides', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, slug }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed')
    } finally {
      setBusy(null)
    }
  }

  const active = useMemo(() => data?.guides.find((g) => g.slug === activeSlug) ?? null, [data, activeSlug])

  if (error && !data) return <AdminPage><AdminPageHeader title="Guides" icon={<BookOpen size={20} />} /><ErrorState message={error} onRetry={() => void load()} /></AdminPage>
  if (!data) return <AdminPage><AdminPageHeader title="Guides" icon={<BookOpen size={20} />} /><LoadingState rows={4} /></AdminPage>

  if (active) {
    const p = progressOf(active, data.progress)
    return (
      <AdminPage className="guides">
        <AdminPageHeader
          title={active.title}
          icon={<BookOpen size={20} />}
          breadcrumbs={[{ label: 'Guides', href: '/admin/guides' }, { label: active.title }]}
          subtitle={active.summary ?? undefined}
          actions={
            <div className="guides__actions">
              {data.isAdmin && (
                <Link href={`/admin/collections/guides/${active.id}`} className="ps-btn ps-btn-ghost" title="Edit this guide's text">
                  <Settings2 size={14} aria-hidden /> Edit
                </Link>
              )}
              <Link href="/admin/guides" className="ps-btn ps-btn-ghost"><ArrowLeft size={14} aria-hidden /> All guides</Link>
            </div>
          }
        />
        {error && <p className="guides__error" role="alert">{error}</p>}
        {!active.published && <Badge tone="warning">Unpublished: only admins can see this</Badge>}
        <div className="guides__progress" aria-label={`${p.count} of ${p.total} sections done`}>
          <div className="guides__progress-bar"><span style={{ width: `${p.pct}%` }} /></div>
          <span className="guides__progress-text">{p.count} of {p.total} done</span>
        </div>
        <ol className="guides__sections">
          {active.sections.map((s, i) => {
            const done = p.done.has(s.id)
            const external = s.linkHref ? /^https?:\/\//i.test(s.linkHref) : false
            return (
              <li key={s.id} className={`guides__section${done ? ' guides__section--done' : ''}`}>
                <button
                  type="button"
                  className="guides__tick"
                  aria-pressed={done}
                  aria-label={done ? `Mark "${s.heading}" not done` : `Mark "${s.heading}" done`}
                  onClick={() => void setDone(active.slug, s.id, !done)}
                >
                  {done ? <Check size={14} aria-hidden /> : <span className="guides__tick-num">{i + 1}</span>}
                </button>
                <div className="guides__section-body">
                  <h3 className="guides__section-heading">{s.heading}</h3>
                  <GuideBody body={s.body} />
                  {s.imageUrl && <img className="guides__shot" src={s.imageUrl} alt="" loading="lazy" />}
                  {s.linkHref && (
                    <a className="ps-btn ps-btn-ghost guides__go" href={s.linkHref} target={external ? '_blank' : undefined} rel={external ? 'noopener noreferrer' : undefined}>
                      {s.linkLabel || 'Go there'} {external ? <ExternalLink size={13} aria-hidden /> : <ArrowRight size={13} aria-hidden />}
                    </a>
                  )}
                </div>
              </li>
            )
          })}
        </ol>
      </AdminPage>
    )
  }

  const mine = data.guides.filter((g) => g.forViewer)
  const others = data.guides.filter((g) => !g.forViewer)

  const card = (g: Guide) => {
    const p = progressOf(g, data.progress)
    return (
      <Link key={g.slug} href={`/admin/guides?g=${g.slug}`} className={`guides__card${p.total > 0 && p.count === p.total ? ' guides__card--complete' : ''}`}>
        <div className="guides__card-head">
          <BookOpen size={16} aria-hidden />
          <span className="guides__card-title">{g.title}</span>
          {!g.published && <Badge tone="warning" size="sm">Draft</Badge>}
        </div>
        {g.summary && <p className="guides__card-summary">{g.summary}</p>}
        <div className="guides__card-foot">
          {p.total === 0 ? (
            <span className="guides__muted">No sections yet</span>
          ) : p.count === p.total ? (
            <span className="guides__done"><Check size={12} aria-hidden /> Done</span>
          ) : (
            <span className="guides__muted"><CircleDashed size={12} aria-hidden /> {p.count} of {p.total} done</span>
          )}
          <span className="guides__card-open">Open <ArrowRight size={12} aria-hidden /></span>
        </div>
        {p.total > 0 && <div className="guides__progress-bar guides__progress-bar--thin"><span style={{ width: `${p.pct}%` }} /></div>}
      </Link>
    )
  }

  return (
    <AdminPage className="guides">
      <AdminPageHeader
        title="Guides"
        icon={<BookOpen size={20} />}
        subtitle="How the admin works and what your role does each week. Come back whenever you need a refresher."
        actions={data.isAdmin ? (
          <div className="guides__actions">
            {data.missingDefaults.length > 0 && (
              <button type="button" className="ps-btn ps-btn-ghost" disabled={busy != null} onClick={() => void adminAction('install-missing')}>
                <RotateCcw size={14} aria-hidden /> Add {data.missingDefaults.length} missing default{data.missingDefaults.length === 1 ? '' : 's'}
              </button>
            )}
            <Link href="/admin/collections/guides" className="ps-btn ps-btn-ghost"><Settings2 size={14} aria-hidden /> Manage guides</Link>
          </div>
        ) : undefined}
      />
      {error && <p className="guides__error" role="alert">{error}</p>}
      {data.installed.length > 0 && <p className="guides__notice">Installed the default guides ({data.installed.length}). Edit any of them under Manage guides.</p>}

      {mine.length === 0 && others.length === 0 ? (
        <EmptyState title="No guides yet" hint={data.isAdmin ? 'Add the defaults or write one under Manage guides.' : 'Nothing has been written for your role yet. Ask a staff manager.'} icon={<BookOpen size={18} />} />
      ) : (
        <>
          <SectionCard title={data.isAdmin ? 'For you' : undefined} description={data.isAdmin ? 'Guides that match your departments, plus the admin guide.' : undefined} className="guides__group">
            <div className="guides__grid">{mine.map(card)}</div>
          </SectionCard>
          {others.length > 0 && (
            <SectionCard title="Other roles" description="Everything else the org has written. Useful when you cover for someone." className="guides__group">
              <div className="guides__grid">{others.map(card)}</div>
            </SectionCard>
          )}
          {data.isAdmin && (
            <p className="guides__muted guides__restore-hint">
              Admins: each guide can be reset to its shipped text from its page.
              {data.guides.filter((g) => g.hasDefault).length > 0 && ' '}
              {data.guides.filter((g) => g.hasDefault).map((g) => (
                <button key={g.slug} type="button" className="guides__restore" disabled={busy != null} onClick={() => { if (window.confirm(`Replace "${g.title}" with the shipped default text? Your edits to it will be lost.`)) void adminAction('restore', g.slug) }}>
                  {busy === g.slug ? 'Restoring…' : `Restore ${g.title}`}
                </button>
              ))}
            </p>
          )}
        </>
      )}
    </AdminPage>
  )
}

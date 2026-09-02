'use client'

import React, { lazy, Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import UnlinkedTab from './UnlinkedTab'
import ClaimsTab from './ClaimsTab'

const MergePeopleView = lazy(() => import('@/components/SystemHealthHub/MergePeopleView'))

type TabId = 'unlinked' | 'claims' | 'merge'
const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'unlinked', label: 'Unlinked people' },
  { id: 'claims', label: 'Claims' },
  { id: 'merge', label: 'Merge' },
]

export const IdentityView: React.FC = () => {
  const params = useSearchParams()
  const [tab, setTab] = useState<TabId>('unlinked')
  const [merge, setMerge] = useState<{ targetId?: number; sourceId?: number }>({})

  useEffect(() => {
    const t = params?.get('tab') as TabId | null
    if (t && TABS.some((x) => x.id === t)) setTab(t)
    const targetId = params?.get('targetId'), sourceId = params?.get('sourceId')
    if (targetId || sourceId) setMerge({ targetId: targetId ? Number(targetId) : undefined, sourceId: sourceId ? Number(sourceId) : undefined })
  }, [params])

  const openMerge = (targetId: number, sourceId: number) => { setMerge({ targetId, sourceId }); setTab('merge') }

  return (
    <div style={{ padding: '0 24px 40px' }}>
      <h1 style={{ margin: '24px 0 4px' }}>Identity</h1>
      <p style={{ margin: '0 0 20px', opacity: 0.7 }}>Link legacy people to Discord, review claims, and merge duplicates.</p>
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {TABS.map((t) => (
          <button key={t.id} type="button" onClick={() => setTab(t.id)} style={{ padding: '8px 14px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.12)', background: tab === t.id ? 'rgba(88,101,242,0.25)' : 'transparent', color: 'inherit', cursor: 'pointer' }}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'unlinked' && <UnlinkedTab onMerge={openMerge} />}
      {tab === 'claims' && <ClaimsTab />}
      {tab === 'merge' && (
        <Suspense fallback={<p>Loading...</p>}>
          <MergePeopleView initialTargetId={merge.targetId} initialSourceId={merge.sourceId} />
        </Suspense>
      )}
    </div>
  )
}

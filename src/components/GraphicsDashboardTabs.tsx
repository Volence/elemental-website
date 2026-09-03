'use client'

import React, { lazy, Suspense } from 'react'
import { LayoutDashboard, Palette } from 'lucide-react'
import { AdminTabs, LoadingState, tabPanelProps, useUrlParamState } from '@/admin-kit'
import type { AdminTab } from '@/admin-kit'
import { KanbanBoard } from './WorkboardKanban'

const TeamBrandingGuide = lazy(() => import('./TeamBrandingGuide/TeamBrandingGuide'))

const TABS_ID = 'graphics'
const DEFAULT_TAB = 'workboard'
const TABS: AdminTab[] = [
  { id: 'workboard', label: 'Workboard', icon: <LayoutDashboard size={14} /> },
  { id: 'branding', label: 'Branding', icon: <Palette size={14} /> },
]

export default function GraphicsDashboardTabs() {
  const [tabParam] = useUrlParamState('tab', DEFAULT_TAB)
  const activeTab = TABS.some((t) => t.id === tabParam) ? tabParam : DEFAULT_TAB

  return (
    <div className="graphics-dashboard">
      <AdminTabs mode="url" id={TABS_ID} tabs={TABS} defaultTab={DEFAULT_TAB} label="Graphics sections" />

      <div {...tabPanelProps(TABS_ID, activeTab)}>
        {activeTab === 'workboard' && <KanbanBoard department="graphics" title="Graphics Dashboard" />}
        {activeTab === 'branding' && (
          <Suspense fallback={<LoadingState rows={0} label="Loading branding guide" />}>
            <TeamBrandingGuide />
          </Suspense>
        )}
      </div>
    </div>
  )
}

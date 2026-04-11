'use client'

import React, { useState, lazy, Suspense } from 'react'
import { KanbanBoard } from './WorkboardKanban'
import { LayoutDashboard, Palette } from 'lucide-react'
import './GraphicsDashboardTabs.scss'

const TeamBrandingGuide = lazy(() => import('./TeamBrandingGuide/TeamBrandingGuide'))

type Tab = 'workboard' | 'branding'

export default function GraphicsDashboardTabs() {
  const [activeTab, setActiveTab] = useState<Tab>('workboard')

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'workboard', label: 'Workboard', icon: <LayoutDashboard size={16} /> },
    { id: 'branding', label: 'Branding', icon: <Palette size={16} /> },
  ]

  return (
    <div>
      <div className="graphics-dashboard-tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`graphics-dashboard-tabs__tab ${activeTab === tab.id ? 'graphics-dashboard-tabs__tab--active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'workboard' && (
        <KanbanBoard department="graphics" title="Graphics Dashboard" />
      )}

      {activeTab === 'branding' && (
        <Suspense fallback={<div style={{ padding: '2rem', color: 'rgba(255,255,255,0.5)' }}>Loading branding guide...</div>}>
          <TeamBrandingGuide />
        </Suspense>
      )}
    </div>
  )
}

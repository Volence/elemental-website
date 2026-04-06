'use client'

import React, { useState, lazy, Suspense } from 'react'
import { BookOpen, Target } from 'lucide-react'

// Lazy-load the child dashboards
const OpponentWikiView = lazy(() => import('@/components/OpponentWikiView'))
const ScoutingDashboardView = lazy(() => import('@/components/ScoutingDashboardView'))

type TabId = 'wiki' | 'scouting'

const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'wiki', label: 'Opponent Wiki', icon: <BookOpen size={14} /> },
  { id: 'scouting', label: 'Scouting Board', icon: <Target size={14} /> },
]

const LoadingSpinner = () => (
  <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem', color: 'rgba(255,255,255,0.5)' }}>
    Loading...
  </div>
)

export default function CompetitiveHub() {
  const [activeTab, setActiveTab] = useState<TabId>('wiki')

  return (
    <div className="competitive-hub" data-section="competitive">
      <nav className="competitive-hub__tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`competitive-hub__tab ${activeTab === tab.id ? 'competitive-hub__tab--active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </nav>

      <div className="competitive-hub__content">
        <Suspense fallback={<LoadingSpinner />}>
          {activeTab === 'wiki' && <OpponentWikiView />}
          {activeTab === 'scouting' && <ScoutingDashboardView />}
        </Suspense>
      </div>
    </div>
  )
}

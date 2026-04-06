'use client'

import React, { useState, lazy, Suspense } from 'react'
import { BookOpen, Target, UserSearch, FileCheck, Shield, Map, Swords } from 'lucide-react'
import { RecruitmentListingsTab } from './RecruitmentListingsTab'
import { RecruitmentApplicationsTab } from './RecruitmentApplicationsTab'
import { ScoutReportsTab } from './ScoutReportsTab'
import { HeroesTab } from './HeroesTab'
import { MapsTab } from './MapsTab'
import { OpponentTeamsTab } from './OpponentTeamsTab'

// Lazy-load the heavy child dashboards
const OpponentWikiView = lazy(() => import('@/components/OpponentWikiView'))
const ScoutingDashboardView = lazy(() => import('@/components/ScoutingDashboardView'))

type TabId = 'wiki' | 'scouting' | 'listings' | 'applications' | 'scout-reports' | 'opponents' | 'heroes' | 'maps'

const tabs: { id: TabId; label: string; icon: React.ReactNode; dividerBefore?: boolean }[] = [
  { id: 'wiki', label: 'Opponent Wiki', icon: <BookOpen size={14} /> },
  { id: 'scouting', label: 'Scouting Board', icon: <Target size={14} /> },
  { id: 'scout-reports', label: 'Scout Reports', icon: <Shield size={14} />, dividerBefore: true },
  { id: 'opponents', label: 'Opponent Teams', icon: <Swords size={14} /> },
  { id: 'listings', label: 'Listings', icon: <UserSearch size={14} />, dividerBefore: true },
  { id: 'applications', label: 'Applications', icon: <FileCheck size={14} /> },
  { id: 'heroes', label: 'Heroes', icon: <Shield size={14} />, dividerBefore: true },
  { id: 'maps', label: 'Maps', icon: <Map size={14} /> },
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
          <React.Fragment key={tab.id}>
            {tab.dividerBefore && <span className="competitive-hub__tab-divider" />}
            <button
              className={`competitive-hub__tab ${activeTab === tab.id ? 'competitive-hub__tab--active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          </React.Fragment>
        ))}
      </nav>

      <div className="competitive-hub__content">
        <Suspense fallback={<LoadingSpinner />}>
          {activeTab === 'wiki' && <OpponentWikiView />}
          {activeTab === 'scouting' && <ScoutingDashboardView />}
        </Suspense>
        {activeTab === 'scout-reports' && <ScoutReportsTab />}
        {activeTab === 'opponents' && <OpponentTeamsTab />}
        {activeTab === 'listings' && <RecruitmentListingsTab />}
        {activeTab === 'applications' && <RecruitmentApplicationsTab />}
        {activeTab === 'heroes' && <HeroesTab />}
        {activeTab === 'maps' && <MapsTab />}
      </div>
    </div>
  )
}

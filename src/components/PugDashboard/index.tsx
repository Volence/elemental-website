'use client'

import React, { useState, lazy, Suspense } from 'react'
import { Gamepad2, Settings, Calendar, Users, Swords, Trophy, LinkIcon } from 'lucide-react'
import { PugLobbiesDashboard } from '@/components/PugLobbies'
import { SettingsGeneratorPanel } from '@/components/SettingsGenerator'

// Lazy-load the heavier sub-views
const PugSeasonsListView = lazy(() =>
  import('@/components/PugSeasons').then((m) => ({ default: m.PugSeasonsListView })),
)
const PugPlayersListView = lazy(() =>
  import('@/components/PugPlayers').then((m) => ({ default: m.PugPlayersListView })),
)
const PugMatchesListView = lazy(() =>
  import('@/components/PugMatches').then((m) => ({ default: m.PugMatchesListView })),
)
const PugLeaderboardListView = lazy(() =>
  import('@/components/PugLeaderboard').then((m) => ({ default: m.PugLeaderboardListView })),
)
const PugInviteGenerator = lazy(() =>
  import('@/components/PugInviteGenerator').then((m) => ({ default: m.PugInviteGenerator })),
)

type TabId = 'lobbies' | 'settings' | 'invites' | 'seasons' | 'players' | 'matches' | 'leaderboard'

const tabs: { id: TabId; label: string; icon: React.ReactNode; dividerBefore?: boolean }[] = [
  { id: 'lobbies', label: 'Lobbies', icon: <Gamepad2 size={14} /> },
  { id: 'settings', label: 'Settings Generator', icon: <Settings size={14} /> },
  { id: 'invites', label: 'Invites', icon: <LinkIcon size={14} /> },
  { id: 'seasons', label: 'Seasons', icon: <Calendar size={14} />, dividerBefore: true },
  { id: 'players', label: 'Players', icon: <Users size={14} /> },
  { id: 'matches', label: 'Matches', icon: <Swords size={14} />, dividerBefore: true },
  { id: 'leaderboard', label: 'Leaderboard', icon: <Trophy size={14} /> },
]

const LoadingSpinner = () => (
  <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem', color: 'rgba(255,255,255,0.5)' }}>
    Loading...
  </div>
)

export default function PugDashboard() {
  const [activeTab, setActiveTab] = useState<TabId>('lobbies')

  return (
    <div className="pug-dashboard" data-section="pugs">
      <nav className="pug-dashboard__tabs">
        {tabs.map((tab) => (
          <React.Fragment key={tab.id}>
            {tab.dividerBefore && <span className="pug-dashboard__tab-divider" />}
            <button
              className={`pug-dashboard__tab ${activeTab === tab.id ? 'pug-dashboard__tab--active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          </React.Fragment>
        ))}
      </nav>

      <div className="pug-dashboard__content">
        {activeTab === 'lobbies' && <PugLobbiesDashboard />}
        {activeTab === 'settings' && <SettingsGeneratorPanel />}
        <Suspense fallback={<LoadingSpinner />}>
          {activeTab === 'invites' && <PugInviteGenerator />}
          {activeTab === 'seasons' && <PugSeasonsListView />}
          {activeTab === 'players' && <PugPlayersListView />}
          {activeTab === 'matches' && <PugMatchesListView />}
          {activeTab === 'leaderboard' && <PugLeaderboardListView />}
        </Suspense>
      </div>
    </div>
  )
}

'use client'

import React, { lazy, Suspense } from 'react'
import { Gamepad2, Settings, Calendar, Users, Swords, Trophy, LinkIcon, Shield, Bot } from 'lucide-react'
import { AdminPage, AdminPageHeader, AdminTabs, LoadingState, tabPanelProps, useUrlParamState } from '@/admin-kit'
import { PugLobbiesDashboard } from '@/components/PugLobbies'
import { SettingsGeneratorPanel } from '@/components/SettingsGenerator'
import { PUG_DEFAULT_TAB, type PugTabId } from './tabs'

export { pugTabHref, PUG_DEFAULT_TAB } from './tabs'
export type { PugTabId } from './tabs'

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
const PugModerationPanel = lazy(() =>
  import('@/components/PugModeration').then((m) => ({ default: m.PugModerationPanel })),
)
const PugBotTestingPanel = lazy(() =>
  import('@/components/PugBotTesting').then((m) => ({ default: m.PugBotTestingPanel })),
)

export const PUG_TABS: { id: PugTabId; label: string; icon: React.ReactNode; description: string }[] = [
  { id: 'lobbies', label: 'Lobbies', icon: <Gamepad2 size={14} />, description: 'Live lobbies and region queues' },
  { id: 'settings', label: 'Settings Generator', icon: <Settings size={14} />, description: 'Custom game settings code' },
  { id: 'invites', label: 'Invites', icon: <LinkIcon size={14} />, description: 'Invite-tier links' },
  { id: 'moderation', label: 'Moderation', icon: <Shield size={14} />, description: 'Bans and unbans' },
  { id: 'bot', label: 'Bot Control', icon: <Bot size={14} />, description: 'Overwatch bot hosting' },
  { id: 'seasons', label: 'Seasons', icon: <Calendar size={14} />, description: 'Season configuration' },
  { id: 'players', label: 'Players', icon: <Users size={14} />, description: 'Registered PUG players' },
  { id: 'matches', label: 'Matches', icon: <Swords size={14} />, description: 'Match history from finished lobbies' },
  { id: 'leaderboard', label: 'Leaderboard', icon: <Trophy size={14} />, description: 'Ratings by season, tier and region' },
]

const TABS_ID = 'pug'
const DEFAULT_TAB: PugTabId = PUG_DEFAULT_TAB

function renderTab(tab: string) {
  switch (tab) {
    case 'lobbies':
      return <PugLobbiesDashboard />
    case 'settings':
      return <SettingsGeneratorPanel />
    case 'invites':
      return <PugInviteGenerator />
    case 'moderation':
      return <PugModerationPanel />
    case 'bot':
      return <PugBotTestingPanel />
    case 'seasons':
      return <PugSeasonsListView />
    case 'players':
      return <PugPlayersListView />
    case 'matches':
      return <PugMatchesListView />
    case 'leaderboard':
      return <PugLeaderboardListView />
    default:
      return <PugLobbiesDashboard />
  }
}

export default function PugDashboard() {
  // AdminTabs (mode="url") owns writes; we read the same param to pick the panel.
  const [activeTab] = useUrlParamState('tab', DEFAULT_TAB)
  const current = PUG_TABS.some((t) => t.id === activeTab) ? activeTab : DEFAULT_TAB

  return (
    <AdminPage width="default" className="pug-dashboard">
      <AdminPageHeader
        title="PUG Dashboard"
        subtitle="Lobbies, invites, moderation, seasons and ratings for pick-up games."
        icon={<Gamepad2 size={22} />}
        breadcrumbs={[{ label: 'PUG Dashboard' }]}
      />
      <AdminTabs mode="url" id={TABS_ID} tabs={PUG_TABS} defaultTab={DEFAULT_TAB} label="PUG sections" />
      <div className="pug-dashboard__content" {...tabPanelProps(TABS_ID, current)}>
        <Suspense fallback={<LoadingState rows={5} />}>{renderTab(current)}</Suspense>
      </div>
    </AdminPage>
  )
}

'use client'

import React, { lazy, Suspense } from 'react'
import { AdminTabs, LoadingState, tabPanelProps, useUrlParamState } from '@/admin-kit'
import type { AdminTab } from '@/admin-kit'
import { useAuth } from '@payloadcms/ui'
import { Calendar, PlusSquare, Users, ClipboardList, Building, BarChart3, Swords, FileText, Tv, Settings, KanbanSquare } from 'lucide-react'

// Each tab is its own chunk; the dashboard used to ship all eleven views to open one.
const WeeklyView = lazy(() => import('./ProductionDashboard/WeeklyView').then((m) => ({ default: m.WeeklyView })))
const StaffSignupsView = lazy(() => import('./ProductionDashboard/StaffSignupsView').then((m) => ({ default: m.StaffSignupsView })))
const AssignmentView = lazy(() => import('./ProductionDashboard/AssignmentView').then((m) => ({ default: m.AssignmentView })))
const ScheduleBuilderView = lazy(() => import('./ProductionDashboard/ScheduleBuilderView').then((m) => ({ default: m.ScheduleBuilderView })))
const SummaryView = lazy(() => import('./ProductionDashboard/SummaryView').then((m) => ({ default: m.SummaryView })))
const BulkTournamentCreator = lazy(() => import('./ProductionDashboard/BulkTournamentCreator').then((m) => ({ default: m.BulkTournamentCreator })))
const MatchesListTab = lazy(() => import('./ProductionDashboard/MatchesListTab').then((m) => ({ default: m.MatchesListTab })))
const TemplatesListTab = lazy(() => import('./ProductionDashboard/TemplatesListTab').then((m) => ({ default: m.TemplatesListTab })))
const StreamTrackerView = lazy(() => import('./ProductionDashboard/StreamTrackerView').then((m) => ({ default: m.StreamTrackerView })))
const SettingsView = lazy(() => import('./ProductionDashboard/SettingsView').then((m) => ({ default: m.SettingsView })))
const KanbanBoard = lazy(() => import('./WorkboardKanban').then((m) => ({ default: m.KanbanBoard })))

const TABS_ID = 'production'

export default function ProductionDashboardView() {
  const { user } = useAuth()

  // Check if user is a production manager (admin or staff-manager)
  const isProductionManager = user?.role === 'admin' || user?.role === 'staff-manager'
  const isAdmin = user?.role === 'admin'

  // Default tab: 'signups' for regular staff, 'weekly' for managers. The active tab lives in ?tab=
  // so it survives reloads and can be deep-linked (workboard task pings use ?tab=workboard&task=).
  const defaultTab = isProductionManager ? 'weekly' : 'signups'
  const [activeTabParam, setActiveTab] = useUrlParamState('tab', defaultTab)

  const tabs: AdminTab[] = [
    { id: 'weekly', label: 'Weekly View', icon: <Calendar size={14} />, hidden: !isProductionManager },
    { id: 'bulk', label: 'Bulk Create', icon: <PlusSquare size={14} />, hidden: !isProductionManager },
    { id: 'signups', label: 'Staff Signups', icon: <Users size={14} /> },
    { id: 'workboard', label: 'Workboard', icon: <KanbanSquare size={14} /> },
    { id: 'assignment', label: 'Assignment', icon: <ClipboardList size={14} />, hidden: !isProductionManager },
    { id: 'schedule', label: 'Schedule Builder', icon: <Building size={14} />, hidden: !isProductionManager },
    { id: 'summary', label: 'Summary', icon: <BarChart3 size={14} />, hidden: !isProductionManager },
    { id: 'streams', label: 'Stream Tracker', icon: <Tv size={14} />, hidden: !isProductionManager },
    { id: 'matches', label: 'Matches', icon: <Swords size={14} />, hidden: !isProductionManager },
    { id: 'templates', label: 'Templates', icon: <FileText size={14} />, hidden: !isProductionManager },
    { id: 'settings', label: 'Settings', icon: <Settings size={14} />, hidden: !isAdmin },
  ]
  const activeTab = tabs.some((t) => t.id === activeTabParam && !t.hidden) ? activeTabParam : defaultTab

  return (
    <div className="production-dashboard" data-section="production">
      <div className="production-dashboard__nav">
        <AdminTabs mode="url" id={TABS_ID} tabs={tabs} defaultTab={defaultTab} accent="info" label="Production dashboard sections" />
      </div>

      <div className="production-dashboard__content" {...tabPanelProps(TABS_ID, activeTab)}>
        <Suspense fallback={<LoadingState rows={0} label="Loading tab" />}>
        {activeTab === 'weekly' && isProductionManager && <WeeklyView />}
        {activeTab === 'bulk' && isProductionManager && <BulkTournamentCreator onSuccess={() => setActiveTab('signups')} />}
        {activeTab === 'signups' && <StaffSignupsView />}
        {activeTab === 'workboard' && <KanbanBoard department="production" />}
        {activeTab === 'assignment' && isProductionManager && <AssignmentView />}
        {activeTab === 'schedule' && isProductionManager && <ScheduleBuilderView />}
        {activeTab === 'summary' && isProductionManager && <SummaryView />}
        {activeTab === 'streams' && isProductionManager && <StreamTrackerView />}
        {activeTab === 'matches' && isProductionManager && <MatchesListTab />}
        {activeTab === 'templates' && isProductionManager && <TemplatesListTab />}
        {activeTab === 'settings' && isAdmin && <SettingsView />}
        </Suspense>
      </div>
    </div>
  )
}

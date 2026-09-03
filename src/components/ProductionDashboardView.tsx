'use client'

import React, { lazy, Suspense, useState } from 'react'
import { LoadingState } from '@/admin-kit'
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

export default function ProductionDashboardView() {
  const { user } = useAuth()

  // Check if user is a production manager (admin or staff-manager)
  const isProductionManager = user?.role === 'admin' || user?.role === 'staff-manager'
  const isAdmin = user?.role === 'admin'

  // Default tab: 'signups' for regular staff, 'weekly' for managers
  const [activeTab, setActiveTab] = useState(isProductionManager ? 'weekly' : 'signups')

  return (
    <div className="production-dashboard" data-section="production">
      <nav className="production-dashboard__tabs">
        {/* Only show management tabs to production managers */}
        {isProductionManager && (
          <>
            <button
              className={`production-dashboard__tab ${activeTab === 'weekly' ? 'production-dashboard__tab--active' : ''}`}
              onClick={() => setActiveTab('weekly')}
            >
              <Calendar size={14} />
              <span>Weekly View</span>
            </button>
            <button
              className={`production-dashboard__tab ${activeTab === 'bulk' ? 'production-dashboard__tab--active' : ''}`}
              onClick={() => setActiveTab('bulk')}
            >
              <PlusSquare size={14} />
              <span>Bulk Create</span>
            </button>
          </>
        )}

        {/* Staff Signups - visible to everyone */}
        <button
          className={`production-dashboard__tab ${activeTab === 'signups' ? 'production-dashboard__tab--active' : ''}`}
          onClick={() => setActiveTab('signups')}
        >
          <Users size={14} />
          <span>Staff Signups</span>
        </button>
        <button
          className={`production-dashboard__tab ${activeTab === 'workboard' ? 'production-dashboard__tab--active' : ''}`}
          onClick={() => setActiveTab('workboard')}
        >
          <KanbanSquare size={14} />
          <span>Workboard</span>
        </button>

        {/* Only show management tabs to production managers */}
        {isProductionManager && (
          <>
            <button
              className={`production-dashboard__tab ${activeTab === 'assignment' ? 'production-dashboard__tab--active' : ''}`}
              onClick={() => setActiveTab('assignment')}
            >
              <ClipboardList size={14} />
              <span>Assignment</span>
            </button>
            <button
              className={`production-dashboard__tab ${activeTab === 'schedule' ? 'production-dashboard__tab--active' : ''}`}
              onClick={() => setActiveTab('schedule')}
            >
              <Building size={14} />
              <span>Schedule Builder</span>
            </button>
            <button
              className={`production-dashboard__tab ${activeTab === 'summary' ? 'production-dashboard__tab--active' : ''}`}
              onClick={() => setActiveTab('summary')}
            >
              <BarChart3 size={14} />
              <span>Summary</span>
            </button>
            <button
              className={`production-dashboard__tab ${activeTab === 'streams' ? 'production-dashboard__tab--active' : ''}`}
              onClick={() => setActiveTab('streams')}
            >
              <Tv size={14} />
              <span>Stream Tracker</span>
            </button>

            {/* Data tabs - embedded collection views */}
            <span className="production-dashboard__tab-divider" />
            <button
              className={`production-dashboard__tab ${activeTab === 'matches' ? 'production-dashboard__tab--active' : ''}`}
              onClick={() => setActiveTab('matches')}
            >
              <Swords size={14} />
              <span>Matches</span>
            </button>
            <button
              className={`production-dashboard__tab ${activeTab === 'templates' ? 'production-dashboard__tab--active' : ''}`}
              onClick={() => setActiveTab('templates')}
            >
              <FileText size={14} />
              <span>Templates</span>
            </button>
          </>
        )}
        {isAdmin && (
          <>
            <span className="production-dashboard__tab-divider" />
            <button
              className={`production-dashboard__tab ${activeTab === 'settings' ? 'production-dashboard__tab--active' : ''}`}
              onClick={() => setActiveTab('settings')}
            >
              <Settings size={14} />
              <span>Settings</span>
            </button>
          </>
        )}
      </nav>

      <div className="production-dashboard__content">
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

'use client'

import React, { lazy, Suspense, useEffect, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Clock,
  Database,
  FileSearch,
  GitMerge,
  Shield,
  ShieldAlert,
  Users,
} from 'lucide-react'
import { AdminPage, AdminPageHeader, AdminTabs, LoadingState, tabPanelProps, useUrlParamState } from '@/admin-kit'
import type { AdminTab } from '@/admin-kit'

// Lazy load each view to keep the initial bundle small
const ErrorDashboardView = lazy(() => import('@/components/ErrorDashboardView'))
const CronMonitorView = lazy(() => import('@/components/CronMonitorView'))
const AuditLogView = lazy(() => import('@/components/AuditLogView'))
const ActiveSessionsView = lazy(() => import('@/components/ActiveSessionsView'))
const AdminUsageView = lazy(() => import('./AdminUsageView'))
const AccessReviewView = lazy(() => import('@/components/AccessReview'))
const DatabaseHealthView = lazy(() => import('@/components/DatabaseHealthView'))
const DataConsistencyView = lazy(() => import('@/components/DataConsistencyView'))
const IgnoredDuplicatesView = lazy(() => import('./IgnoredDuplicatesView'))
const MergePeopleView = lazy(() => import('./MergePeopleView'))
const MergeSuggestionsView = lazy(() => import('./MergeSuggestionsView'))

const TABS: AdminTab[] = [
  { id: 'errors', label: 'Errors', icon: <AlertTriangle size={16} />, description: 'Error logs and resolution tracking' },
  { id: 'cron', label: 'Cron Jobs', icon: <Clock size={16} />, description: 'Scheduled task monitoring' },
  { id: 'audit', label: 'Audit Log', icon: <Shield size={16} />, description: 'User action history' },
  { id: 'sessions', label: 'Sessions', icon: <Users size={16} />, description: 'Active user sessions' },
  { id: 'usage', label: 'Usage', icon: <BarChart3 size={16} />, description: 'Which admin screens get used' },
  { id: 'access', label: 'Access Review', icon: <ShieldAlert size={16} />, description: 'Who has elevated access and whether it is still warranted' },
  { id: 'database', label: 'Database', icon: <Database size={16} />, description: 'Collection health and stats' },
  { id: 'consistency', label: 'Data Integrity', icon: <FileSearch size={16} />, description: 'Check and fix data issues' },
  { id: 'duplicates', label: 'Ignored Dups', icon: <Users size={16} />, description: 'View ignored merge pairs' },
  { id: 'suggestions', label: 'Merge Flags', icon: <AlertTriangle size={16} />, description: 'Flagged signup duplicates' },
  { id: 'merge', label: 'Merge People', icon: <GitMerge size={16} />, description: 'Merge duplicate person records (also on /admin/identity)' },
]

const TABS_ID = 'system-health'
const DEFAULT_TAB = 'errors'

export default function SystemHealthHub() {
  // AdminTabs (mode="url") owns writes to ?tab=; we read the same param to pick the panel.
  const [activeTab] = useUrlParamState('tab', DEFAULT_TAB)
  const current = TABS.some((t) => t.id === activeTab) ? activeTab : DEFAULT_TAB

  // Merge deep links: ?targetId= and ?sourceId= preselect people in the merge tab.
  const [mergeTargetId, setMergeTargetId] = useState<number | null>(null)
  const [mergeSourceId, setMergeSourceId] = useState<number | null>(null)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const tId = parseInt(params.get('targetId') ?? '', 10)
    const sId = parseInt(params.get('sourceId') ?? '', 10)
    if (tId) setMergeTargetId(tId)
    if (sId) setMergeSourceId(sId)
  }, [])

  const renderTabContent = () => {
    switch (current) {
      case 'errors':
        return <ErrorDashboardView />
      case 'cron':
        return <CronMonitorView />
      case 'audit':
        return <AuditLogView />
      case 'sessions':
        return <ActiveSessionsView />
      case 'usage':
        return <AdminUsageView />
      case 'access':
        return <AccessReviewView embedded />
      case 'database':
        return <DatabaseHealthView />
      case 'consistency':
        return <DataConsistencyView />
      case 'duplicates':
        return <IgnoredDuplicatesView />
      case 'suggestions':
        return <MergeSuggestionsView />
      case 'merge':
        return <MergePeopleView initialTargetId={mergeTargetId} initialSourceId={mergeSourceId} />
      default:
        return null
    }
  }

  return (
    <AdminPage width="wide" className="system-health">
      <AdminPageHeader
        title="System Health"
        subtitle="Errors, cron jobs, audit log, sessions, usage, access review and database health in one place."
        icon={<Activity size={22} />}
        breadcrumbs={[{ label: 'System Health' }]}
      />
      <AdminTabs mode="url" id={TABS_ID} tabs={TABS} defaultTab={DEFAULT_TAB} label="System health sections" />
      <div className="system-health__content" {...tabPanelProps(TABS_ID, current)}>
        <Suspense fallback={<LoadingState rows={6} />}>{renderTabContent()}</Suspense>
      </div>
    </AdminPage>
  )
}

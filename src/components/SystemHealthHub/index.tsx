'use client'

import React, { useState, lazy, Suspense } from 'react'
import { useStepNav } from '@payloadcms/ui'
import { useEffect } from 'react'
import {
  Activity,
  AlertTriangle,
  Clock,
  Database,
  FileSearch,
  GitMerge,
  Shield,
  Users,
} from 'lucide-react'

// Lazy load each view to keep initial bundle small
const ErrorDashboardView = lazy(() => import('@/components/ErrorDashboardView'))
const CronMonitorView = lazy(() => import('@/components/CronMonitorView'))
const AuditLogView = lazy(() => import('@/components/AuditLogView'))
const ActiveSessionsView = lazy(() => import('@/components/ActiveSessionsView'))
const DatabaseHealthView = lazy(() => import('@/components/DatabaseHealthView'))
const DataConsistencyView = lazy(() => import('@/components/DataConsistencyView'))
const IgnoredDuplicatesView = lazy(() => import('./IgnoredDuplicatesView'))
const MergePeopleView = lazy(() => import('./MergePeopleView'))
const MergeSuggestionsView = lazy(() => import('./MergeSuggestionsView'))

interface Tab {
  id: string
  label: string
  icon: React.ReactNode
  description: string
}

const TABS: Tab[] = [
  { id: 'errors', label: 'Errors', icon: <AlertTriangle size={16} />, description: 'Error logs and resolution tracking' },
  { id: 'cron', label: 'Cron Jobs', icon: <Clock size={16} />, description: 'Scheduled task monitoring' },
  { id: 'audit', label: 'Audit Log', icon: <Shield size={16} />, description: 'User action history' },
  { id: 'sessions', label: 'Sessions', icon: <Users size={16} />, description: 'Active user sessions' },
  { id: 'database', label: 'Database', icon: <Database size={16} />, description: 'Collection health & stats' },
  { id: 'consistency', label: 'Data Integrity', icon: <FileSearch size={16} />, description: 'Check & fix data issues' },
  { id: 'duplicates', label: 'Ignored Dups', icon: <Users size={16} />, description: 'View ignored merge pairs' },
  { id: 'suggestions', label: 'Merge Flags', icon: <AlertTriangle size={16} />, description: 'Flagged signup duplicates' },
  { id: 'merge', label: 'Merge People', icon: <GitMerge size={16} />, description: 'Merge duplicate person records' },
]

function TabLoadingSpinner() {
  return (
    <div className="system-health__loading">
      <Activity size={24} className="spinning" />
      <span>Loading...</span>
    </div>
  )
}

export default function SystemHealthHub() {
  const [activeTab, setActiveTab] = useState('errors')
  const [mergeTargetId, setMergeTargetId] = useState<number | null>(null)
  const [mergeSourceId, setMergeSourceId] = useState<number | null>(null)
  const { setStepNav } = useStepNav()

  useEffect(() => {
    setStepNav([
      { label: 'System Health', url: '/admin/globals/system-health' },
    ])
  }, [setStepNav])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const tab = params.get('tab')
    if (tab && TABS.some(t => t.id === tab)) setActiveTab(tab)
    const tId = parseInt(params.get('targetId') ?? '', 10)
    const sId = parseInt(params.get('sourceId') ?? '', 10)
    if (tId) setMergeTargetId(tId)
    if (sId) setMergeSourceId(sId)
  }, [])

  const renderTabContent = () => {
    switch (activeTab) {
      case 'errors': return <ErrorDashboardView />
      case 'cron': return <CronMonitorView />
      case 'audit': return <AuditLogView />
      case 'sessions': return <ActiveSessionsView />
      case 'database': return <DatabaseHealthView />
      case 'consistency': return <DataConsistencyView />
      case 'duplicates': return <IgnoredDuplicatesView />
      case 'suggestions': return <MergeSuggestionsView />
      case 'merge': return <MergePeopleView initialTargetId={mergeTargetId} initialSourceId={mergeSourceId} />
      default: return null
    }
  }

  return (
    <div className="system-health">
      <div className="system-health__header">
        <div className="system-health__title">
          <Activity size={20} />
          <h2>System Health</h2>
        </div>
        <p className="system-health__subtitle">
          Unified monitoring dashboard for errors, cron jobs, audit logs, sessions, and database health.
        </p>
      </div>

      <div className="system-health__tabs">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={`system-health__tab ${activeTab === tab.id ? 'system-health__tab--active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
            title={tab.description}
          >
            <span className="system-health__tab-icon">{tab.icon}</span>
            <span className="system-health__tab-label">{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="system-health__content">
        <Suspense fallback={<TabLoadingSpinner />}>
          {renderTabContent()}
        </Suspense>
      </div>
    </div>
  )
}

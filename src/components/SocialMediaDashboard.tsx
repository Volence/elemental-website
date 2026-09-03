'use client'

import React, { useEffect } from 'react'
import { useAuth } from '@payloadcms/ui'
import { Calendar, LayoutList, Archive, Settings } from 'lucide-react'
import { AdminTabs, tabPanelProps, useUrlParamState } from '@/admin-kit'
import type { AdminTab } from '@/admin-kit'
import { CalendarView } from './SocialMediaDashboard/CalendarView'
import { SocialPostsTab } from './SocialMediaDashboard/SocialPostsTab'
import { SettingsTab } from './SocialMediaDashboard/SettingsTab'
import { KanbanBoard } from './WorkboardKanban'

const TAB_KEY = 'sm-dashboard-tab'
const TABS_ID = 'social'
const DEFAULT_TAB = 'calendar'
const TAB_IDS = ['calendar', 'workboard', 'posts', 'settings']

export default function SocialMediaDashboard() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin' || user?.role === 'staff-manager'
  const [tabParam, setTab] = useUrlParamState('tab', DEFAULT_TAB)

  // Sidebar links carry no ?tab=, so a fresh visit reopens the tab this browser used last.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has('tab')) return
    try {
      const stored = window.localStorage.getItem(TAB_KEY)
      if (stored && TAB_IDS.includes(stored) && stored !== DEFAULT_TAB) setTab(stored)
    } catch {
      /* best effort */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const remember = (id: string) => {
    try {
      window.localStorage.setItem(TAB_KEY, id)
    } catch {
      /* best effort */
    }
  }

  const tabs: AdminTab[] = [
    { id: 'calendar', label: 'Calendar', icon: <Calendar size={14} /> },
    { id: 'workboard', label: 'Workboard', icon: <LayoutList size={14} /> },
    { id: 'posts', label: 'Past Posts', icon: <Archive size={14} /> },
    { id: 'settings', label: 'Settings', icon: <Settings size={14} />, hidden: !isAdmin },
  ]
  const activeTab = tabs.some((t) => t.id === tabParam && !t.hidden) ? tabParam : DEFAULT_TAB

  return (
    <div className="social-media-dashboard" data-section="social-media">
      <AdminTabs mode="url" id={TABS_ID} tabs={tabs} defaultTab={DEFAULT_TAB} accent="primary" label="Social media sections" onChange={remember} />

      <div className="social-media-dashboard__content" {...tabPanelProps(TABS_ID, activeTab)}>
        {activeTab === 'calendar' && <CalendarView />}
        {activeTab === 'workboard' && <KanbanBoard department="social-media" title="Social Media Workboard" />}
        {activeTab === 'posts' && <SocialPostsTab />}
        {activeTab === 'settings' && <SettingsTab />}
      </div>
    </div>
  )
}

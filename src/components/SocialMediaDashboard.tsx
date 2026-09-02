'use client'

import React, { useState, useEffect } from 'react'
import { useAuth } from '@payloadcms/ui'
import { Calendar, LayoutList, Archive, Settings } from 'lucide-react'
import { CalendarView } from './SocialMediaDashboard/CalendarView'
import { SocialPostsTab } from './SocialMediaDashboard/SocialPostsTab'
import { SettingsTab } from './SocialMediaDashboard/SettingsTab'
import { KanbanBoard } from './WorkboardKanban'

type Tab = 'calendar' | 'workboard' | 'posts' | 'settings'

const TAB_KEY = 'sm-dashboard-tab'
const TABS: Tab[] = ['calendar', 'workboard', 'posts', 'settings']

export default function SocialMediaDashboard() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin' || user?.role === 'staff-manager'
  const [activeTab, setActiveTabState] = useState<Tab>('calendar')

  // Remember the last tab per browser
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(TAB_KEY) as Tab | null
      if (stored && TABS.includes(stored)) setActiveTabState(stored)
    } catch {
      /* best effort */
    }
  }, [])

  const setActiveTab = (tab: Tab) => {
    setActiveTabState(tab)
    try {
      window.localStorage.setItem(TAB_KEY, tab)
    } catch {
      /* best effort */
    }
  }

  const tabClass = (tab: Tab) =>
    `social-media-dashboard__tab ${activeTab === tab ? 'social-media-dashboard__tab--active' : ''}`

  return (
    <div className="social-media-dashboard" data-section="social-media">
      <nav className="social-media-dashboard__tabs">
        <button className={tabClass('calendar')} onClick={() => setActiveTab('calendar')}>
          <Calendar size={14} /> Calendar
        </button>

        <button className={tabClass('workboard')} onClick={() => setActiveTab('workboard')}>
          <LayoutList size={14} /> Workboard
        </button>

        <span className="social-media-dashboard__tab-divider" />

        <button className={tabClass('posts')} onClick={() => setActiveTab('posts')}>
          <Archive size={14} /> Past Posts
        </button>

        {isAdmin && (
          <button className={tabClass('settings')} onClick={() => setActiveTab('settings')}>
            <Settings size={14} /> Settings
          </button>
        )}
      </nav>

      <div className="social-media-dashboard__content">
        {activeTab === 'calendar' && <CalendarView />}
        {activeTab === 'workboard' && <KanbanBoard department="social-media" title="Social Media Workboard" />}
        {activeTab === 'posts' && <SocialPostsTab />}
        {activeTab === 'settings' && (isAdmin ? <SettingsTab /> : <CalendarView />)}
      </div>
    </div>
  )
}

'use client'

import React, { useState, lazy, Suspense } from 'react'
import { useAuth } from '@payloadcms/ui'
import { Users, Link as LinkIcon } from 'lucide-react'
import type { Person } from '@/payload-types'
import './index.scss'

const InviteLinksListView = lazy(() => import('./InviteLinksListView'))

type Tab = 'people' | 'invite-links'

export default function UserManagementTabs() {
  const { user } = useAuth<Person>()
  const [activeTab, setActiveTab] = useState<Tab>('people')

  const role = (user?.role as string) ?? ''
  const canSeePeople = role === 'admin'
  const canSeeInvites = role === 'admin' || role === 'staff-manager' || role === 'team-manager'

  // Build tab definitions
  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = []

  if (canSeePeople) {
    tabs.push({
      id: 'people',
      label: 'People',
      icon: <Users size={16} />,
    })
  }

  if (canSeeInvites) {
    tabs.push({
      id: 'invite-links',
      label: 'Invite Links',
      icon: <LinkIcon size={16} />,
    })
  }

  // If there's only 1 tab visible, don't render the tab bar
  if (tabs.length <= 1) {
    return null
  }

  return (
    <div className={`user-management-tabs-container ${activeTab === 'invite-links' ? 'user-management-tabs-container--show-invites' : ''}`}>
      <div className="user-management-tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`user-management-tabs__link ${activeTab === tab.id ? 'user-management-tabs__link--active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* When invite-links tab is active, render the inline list and hide Payload's default list below */}
      {activeTab === 'invite-links' && (
        <Suspense fallback={<div style={{ padding: '2rem', color: 'rgba(255,255,255,0.5)' }}>Loading...</div>}>
          <InviteLinksListView />
        </Suspense>
      )}
    </div>
  )
}

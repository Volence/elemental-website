'use client'

import React from 'react'
import Link from 'next/link'
import { useAuth } from '@payloadcms/ui'
import { BarChart3, Upload, Users, Shield } from 'lucide-react'
import type { User } from '@/payload-types'

export type ScrimTab = 'scrims' | 'upload' | 'players' | 'heroes'

interface ScrimAnalyticsTabsProps {
  activeTab: ScrimTab
}

/**
 * Shared tab bar for all Scrim Analytics pages.
 * Uses Link navigation (each tab is its own route).
 * Reuses the same dashboard-tabs styling from the scrim SCSS.
 */
export default function ScrimAnalyticsTabs({ activeTab }: ScrimAnalyticsTabsProps) {
  const { user } = useAuth<User>()
  const role = (user?.role as string) ?? ''
  const canUpload = ['admin', 'staff-manager', 'team-manager', 'player'].includes(role)

  const tabs: { id: ScrimTab; label: string; icon: React.ReactNode; href: string; show: boolean }[] = [
    { id: 'scrims', label: 'Scrims', icon: <BarChart3 size={14} />, href: '/admin/scrims', show: true },
    { id: 'upload', label: 'Upload', icon: <Upload size={14} />, href: '/admin/scrim-upload', show: canUpload },
    { id: 'players', label: 'Players', icon: <Users size={14} />, href: '/admin/scrim-players', show: true },
    { id: 'heroes', label: 'Heroes', icon: <Shield size={14} />, href: '/admin/scrim-heroes', show: true },
  ]

  return (
    <div className="scrim-analytics-dashboard__tabs">
      {tabs.filter(t => t.show).map((tab) => (
        <Link
          key={tab.id}
          href={tab.href}
          className={`scrim-analytics-dashboard__tab ${activeTab === tab.id ? 'scrim-analytics-dashboard__tab--active' : ''}`}
        >
          <span className="scrim-analytics-dashboard__tab-icon">{tab.icon}</span>
          <span className="scrim-analytics-dashboard__tab-label">{tab.label}</span>
        </Link>
      ))}
    </div>
  )
}

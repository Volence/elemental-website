'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BarChart3, Upload, Users, Shield, Flag, LayoutDashboard } from 'lucide-react'
import { useAccess } from '@/access/useAccess'
import { resolveScrimTab, SCRIM_TAB_HREFS, type ScrimTab } from './resolve'
import { canUploadScrims } from './access'

export type { ScrimTab } from './resolve'

interface ScrimAnalyticsTabsProps {
  /** Ignored: the active tab is derived from the URL. Kept so existing call sites compile. */
  activeTab?: ScrimTab
}

/**
 * Shared tab bar for all Scrim Analytics pages. Each tab is its own route, so
 * these are links styled as tabs; the active one is derived from the pathname.
 */
export default function ScrimAnalyticsTabs(_props: ScrimAnalyticsTabsProps) {
  const pathname = usePathname()
  const { access } = useAccess()
  // Must match ScrimUpload/Route.tsx's guard - a tab that redirects away is worse than none
  const canUpload = canUploadScrims(access)

  const active = resolveScrimTab(pathname)

  const tabs: { id: ScrimTab; label: string; icon: React.ReactNode; show: boolean }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={14} />, show: true },
    { id: 'scrims', label: 'Scrims', icon: <BarChart3 size={14} />, show: true },
    { id: 'teams', label: 'Teams', icon: <Flag size={14} />, show: true },
    { id: 'players', label: 'Players', icon: <Users size={14} />, show: true },
    { id: 'heroes', label: 'Heroes', icon: <Shield size={14} />, show: true },
    { id: 'upload', label: 'Upload', icon: <Upload size={14} />, show: canUpload },
  ]

  return (
    <nav className="scrim-analytics-tabs" aria-label="Scrim analytics sections">
      <div className="kit-tabs kit-tabs--info">
        {tabs
          .filter((t) => t.show)
          .map((tab) => (
            <Link
              key={tab.id}
              href={SCRIM_TAB_HREFS[tab.id]}
              className={`kit-tabs__tab${active === tab.id ? ' kit-tabs__tab--active' : ''}`}
              aria-current={active === tab.id ? 'page' : undefined}
            >
              <span className="kit-tabs__icon">{tab.icon}</span>
              <span className="kit-tabs__label">{tab.label}</span>
            </Link>
          ))}
      </div>
    </nav>
  )
}

'use client'

import React from 'react'
import Link from 'next/link'
import { useAuth } from '@payloadcms/ui'
import { Upload, BarChart3, Calendar, PlusCircle } from 'lucide-react'
import type { User } from '@/payload-types'
import { UserRole } from '@/access/roles'

/**
 * Quick Actions bar — prominent shortcut buttons for frequent admin tasks.
 * Role-filtered: buttons only show if the user has access.
 */
export default function QuickActionsWidget() {
  const { user } = useAuth<User>()
  if (!user) return null

  const role = (user.role as string) ?? ''
  const isManager = [UserRole.ADMIN, UserRole.STAFF_MANAGER, UserRole.TEAM_MANAGER].includes(role as UserRole)
  const canCreate = [UserRole.ADMIN, UserRole.STAFF_MANAGER].includes(role as UserRole)

  const actions: { icon: React.ReactNode; label: string; href: string; show: boolean; color: string }[] = [
    {
      icon: <Upload size={18} />,
      label: 'Upload Scrim',
      href: '/admin/scrim-upload',
      show: isManager || role === 'player',
      color: '#06b6d4',
    },
    {
      icon: <BarChart3 size={18} />,
      label: 'Scrim Analytics',
      href: '/admin/scrims',
      show: true,
      color: '#a855f7',
    },
    {
      icon: <Calendar size={18} />,
      label: 'Calendar',
      href: '/admin/calendar',
      show: true,
      color: '#f59e0b',
    },
    {
      icon: <PlusCircle size={18} />,
      label: 'Create Match',
      href: '/admin/collections/matches/create',
      show: canCreate,
      color: '#10b981',
    },
  ]

  const visible = actions.filter(a => a.show)

  return (
    <div className="dashboard-quick-actions">
      {visible.map((action) => (
        <Link key={action.label} href={action.href} className="dashboard-quick-actions__btn" style={{ '--action-color': action.color } as React.CSSProperties}>
          <span className="dashboard-quick-actions__icon">{action.icon}</span>
          <span className="dashboard-quick-actions__label">{action.label}</span>
        </Link>
      ))}
    </div>
  )
}

import type { AdminViewServerProps } from 'payload'
import React from 'react'
import { redirect } from 'next/navigation'
import LinkDiscordBanner from '@/components/BeforeDashboard/LinkDiscordBanner'
import { SectionThemeApplicator } from '@/components/SectionThemeApplicator'
import AdminDashboard from '@/components/BeforeDashboard'

/**
 * /admin: replaces Payload's dashboard (admin.components.views.dashboard). Payload
 * renders this inside DefaultTemplate itself, so the default collection cards never
 * appear and nothing has to hide them after mount.
 */
const DashboardRoute: React.FC<AdminViewServerProps> = ({ initPageResult }) => {
  if (!initPageResult.req.user) redirect('/admin/login')
  return (
    <div className="elmt-dashboard">
      <LinkDiscordBanner />
      <SectionThemeApplicator />
      <AdminDashboard />
    </div>
  )
}

export default DashboardRoute

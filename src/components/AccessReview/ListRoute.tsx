import type { AdminViewServerProps } from 'payload'
import React from 'react'
import { redirect } from 'next/navigation'

/**
 * Access Review lives as a tab of System Health. This route only exists so the
 * old /admin/access-review URL keeps working for bookmarks and links.
 */
const AccessReviewRoute: React.FC<AdminViewServerProps> = ({ initPageResult }) => {
  const user = initPageResult.req.user
  const role = (user as any)?.role as string | undefined
  if (!user || role !== 'admin') redirect('/admin')
  redirect('/admin/globals/system-health?tab=access')
}

export default AccessReviewRoute

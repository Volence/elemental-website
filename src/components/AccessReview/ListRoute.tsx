import type { AdminViewServerProps } from 'payload'
import { redirect } from 'next/navigation'
import { accessForAdminRoute } from '@/access/serverAccess'

/**
 * Access Review lives as a tab of System Health. This route only exists so the
 * old /admin/access-review URL keeps working for bookmarks and links.
 */
const AccessReviewRoute = async ({ initPageResult }: AdminViewServerProps) => {
  const access = await accessForAdminRoute(initPageResult)
  if (!access || !access.isAdmin) redirect('/admin')
  redirect('/admin/globals/system-health?tab=access')
}

export default AccessReviewRoute

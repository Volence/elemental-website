import type { AdminViewServerProps } from 'payload'
import { redirect } from 'next/navigation'

/**
 * The Users editor was folded into the People editor (it edited the same
 * people row with fewer cards). Old links and bookmarks land here and move on.
 */
const EditUserRoute = ({ searchParams }: AdminViewServerProps) => {
  const raw = searchParams?.id
  const id = Array.isArray(raw) ? raw[0] : raw
  redirect(id ? `/admin/edit-person?id=${encodeURIComponent(String(id))}` : '/admin/manage-users')
}

export default EditUserRoute

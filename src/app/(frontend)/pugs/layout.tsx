import React from 'react'
import { cookies } from 'next/headers'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { PugNav } from './PugNav'
import { PUG_NAV_ITEMS, type PugNavItem } from './navItems'

export const dynamic = 'force-dynamic'

/** Registered PUG players get a Profile item that points at their own profile. */
async function getViewerProfileHref(): Promise<string | null> {
  const token = (await cookies()).get('payload-token')?.value
  if (!token) return null
  try {
    const payload = await getPayload({ config: configPromise })
    const { user } = await payload.auth({ headers: new Headers({ Authorization: `JWT ${token}` }) })
    const tiers = (user as { pugTiers?: string[] | null } | null)?.pugTiers
    return user && tiers && tiers.length > 0 ? `/pugs/profile/${user.id}` : null
  } catch {
    return null
  }
}

export default async function PugsLayout({ children }: { children: React.ReactNode }) {
  const profileHref = await getViewerProfileHref()
  const items: PugNavItem[] = profileHref
    ? [...PUG_NAV_ITEMS, { href: profileHref, label: 'Profile' }]
    : PUG_NAV_ITEMS

  return (
    <>
      <div className="container mx-auto px-4 pt-8">
        <PugNav items={items} />
      </div>
      {children}
    </>
  )
}

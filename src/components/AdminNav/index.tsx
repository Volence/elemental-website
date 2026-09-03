import React from 'react'
import type { PayloadRequest, ServerProps } from 'payload'
import { PREFERENCE_KEYS } from 'payload/shared'
import { Logout } from '@payloadcms/ui'
import { buildNavAreas, type NavUserLike } from './buildNav'
import { AdminNavClient } from './AdminNavClient'

type VisibleEntitiesLike = { collections?: string[]; globals?: string[] }

// Payload's DefaultTemplate passes these to the Nav component alongside the standard server props.
type AdminNavProps = ServerProps & {
  visibleEntities?: VisibleEntitiesLike
  req?: PayloadRequest
}

/**
 * Replaces Payload's DefaultNav (admin.components.Nav). Builds the curated
 * sidebar from what the user can see, loads their group open/closed preference
 * the same way Payload does, and hands both to the client renderer.
 */
export default async function AdminNav(props: AdminNavProps) {
  const { payload, permissions, req, visibleEntities } = props
  // Some custom routes render DefaultTemplate without `user`; the request always has it.
  const user = props.user ?? (req?.user as typeof props.user | undefined)
  if (!user) return null

  // Payload passes visibleEntities to nav components; fall back to read permissions if it ever does not.
  const collections =
    visibleEntities?.collections ??
    Object.entries(permissions?.collections ?? {})
      .filter(([, p]) => p?.read)
      .map(([slug]) => slug)
  const globals =
    visibleEntities?.globals ??
    Object.entries(permissions?.globals ?? {})
      .filter(([, p]) => p?.read)
      .map(([slug]) => slug)

  const areas = buildNavAreas({ user: user as unknown as NavUserLike, collections, globals })

  let groupPrefs: Record<string, { open?: boolean } | undefined> = {}
  try {
    if (user.collection && req) {
      const prefs = await payload.find({
        collection: 'payload-preferences',
        depth: 0,
        limit: 1,
        pagination: false,
        req,
        where: {
          and: [
            { key: { equals: PREFERENCE_KEYS.NAV } },
            { 'user.relationTo': { equals: user.collection } },
            { 'user.value': { equals: user.id } },
          ],
        },
      })
      const value = prefs?.docs?.[0]?.value as { groups?: Record<string, { open?: boolean }> } | undefined
      groupPrefs = value?.groups ?? {}
    }
  } catch {
    // Preferences are a nicety; the nav renders with every group open.
  }

  return <AdminNavClient areas={areas} groupPrefs={groupPrefs} logout={<Logout />} />
}

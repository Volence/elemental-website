import { revalidateTag } from 'next/cache'
import type { CollectionAfterChangeHook, CollectionAfterDeleteHook } from 'payload'

/** Drops the cached `getAllTeams()` result (tag `teams`) whenever a team changes. */
function revalidateTeamsTag(): void {
  try {
    revalidateTag('teams')
  } catch {
    // Called outside a Next request (scripts, Discord bot): nothing to invalidate.
  }
}

export const revalidateTeamsAfterChange: CollectionAfterChangeHook = ({ doc }) => {
  revalidateTeamsTag()
  return doc
}

export const revalidateTeamsAfterDelete: CollectionAfterDeleteHook = ({ doc }) => {
  revalidateTeamsTag()
  return doc
}

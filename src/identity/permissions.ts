import { resolveAccess, type AccessPersonInput } from '@/access'

/**
 * Who may search Discord members and create people from them.
 * @deprecated use `access.canPickMembers` (server: `resolveAccess(user, []).canPickMembers`,
 * client: `useAccess().access?.canPickMembers`). Kept only so remaining callers stay green until
 * Task 8 moves them onto the resolver directly and deletes this file.
 */
export function canPickMembers(user: AccessPersonInput | null | undefined): boolean {
  if (!user) return false
  return resolveAccess(user, []).canPickMembers
}

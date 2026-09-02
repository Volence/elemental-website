import type { DiscordProfile } from './guild'
import type { PersonRow, ClaimCandidate } from './people'
import { discordNamesOf } from './people'

export interface LoginDeps {
  isMember(discordId: string): Promise<boolean | null>
  findByDiscordId(discordId: string): Promise<PersonRow | null>
  createFromDiscord(profile: DiscordProfile): Promise<PersonRow>
  refreshProfile(personId: number, profile: DiscordProfile): Promise<void>
  findClaimCandidates(discordNames: string[]): Promise<ClaimCandidate[]>
}

export type LoginOutcome =
  | { kind: 'not_member' }
  | { kind: 'membership_unknown' }
  | { kind: 'login'; person: PersonRow }
  | { kind: 'created'; person: PersonRow; candidates: ClaimCandidate[] }

/** Login flow. Membership is checked first so non-members never get a row. */
export async function resolveDiscordLogin(deps: LoginDeps, profile: DiscordProfile): Promise<LoginOutcome> {
  const member = await deps.isMember(profile.id)
  if (member === null) return { kind: 'membership_unknown' }
  if (member === false) return { kind: 'not_member' }

  const existing = await deps.findByDiscordId(profile.id)
  if (existing) {
    await deps.refreshProfile(existing.id, profile)
    return { kind: 'login', person: existing }
  }

  const person = await deps.createFromDiscord(profile)
  const candidates = await deps.findClaimCandidates(discordNamesOf(profile))
  return { kind: 'created', person, candidates }
}

export interface LinkDeps {
  findByDiscordId(discordId: string): Promise<PersonRow | null>
  hasReferences(personId: number): Promise<boolean>
  setIdentity(personId: number, profile: DiscordProfile): Promise<void>
  clearDiscordId(personId: number): Promise<void>
  markInactive(personId: number, mergedInto: number): Promise<void>
}

export type LinkOutcome =
  | { kind: 'linked' }
  | { kind: 'already_linked_here' }
  | { kind: 'conflict'; otherId: number }

/**
 * A row nobody has ever claimed as a real account: either no email at all (the Discord
 * self-signup shape, which uses username = discordId and no email) or a synthetic
 * `@elmt.placeholder` address left over from the old import. Password hashes are useless as a
 * signal because every row carries one - Discord self-signups get a random unusable password.
 */
export function isSyntheticIdentity(row: { email?: string | null }): boolean {
  return !row.email || row.email.endsWith('@elmt.placeholder')
}

/**
 * Link flow. A "stray" row (a synthetic identity with no team/staff references) is absorbed:
 * its Discord ID moves to the current person and the stray is archived.
 */
export async function resolveDiscordLink(deps: LinkDeps, currentPersonId: number, profile: DiscordProfile): Promise<LinkOutcome> {
  const other = await deps.findByDiscordId(profile.id)
  if (other && other.id === currentPersonId) return { kind: 'already_linked_here' }

  if (other) {
    const stray = isSyntheticIdentity(other) && !(await deps.hasReferences(other.id))
    if (!stray) return { kind: 'conflict', otherId: other.id }
    await deps.clearDiscordId(other.id)
    await deps.markInactive(other.id, currentPersonId)
  }

  await deps.setIdentity(currentPersonId, profile)
  return { kind: 'linked' }
}

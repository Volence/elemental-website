import type { Payload } from 'payload'
import { sql } from 'drizzle-orm'
import { randomBytes } from 'crypto'
import type { DiscordProfile } from './guild'
import { rankCandidates } from './match'

export interface PersonRow {
  id: number
  name: string
  email: string | null
  discordId: string | null
  role: string | null
  isInactive: boolean
  hash?: string | null
}

function toRow(doc: any): PersonRow {
  return {
    id: doc.id,
    name: doc.name,
    email: doc.email ?? null,
    discordId: doc.discordId ?? null,
    role: doc.role ?? null,
    isInactive: doc.isInactive === true,
    hash: doc.hash ?? null,
  }
}

function db(payload: Payload) {
  return (payload as any).db.drizzle as { execute(q: any): Promise<any> }
}

export function discordNamesOf(profile: { username: string; displayName: string; nickname?: string | null }): string[] {
  return [profile.username, profile.displayName, profile.nickname ?? ''].filter(Boolean)
}

export async function findPersonByDiscordId(payload: Payload, discordId: string): Promise<PersonRow | null> {
  const res = await payload.find({ collection: 'people', where: { discordId: { equals: discordId } }, limit: 1, depth: 0, overrideAccess: true, showHiddenFields: true })
  return res.docs[0] ? toRow(res.docs[0]) : null
}

/**
 * Discord-created rows: username = discordId (Payload needs username or email), a random
 * unusable password (Payload requires one), no email, role user.
 */
export async function createPersonFromDiscord(payload: Payload, profile: DiscordProfile): Promise<PersonRow> {
  const data: Record<string, any> = {
    name: profile.displayName,
    username: profile.id,
    password: randomBytes(32).toString('hex'),
    role: 'user',
    discordId: profile.id,
    discordUsername: profile.username,
    discordAvatar: profile.avatar,
  }
  try {
    const doc = await payload.create({ collection: 'people', data: data as any, overrideAccess: true, context: { identityCreate: true } })
    return toRow(doc)
  } catch (err: any) {
    if (!err?.message?.includes('slug')) throw err
    const slug = `${profile.displayName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${profile.id.slice(-4)}`
    const doc = await payload.create({ collection: 'people', data: { ...data, slug } as any, overrideAccess: true, context: { identityCreate: true } })
    return toRow(doc)
  }
}

export async function refreshDiscordProfile(payload: Payload, personId: number, profile: DiscordProfile): Promise<void> {
  await db(payload).execute(
    sql`UPDATE people SET discord_username = ${profile.username}, discord_avatar = ${profile.avatar} WHERE id = ${personId}`,
  )
}

export async function setDiscordIdentity(payload: Payload, personId: number, profile: DiscordProfile): Promise<void> {
  await db(payload).execute(
    sql`UPDATE people SET discord_id = ${profile.id}, discord_username = ${profile.username}, discord_avatar = ${profile.avatar} WHERE id = ${personId}`,
  )
}

export async function clearDiscordId(payload: Payload, personId: number): Promise<void> {
  await db(payload).execute(sql`UPDATE people SET discord_id = NULL, username = NULL WHERE id = ${personId}`)
}

export async function markInactive(payload: Payload, personId: number, mergedInto: number | null): Promise<void> {
  await db(payload).execute(sql`UPDATE people SET is_inactive = true, merged_into_id = ${mergedInto} WHERE id = ${personId}`)
}

/** True when the person appears on any team array or staff collection. */
export async function personHasReferences(payload: Payload, personId: number): Promise<boolean> {
  const res = await db(payload).execute(sql`
    SELECT 1 FROM teams_roster WHERE person_id = ${personId}
    UNION ALL SELECT 1 FROM teams_subs WHERE person_id = ${personId}
    UNION ALL SELECT 1 FROM teams_captain WHERE person_id = ${personId}
    UNION ALL SELECT 1 FROM teams_coaches WHERE person_id = ${personId}
    UNION ALL SELECT 1 FROM teams_manager WHERE person_id = ${personId}
    UNION ALL SELECT 1 FROM teams WHERE co_captain_id = ${personId}
    UNION ALL SELECT 1 FROM organization_staff WHERE person_id = ${personId}
    UNION ALL SELECT 1 FROM production WHERE person_id = ${personId}
    LIMIT 1
  `)
  const rows = res?.rows ?? res
  return Array.isArray(rows) && rows.length > 0
}

export interface ClaimCandidate {
  id: number
  name: string
  teams: string[]
  score: number
}

/** Unlinked, active people whose name/aliases/battletag resemble the Discord names. */
export async function findClaimCandidates(payload: Payload, discordNames: string[]): Promise<ClaimCandidate[]> {
  const people = await payload.find({
    collection: 'people',
    where: { and: [{ discordId: { exists: false } }, { isInactive: { not_equals: true } }] },
    limit: 5000,
    depth: 0,
    overrideAccess: true,
    select: { name: true, gameAliases: true, pugBattleTag: true },
  })
  const ranked = rankCandidates(
    people.docs as any[],
    (p) => [p.name, ...((p.gameAliases ?? []) as any[]).map((a) => a?.alias ?? ''), (p.pugBattleTag ?? '').split('#')[0]],
    discordNames,
  )
  if (ranked.length === 0) return []

  const ids = ranked.map((r) => r.item.id)
  const teams = await payload.find({ collection: 'teams', limit: 500, depth: 0, overrideAccess: true, select: { name: true, roster: true, subs: true } })
  const teamsByPerson = new Map<number, string[]>()
  for (const t of teams.docs as any[]) {
    for (const entry of [...(t.roster ?? []), ...(t.subs ?? [])]) {
      const pid = typeof entry.person === 'object' ? entry.person?.id : entry.person
      if (ids.includes(pid)) teamsByPerson.set(pid, [...(teamsByPerson.get(pid) ?? []), t.name])
    }
  }
  return ranked.map((r) => ({ id: r.item.id, name: r.item.name, teams: teamsByPerson.get(r.item.id) ?? [], score: r.score }))
}

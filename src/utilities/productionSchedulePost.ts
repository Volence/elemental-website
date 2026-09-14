/**
 * Text for the weekly production broadcast schedule.
 *
 * Pure: no Payload, no Discord client. The Schedule Builder preview and the
 * bot both render through here so what the lead sees is what gets posted.
 * Two flavours: the staff post (internal channel, real pings) and the public
 * post (announcements, names only).
 */
import type { Where } from 'payload'
import { FACEIT_DIVISIONS, divisionFromRating } from './divisions'

export const DISCORD_MESSAGE_LIMIT = 2000
export const DEFAULT_LEAGUE_LABEL = 'FACEIT League'
export const STREAM_URL = 'https://twitch.tv/elmt_gg'
const LOBBY_PLACEHOLDER = 'https://www.faceit.com/en/ow2/room/[TBD]'

export interface SchedulePerson {
  id: number
  name?: string | null
  email?: string | null
  discordId?: string | null
}

export interface ScheduleTeam {
  name?: string | null
  region?: string | null
  rating?: string | number | null
}

export interface ScheduleMatch {
  id: number
  title?: string | null
  date: string
  opponent?: string | null
  league?: string | null
  region?: string | null
  faceitLobby?: string | null
  isTournamentSlot?: boolean | null
  /** Legacy single-team field */
  team?: ScheduleTeam | number | null
  team1Type?: 'internal' | 'external' | null
  team1Internal?: ScheduleTeam | number | null
  team1External?: string | null
  team2Type?: 'internal' | 'external' | null
  team2Internal?: ScheduleTeam | number | null
  team2External?: string | null
  productionWorkflow?: {
    includeInSchedule?: boolean | null
    coverageStatus?: string | null
    assignedObservers?: Array<SchedulePerson | number | null> | null
    assignedProducers?: Array<SchedulePerson | number | null> | null
    assignedDirectors?: Array<SchedulePerson | number | null> | null
    assignedCasters?: Array<{ user?: SchedulePerson | number | null }> | null
  } | null
}

export type MentionStyle = 'discord' | 'preview'

export interface StaffFormatOptions {
  mentionStyle: MentionStyle
}

export interface PublicFormatOptions {
  /** Shown when the match's league field holds a tier name instead of a league. */
  defaultLeague?: string
}

export interface SchedulePosts {
  staff: string[]
  public: string[]
  matchIds: number[]
}

const EMPTY_STAFF = '**No matches selected for broadcast this week.**\n\nUse the checkboxes to select matches to include in the schedule.'
const EMPTY_PUBLIC = '**No matches selected for broadcast this week.**'

function isPopulated<T extends object>(value: T | number | null | undefined): value is T {
  return !!value && typeof value === 'object'
}

function personName(person: SchedulePerson | number | null | undefined): string {
  if (!person) return 'Unknown'
  if (typeof person === 'number') return `User #${person}`
  return person.name || person.email || 'Unknown'
}

function mention(person: SchedulePerson | number | null | undefined, style: MentionStyle): string {
  if (!person) return 'TBD'
  if (style === 'discord' && typeof person === 'object' && person.discordId) {
    return `<@${person.discordId}>`
  }
  return `@${personName(person)}`
}

/**
 * One "Role: name & name" line. Every production role is a list now, so the label follows the
 * count: one observer reads "Observer", several read "Observers".
 */
function roleLine(
  label: string,
  people: Array<SchedulePerson | number | null> | null | undefined,
  render: (p: SchedulePerson | number) => string,
  fallback: string | null = 'TBD',
): string | null {
  const names = (people ?? []).filter((p): p is SchedulePerson | number => p != null).map(render)
  if (names.length === 0) return fallback === null ? null : `${label}: ${fallback}`
  return `${names.length > 1 ? label + 's' : label}: ${names.join(' & ')}`
}

/** The ELMT side of the match, from the new fields, then the legacy one. */
export function resolveHomeTeam(match: ScheduleMatch): ScheduleTeam | null {
  if (match.team1Type === 'internal' && isPopulated(match.team1Internal)) return match.team1Internal
  if (isPopulated(match.team)) return match.team
  return null
}

export function homeTeamName(match: ScheduleMatch): string {
  const team = resolveHomeTeam(match)
  if (team?.name) return team.name
  if (match.team1Type === 'external' && match.team1External) return match.team1External
  if (match.isTournamentSlot) return 'Tournament Slot'
  return 'TBD'
}

export function opponentName(match: ScheduleMatch): string {
  if (match.team2Type === 'internal' && isPopulated(match.team2Internal) && match.team2Internal.name) {
    return match.team2Internal.name
  }
  if (match.team2Type === 'external' && match.team2External) return match.team2External
  return match.opponent || 'TBD'
}

/** "Bug" -> "ELMT Bug"; "ELMT Bug" stays as is. */
export function withOrgPrefix(name: string): string {
  return name.startsWith('ELMT ') ? name : `ELMT ${name}`
}

export function discordTimestamp(date: string): string {
  const unix = Math.floor(new Date(date).getTime() / 1000)
  return `<t:${unix}:F>`
}

/**
 * Which matches the posted schedule is built from: upcoming matches ticked for it, plus any
 * match already in this week's post. The second half keeps a played match in the post instead
 * of dropping it once its date passes or it is marked complete - only unticking or cancelling
 * a match takes it out. `keepIds` is empty when a fresh week's post is being made.
 */
export function scheduleMatchesWhere(since: Date, keepIds: number[]): Where {
  const upcoming: Where = {
    and: [
      { date: { greater_than_equal: since.toISOString() } },
      { 'productionWorkflow.includeInSchedule': { equals: true } },
      { 'productionWorkflow.isArchived': { not_equals: true } },
      { status: { not_in: ['complete', 'cancelled'] } },
    ],
  }
  if (keepIds.length === 0) return upcoming
  return {
    or: [
      upcoming,
      {
        and: [
          { id: { in: keepIds } },
          { 'productionWorkflow.includeInSchedule': { equals: true } },
          { status: { not_equals: 'cancelled' } },
        ],
      },
    ],
  }
}

function selectedMatches(matches: ScheduleMatch[]): ScheduleMatch[] {
  return matches
    .filter((m) => m.productionWorkflow?.includeInSchedule)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
}

function staffSection(match: ScheduleMatch, style: MentionStyle): string {
  const pw = match.productionWorkflow ?? {}
  const casters = pw.assignedCasters?.map((c) => mention(c.user, style)).filter((s) => s !== 'TBD')
  return [
    `${discordTimestamp(match.date)}:`,
    '',
    `${withOrgPrefix(homeTeamName(match))} vs ${opponentName(match)}`,
    `FACEIT Lobby: ${match.faceitLobby || LOBBY_PLACEHOLDER}`,
    '',
    roleLine('Observer', pw.assignedObservers, (p) => mention(p, style)),
    roleLine('Producer', pw.assignedProducers, (p) => mention(p, style)),
    // Director is optional: no line at all rather than a standing TBD.
    roleLine('Director', pw.assignedDirectors, (p) => mention(p, style), null),
    `Casters: ${casters && casters.length > 0 ? casters.join(' & ') : 'TBD'}`,
    '',
  ]
    .filter((line): line is string => line !== null)
    .join('\n')
}

const STAFF_HEADER = 'Schedule for the week!\n\n'
const STAFF_SEPARATOR = '\n' + '-'.repeat(80) + '\n\n'

export function formatStaffSections(matches: ScheduleMatch[], opts: StaffFormatOptions): string[] {
  return selectedMatches(matches).map((m) => staffSection(m, opts.mentionStyle))
}

export function formatStaffSchedule(matches: ScheduleMatch[], opts: StaffFormatOptions): string {
  const sections = formatStaffSections(matches, opts)
  if (sections.length === 0) return EMPTY_STAFF
  return STAFF_HEADER + sections.join(STAFF_SEPARATOR)
}

function publicSection(match: ScheduleMatch, defaultLeague: string): string {
  const pw = match.productionWorkflow ?? {}
  const team = resolveHomeTeam(match)
  const region = team?.region || match.region || 'NA'
  const division = divisionFromRating(team?.rating) ?? 'Open'
  const leagueIsTier = FACEIT_DIVISIONS.some((d) => match.league?.toLowerCase() === d.toLowerCase())
  const league = match.league && !leagueIsTier ? match.league : defaultLeague
  const casters = pw.assignedCasters?.map((c) => personName(c.user))
  return [
    '─────────────────────────────────────────',
    '',
    `## 🎮 **${withOrgPrefix(homeTeamName(match))} vs ${opponentName(match)}**`,
    `🌐 ${region} / ${division} • ${league}`,
    `🕐 ${discordTimestamp(match.date)}`,
    `🎬 Stream: ${STREAM_URL}`,
    `👁️ ${roleLine('Observer', pw.assignedObservers, personName)}`,
    `📹 ${roleLine('Producer', pw.assignedProducers, personName)}`,
    ...(roleLine('Director', pw.assignedDirectors, personName, null) ? [`🎛️ ${roleLine('Director', pw.assignedDirectors, personName, null)}`] : []),
    `🎙️ Casters: ${casters && casters.length > 0 ? casters.join(' & ') : 'TBD'}`,
    `🔗 FACEIT Lobby: ${match.faceitLobby || LOBBY_PLACEHOLDER}`,
    '',
  ].join('\n')
}

const PUBLIC_HEADER =
  "📺 **This Week's ELMT Broadcast Schedule**\n\n" +
  "Here's everything being casted this week, come support our teams!\n\n"

export function formatPublicSections(matches: ScheduleMatch[], opts: PublicFormatOptions = {}): string[] {
  const defaultLeague = opts.defaultLeague ?? DEFAULT_LEAGUE_LABEL
  return selectedMatches(matches).map((m) => publicSection(m, defaultLeague))
}

export function formatPublicSchedule(matches: ScheduleMatch[], opts: PublicFormatOptions = {}): string {
  const sections = formatPublicSections(matches, opts)
  if (sections.length === 0) return EMPTY_PUBLIC
  return PUBLIC_HEADER + sections.join('\n')
}

/**
 * Pack sections into as few messages as fit under `max`, never cutting a
 * section. The header goes on the first message only.
 */
export function splitAtBoundaries(header: string, sections: string[], separator: string, max = DISCORD_MESSAGE_LIMIT): string[] {
  const messages: string[] = []
  let current = header
  let currentHasSection = false
  for (const section of sections) {
    const candidate = currentHasSection ? current + separator + section : current + section
    if (candidate.length <= max || !currentHasSection) {
      current = candidate
      currentHasSection = true
      continue
    }
    messages.push(current)
    current = section
  }
  if (currentHasSection || messages.length === 0) messages.push(current)
  return messages
}

function relId(value: { id: number } | number | null | undefined): number | null {
  if (value == null) return null
  return typeof value === 'number' ? value : value.id
}

function assignmentKey(match: ScheduleMatch): string {
  const pw = match.productionWorkflow ?? {}
  const ids = (list: Array<{ id: number } | number | null> | null | undefined) =>
    (list ?? []).map((p) => relId(p)).join(',')
  const casters = (pw.assignedCasters ?? []).map((c) => relId(c.user ?? null)).join(',')
  return [
    ids(pw.assignedObservers as any),
    ids(pw.assignedProducers as any),
    ids(pw.assignedDirectors as any),
    casters,
  ].join('|')
}

function sideKey(match: ScheduleMatch): string {
  const home = resolveHomeTeam(match)
  return [
    home?.name ?? relId(match.team1Internal as any) ?? relId(match.team as any) ?? match.team1External ?? '',
    opponentName(match),
  ].join('|')
}

/**
 * Whether a match save should re-render the posted schedule. True when the
 * match enters or leaves the schedule, or when something the post shows
 * changed on a match that is in it. Renames and other bookkeeping are ignored.
 */
export function schedulePostRelevantChange(
  doc: ScheduleMatch & { status?: string | null },
  previousDoc: (ScheduleMatch & { status?: string | null }) | null | undefined,
): boolean {
  const nowIn = !!doc.productionWorkflow?.includeInSchedule
  const wasIn = !!previousDoc?.productionWorkflow?.includeInSchedule
  if (nowIn !== wasIn) return true
  if (!nowIn) return false
  if (!previousDoc) return true
  return (
    new Date(doc.date).getTime() !== new Date(previousDoc.date).getTime() ||
    (doc.faceitLobby ?? '') !== (previousDoc.faceitLobby ?? '') ||
    (doc.status ?? '') !== (previousDoc.status ?? '') ||
    (doc.league ?? '') !== (previousDoc.league ?? '') ||
    sideKey(doc) !== sideKey(previousDoc) ||
    assignmentKey(doc) !== assignmentKey(previousDoc)
  )
}

export function buildSchedulePosts(matches: ScheduleMatch[], opts: StaffFormatOptions & PublicFormatOptions): SchedulePosts {
  const selected = selectedMatches(matches)
  if (selected.length === 0) {
    return { staff: [EMPTY_STAFF], public: [EMPTY_PUBLIC], matchIds: [] }
  }
  return {
    staff: splitAtBoundaries(STAFF_HEADER, formatStaffSections(selected, opts), STAFF_SEPARATOR),
    public: splitAtBoundaries(PUBLIC_HEADER, formatPublicSections(selected, opts), '\n'),
    matchIds: selected.map((m) => m.id),
  }
}

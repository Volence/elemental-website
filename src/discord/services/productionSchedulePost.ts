import type { Payload } from 'payload'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, type TextChannel, type ThreadChannel } from 'discord.js'
import { ensureDiscordClient, getDiscordClient } from '../bot'
import { parseMessageIds, syncScheduleMessages } from '../handlers/publish-schedule'
import {
  announceButtonLabel,
  buildSchedulePosts,
  scheduleMatchesWhere,
  shouldStartNewWeek,
  type MentionStyle,
  type ScheduleMatch,
  type SchedulePosts,
} from '@/utilities/productionSchedulePost'

/**
 * The weekly production broadcast schedule, posted to Discord from the
 * Schedule Builder and kept current afterwards.
 *
 * State lives on the production-dashboard global: the two channel ids the
 * admin configures and the message ids of the current week's post. A save
 * on any match in the post (or the checkbox itself) schedules a debounced
 * refresh that edits those messages in place. Nothing is posted until a
 * production manager has clicked Post once for the week.
 */

const GLOBAL_SLUG = 'production-dashboard' as const
const REFRESH_DEBOUNCE_MS = 8_000

export interface SchedulePostChannels {
  staff: string | null
  public: string | null
}

export interface SchedulePostState {
  staffMessageIds: string[]
  publicMessageIds: string[]
  matchIds: number[]
  postedAt: string | null
  postedBy: string | null
}

export interface ScheduleBuild {
  posts: SchedulePosts
  matches: ScheduleMatch[]
  channels: SchedulePostChannels
  state: SchedulePostState
}

export function readState(global: any): SchedulePostState {
  const sp = global?.schedulePost ?? {}
  return {
    staffMessageIds: parseMessageIds(sp.staffMessageIds),
    publicMessageIds: parseMessageIds(sp.publicMessageIds),
    matchIds: parseMessageIds(sp.matchIds).map((s) => Number(s)).filter((n) => Number.isFinite(n)),
    postedAt: sp.postedAt ?? null,
    postedBy: sp.postedBy ?? null,
  }
}

export const STREAM_ANNOUNCE_PREFIX = 'stream_announce:'

/** Discord allows 5 rows of 5 buttons; a message never holds that many matches, but never exceed it. */
const MAX_BUTTONS = 25

/** One Announce button per match in the message, five to a row. */
export function announceRows(matchIds: number[], matches: ScheduleMatch[]): ActionRowBuilder<ButtonBuilder>[] {
  const byId = new Map(matches.map((m) => [m.id, m]))
  const buttons = matchIds
    .map((id) => byId.get(id))
    .filter((m): m is ScheduleMatch => !!m)
    .slice(0, MAX_BUTTONS)
    .map((m) =>
      new ButtonBuilder()
        .setCustomId(`${STREAM_ANNOUNCE_PREFIX}${m.id}`)
        .setLabel(announceButtonLabel(m))
        .setStyle(ButtonStyle.Secondary),
    )
  const rows: ActionRowBuilder<ButtonBuilder>[] = []
  for (let i = 0; i < buttons.length; i += 5) {
    rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(buttons.slice(i, i + 5)))
  }
  return rows
}

export function readChannels(global: any): SchedulePostChannels {
  return {
    staff: global?.scheduleStaffChannelId || null,
    public: global?.schedulePublicChannelId || null,
  }
}

/**
 * Matches with coverage that are ticked for the schedule: the upcoming ones, plus `keepIds` (the
 * matches already in the post) even once they have been played.
 */
export async function fetchScheduleMatches(payload: Payload, keepIds: number[] = []): Promise<ScheduleMatch[]> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const result = await payload.find({
    collection: 'matches',
    where: scheduleMatchesWhere(today, keepIds),
    sort: 'date',
    limit: 100,
    depth: 2,
    overrideAccess: true,
  })
  return (result.docs as unknown as ScheduleMatch[]).filter((m) => {
    const cov = m.productionWorkflow?.coverageStatus
    return cov === 'partial' || cov === 'full'
  })
}

export interface BuildOptions {
  /** Keep matches already in the week's post after they are played. Off only for a fresh week's post. */
  keepPosted?: boolean
}

export async function buildProductionSchedule(
  payload: Payload,
  mentionStyle: MentionStyle,
  { keepPosted = true }: BuildOptions = {},
): Promise<ScheduleBuild> {
  const global = await payload.findGlobal({ slug: GLOBAL_SLUG, depth: 0, overrideAccess: true })
  const state = readState(global)
  const matches = await fetchScheduleMatches(payload, keepPosted ? state.matchIds : [])
  return {
    posts: buildSchedulePosts(matches, { mentionStyle }),
    matches,
    channels: readChannels(global),
    state,
  }
}

async function fetchTextChannel(channelId: string): Promise<TextChannel | ThreadChannel> {
  const client = await ensureDiscordClient()
  if (!client) throw new Error('Discord bot is not connected')
  const channel = await client.channels.fetch(channelId).catch(() => null)
  if (!channel || !('send' in channel)) throw new Error(`Discord channel ${channelId} not found or not a text channel`)
  return channel as TextChannel | ThreadChannel
}

async function saveState(payload: Payload, state: SchedulePostState): Promise<void> {
  await payload.updateGlobal({
    slug: GLOBAL_SLUG,
    data: {
      schedulePost: {
        staffMessageIds: state.staffMessageIds.join(','),
        publicMessageIds: state.publicMessageIds.join(','),
        matchIds: state.matchIds.join(','),
        postedAt: state.postedAt,
        postedBy: state.postedBy,
      },
    } as any,
    overrideAccess: true,
  })
}

export interface PostScheduleArgs {
  /** 'update' edits the messages on record; 'new' posts fresh ones and forgets the old. */
  mode: 'update' | 'new'
  postedBy?: string | null
}

export interface PostScheduleResult {
  updated: boolean
  staffMessageIds: string[]
  publicMessageIds: string[]
  matchCount: number
}

/**
 * Send or update both posts. Either channel may be unset, in which case that
 * post is skipped; at least one must be configured.
 */
export async function postProductionSchedule(payload: Payload, { mode, postedBy }: PostScheduleArgs): Promise<PostScheduleResult> {
  const build = await buildProductionSchedule(payload, 'discord', { keepPosted: mode === 'update' })
  if (!build.channels.staff && !build.channels.public) {
    throw new Error('No Discord channels configured for the broadcast schedule')
  }

  const existing = mode === 'update' ? build.state : { ...build.state, staffMessageIds: [], publicMessageIds: [] }
  const updated = mode === 'update' && (existing.staffMessageIds.length > 0 || existing.publicMessageIds.length > 0)

  let staffIds: string[] = []
  if (build.channels.staff) {
    const channel = await fetchTextChannel(build.channels.staff)
    const staffMessages = build.posts.staff.map((content, i) => ({
      content,
      components: announceRows(build.posts.staffMatchIds[i] ?? [], build.matches),
    }))
    staffIds = await syncScheduleMessages(channel, existing.staffMessageIds, staffMessages)
  }

  let publicIds: string[] = []
  if (build.channels.public) {
    const channel = await fetchTextChannel(build.channels.public)
    publicIds = await syncScheduleMessages(channel, existing.publicMessageIds, build.posts.public)
  }

  await saveState(payload, {
    staffMessageIds: staffIds,
    publicMessageIds: publicIds,
    matchIds: build.posts.matchIds,
    postedAt: new Date().toISOString(),
    postedBy: postedBy ?? build.state.postedBy,
  })

  return { updated, staffMessageIds: staffIds, publicMessageIds: publicIds, matchCount: build.posts.matchIds.length }
}

/**
 * Re-render the posted schedule after a match changed. No-op until a post
 * exists for the week. Safe to call often; the caller debounces.
 */
export async function refreshProductionSchedule(): Promise<void> {
  if (!getDiscordClient()) return
  const payload = await getPayload({ config: configPromise })
  const global = await payload.findGlobal({ slug: GLOBAL_SLUG, depth: 0, overrideAccess: true })
  const state = readState(global)
  if (state.staffMessageIds.length === 0 && state.publicMessageIds.length === 0) return
  const result = await postProductionSchedule(payload, { mode: 'update' })
  console.log(`[ProductionSchedulePost] refreshed (${result.matchCount} matches)`)
}

let refreshTimer: NodeJS.Timeout | null = null
let refreshRunning = false
let refreshQueued = false

/** Debounced refresh; bursts of match saves collapse into one Discord edit. */
export function scheduleProductionScheduleRefresh(reason: string): void {
  if (refreshTimer) clearTimeout(refreshTimer)
  refreshTimer = setTimeout(() => {
    refreshTimer = null
    void runRefresh(reason)
  }, REFRESH_DEBOUNCE_MS)
}

async function runRefresh(reason: string): Promise<void> {
  if (refreshRunning) {
    refreshQueued = true
    return
  }
  refreshRunning = true
  try {
    await refreshProductionSchedule()
  } catch (err) {
    console.error(`[ProductionSchedulePost] refresh failed (${reason}):`, (err as Error).message)
  } finally {
    refreshRunning = false
    if (refreshQueued) {
      refreshQueued = false
      void runRefresh('queued')
    }
  }
}

/*
 * Weekly fresh post: from Monday 10:00 Eastern, a post left over from an earlier week is replaced
 * by new messages (as if a lead pressed Start a new week), so the schedule is the newest thing in
 * the announcements channel again. Only runs once someone has posted at least once, and waits
 * while no match is ticked for the new week rather than announcing an empty schedule.
 */

const WEEKLY_CHECK_INTERVAL_MS = 10 * 60 * 1000
let weeklyTimer: NodeJS.Timeout | null = null

export function startWeeklySchedulePost(): void {
  if (weeklyTimer) return
  weeklyTimer = setInterval(() => void runWeeklySchedulePostCheck(), WEEKLY_CHECK_INTERVAL_MS)
}

export function stopWeeklySchedulePost(): void {
  if (weeklyTimer) {
    clearInterval(weeklyTimer)
    weeklyTimer = null
  }
}

export async function runWeeklySchedulePostCheck(now: Date = new Date()): Promise<void> {
  if (!getDiscordClient() || refreshRunning) return
  refreshRunning = true
  try {
    const payload = await getPayload({ config: configPromise })
    const global = await payload.findGlobal({ slug: GLOBAL_SLUG, depth: 0, overrideAccess: true })
    const state = readState(global)
    const firstId = state.staffMessageIds[0] ?? state.publicMessageIds[0]
    if (!shouldStartNewWeek(firstId, now)) return
    const build = await buildProductionSchedule(payload, 'discord', { keepPosted: false })
    if (build.posts.matchIds.length === 0) return
    const result = await postProductionSchedule(payload, { mode: 'new', postedBy: 'Weekly auto-post' })
    console.log(`[ProductionSchedulePost] new week posted (${result.matchCount} matches)`)
  } catch (err) {
    console.error('[ProductionSchedulePost] weekly post failed:', (err as Error).message)
  } finally {
    refreshRunning = false
    if (refreshQueued) {
      refreshQueued = false
      void runRefresh('queued')
    }
  }
}

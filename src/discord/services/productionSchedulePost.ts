import type { Payload } from 'payload'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import type { TextChannel, ThreadChannel } from 'discord.js'
import { ensureDiscordClient, getDiscordClient } from '../bot'
import { parseMessageIds, syncScheduleMessages } from '../handlers/publish-schedule'
import {
  buildSchedulePosts,
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

export function readChannels(global: any): SchedulePostChannels {
  return {
    staff: global?.scheduleStaffChannelId || null,
    public: global?.schedulePublicChannelId || null,
  }
}

/** Upcoming matches with coverage that are ticked for the schedule. */
export async function fetchScheduleMatches(payload: Payload): Promise<ScheduleMatch[]> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const result = await payload.find({
    collection: 'matches',
    where: {
      and: [
        { date: { greater_than_equal: today.toISOString() } },
        { 'productionWorkflow.includeInSchedule': { equals: true } },
        { 'productionWorkflow.isArchived': { not_equals: true } },
        { status: { not_in: ['complete', 'cancelled'] } },
      ],
    },
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

export async function buildProductionSchedule(payload: Payload, mentionStyle: MentionStyle): Promise<ScheduleBuild> {
  const [global, matches] = await Promise.all([
    payload.findGlobal({ slug: GLOBAL_SLUG, depth: 0, overrideAccess: true }),
    fetchScheduleMatches(payload),
  ])
  return {
    posts: buildSchedulePosts(matches, { mentionStyle }),
    matches,
    channels: readChannels(global),
    state: readState(global),
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
  const build = await buildProductionSchedule(payload, 'discord')
  if (!build.channels.staff && !build.channels.public) {
    throw new Error('No Discord channels configured for the broadcast schedule')
  }

  const existing = mode === 'update' ? build.state : { ...build.state, staffMessageIds: [], publicMessageIds: [] }
  const updated = mode === 'update' && (existing.staffMessageIds.length > 0 || existing.publicMessageIds.length > 0)

  let staffIds: string[] = []
  if (build.channels.staff) {
    const channel = await fetchTextChannel(build.channels.staff)
    staffIds = await syncScheduleMessages(channel, existing.staffMessageIds, build.posts.staff)
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

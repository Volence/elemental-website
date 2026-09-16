import {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  type ButtonInteraction,
  type StringSelectMenuInteraction,
} from 'discord.js'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { resolveAccessForUser } from '@/access'
import {
  DEFAULT_STREAM_CHANNELS,
  DEFAULT_STREAM_PING_ROLE_ID,
  formatStreamAnnouncement,
  homeTeamName,
  opponentName,
  type ScheduleMatch,
} from '@/utilities/productionSchedulePost'
import { STREAM_ANNOUNCE_PREFIX } from '../services/productionSchedulePost'

/**
 * The Announce buttons on the staff broadcast schedule post. Pressing one asks (privately)
 * which stream the match is on, then posts a single "We're LIVE" message with the stream
 * ping to the announcements channel.
 */

export const STREAM_ANNOUNCE_PICK_PREFIX = 'stream_announce_pick:'

interface StreamChannel {
  label: string
  url: string
}

async function loadSettings() {
  const payload = await getPayload({ config: configPromise })
  const global: any = await payload.findGlobal({ slug: 'production-dashboard', depth: 0, overrideAccess: true })
  const listed: StreamChannel[] = (global?.streamChannels ?? []).filter((c: any) => c?.label && c?.url)
  return {
    payload,
    channels: listed.length > 0 ? listed : DEFAULT_STREAM_CHANNELS,
    pingRoleId: (global?.streamPingRoleId as string | null) || DEFAULT_STREAM_PING_ROLE_ID,
    announceChannelId: (global?.schedulePublicChannelId as string | null) || null,
  }
}

/** Production staff only, matched through the clicker's linked Discord account. */
async function isProductionStaff(payload: Awaited<ReturnType<typeof getPayload>>, discordUserId: string): Promise<boolean> {
  const found = await payload.find({
    collection: 'people',
    where: { discordId: { equals: discordUserId } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const person = found.docs[0] as any
  if (!person) return false
  const access = await resolveAccessForUser(payload, person)
  return !!access && (access.isAdmin || access.departments.production !== 'none')
}

function matchIdFrom(customId: string, prefix: string): number | null {
  const id = Number(customId.slice(prefix.length))
  return Number.isInteger(id) && id > 0 ? id : null
}

export async function handleStreamAnnounceButton(interaction: ButtonInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true })
  const matchId = matchIdFrom(interaction.customId, STREAM_ANNOUNCE_PREFIX)
  const { payload, channels } = await loadSettings()

  if (!(await isProductionStaff(payload, interaction.user.id))) {
    await interaction.editReply('Only production staff can announce streams.')
    return
  }
  const match = matchId ? await findMatch(payload, matchId) : null
  if (!match) {
    await interaction.editReply('That match no longer exists.')
    return
  }

  const menu = new StringSelectMenuBuilder()
    .setCustomId(`${STREAM_ANNOUNCE_PICK_PREFIX}${match.id}`)
    .setPlaceholder('Which stream is it on?')
    .addOptions(
      channels.slice(0, 25).map((c, i) =>
        new StringSelectMenuOptionBuilder().setLabel(c.label.slice(0, 100)).setDescription(c.url.slice(0, 100)).setValue(String(i)),
      ),
    )
  await interaction.editReply({
    content: `Announce **${homeTeamName(match)} vs ${opponentName(match)}** as live on:`,
    components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu)],
  })
}

export async function handleStreamAnnouncePick(interaction: StringSelectMenuInteraction): Promise<void> {
  await interaction.deferUpdate()
  const matchId = matchIdFrom(interaction.customId, STREAM_ANNOUNCE_PICK_PREFIX)
  const { payload, channels, pingRoleId, announceChannelId } = await loadSettings()

  if (!(await isProductionStaff(payload, interaction.user.id))) {
    await interaction.editReply({ content: 'Only production staff can announce streams.', components: [] })
    return
  }
  const stream = channels[Number(interaction.values[0])]
  const match = matchId ? await findMatch(payload, matchId) : null
  if (!stream || !match) {
    await interaction.editReply({ content: 'That match or stream is gone. Press Announce again.', components: [] })
    return
  }
  if (!announceChannelId) {
    await interaction.editReply({
      content: 'No announcements channel is set in Production Dashboard settings.',
      components: [],
    })
    return
  }

  const channel = await interaction.client.channels.fetch(announceChannelId).catch(() => null)
  if (!channel || !('send' in channel)) {
    await interaction.editReply({ content: `Can't post in the announcements channel (${announceChannelId}).`, components: [] })
    return
  }
  const sent = await (channel as any).send({
    content: formatStreamAnnouncement(match, stream.url, pingRoleId),
    allowedMentions: { roles: [pingRoleId] },
  })
  console.log(`[StreamAnnounce] match ${match.id} on ${stream.label} by ${interaction.user.tag}`)
  await interaction.editReply({ content: `Posted: ${sent.url}`, components: [] })
}

async function findMatch(payload: Awaited<ReturnType<typeof getPayload>>, id: number): Promise<ScheduleMatch | null> {
  try {
    return (await payload.findByID({ collection: 'matches', id, depth: 1, overrideAccess: true })) as unknown as ScheduleMatch
  } catch {
    return null
  }
}

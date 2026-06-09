import { EmbedBuilder, Events, AuditLogEvent, type Client } from 'discord.js'
import type { Payload } from 'payload'
import { postLog } from '../sink'
import { userMention, accountCreatedAtMs, isNewAccount } from '../identity'
import { diffRoles, diffNickname, truncate } from '../diff'
import { ordinal, humanizeDuration } from '../format'
import { loadLoggingConfig } from '../config'
import { resolveProfile } from '../nameResolver'
import { recordMemberEvent, getRejoinSummary } from '../memberEvents'
import { resolveJoinInvite } from '../invites'
import { fetchActorId, fetchAuditEntry, addActorField } from '../attribution'

export function attachMemberHandlers(client: Client, payload: Payload, now: () => number): void {
  client.on(Events.GuildMemberAdd, async (member) => {
    const guildId = member.guild.id
    const cfg = await loadLoggingConfig(payload, guildId)
    if (!cfg) return
    const nowMs = now()
    const summary = await getRejoinSummary(payload, guildId, member.id)
    const invite = await resolveJoinInvite(member.guild)
    const profile = cfg.attachProfileLink ? await resolveProfile(payload, member.id) : { profileUrl: null }

    const embed = new EmbedBuilder()
      .setColor(0x2ecc71)
      .setTitle('Member joined')
      .setDescription(`${userMention(member.id)} (${member.user.tag}) - ${ordinal(member.guild.memberCount)} to join`)
      .addFields(
        { name: 'Account age', value: humanizeDuration(accountCreatedAtMs(member.id), nowMs), inline: true },
        {
          name: 'History',
          value: summary.isRejoin
            ? `Rejoin (#${summary.priorJoins + 1}); last left ${summary.lastLeftAt ?? 'unknown'}`
            : 'First join',
          inline: true,
        },
        { name: 'Invite', value: invite ? `\`${invite.code}\` (${invite.uses} uses)` : 'unknown', inline: true },
      )
    if (isNewAccount(member.id, cfg.newAccountFlagDays, nowMs)) {
      embed.addFields({ name: '⚠️ New account', value: `Younger than ${cfg.newAccountFlagDays} days` })
    }
    if (profile.profileUrl) embed.addFields({ name: 'Profile', value: profile.profileUrl })
    embed.setFooter({ text: `ID: ${member.id}` })

    await postLog(client, payload, guildId, 'joinLeave', embed, cfg)
    await recordMemberEvent(payload, guildId, member.id, 'join', new Date(nowMs).toISOString())
  })

  client.on(Events.GuildMemberRemove, async (member) => {
    const guildId = member.guild.id
    const cfg = await loadLoggingConfig(payload, guildId)
    if (!cfg) return
    const nowMs = now()

    // A voluntary leave has no MemberKick audit entry; a kick does.
    const kick = await fetchAuditEntry(member.guild, AuditLogEvent.MemberKick, member.id)
    const roles = member.roles?.cache
      ? [...member.roles.cache.values()].filter((r) => r.id !== guildId).map((r) => `<@&${r.id}>`)
      : []
    const joinedMs = member.joinedTimestamp ?? null

    const embed = new EmbedBuilder()
      .setColor(kick ? 0xe67e22 : 0x95a5a6)
      .setTitle(kick ? 'Member kicked' : 'Member left')
      .setDescription(
        `${userMention(member.id)} (${member.user?.tag ?? 'unknown'})` +
          (joinedMs ? ` - was in the server ${humanizeDuration(joinedMs, nowMs)}` : ''),
      )
    if (kick) {
      embed.addFields({
        name: 'Kicked by',
        value: `${kick.executorId ? userMention(kick.executorId) : 'unknown'}${kick.reason ? ` - ${truncate(kick.reason, 900)}` : ''}`,
      })
    }
    if (roles.length) {
      embed.addFields({ name: 'Roles', value: truncate(roles.join(' '), 1024) })
    }
    embed.setFooter({ text: `ID: ${member.id}` })

    await postLog(client, payload, guildId, 'joinLeave', embed, cfg)
    await recordMemberEvent(payload, guildId, member.id, 'leave', new Date(nowMs).toISOString())
  })

  client.on(Events.GuildMemberUpdate, async (oldM, newM) => {
    const guildId = newM.guild.id
    const cfg = await loadLoggingConfig(payload, guildId)
    if (!cfg) return

    // A partial oldMember has an incomplete role/nick cache; diffing it would falsely
    // report every current role as "added". Skip when we can't trust the prior state.
    if (oldM.partial) return

    // Roles + nickname -> member-log
    const roleDiff = diffRoles([...oldM.roles.cache.keys()], [...newM.roles.cache.keys()])
    const nickDiff = diffNickname(oldM.nickname ?? null, newM.nickname ?? null)
    if (roleDiff.added.length || roleDiff.removed.length || nickDiff.changed) {
      const embed = new EmbedBuilder()
        .setColor(0x3498db)
        .setTitle('Member updated')
        .setDescription(`${userMention(newM.id)} (${newM.user.tag})`)
      if (roleDiff.added.length) embed.addFields({ name: 'Roles added', value: truncate(roleDiff.added.map((r) => `<@&${r}>`).join(' '), 1024) })
      if (roleDiff.removed.length) embed.addFields({ name: 'Roles removed', value: truncate(roleDiff.removed.map((r) => `<@&${r}>`).join(' '), 1024) })
      if (nickDiff.changed) embed.addFields({ name: 'Nickname', value: `${nickDiff.from ?? '_none_'} -> ${nickDiff.to ?? '_none_'}` })
      const auditType = roleDiff.added.length || roleDiff.removed.length ? AuditLogEvent.MemberRoleUpdate : AuditLogEvent.MemberUpdate
      addActorField(embed, await fetchActorId(newM.guild, auditType, newM.id))
      await postLog(client, payload, guildId, 'member', embed, cfg)
    }

    // Timeout add/remove -> member-log
    const oldTimeout = oldM.communicationDisabledUntilTimestamp ?? null
    const newTimeout = newM.communicationDisabledUntilTimestamp ?? null
    if (oldTimeout !== newTimeout) {
      const embed = new EmbedBuilder()
        .setColor(0xe67e22)
        .setTitle(newTimeout ? 'Member timed out' : 'Member timeout removed')
        .setDescription(`${userMention(newM.id)} (${newM.user.tag})`)
      if (newTimeout) {
        embed.addFields({ name: 'Until', value: `<t:${Math.floor(newTimeout / 1000)}:F>` })
      }
      addActorField(embed, await fetchActorId(newM.guild, AuditLogEvent.MemberUpdate, newM.id))
      await postLog(client, payload, guildId, 'member', embed, cfg)
    }

    // Per-guild avatar change -> profile-log
    if (oldM.avatar !== newM.avatar) {
      const embed = new EmbedBuilder()
        .setColor(0x9b59b6)
        .setTitle('Server avatar changed')
        .setDescription(`${userMention(newM.id)} (${newM.user.tag})`)
      await postLog(client, payload, guildId, 'profile', embed, cfg)
    }
  })
}

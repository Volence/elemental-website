import { EmbedBuilder, Events, AuditLogEvent, type Client } from 'discord.js'
import type { Payload } from 'payload'
import { postLog } from '../sink'
import { userMention, subjectLabel, accountCreatedAtMs, isNewAccount } from '../identity'
import { diffRoles, diffNickname, truncate } from '../diff'
import { ordinal, humanizeDuration, discordTimestamp } from '../format'
import { loadLoggingConfig } from '../config'
import { resolveProfile } from '../nameResolver'
import { recordMemberEvent, getRejoinSummary } from '../memberEvents'
import { resolveJoinInvite } from '../invites'
import { fetchActorId, fetchAuditEntryWithRetry, fetchRoleChange, setActorAuthorOrUser, setMemberAuthor, setUserAuthor } from '../attribution'
import { Colors } from '../colors'

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
      .setColor(Colors.create)
      .setTitle('Member joined')
      .setDescription(`${subjectLabel(member.user.tag, member.id)} - ${ordinal(member.guild.memberCount)} to join`)
      .addFields(
        { name: 'Account age', value: humanizeDuration(accountCreatedAtMs(member.id), nowMs), inline: true },
        {
          name: 'History',
          value: summary.isRejoin
            ? `Rejoin (#${summary.priorJoins + 1}); last left ${summary.lastLeftAt ? discordTimestamp(summary.lastLeftAt, 'R') : 'unknown'}`
            : 'First join',
          inline: true,
        },
        {
          name: 'Invite',
          value: invite
            ? `\`${invite.code}\`${invite.inviterId ? ` by ${userMention(invite.inviterId)}` : ''} (${invite.uses} uses)`
            : 'unknown',
          inline: true,
        },
      )
    if (isNewAccount(member.id, cfg.newAccountFlagDays, nowMs)) {
      embed.addFields({ name: '⚠️ New account', value: `Younger than ${cfg.newAccountFlagDays} days` })
    }
    if (profile.profileUrl) embed.addFields({ name: 'Profile', value: profile.profileUrl })
    setMemberAuthor(embed, member)
    embed.setFooter({ text: `ID: ${member.id}` })

    await postLog(client, payload, guildId, 'joinLeave', embed, { cfg })
    await recordMemberEvent(payload, guildId, member.id, 'join', new Date(nowMs).toISOString())
  })

  client.on(Events.GuildMemberRemove, async (member) => {
    const guildId = member.guild.id
    const cfg = await loadLoggingConfig(payload, guildId)
    if (!cfg) return
    const nowMs = now()

    // A voluntary leave has no MemberKick audit entry; a kick does. Retried because the
    // audit entry can lag the gateway event (otherwise kicks mislabel as leaves).
    const kick = await fetchAuditEntryWithRetry(member.guild, AuditLogEvent.MemberKick, member.id)
    // The @everyone role's id equals the guild id - drop it so we only list real roles.
    const roles = member.roles?.cache
      ? [...member.roles.cache.values()].filter((r) => r.id !== guildId).map((r) => `<@&${r.id}>`)
      : []
    const joinedMs = member.joinedTimestamp ?? null

    const embed = new EmbedBuilder()
      .setColor(kick ? Colors.punitive : Colors.neutral)
      .setTitle(kick ? 'Member kicked' : 'Member left')
      .setDescription(
        `${member.user ? subjectLabel(member.user.tag, member.id) : `**unknown** (${userMention(member.id)})`}` +
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
    if (member.user) setUserAuthor(embed, member.user)
    embed.setFooter({ text: `ID: ${member.id}` })

    await postLog(client, payload, guildId, 'joinLeave', embed, { cfg })
    await recordMemberEvent(payload, guildId, member.id, 'leave', new Date(nowMs).toISOString())
  })

  client.on(Events.GuildMemberUpdate, async (oldM, newM) => {
    const guildId = newM.guild.id
    const cfg = await loadLoggingConfig(payload, guildId)
    if (!cfg) return

    // Roles: prefer the audit log so role changes log even when the old member wasn't cached
    // (the partial case). Fall back to a cache diff only when we have trustworthy prior state.
    const roleChange = await fetchRoleChange(newM.guild, newM.id)
    let added: string[] = []
    let removed: string[] = []
    let roleActorId: string | null = null
    if (roleChange && (roleChange.added.length || roleChange.removed.length)) {
      added = roleChange.added
      removed = roleChange.removed
      roleActorId = roleChange.executorId
    } else if (!oldM.partial) {
      const d = diffRoles([...oldM.roles.cache.keys()], [...newM.roles.cache.keys()])
      added = d.added
      removed = d.removed
    }

    // Nickname compare needs the cached prior state; skip when the old member is partial.
    const nickDiff = oldM.partial
      ? { from: null as string | null, to: null as string | null, changed: false }
      : diffNickname(oldM.nickname ?? null, newM.nickname ?? null)

    if (added.length || removed.length || nickDiff.changed) {
      const embed = new EmbedBuilder()
        .setColor(Colors.memberUpdate)
        .setTitle('Member updated')
        .setDescription(subjectLabel(newM.user.tag, newM.id))
      if (added.length) embed.addFields({ name: 'Roles added', value: truncate(added.map((r) => `<@&${r}>`).join(' '), 1024) })
      if (removed.length) embed.addFields({ name: 'Roles removed', value: truncate(removed.map((r) => `<@&${r}>`).join(' '), 1024) })
      if (nickDiff.changed) embed.addFields({ name: 'Nickname', value: `${nickDiff.from ?? '_none_'} -> ${nickDiff.to ?? '_none_'}` })
      const actorId =
        roleActorId ??
        (await fetchActorId(newM.guild, added.length || removed.length ? AuditLogEvent.MemberRoleUpdate : AuditLogEvent.MemberUpdate, newM.id))
      embed.setThumbnail(newM.displayAvatarURL({ size: 256 }))
      await setActorAuthorOrUser(client, embed, actorId, newM.user)
      embed.setFooter({ text: `ID: ${newM.id}` })
      await postLog(client, payload, guildId, 'member', embed, { cfg })
    }

    // Timeout and avatar comparisons need the cached prior state.
    if (!oldM.partial) {
      const oldTimeout = oldM.communicationDisabledUntilTimestamp ?? null
      const newTimeout = newM.communicationDisabledUntilTimestamp ?? null
      if (oldTimeout !== newTimeout) {
        const embed = new EmbedBuilder()
          .setColor(Colors.punitive)
          .setTitle(newTimeout ? 'Member timed out' : 'Member timeout removed')
          .setDescription(subjectLabel(newM.user.tag, newM.id))
        if (newTimeout) {
          embed.addFields({ name: 'Until', value: discordTimestamp(newTimeout, 'F') })
        }
        embed.setThumbnail(newM.displayAvatarURL({ size: 256 }))
        await setActorAuthorOrUser(client, embed, await fetchActorId(newM.guild, AuditLogEvent.MemberUpdate, newM.id), newM.user)
        embed.setFooter({ text: `ID: ${newM.id}` })
        await postLog(client, payload, guildId, 'member', embed, { cfg })
      }

      // Per-guild avatar change -> profile-log (show the new avatar as a thumbnail)
      if (oldM.avatar !== newM.avatar) {
        const embed = new EmbedBuilder()
          .setColor(Colors.profile)
          .setTitle(newM.avatar ? 'Server avatar changed' : 'Server avatar removed')
          .setDescription(subjectLabel(newM.user.tag, newM.id))
          .setThumbnail(newM.displayAvatarURL({ size: 256 }))
        setMemberAuthor(embed, newM)
        embed.setFooter({ text: `ID: ${newM.id}` })
        await postLog(client, payload, guildId, 'profile', embed, { cfg })
      }
    }
  })
}

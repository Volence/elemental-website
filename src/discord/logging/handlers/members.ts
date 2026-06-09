import { EmbedBuilder, Events, type Client } from 'discord.js'
import type { Payload } from 'payload'
import { postLog } from '../sink'
import { userMention, accountAgeDays, isNewAccount } from '../identity'
import { diffRoles, diffNickname } from '../diff'
import { loadLoggingConfig } from '../config'
import { resolveProfile } from '../nameResolver'
import { recordMemberEvent, getRejoinSummary } from '../memberEvents'
import { resolveJoinInvite } from '../invites'

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
      .setDescription(`${userMention(member.id)} (${member.user.tag})`)
      .addFields(
        { name: 'Account age', value: `${accountAgeDays(member.id, nowMs)} days`, inline: true },
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

    await postLog(client, payload, guildId, 'joinLeave', embed, cfg)
    await recordMemberEvent(payload, guildId, member.id, 'join', new Date(nowMs).toISOString())
  })

  client.on(Events.GuildMemberRemove, async (member) => {
    const guildId = member.guild.id
    const cfg = await loadLoggingConfig(payload, guildId)
    if (!cfg) return
    const nowMs = now()
    const embed = new EmbedBuilder()
      .setColor(0x95a5a6)
      .setTitle('Member left')
      .setDescription(`${userMention(member.id)} (${member.user?.tag ?? 'unknown'})`)
    await postLog(client, payload, guildId, 'joinLeave', embed, cfg)
    await recordMemberEvent(payload, guildId, member.id, 'leave', new Date(nowMs).toISOString())
  })

  client.on(Events.GuildMemberUpdate, async (oldM, newM) => {
    const guildId = newM.guild.id
    const cfg = await loadLoggingConfig(payload, guildId)
    if (!cfg) return

    // Roles + nickname -> member-log
    const roleDiff = diffRoles([...oldM.roles.cache.keys()], [...newM.roles.cache.keys()])
    const nickDiff = diffNickname(oldM.nickname ?? null, newM.nickname ?? null)
    if (roleDiff.added.length || roleDiff.removed.length || nickDiff.changed) {
      const embed = new EmbedBuilder()
        .setColor(0x3498db)
        .setTitle('Member updated')
        .setDescription(`${userMention(newM.id)} (${newM.user.tag})`)
      if (roleDiff.added.length) embed.addFields({ name: 'Roles added', value: roleDiff.added.map((r) => `<@&${r}>`).join(' ') })
      if (roleDiff.removed.length) embed.addFields({ name: 'Roles removed', value: roleDiff.removed.map((r) => `<@&${r}>`).join(' ') })
      if (nickDiff.changed) embed.addFields({ name: 'Nickname', value: `${nickDiff.from ?? '_none_'} -> ${nickDiff.to ?? '_none_'}` })
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

import { NextRequest, NextResponse } from 'next/server'
import { PermissionFlagsBits } from 'discord.js'
import { authenticateRequest, requireAdmin } from '@/utilities/apiAuth'
import { ensureDiscordClient } from '@/discord/bot'
import { runCloneJob } from '@/discord/services/cloneWorker'
import type { CloneSelection } from '@/discord/services/clonePlan'

/** POST /api/discord/server/clone-start — validate target, create job, fire worker. */
export async function POST(request: NextRequest) {
  const auth = await authenticateRequest()
  if (!auth.success) return auth.response
  const adminCheck = requireAdmin(auth.data.user)
  if (adminCheck) return adminCheck

  try {
    const { targetGuildId, selection } = (await request.json()) as {
      targetGuildId?: string
      selection?: CloneSelection
    }
    if (!targetGuildId) {
      return NextResponse.json({ success: false, error: 'targetGuildId is required' }, { status: 400 })
    }
    if (targetGuildId === process.env.DISCORD_GUILD_ID) {
      return NextResponse.json({ success: false, error: 'Target cannot be the primary server' }, { status: 400 })
    }
    if (!selection) {
      return NextResponse.json({ success: false, error: 'selection is required' }, { status: 400 })
    }

    const client = await ensureDiscordClient()
    if (!client) {
      return NextResponse.json({ success: false, error: 'Discord client not available' }, { status: 500 })
    }

    // Verify the bot is in the target and has the permissions it needs.
    let target
    try {
      target = await client.guilds.fetch(targetGuildId)
    } catch {
      return NextResponse.json({ success: false, error: 'Bot is not a member of that server' }, { status: 400 })
    }
    const me = await target.members.fetchMe()
    const needed = [
      PermissionFlagsBits.ManageRoles,
      PermissionFlagsBits.ManageChannels,
      PermissionFlagsBits.ManageGuild,
    ]
    if (!me.permissions.has(needed)) {
      return NextResponse.json(
        { success: false, error: 'Bot lacks Manage Roles / Manage Channels / Manage Server in the target' },
        { status: 400 },
      )
    }

    const { payload } = auth.data
    const job = await payload.create({
      collection: 'discord-clone-jobs',
      data: { targetGuildId, status: 'pending', selection, progress: { phase: 'queued' }, report: [] },
    })

    // Fire-and-forget: the process is long-lived, so the worker runs to completion in-process.
    void runCloneJob(String(job.id), targetGuildId, selection)

    return NextResponse.json({ success: true, jobId: job.id })
  } catch (error: any) {
    console.error('Error starting clone:', error)
    return NextResponse.json({ success: false, error: error.message || 'Failed to start clone' }, { status: 500 })
  }
}

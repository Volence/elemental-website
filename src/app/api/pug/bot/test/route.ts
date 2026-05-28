import { NextResponse, type NextRequest } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import prisma from '@/lib/prisma'
import { completeMatch } from '@/pug/lobbyStateMachine'

const BOT_URL = () => process.env.OW_BOT_SERVICE_URL
const BOT_SECRET = () => process.env.OW_BOT_SECRET ?? ''

async function requirePugAdmin(request: NextRequest) {
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers: request.headers })
  if (!user) return { error: 'Unauthorized', status: 401 }
  const u = user as any
  const isPugAdmin = u.departments?.isPugAdmin === true || u.role === 'admin'
  if (!isPugAdmin) return { error: 'Forbidden', status: 403 }
  return { user }
}

async function botFetch(path: string, body?: any): Promise<Response> {
  return fetch(`${BOT_URL()}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Bot-Secret': BOT_SECRET(),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
}

async function botGet(path: string): Promise<Response> {
  return fetch(`${BOT_URL()}${path}`, {
    method: 'GET',
    headers: { 'X-Bot-Secret': BOT_SECRET() },
  })
}

function botError(text: string, status: number) {
  return NextResponse.json({ error: `Bot error: ${text}` }, { status })
}

async function proxyBotResponse(res: Response) {
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    return botError(text, res.status)
  }
  const data = await res.json().catch(() => ({}))
  return NextResponse.json(data)
}

// ---- Bot API Endpoints (from OpenAPI spec) ----
//
// GET  /health                          -> HealthResponse
// GET  /instances                       -> InstanceInfo[]
// POST /instance/warmup                 -> WarmupResponse     body: { pugLobbyId? }
// POST /instance/shutdown               -> {}                 body: { instanceId? }
// POST /instance/{instance_id}/recover  -> {}
// POST /lobby/create                    -> LobbyCreateResponse
// GET  /lobby/{pug_lobby_id}/status     -> LobbyStatusResponse
// POST /lobby/{pug_lobby_id}/cancel     -> {}
// POST /lobby/{pug_lobby_id}/command    -> {}                 body: { command }

// --- Action handlers ---

async function handleBotHealth() {
  if (!BOT_URL()) {
    return { reachable: false, error: 'OW_BOT_SERVICE_URL not configured' }
  }
  try {
    const res = await botGet('/health')
    if (res.status === 401) {
      return { reachable: true, authError: true }
    }
    if (!res.ok) {
      return { reachable: true, authError: false, error: `HTTP ${res.status}` }
    }
    const data = await res.json().catch(() => ({}))
    return { reachable: true, authError: false, ...data }
  } catch (err: any) {
    return { reachable: false, error: err.message || 'Connection failed' }
  }
}

async function handleListInstances() {
  const res = await botGet('/instances')
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    return botError(text, res.status)
  }
  return NextResponse.json(await res.json())
}

async function handleLobbyPlayers(pugLobbyId: number) {
  const players = await prisma.pugLobbyPlayer.findMany({
    where: { lobbyId: pugLobbyId },
  })
  const payload = await getPayload({ config: configPromise })
  const userIds = players.map((p: any) => p.userId)
  if (userIds.length === 0) return NextResponse.json([])

  const users = await payload.find({
    collection: 'people',
    where: { id: { in: userIds } },
    overrideAccess: true,
    limit: userIds.length,
  })

  const userMap = new Map((users.docs as any[]).map((u) => [u.id, u]))
  return NextResponse.json(
    players.map((p: any) => {
      const u = userMap.get(p.userId)
      return {
        userId: p.userId,
        name: u?.name || `User ${p.userId}`,
        battleTag: u?.pugBattleTag || null,
        team: p.team,
        role: p.role,
      }
    }),
  )
}

async function handleInstancePlayers(_instanceId: string) {
  // Bot API doesn't expose per-instance player list; return empty
  return NextResponse.json([])
}

// POST /instance/warmup  { pugLobbyId? }
async function handleWarmup() {
  const res = await botFetch('/instance/warmup', {})
  return proxyBotResponse(res)
}

// POST /instance/shutdown  { instanceId? }
async function handleShutdownInstance(instanceId?: string) {
  const res = await botFetch('/instance/shutdown', { instanceId: instanceId ?? null })
  return proxyBotResponse(res)
}

// POST /instance/shutdown with no instanceId -> shuts down any idle instance
async function handleShutdownIdle() {
  const res = await botFetch('/instance/shutdown', {})
  return proxyBotResponse(res)
}

async function handleForceResetAll() {
  // Shut down all instances by calling shutdown for each
  const listRes = await botGet('/instances')
  if (!listRes.ok) return proxyBotResponse(listRes)
  const instances = await listRes.json()
  const results: any[] = []
  for (const inst of instances) {
    const res = await botFetch('/instance/shutdown', { instanceId: inst.id })
    results.push({ instanceId: inst.id, ok: res.ok })
  }
  return NextResponse.json({ ok: true, results })
}

async function handleRestartService() {
  // No dedicated restart endpoint; shut down all then warmup
  const listRes = await botGet('/instances')
  if (!listRes.ok) return proxyBotResponse(listRes)
  const instances = await listRes.json()
  for (const inst of instances) {
    await botFetch('/instance/shutdown', { instanceId: inst.id })
  }
  // Warmup fresh instances
  const warmups: any[] = []
  for (const _inst of instances) {
    const res = await botFetch('/instance/warmup', {})
    const data = await res.json().catch(() => ({}))
    warmups.push(data)
  }
  return NextResponse.json({ ok: true, warmups })
}

// POST /instance/{instance_id}/recover
async function handleRecoverInstance(instanceId: string) {
  const res = await botFetch(`/instance/${instanceId}/recover`)
  return proxyBotResponse(res)
}

// POST /lobby/{pug_lobby_id}/command  { command }
async function handleLobbyCommand(pugLobbyId: number, command: string) {
  const res = await botFetch(`/lobby/${pugLobbyId}/command`, { command })
  return proxyBotResponse(res)
}

// POST /lobby/{pug_lobby_id}/cancel
async function handleCancelBotLobby(pugLobbyId: number) {
  const res = await botFetch(`/lobby/${pugLobbyId}/cancel`)
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    return botError(text, res.status)
  }
  await prisma.pugLobby.update({
    where: { id: pugLobbyId },
    data: { botInstanceId: null, botStatus: null },
  })
  return NextResponse.json(await res.json().catch(() => ({ ok: true })))
}

// Not a real bot endpoint - handle invite via lobby/create flow
async function handleInviteToLobby(pugLobbyId: number, battleTag: string, team: string) {
  // The bot doesn't have a standalone invite endpoint;
  // invites happen as part of lobby/create. Return a helpful message.
  return NextResponse.json({
    error: 'Direct invites not supported. Players are invited as part of lobby creation.',
  }, { status: 400 })
}

// POST /instance/{instance_id}/step  { command, code? }
async function handleInstanceStep(instanceId: string, command: string, extra?: Record<string, any>) {
  if (command === 'import_code' && extra?.code) {
    // The client sends a settings-only code (map + hero bans).
    // We need to generate the full bot code: bot-specific settings
    // (ELMT PUG mode, ScrimTime workshop config) + Workshop rules.
    // Parse map/ban info from the client code and regenerate properly.
    const { generateFullCode } = await import('@/pug/settingsGenerator')
    const { getWorkshopTemplate } = await import('@/pug/workshopTemplate')

    // If the code already contains workshop rules (e.g. from generateFullCode),
    // pass it through as-is. Otherwise treat it as settings-only and wrap it.
    if (!extra.code.includes('ELMT Admin')) {
      // Client sent settings-only code - generate proper bot code.
      // We can't easily reverse-parse the settings, so use generateFullCode
      // with the map/ban info the client sent alongside.
      if (extra.mapSettingsEntry !== undefined) {
        extra.code = generateFullCode({
          mapSettingsEntry: extra.mapSettingsEntry ?? null,
          mapType: extra.mapType ?? 'control',
          bannedHeroes: extra.bannedHeroes ?? [],
          otherMapsInMode: extra.otherMapsInMode,
          hostNote: extra.hostNote,
        })
      } else {
        // Fallback: append workshop template to whatever was sent
        extra.code = extra.code + '\n\n' + getWorkshopTemplate()
      }
    }
  }
  const res = await botFetch(`/instance/${instanceId}/step`, { command, ...extra })
  return proxyBotResponse(res)
}

async function handleSyncInstance(instanceId: string) {
  const res = await botFetch(`/instance/${instanceId}/sync`)
  return proxyBotResponse(res)
}

async function handleTestInput(instanceId: string, method: string, key: string = 'f') {
  const res = await botFetch('/test-input', { instanceId, method, key })
  return proxyBotResponse(res)
}

async function handleSimulateStatus(pugLobbyId: number, status: string) {
  await prisma.pugLobby.update({
    where: { id: pugLobbyId },
    data: { botStatus: status },
  })
  return NextResponse.json({ ok: true, status })
}

async function handleSimulateStats(pugLobbyId: number, result: 'team1' | 'team2' | 'draw') {
  try {
    await completeMatch(pugLobbyId, result)
    return NextResponse.json({ ok: true, result })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

async function handleScreenshot(instanceId: string) {
  const res = await fetch(`${BOT_URL()}/instance/${instanceId}/screenshot`, {
    method: 'GET',
    headers: { 'X-Bot-Secret': BOT_SECRET() },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    return botError(text, res.status)
  }
  const buffer = await res.arrayBuffer()
  const base64 = Buffer.from(buffer).toString('base64')
  return NextResponse.json({ image: `data:image/jpeg;base64,${base64}` })
}

async function handleStartTestLobby(battleTags: string[]) {
  if (!battleTags || battleTags.length < 2) {
    return NextResponse.json({ error: 'Need at least 2 BattleTags' }, { status: 400 })
  }
  if (battleTags.length > 10) {
    return NextResponse.json({ error: 'Max 10 BattleTags' }, { status: 400 })
  }

  if (!BOT_URL()) {
    return NextResponse.json({ error: 'OW_BOT_SERVICE_URL not configured' }, { status: 400 })
  }

  const payload = await getPayload({ config: configPromise })

  // Find active season
  const seasons = await payload.find({
    collection: 'pug-seasons',
    where: { active: { equals: true }, tier: { equals: 'open' } },
    limit: 1,
    overrideAccess: true,
  })
  const season = (seasons.docs as any[])[0]
  if (!season) {
    return NextResponse.json({ error: 'No active open PUG season. Create one in Seasons tab first.' }, { status: 400 })
  }

  const lastLobby = await prisma.pugLobby.findFirst({
    orderBy: { lobbyNumber: 'desc' },
  })
  const lobbyNumber = (lastLobby?.lobbyNumber ?? 0) + 1

  // Create lobby record
  const lobby = await prisma.pugLobby.create({
    data: {
      lobbyNumber,
      payloadSeasonId: season.id,
      tier: 'open',
      status: 'IN_PROGRESS',
    },
  })

  // Split tags: first half = team 1, second half = team 2
  const half = Math.ceil(battleTags.length / 2)
  const players: Array<{ userId: number; battleTag: string | null; team: 1 | 2 }> = []

  for (let i = 0; i < battleTags.length; i++) {
    const team = i < half ? 1 : 2
    // Create player record with a fake userId (negative to avoid collisions)
    const fakeUserId = -(i + 1)
    await prisma.pugLobbyPlayer.create({
      data: {
        lobbyId: lobby.id,
        userId: fakeUserId,
        team,
        joinedAt: new Date(),
        isCaptain: i === 0 || i === half,
      },
    })
    players.push({ userId: fakeUserId, battleTag: battleTags[i], team: team as 1 | 2 })
  }

  // Generate a default settings code (control map, no bans)
  const { generateFullCode } = await import('@/pug/settingsGenerator')
  const fullCode = generateFullCode({
    mapSettingsEntry: null,
    mapType: 'control',
    bannedHeroes: [],
  })

  // Call the bot directly
  try {
    const res = await botFetch('/lobby/create', {
      pugLobbyId: lobby.id,
      lobbyNumber: lobby.lobbyNumber,
      fullCode,
      players,
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      return NextResponse.json({
        error: `Bot returned ${res.status}: ${text}`,
        lobbyId: lobby.id,
      }, { status: 500 })
    }

    const botData = await res.json()
    await prisma.pugLobby.update({
      where: { id: lobby.id },
      data: {
        hostUserId: -1,
        botInstanceId: botData.instanceId ?? null,
        botStatus: 'creating',
      },
    })

    return NextResponse.json({
      ok: true,
      lobbyId: lobby.id,
      lobbyNumber: lobby.lobbyNumber,
      instanceId: botData.instanceId,
      playerCount: battleTags.length,
      team1: battleTags.slice(0, half),
      team2: battleTags.slice(half),
    })
  } catch (err: any) {
    return NextResponse.json({
      error: `Bot connection failed: ${err.message}`,
      lobbyId: lobby.id,
    }, { status: 500 })
  }
}

async function handleFillAndAdvance() {
  const payload = await getPayload({ config: configPromise })

  // Find active season from Payload CMS
  const seasons = await payload.find({
    collection: 'pug-seasons',
    where: { active: { equals: true }, tier: { equals: 'open' } },
    limit: 1,
    overrideAccess: true,
  })
  const season = (seasons.docs as any[])[0]
  if (!season) {
    return NextResponse.json({ error: 'No active open PUG season. Create one in Seasons tab first.' }, { status: 400 })
  }

  const lastLobby = await prisma.pugLobby.findFirst({
    orderBy: { lobbyNumber: 'desc' },
  })
  const lobbyNumber = (lastLobby?.lobbyNumber ?? 0) + 1

  const lobby = await prisma.pugLobby.create({
    data: {
      lobbyNumber,
      payloadSeasonId: season.id,
      tier: 'open',
      status: 'OPEN',
    },
  })

  const people = await payload.find({
    collection: 'people',
    limit: 10,
    overrideAccess: true,
    where: { discordId: { exists: true } },
  })

  const teams = [1, 1, 1, 1, 1, 2, 2, 2, 2, 2]

  for (let i = 0; i < Math.min(10, people.docs.length); i++) {
    const person = people.docs[i] as any
    await prisma.pugLobbyPlayer.create({
      data: {
        lobbyId: lobby.id,
        userId: person.id,
        team: teams[i],
        joinedAt: new Date(),
      },
    })
  }

  try {
    const players = await prisma.pugLobbyPlayer.findMany({ where: { lobbyId: lobby.id } })
    const team1 = players.filter((p: any) => p.team === 1)
    const team2 = players.filter((p: any) => p.team === 2)
    if (team1.length > 0) {
      await prisma.pugLobbyPlayer.update({ where: { id: team1[0].id }, data: { isCaptain: true } })
    }
    if (team2.length > 0) {
      await prisma.pugLobbyPlayer.update({ where: { id: team2[0].id }, data: { isCaptain: true } })
    }

    await prisma.pugLobby.update({
      where: { id: lobby.id },
      data: { status: 'IN_PROGRESS' },
    })

    // Generate settings code and trigger the bot to create the OW lobby
    const { generateFullCode } = await import('@/pug/settingsGenerator')
    const fullCode = generateFullCode({
      mapSettingsEntry: null,
      mapType: 'control',
      bannedHeroes: [],
    })

    // Players with null battleTags so invites are skipped
    const botPlayers = players.map((p: any) => ({
      userId: p.userId,
      battleTag: null,
      team: p.team as 1 | 2,
    }))

    if (!BOT_URL()) {
      return NextResponse.json({
        ok: true,
        lobbyId: lobby.id,
        lobbyNumber: lobby.lobbyNumber,
        playerCount: Math.min(10, people.docs.length),
        warning: 'OW_BOT_SERVICE_URL not configured - lobby created but bot not triggered',
      })
    }

    const botRes = await botFetch('/lobby/create', {
      pugLobbyId: lobby.id,
      lobbyNumber: lobby.lobbyNumber,
      fullCode,
      players: botPlayers,
    })

    if (!botRes.ok) {
      const text = await botRes.text().catch(() => '')
      return NextResponse.json({
        error: `Lobby created but bot returned ${botRes.status}: ${text}`,
        lobbyId: lobby.id,
      }, { status: 500 })
    }

    const botData = await botRes.json()
    await prisma.pugLobby.update({
      where: { id: lobby.id },
      data: {
        hostUserId: -1,
        botInstanceId: botData.instanceId ?? null,
      },
    })

    return NextResponse.json({
      ok: true,
      lobbyId: lobby.id,
      lobbyNumber: lobby.lobbyNumber,
      instanceId: botData.instanceId,
      playerCount: Math.min(10, people.docs.length),
    })
  } catch (err: any) {
    return NextResponse.json({ error: `Fill failed: ${err.message}` }, { status: 500 })
  }
}

// --- Main route handler ---

export async function POST(request: NextRequest) {
  const auth = await requirePugAdmin(request)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = await request.json()
  const { action } = body
  console.log(`[Bot Test] action=${action}`, JSON.stringify(body))

  switch (action) {
    case 'botHealth':
      return NextResponse.json(await handleBotHealth())

    case 'listInstances':
      return handleListInstances()

    case 'lobbyPlayers':
      return handleLobbyPlayers(body.pugLobbyId)

    case 'instancePlayers':
      return handleInstancePlayers(body.instanceId)

    case 'shutdownIdle':
      return handleShutdownIdle()

    case 'forceResetAll':
      return handleForceResetAll()

    case 'restartService':
      return handleRestartService()

    case 'warmup':
      return handleWarmup()

    case 'instanceStep':
      return handleInstanceStep(body.instanceId, body.command, {
        ...(body.code ? { code: body.code } : {}),
        ...(body.players ? { players: body.players } : {}),
        ...(body.mapSettingsEntry !== undefined ? { mapSettingsEntry: body.mapSettingsEntry } : {}),
        ...(body.mapType ? { mapType: body.mapType } : {}),
        ...(body.bannedHeroes ? { bannedHeroes: body.bannedHeroes } : {}),
        ...(body.otherMapsInMode ? { otherMapsInMode: body.otherMapsInMode } : {}),
        ...(body.hostNote ? { hostNote: body.hostNote } : {}),
      })

    case 'lobbyCommand':
      return handleLobbyCommand(body.pugLobbyId, body.command)

    case 'cancelBotLobby':
      return handleCancelBotLobby(body.pugLobbyId)

    case 'recoverInstance':
      return handleRecoverInstance(body.instanceId)

    case 'shutdownInstance':
      return handleShutdownInstance(body.instanceId)

    case 'inviteToLobby':
      return handleInviteToLobby(body.pugLobbyId, body.battleTag, body.team)

    case 'simulateStatus':
      return handleSimulateStatus(body.pugLobbyId, body.status)

    case 'simulateStats':
      return handleSimulateStats(body.pugLobbyId, body.result)

    case 'screenshot':
      return handleScreenshot(body.instanceId)

    case 'syncInstance':
      return handleSyncInstance(body.instanceId)

    case 'testInput':
      return handleTestInput(body.instanceId, body.method, body.key)

    case 'startTestLobby':
      return handleStartTestLobby(body.battleTags)

    case 'fillAndAdvance':
      return handleFillAndAdvance()

    default:
      return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
  }
}

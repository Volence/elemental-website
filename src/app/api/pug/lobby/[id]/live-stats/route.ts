import { NextResponse, type NextRequest } from 'next/server'
import prisma from '@/lib/prisma'

type Params = { params: Promise<{ id: string }> }

// Per-process cache so many spectators within the window share one bot call.
// (Not shared across replicas; fine for the single instance.)
const CACHE_TTL_MS = 2000
const cache = new Map<number, { ts: number; data: unknown }>()

export async function GET(_request: NextRequest, { params }: Params) {
  const { id } = await params
  const lobbyId = parseInt(id, 10)
  if (isNaN(lobbyId)) return NextResponse.json({ liveStats: null })

  const cached = cache.get(lobbyId)
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return NextResponse.json({ liveStats: cached.data })
  }

  const lobby = await prisma.pugLobby.findUnique({
    where: { id: lobbyId },
    select: { id: true, status: true, botInstanceId: true },
  })
  if (!lobby || lobby.status !== 'IN_PROGRESS' || !lobby.botInstanceId) {
    return NextResponse.json({ liveStats: null })
  }

  const botUrl = process.env.OW_BOT_SERVICE_URL
  if (!botUrl) return NextResponse.json({ liveStats: null })

  try {
    const resp = await fetch(`${botUrl}/lobby/${lobbyId}/status`, {
      headers: { 'X-Bot-Secret': process.env.OW_BOT_SECRET ?? '' },
      signal: AbortSignal.timeout(3000),
    })
    if (!resp.ok) return NextResponse.json({ liveStats: null })
    const data = await resp.json()
    const liveStats = data.liveStats ?? null
    cache.set(lobbyId, { ts: Date.now(), data: liveStats })
    return NextResponse.json({ liveStats })
  } catch {
    return NextResponse.json({ liveStats: null })
  }
}

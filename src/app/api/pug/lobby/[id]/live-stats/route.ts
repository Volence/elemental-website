import { NextResponse, type NextRequest } from 'next/server'
import prisma from '@/lib/prisma'

type Params = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, { params }: Params) {
  const { id } = await params
  const lobbyId = parseInt(id, 10)
  if (isNaN(lobbyId)) return NextResponse.json({ liveStats: null })

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
    return NextResponse.json({ liveStats: data.liveStats ?? null })
  } catch {
    return NextResponse.json({ liveStats: null })
  }
}

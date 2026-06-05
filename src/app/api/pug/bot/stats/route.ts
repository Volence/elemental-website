import { NextResponse, type NextRequest } from 'next/server'
import { ingestMatchLog } from '@/pug/ingestStats'

function validateBotSecret(request: NextRequest): boolean {
  const secret = request.headers.get('x-bot-secret')
  return !!secret && secret === process.env.OW_BOT_SECRET
}

export async function POST(request: NextRequest) {
  if (!validateBotSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { pugLobbyId, logContent } = body as {
    pugLobbyId: number
    logContent: string
  }

  if (!pugLobbyId || !logContent) {
    return NextResponse.json({ error: 'Missing pugLobbyId or logContent' }, { status: 400 })
  }

  try {
    const result = await ingestMatchLog(pugLobbyId, logContent)
    return NextResponse.json({
      ok: true,
      scrimId: result.scrimId,
      autoResult: result.matchResult,
      alreadyIngested: result.alreadyIngested,
    })
  } catch (err) {
    console.error(`[PUG Bot] Failed to process stats for lobby ${pugLobbyId}:`, err)
    return NextResponse.json(
      { error: `Failed to process stats: ${err instanceof Error ? err.message : 'Unknown error'}` },
      { status: 500 },
    )
  }
}

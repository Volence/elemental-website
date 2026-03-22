import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { getPlayerByName, getAllPlayerNames, formatPlayerSlug } from '@/utilities/getPlayer'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const slug = searchParams.get('slug') || 'literally-mayhem-special-idiot'

  const results: Record<string, any> = { slug }

  try {
    // Step 1: Find person by slug
    const payload = await getPayload({ config })
    const personBySlug = await payload.find({
      collection: 'people',
      where: { slug: { equals: slug } },
      limit: 1,
      depth: 0,
    })
    results.step1_personBySlug = {
      count: personBySlug.docs.length,
      name: personBySlug.docs[0]?.name || null,
    }

    let playerName: string | undefined
    if (personBySlug.docs.length > 0) {
      playerName = personBySlug.docs[0].name
    } else {
      const playerNames = await getAllPlayerNames()
      playerName = playerNames.find((name) => formatPlayerSlug(name) === slug)
      results.step1_fallback = { totalNames: playerNames.length, matched: !!playerName }
    }

    results.step2_playerName = playerName

    if (!playerName) {
      results.redirectReason = 'No playerName found'
      return NextResponse.json(results)
    }

    // Step 2: Call getPlayerByName
    try {
      const player = await getPlayerByName(playerName, slug)
      results.step3_player = player ? { 
        name: player.name,
        slug: player.slug,
        teamsCount: player.teams.length,
        hasOrgRoles: !!(player.staffRoles.organization && player.staffRoles.organization.length > 0),
        hasProduction: !!player.staffRoles.production,
      } : null
      
      if (!player) {
        results.redirectReason = 'getPlayerByName returned null'
      }
    } catch (playerError: any) {
      results.step3_error = {
        message: playerError.message,
        stack: playerError.stack?.split('\n').slice(0, 5),
      }
      results.redirectReason = 'getPlayerByName threw an error'
    }
  } catch (outerError: any) {
    results.outerError = {
      message: outerError.message,
      stack: outerError.stack?.split('\n').slice(0, 5),
    }
  }

  return NextResponse.json(results)
}

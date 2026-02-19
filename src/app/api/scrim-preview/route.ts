/**
 * POST /api/scrim-preview
 *
 * Accepts the same files as scrim-upload, but ONLY parses them —
 * does NOT store anything. Returns map summaries and unique player
 * names grouped by team, used for the player mapping step.
 */

import { NextResponse } from 'next/server'
import { parseScrimLog, validateScrimLog } from '@/lib/scrim-parser'
import { getPayload } from 'payload'
import configPromise from '@payload-config'

export async function POST(request: Request) {
  try {
    const payload = await getPayload({ config: configPromise })
    const { user } = await payload.auth({ headers: request.headers })

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const files = formData.getAll('files') as File[]

    if (!files.length) {
      return NextResponse.json({ error: 'No files uploaded' }, { status: 400 })
    }

    // Validate file types
    for (const file of files) {
      if (!file.name.endsWith('.txt') && !file.name.endsWith('.csv')) {
        return NextResponse.json(
          { error: `Invalid file type: ${file.name}. Only .txt and .csv files are supported.` },
          { status: 400 },
        )
      }
    }

    const maps: {
      fileName: string
      mapName: string
      mapType: string
      team1: string
      team2: string
    }[] = []

    // Track unique player names per team
    const playersByTeam: Record<string, Set<string>> = {}

    for (const file of files) {
      const content = await file.text()

      // Validate file is a ScrimTime log before parsing
      const validationError = validateScrimLog(content)
      if (validationError) {
        return NextResponse.json(
          { error: `File "${file.name}": ${validationError}` },
          { status: 400 },
        )
      }

      try {
        const parsedData = parseScrimLog(content)

        if (!parsedData.match_start?.length) {
          return NextResponse.json(
            {
              error: `File "${file.name}" does not contain a valid match_start event. Is this a ScrimTime log file?`,
            },
            { status: 400 },
          )
        }

        const matchStart = parsedData.match_start[0]
        const team1 = String(matchStart[4] || 'Team 1')
        const team2 = String(matchStart[5] || 'Team 2')

        maps.push({
          fileName: file.name,
          mapName: String(matchStart[2] || 'Unknown'),
          mapType: String(matchStart[3] || 'Unknown'),
          team1,
          team2,
        })

        // Collect unique player names from player_stat events
        if (parsedData.player_stat) {
          for (const stat of parsedData.player_stat) {
            const teamName = String(stat[3])
            const playerName = String(stat[4])
            if (!playersByTeam[teamName]) {
              playersByTeam[teamName] = new Set()
            }
            playersByTeam[teamName].add(playerName)
          }
        }

        // Also pull from hero_spawn events for completeness
        if (parsedData.hero_spawn) {
          for (const spawn of parsedData.hero_spawn) {
            const teamName = String(spawn[2])
            const playerName = String(spawn[3])
            if (!playersByTeam[teamName]) {
              playersByTeam[teamName] = new Set()
            }
            playersByTeam[teamName].add(playerName)
          }
        }
      } catch (parseError) {
        return NextResponse.json(
          {
            error: `Failed to parse file "${file.name}": ${parseError instanceof Error ? parseError.message : 'Unknown error'}`,
          },
          { status: 400 },
        )
      }
    }

    // Convert Sets to arrays for JSON serialization
    const players: Record<string, string[]> = {}
    for (const [team, names] of Object.entries(playersByTeam)) {
      players[team] = Array.from(names).sort()
    }

    return NextResponse.json({
      maps,
      players,
      team1: maps[0]?.team1 || 'Team 1',
      team2: maps[0]?.team2 || 'Team 2',
    })
  } catch (error) {
    console.error('Scrim preview error:', error)
    return NextResponse.json(
      { error: `Failed to preview files: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 },
    )
  }
}

/**
 * POST /api/scrim-preview
 *
 * Accepts the same files as scrim-upload, but ONLY parses them -
 * does NOT store anything. Returns map summaries and unique player
 * names grouped by team, used for the player mapping step.
 */

import { NextResponse } from 'next/server'
import { parseScrimLog, validateScrimLog, groupPlayersByTeam } from '@/lib/scrim-parser'
import type { ParserData } from '@/lib/scrim-parser'
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

    // Parsed data per file, kept in upload order for team assignment.
    const parsedPerFile: ParserData[] = []

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

        parsedPerFile.push(parsedData)
      } catch (parseError) {
        return NextResponse.json(
          {
            error: `Failed to parse file "${file.name}": ${parseError instanceof Error ? parseError.message : 'Unknown error'}`,
          },
          { status: 400 },
        )
      }
    }

    // Assign each player to a single team from their earliest appearance, so
    // side-swaps and mid-match slot reshuffles don't list everyone under both.
    const players = groupPlayersByTeam(parsedPerFile)

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

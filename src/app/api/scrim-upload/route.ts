/**
 * API Route: Upload ScrimTime log files
 *
 * Accepts multipart form data with one or more .txt log files,
 * parses them, and stores the scrim data in the database.
 *
 * POST /api/scrim-upload
 * Body: FormData with:
 *   - files: File[] (one or more .txt log files)
 *   - name: string (scrim name)
 *   - date: string (ISO date string)
 *   - teamId: string (Payload team ID, optional)
 */

import { NextResponse } from 'next/server'
import { parseScrimLog, validateScrimLog, createScrimFromParsedData } from '@/lib/scrim-parser'
import { getPayload } from 'payload'
import configPromise from '@payload-config'

export async function POST(request: Request) {
  try {
    // Verify user is authenticated via Payload
    const payload = await getPayload({ config: configPromise })
    const { user } = await payload.auth({ headers: request.headers })

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check role — admin, staff-manager, and team-manager can upload
    const userRole = (user as { role?: string }).role
    const canUpload = userRole === 'admin' || userRole === 'staff-manager' || userRole === 'team-manager'
    if (!canUpload) {
      return NextResponse.json(
        { error: 'Insufficient permissions. Only admins, staff managers, and team managers can upload scrims.' },
        { status: 403 },
      )
    }

    const formData = await request.formData()
    const files = formData.getAll('files') as File[]
    const name = (formData.get('name') as string) || (formData.get('scrimName') as string) || `Scrim ${new Date().toLocaleDateString()}`
    const dateStr = formData.get('date') as string
    let teamIdStr = formData.get('teamId') as string | null

    // For team-managers: auto-set team to their first assigned team if not specified
    if (!teamIdStr && userRole === 'team-manager') {
      const typedUser = user as { assignedTeams?: Array<number | { id: number }> }
      if (typedUser.assignedTeams?.length) {
        const firstTeam = typedUser.assignedTeams[0]
        teamIdStr = String(typeof firstTeam === 'number' ? firstTeam : firstTeam.id)
      }
    }

    const playerMappingsStr = formData.get('playerMappings') as string | null
    const opponentNameOverride = (formData.get('opponentName') as string | null)?.trim() || null
    const playerMappings: Record<string, number> = {}
    if (playerMappingsStr) {
      try {
        const parsed = JSON.parse(playerMappingsStr)
        for (const [name, id] of Object.entries(parsed)) {
          if (id && !isNaN(Number(id))) {
            playerMappings[name] = Number(id)
          }
        }
      } catch {
        // Ignore invalid JSON — proceed without mappings
      }
    }

    if (!files.length) {
      return NextResponse.json({ error: 'No files uploaded' }, { status: 400 })
    }

    // Validate files are .txt or .csv
    for (const file of files) {
      if (!file.name.endsWith('.txt') && !file.name.endsWith('.csv')) {
        return NextResponse.json(
          { error: `Invalid file type: ${file.name}. Only .txt and .csv files are supported.` },
          { status: 400 },
        )
      }
    }

    // Parse each file
    const parsedMaps = []
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

        parsedMaps.push({
          fileContent: content,
          parsedData,
          fileName: file.name,
        })
      } catch (parseError) {
        return NextResponse.json(
          {
            error: `Failed to parse file "${file.name}": ${parseError instanceof Error ? parseError.message : 'Unknown error'}`,
          },
          { status: 400 },
        )
      }
    }

    // Create the scrim with all maps
    const result = await createScrimFromParsedData({
      name,
      date: dateStr ? new Date(dateStr) : new Date(),
      payloadTeamId: teamIdStr ? parseInt(teamIdStr, 10) : null,
      creatorEmail: user.email,
      opponentName: opponentNameOverride,
      maps: parsedMaps,
      playerMappings,
    })

    // Build a summary response
    const mapSummaries = parsedMaps.map((map, i) => {
      const matchStart = map.parsedData.match_start?.[0]
      return {
        index: i + 1,
        fileName: map.fileName,
        mapName: matchStart ? String(matchStart[2]) : 'Unknown',
        mapType: matchStart ? String(matchStart[3]) : 'Unknown',
        team1: matchStart ? String(matchStart[4]) : 'Unknown',
        team2: matchStart ? String(matchStart[5]) : 'Unknown',
        eventCount: Object.values(map.parsedData).reduce(
          (sum, events) => sum + (Array.isArray(events) ? events.length : 0),
          0,
        ),
      }
    })

    return NextResponse.json({
      success: true,
      scrim: {
        id: result.scrim.id,
        name: result.scrim.name,
        date: result.scrim.date,
      },
      maps: mapSummaries,
      totalMaps: parsedMaps.length,
    })
  } catch (error) {
    console.error('Scrim upload error:', error)
    return NextResponse.json(
      {
        error: `Failed to process scrim: ${error instanceof Error ? error.message : 'Unknown error'}`,
      },
      { status: 500 },
    )
  }
}

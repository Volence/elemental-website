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
 *   - teamId2: string (second Payload team ID for internal scrims, optional)
 *   - mappings: JSON string, player_name -> Person id for the primary team
 *   - mappings2: JSON string, player_name -> Person id for the second team
 */

import { NextResponse } from 'next/server'
import { parseScrimLog, validateScrimLog, createScrimFromParsedData } from '@/lib/scrim-parser'
import { mapSignatureFromParsedData } from '@/lib/scrim-analytics/duplicate-detection'
import prisma from '@/lib/prisma'
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

    // Check role - admin, staff-manager, and team-manager can upload
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

    // Form keys are 'mappings'/'mappings2' (set by ScrimUpload). These carry the
    // player_name -> Person id maps that let storage stamp personId onto each
    // scrim_player_stat row; without personId the scrim-stats route cannot
    // correlate raw "Team 1"/"Team 2" to Payload teams or resolve player names.
    const playerMappingsStr = formData.get('mappings') as string | null
    const playerMappings2Str = formData.get('mappings2') as string | null
    const opponentNameOverride = (formData.get('opponentName') as string | null)?.trim() || null
    const teamId2Str = formData.get('teamId2') as string | null
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
        // Ignore invalid JSON - proceed without mappings
      }
    }
    const playerMappings2: Record<string, number> = {}
    if (playerMappings2Str) {
      try {
        const parsed = JSON.parse(playerMappings2Str)
        for (const [name, id] of Object.entries(parsed)) {
          if (id && !isNaN(Number(id))) {
            playerMappings2[name] = Number(id)
          }
        }
      } catch {
        // Ignore invalid JSON - proceed without mappings
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

    // Duplicate detection: a map whose name, kill count, and first/last kill
    // timestamps all match an existing map is almost certainly a re-upload of
    // the same log, which would silently double-count every stat.
    const allowDuplicates = formData.get('allowDuplicates') === 'true'
    if (!allowDuplicates) {
      const duplicates: Array<{ fileName: string; mapName: string; existing: Array<{ scrimId: number; scrimName: string; date: string }> }> = []
      for (const map of parsedMaps) {
        const sig = mapSignatureFromParsedData(map.parsedData)
        if (!sig || sig.kills === 0) continue
        const existing = await prisma.$queryRaw<Array<{ scrimId: number; scrimName: string; date: Date }>>`
          SELECT s.id as "scrimId", s.name as "scrimName", s.date
          FROM scrim_map_data md
          JOIN scrim_maps m ON m.id = md."mapId"
          JOIN scrim_scrims s ON s.id = m."scrimId"
          WHERE m.name = ${sig.mapName}
            AND (SELECT count(*) FROM scrim_kills k WHERE k."mapDataId" = md.id) = ${sig.kills}
            AND (SELECT min(k.match_time) FROM scrim_kills k WHERE k."mapDataId" = md.id) = ${sig.firstKillTime}
            AND (SELECT max(k.match_time) FROM scrim_kills k WHERE k."mapDataId" = md.id) = ${sig.lastKillTime}
          LIMIT 3
        `
        if (existing.length > 0) {
          duplicates.push({
            fileName: map.fileName,
            mapName: sig.mapName,
            existing: existing.map(e => ({ scrimId: e.scrimId, scrimName: e.scrimName, date: e.date.toISOString() })),
          })
        }
      }
      if (duplicates.length > 0) {
        return NextResponse.json(
          {
            error: 'duplicate_maps',
            message:
              `${duplicates.length} of ${parsedMaps.length} file(s) appear to already be uploaded: ` +
              duplicates.map(d => `"${d.fileName}" matches ${d.mapName} in scrim "${d.existing[0].scrimName}"`).join('; ') +
              '. Re-uploading would double-count these maps in all stats.',
            duplicates,
          },
          { status: 409 },
        )
      }
    }

    // Create the scrim with all maps
    const result = await createScrimFromParsedData({
      name,
      date: dateStr ? new Date(dateStr) : new Date(),
      payloadTeamId: teamIdStr ? parseInt(teamIdStr, 10) : null,
      payloadTeamId2: teamId2Str ? parseInt(teamId2Str, 10) : null,
      creatorEmail: user.email,
      opponentName: opponentNameOverride,
      maps: parsedMaps,
      playerMappings,
      playerMappings2: Object.keys(playerMappings2).length > 0 ? playerMappings2 : undefined,
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

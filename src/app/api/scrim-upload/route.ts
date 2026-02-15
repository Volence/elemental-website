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
import { parseScrimLog, createScrimFromParsedData } from '@/lib/scrim-parser'
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

    // Check role — only admin and manager can upload
    const userRole = (user as { role?: string }).role
    if (userRole !== 'admin' && userRole !== 'manager') {
      return NextResponse.json(
        { error: 'Insufficient permissions. Only admins and managers can upload scrims.' },
        { status: 403 },
      )
    }

    const formData = await request.formData()
    const files = formData.getAll('files') as File[]
    const name = formData.get('name') as string
    const dateStr = formData.get('date') as string
    const teamIdStr = formData.get('teamId') as string | null

    if (!files.length) {
      return NextResponse.json({ error: 'No files uploaded' }, { status: 400 })
    }

    if (!name) {
      return NextResponse.json({ error: 'Scrim name is required' }, { status: 400 })
    }

    // Validate files are .txt
    for (const file of files) {
      if (!file.name.endsWith('.txt')) {
        return NextResponse.json(
          { error: `Invalid file type: ${file.name}. Only .txt files are supported.` },
          { status: 400 },
        )
      }
    }

    // Parse each file
    const parsedMaps = []
    for (const file of files) {
      const content = await file.text()
      try {
        const parsedData = parseScrimLog(content)

        // Validate that the file has at least a match_start event
        if (!parsedData.match_start?.length) {
          return NextResponse.json(
            {
              error: `File "${file.name}" does not contain a valid match_start event. Is this a ScrimTime log file?`,
            },
            { status: 400 },
          )
        }

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
      maps: parsedMaps,
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

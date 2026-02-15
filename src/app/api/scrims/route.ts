import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

/**
 * GET /api/scrims
 * Returns paginated list of scrims with map counts.
 * Query params: ?page=1&limit=10
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1'))
  const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit') ?? '10')))
  const skip = (page - 1) * limit

  const [scrims, total] = await Promise.all([
    prisma.scrim.findMany({
      orderBy: { date: 'desc' },
      skip,
      take: limit,
      include: {
        maps: {
          select: {
            id: true,
            name: true,
            mapData: {
              select: { id: true },
            },
          },
        },
        _count: { select: { maps: true } },
      },
    }),
    prisma.scrim.count(),
  ])

  return NextResponse.json({
    scrims: scrims.map((s) => ({
      id: s.id,
      name: s.name,
      date: s.date.toISOString(),
      createdAt: s.createdAt.toISOString(),
      creatorEmail: s.creatorEmail,
      mapCount: s._count.maps,
      maps: s.maps.map((m) => ({
        id: m.id,
        name: m.name,
        mapDataId: m.mapData[0]?.id ?? null,
      })),
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  })
}

/**
 * DELETE /api/scrims?id=N
 * Deletes a scrim and all related data (cascading).
 */
export async function DELETE(req: NextRequest) {
  const url = new URL(req.url)
  const idStr = url.searchParams.get('id')

  if (!idStr) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 })
  }

  const id = parseInt(idStr)
  if (isNaN(id)) {
    return NextResponse.json({ error: 'id must be a number' }, { status: 400 })
  }

  try {
    await prisma.scrim.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Scrim not found' }, { status: 404 })
  }
}

import { NextResponse, type NextRequest } from 'next/server'
import { serviceHealth } from '@/discord/serviceHealth'

export async function GET(request: NextRequest) {
  const verbose = request.nextUrl.searchParams.get('verbose') === 'true'
  const healthy = serviceHealth.isHealthy()
  const status = healthy ? 'healthy' : 'degraded'

  if (!verbose) {
    return NextResponse.json(
      { status, timestamp: new Date().toISOString() },
      { status: healthy ? 200 : 503 },
    )
  }

  const mem = process.memoryUsage()

  return NextResponse.json(
    {
      status,
      timestamp: new Date().toISOString(),
      uptime: `${Math.floor(process.uptime())}s`,
      startedAt: serviceHealth.getStartedAt(),
      memory: {
        rss: `${Math.round(mem.rss / 1024 / 1024)}MB`,
        heapUsed: `${Math.round(mem.heapUsed / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(mem.heapTotal / 1024 / 1024)}MB`,
      },
      services: serviceHealth.getAll(),
    },
    { status: healthy ? 200 : 503 },
  )
}

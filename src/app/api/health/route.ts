import { NextResponse, type NextRequest } from 'next/server'
import { serviceHealth } from '@/discord/serviceHealth'

export async function GET(request: NextRequest) {
  const verbose = request.nextUrl.searchParams.get('verbose') === 'true'

  if (!verbose) {
    return NextResponse.json({ status: 'healthy', timestamp: new Date().toISOString() })
  }

  const mem = process.memoryUsage()

  return NextResponse.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: `${Math.floor(process.uptime())}s`,
    startedAt: serviceHealth.getStartedAt(),
    memory: {
      rss: `${Math.round(mem.rss / 1024 / 1024)}MB`,
      heapUsed: `${Math.round(mem.heapUsed / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(mem.heapTotal / 1024 / 1024)}MB`,
    },
    services: serviceHealth.getAll(),
  })
}

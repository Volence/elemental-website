interface ServiceStatus {
  lastRun: string
  ok: boolean
  message: string
  durationMs: number
  consecutiveFailures: number
  expectedIntervalMs?: number
}

const services = new Map<string, ServiceStatus>()
const startedAt = new Date().toISOString()
let stalenessInterval: NodeJS.Timeout | null = null
let consecutiveUnhealthy = 0
const MAX_CONSECUTIVE_UNHEALTHY = 3

function register(name: string, expectedIntervalMs: number): void {
  const existing = services.get(name)
  if (existing) {
    existing.expectedIntervalMs = expectedIntervalMs
  } else {
    services.set(name, {
      lastRun: startedAt,
      ok: true,
      message: 'registered',
      durationMs: 0,
      consecutiveFailures: 0,
      expectedIntervalMs,
    })
  }
}

function record(name: string, ok: boolean, message: string, durationMs?: number): void {
  const prev = services.get(name)
  services.set(name, {
    lastRun: new Date().toISOString(),
    ok,
    message,
    durationMs: durationMs ?? 0,
    consecutiveFailures: ok ? 0 : (prev?.consecutiveFailures ?? 0) + 1,
    expectedIntervalMs: prev?.expectedIntervalMs,
  })

  if (!ok && (services.get(name)!.consecutiveFailures % 3 === 0)) {
    console.error(`[ServiceHealth] ${name} has failed ${services.get(name)!.consecutiveFailures} times in a row: ${message}`)
  }
}

function startStalenessChecker(): void {
  if (stalenessInterval) return
  stalenessInterval = setInterval(() => {
    const now = Date.now()
    let anyStale = false
    for (const [name, status] of services) {
      if (!status.expectedIntervalMs) continue
      const lastRun = new Date(status.lastRun).getTime()
      const stalenessThreshold = status.expectedIntervalMs * 3
      if (now - lastRun > stalenessThreshold) {
        anyStale = true
        console.error(`[ServiceHealth] ${name} appears stale - last ran ${Math.round((now - lastRun) / 1000)}s ago (expected every ${Math.round(status.expectedIntervalMs / 1000)}s)`)
      }
    }
    if (anyStale) {
      consecutiveUnhealthy++
      if (consecutiveUnhealthy >= MAX_CONSECUTIVE_UNHEALTHY) {
        console.error(`[ServiceHealth] Services stale for ${consecutiveUnhealthy} consecutive checks, forcing restart`)
        process.exit(1)
      }
    } else {
      consecutiveUnhealthy = 0
    }
  }, 5 * 60 * 1000)
}

function stopStalenessChecker(): void {
  if (stalenessInterval) {
    clearInterval(stalenessInterval)
    stalenessInterval = null
  }
}

function isHealthy(): boolean {
  const now = Date.now()
  for (const [, status] of services) {
    if (!status.expectedIntervalMs) continue
    const lastRun = new Date(status.lastRun).getTime()
    if (now - lastRun > status.expectedIntervalMs * 3) return false
  }
  return true
}

function getAll(): Record<string, ServiceStatus> {
  return Object.fromEntries(services)
}

function getStartedAt(): string {
  return startedAt
}

export const serviceHealth = { register, record, startStalenessChecker, stopStalenessChecker, isHealthy, getAll, getStartedAt }

interface ServiceStatus {
  lastRun: string
  ok: boolean
  message: string
  durationMs: number
  consecutiveFailures: number
}

const services = new Map<string, ServiceStatus>()
const startedAt = new Date().toISOString()

function record(name: string, ok: boolean, message: string, durationMs?: number): void {
  const prev = services.get(name)
  services.set(name, {
    lastRun: new Date().toISOString(),
    ok,
    message,
    durationMs: durationMs ?? 0,
    consecutiveFailures: ok ? 0 : (prev?.consecutiveFailures ?? 0) + 1,
  })

  if (!ok && (services.get(name)!.consecutiveFailures % 3 === 0)) {
    console.error(`[ServiceHealth] ${name} has failed ${services.get(name)!.consecutiveFailures} times in a row: ${message}`)
  }
}

function getAll(): Record<string, ServiceStatus> {
  return Object.fromEntries(services)
}

function getStartedAt(): string {
  return startedAt
}

export const serviceHealth = { record, getAll, getStartedAt }

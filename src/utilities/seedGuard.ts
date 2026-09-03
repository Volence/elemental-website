/**
 * Guard for the database seed routes (`/next/seed`, `/next/seed-teams`).
 *
 * These routes wipe and recreate data. Before this guard existed they only
 * required *any* authenticated Payload user, which included Discord-created
 * PUG players. The guard now requires:
 *
 * 1. Not production, unless ALLOW_DB_SEED=true is set explicitly. In
 *    production the route answers 404 so it does not advertise itself.
 * 2. An authenticated user with role `admin`.
 */

type SeedUser = { role?: string | null } | null | undefined

type SeedEnv = { NODE_ENV?: string; ALLOW_DB_SEED?: string }

export type SeedGuardResult = { ok: true } | { ok: false; status: 403 | 404; reason: string }

export function canRunSeed(user: SeedUser, env: SeedEnv = process.env): SeedGuardResult {
  if (env.NODE_ENV === 'production' && env.ALLOW_DB_SEED !== 'true') {
    return { ok: false, status: 404, reason: 'Seeding is disabled in production.' }
  }
  if (!user || user.role !== 'admin') {
    return { ok: false, status: 403, reason: 'Action forbidden.' }
  }
  return { ok: true }
}

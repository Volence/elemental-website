import { relId } from './compute'
import { DEPARTMENT_KEYS, ROLE_VALUES, type RawPerson } from './types'

export interface MutationInput {
  person: RawPerson & { role?: string | null }
  body: Record<string, unknown>
  /** Id of the admin performing the change, for the self-demotion guard. */
  actorId: number | string
  /** How many admins exist right now, for the last-admin guard. */
  adminCount: number
}

export type MutationResult =
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; status: number; error: string }

function currentTeamIds(person: RawPerson): number[] {
  const ids: number[] = []
  for (const entry of person.assignedTeams ?? []) {
    const id = relId(entry)
    if (id !== null) ids.push(id)
  }
  return ids
}

/**
 * Decide the single-field update for one grant or revoke, or refuse it.
 * Every rule lives here so the route handler stays a thin wrapper and the guards are testable.
 */
export function resolveMutation(input: MutationInput): MutationResult {
  const { person, body, actorId, adminCount } = input
  const kind = body.kind

  if (kind === 'role') {
    const value = body.value
    if (typeof value !== 'string' || !(ROLE_VALUES as readonly string[]).includes(value)) {
      return { ok: false, status: 400, error: `Unknown role: ${String(value)}` }
    }
    if (String(actorId) === String(person.id)) {
      return { ok: false, status: 403, error: 'You cannot change your own role' }
    }
    if (person.role === 'admin' && value !== 'admin' && adminCount <= 1) {
      return { ok: false, status: 409, error: 'Refusing to remove the last remaining Admin' }
    }
    return { ok: true, data: { role: value } }
  }

  if (kind === 'department') {
    const key = body.key
    if (typeof key !== 'string' || !(DEPARTMENT_KEYS as readonly string[]).includes(key)) {
      return { ok: false, status: 400, error: `Unknown department: ${String(key)}` }
    }
    return {
      ok: true,
      data: { departments: { ...(person.departments ?? {}), [key]: body.value === true } },
    }
  }

  if (kind === 'team') {
    const teamId = Number(body.teamId)
    if (!Number.isFinite(teamId)) {
      return { ok: false, status: 400, error: 'teamId must be a number' }
    }
    const current = currentTeamIds(person)
    const next =
      body.value === true
        ? current.includes(teamId)
          ? current
          : [...current, teamId]
        : current.filter((id) => id !== teamId)
    return { ok: true, data: { assignedTeams: next } }
  }

  return { ok: false, status: 400, error: `Unknown mutation kind: ${String(kind)}` }
}

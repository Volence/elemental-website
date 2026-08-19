import type { AccessReport, DepartmentKey, RoleValue } from '@/accessReview/types'

export type AccessDelta =
  | { personId: number; kind: 'role'; value: RoleValue }
  | { personId: number; kind: 'department'; key: DepartmentKey; value: boolean }
  | { personId: number; kind: 'team'; teamId: number; value: boolean }

export async function fetchReport(refresh = false): Promise<AccessReport> {
  const res = await fetch(`/api/access-review${refresh ? '?refresh=1' : ''}`, {
    credentials: 'include',
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok || !body?.success) {
    throw new Error(body?.error ?? `Failed to load access report (${res.status})`)
  }
  return body.report as AccessReport
}

/** Applies one delta. Throws with the server's message so the UI can show the guard text. */
export async function applyDelta(delta: AccessDelta): Promise<void> {
  const res = await fetch('/api/access-review', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(delta),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok || !body?.success) {
    throw new Error(body?.error ?? `Change failed (${res.status})`)
  }
}

/** The inverse of a delta, for the Undo affordance. */
export function invertDelta(delta: AccessDelta, previousRole: string | null): AccessDelta {
  if (delta.kind === 'role') {
    return { ...delta, value: (previousRole ?? 'user') as RoleValue }
  }
  return { ...delta, value: !delta.value } as AccessDelta
}

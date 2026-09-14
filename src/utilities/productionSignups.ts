/**
 * Signup and assignment lists for a match's production workflow.
 *
 * Pure: no Payload. The API routes compute the next list here from a fresh read of the match,
 * and the Assignment view uses the slot helpers to show who is free for a time slot.
 *
 * A signup is availability for a whole time slot - the Staff Signups page writes it to every
 * match at that time - so the Assignment view offers the slot's signups on every match in it
 * rather than trusting each match's own copy. Every list is de-duplicated on the way through:
 * two saves of one match racing each other used to leave a person listed twice.
 */
import { relId } from './productionCoverage'

type Rel = number | string | { id?: number | string | null } | null | undefined

interface CasterInput {
  id?: string | null
  user?: Rel
  style?: string | null
}

export interface CasterRow {
  id?: string | null
  user: number
  style?: string | null
}

export interface SignupWorkflow {
  observerSignups?: Rel[] | null
  producerSignups?: Rel[] | null
  casterSignups?: CasterInput[] | null
}

export interface SignupLists {
  observerSignups: number[]
  producerSignups: number[]
  casterSignups: CasterRow[]
}

export interface SignupRoles {
  observer?: boolean
  producer?: boolean
  caster?: boolean
  casterStyle?: string | null
}

export type SignupRole = 'observer' | 'producer' | 'caster'
export type StaffRole = 'observer' | 'producer' | 'director' | 'caster'

export interface AssignmentWorkflow {
  assignedObservers?: Rel[] | null
  assignedProducers?: Rel[] | null
  assignedDirectors?: Rel[] | null
  assignedCasters?: CasterInput[] | null
}

export interface AssignmentLists {
  assignedObservers?: number[]
  assignedProducers?: number[]
  assignedDirectors?: number[]
  assignedCasters?: CasterRow[]
}

const ASSIGNED_FIELD = {
  observer: 'assignedObservers',
  producer: 'assignedProducers',
  director: 'assignedDirectors',
} as const

/** Ids in first-seen order, each once. */
export function uniqueIds(list: Rel[] | null | undefined): number[] {
  const seen = new Set<number>()
  const out: number[] = []
  for (const value of list ?? []) {
    const id = relId(value)
    if (id === null || seen.has(id)) continue
    seen.add(id)
    out.push(id)
  }
  return out
}

/** Caster rows, one per person, first row wins. Row ids are kept so a rewrite does not churn them. */
export function uniqueCasters(list: CasterInput[] | null | undefined): CasterRow[] {
  const seen = new Set<number>()
  const out: CasterRow[] = []
  for (const row of list ?? []) {
    const user = relId(row?.user)
    if (user === null || seen.has(user)) continue
    seen.add(user)
    out.push({
      ...(row.id ? { id: row.id } : {}),
      user,
      ...(row.style !== undefined ? { style: row.style } : {}),
    })
  }
  return out
}

export function signupLists(pw: SignupWorkflow | null | undefined): SignupLists {
  return {
    observerSignups: uniqueIds(pw?.observerSignups),
    producerSignups: uniqueIds(pw?.producerSignups),
    casterSignups: uniqueCasters(pw?.casterSignups),
  }
}

/** Adds the person to each ticked role. Unticked roles are left as they are. */
export function withSignup(pw: SignupWorkflow | null | undefined, userId: number, roles: SignupRoles): SignupLists {
  const lists = signupLists(pw)
  if (roles.observer && !lists.observerSignups.includes(userId)) lists.observerSignups.push(userId)
  if (roles.producer && !lists.producerSignups.includes(userId)) lists.producerSignups.push(userId)
  if (roles.caster) {
    const style = roles.casterStyle || null
    const existing = lists.casterSignups.find((c) => c.user === userId)
    if (existing) existing.style = style
    else lists.casterSignups.push({ user: userId, style })
  }
  return lists
}

export function withoutSignup(pw: SignupWorkflow | null | undefined, userId: number, role: SignupRole): SignupLists {
  const lists = signupLists(pw)
  if (role === 'observer') lists.observerSignups = lists.observerSignups.filter((id) => id !== userId)
  if (role === 'producer') lists.producerSignups = lists.producerSignups.filter((id) => id !== userId)
  if (role === 'caster') lists.casterSignups = lists.casterSignups.filter((c) => c.user !== userId)
  return lists
}

/** The one assigned list a role writes, with the person added. */
export function withAssignment(
  pw: AssignmentWorkflow | null | undefined,
  role: StaffRole,
  userId: number,
  style?: string | null,
): AssignmentLists {
  if (role === 'caster') {
    const casters = uniqueCasters(pw?.assignedCasters)
    if (!casters.some((c) => c.user === userId)) casters.push({ user: userId, style: style || 'both' })
    return { assignedCasters: casters }
  }
  const field = ASSIGNED_FIELD[role]
  const ids = uniqueIds(pw?.[field])
  if (!ids.includes(userId)) ids.push(userId)
  return { [field]: ids }
}

/** The one assigned list a role writes, with the person removed. */
export function withoutAssignment(pw: AssignmentWorkflow | null | undefined, role: StaffRole, userId: number): AssignmentLists {
  if (role === 'caster') {
    return { assignedCasters: uniqueCasters(pw?.assignedCasters).filter((c) => c.user !== userId) }
  }
  const field = ASSIGNED_FIELD[role]
  return { [field]: uniqueIds(pw?.[field]).filter((id) => id !== userId) }
}

// ─── Time slot helpers (Assignment view) ───

type Person = number | { id?: number | string | null }

interface SlotWorkflow<P> {
  observerSignups?: (P | null)[] | null
  producerSignups?: (P | null)[] | null
  casterSignups?: Array<{ user?: P | null; style?: string | null }> | null
  assignedObservers?: (P | null)[] | null
  assignedProducers?: (P | null)[] | null
  assignedDirectors?: (P | null)[] | null
  assignedCasters?: Array<{ user?: P | null }> | null
}

interface SlotMatch<P> {
  id?: number
  title?: string | null
  productionWorkflow?: SlotWorkflow<P> | null
}

export interface SlotSignups<P> {
  observers: P[]
  producers: P[]
  casters: Array<{ user: P; style?: string | null }>
}

/** Collects people by id, first-seen order, swapping a bare id for a populated record when one turns up. */
function collector<P extends Person>() {
  const order: number[] = []
  const byId = new Map<number, P>()
  return {
    add(person: P | null | undefined): number | null {
      const id = relId(person as Rel)
      if (id === null || person == null) return null
      const known = byId.get(id)
      if (known === undefined) {
        order.push(id)
        byId.set(id, person)
      } else if (typeof known !== 'object' && typeof person === 'object') {
        byId.set(id, person)
      }
      return id
    },
    list: (): P[] => order.map((id) => byId.get(id)!),
  }
}

/** Everyone who signed up for any match in the slot, per role, each once. */
export function slotSignups<P extends Person>(matches: SlotMatch<P>[]): SlotSignups<P> {
  const observers = collector<P>()
  const producers = collector<P>()
  const casters = collector<P>()
  const styles = new Map<number, string | null | undefined>()
  for (const m of matches) {
    const pw = m.productionWorkflow
    pw?.observerSignups?.forEach((p) => observers.add(p))
    pw?.producerSignups?.forEach((p) => producers.add(p))
    pw?.casterSignups?.forEach((c) => {
      const id = casters.add(c?.user)
      if (id !== null && !styles.has(id)) styles.set(id, c.style)
    })
  }
  return {
    observers: observers.list(),
    producers: producers.list(),
    casters: casters.list().map((user) => ({ user, style: styles.get(relId(user as Rel)!) })),
  }
}

/** People already working another match in the slot, mapped to that match's title. */
export function assignedElsewhere<P extends Person>(matches: SlotMatch<P>[], matchId: number): Map<number, string> {
  const busy = new Map<number, string>()
  for (const m of matches) {
    if (m.id === matchId) continue
    const pw = m.productionWorkflow
    const people = [
      ...(pw?.assignedObservers ?? []),
      ...(pw?.assignedProducers ?? []),
      ...(pw?.assignedDirectors ?? []),
      ...(pw?.assignedCasters ?? []).map((c) => c?.user),
    ]
    for (const person of people) {
      const id = relId(person as Rel)
      if (id !== null && !busy.has(id)) busy.set(id, m.title || `Match #${m.id}`)
    }
  }
  return busy
}

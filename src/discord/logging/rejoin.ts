export interface MemberEventRow { eventType: 'join' | 'leave'; occurredAt: string }

export interface RejoinSummary { priorJoins: number; isRejoin: boolean; lastLeftAt: string | null }

/** Summarize a member's prior join/leave history (does NOT include the current join). */
export function summarizeRejoin(history: MemberEventRow[]): RejoinSummary {
  const priorJoins = history.filter((r) => r.eventType === 'join').length
  const leaves = history
    .filter((r) => r.eventType === 'leave')
    .map((r) => r.occurredAt)
    .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())
  return {
    priorJoins,
    isRejoin: priorJoins > 0,
    lastLeftAt: leaves.length ? leaves[leaves.length - 1] : null,
  }
}

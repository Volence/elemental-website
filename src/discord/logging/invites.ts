export type InviteUseMap = Record<string, number>

export interface InviteMatch { code: string; uses: number }

/** Returns the single invite whose uses increased, or null if zero or more than one did. */
export function diffInviteUses(before: InviteUseMap, after: InviteUseMap): InviteMatch | null {
  const increased: InviteMatch[] = []
  for (const code of Object.keys(after)) {
    const prev = before[code] ?? 0
    if (after[code] > prev) increased.push({ code, uses: after[code] })
  }
  return increased.length === 1 ? increased[0] : null
}

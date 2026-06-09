export interface RoleDiff { added: string[]; removed: string[] }

export function diffRoles(before: string[], after: string[]): RoleDiff {
  const b = new Set(before)
  const a = new Set(after)
  return {
    added: after.filter((id) => !b.has(id)),
    removed: before.filter((id) => !a.has(id)),
  }
}

export interface NicknameDiff { from: string | null; to: string | null; changed: boolean }

export function diffNickname(before: string | null, after: string | null): NicknameDiff {
  return { from: before, to: after, changed: before !== after }
}

export function truncate(text: string, max: number): string {
  return text.length <= max ? text : text.slice(0, max) + '...'
}

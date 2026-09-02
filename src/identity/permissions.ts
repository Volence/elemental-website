/** Who may search Discord members and create people from them. Step 2 replaces this with the title model. */
export function canPickMembers(user: { role?: string | null; departments?: Record<string, unknown> | null } | null | undefined): boolean {
  if (!user) return false
  if (user.role === 'admin' || user.role === 'staff-manager' || user.role === 'team-manager') return true
  return Object.values(user.departments ?? {}).some((v) => v === true)
}

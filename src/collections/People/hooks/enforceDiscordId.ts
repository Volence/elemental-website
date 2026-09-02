import { APIError } from 'payload'
import { requireDiscordIdOnCreate, DISCORD_ID_RE } from '@/identity/config'

/**
 * Create-time rule: a new person must carry a Discord ID. Payload evaluates create access
 * without data when deciding whether to show the admin "Create new" button, so returning
 * false for missing data hides the default form once the flag is on.
 */
export function createAccessAllowsData(data: { discordId?: unknown } | undefined): boolean {
  if (!requireDiscordIdOnCreate()) return true
  return typeof data?.discordId === 'string' && DISCORD_ID_RE.test(data.discordId)
}

export async function enforceDiscordIdOnCreate(args: {
  operation: string
  data: any
  context?: Record<string, unknown>
  countPeople: () => Promise<number>
}): Promise<void> {
  if (args.operation !== 'create' || !requireDiscordIdOnCreate()) return
  if (args.context?.identityCreate === true) return

  const id = args.data?.discordId
  if (typeof id === 'string' && DISCORD_ID_RE.test(id)) return

  // First-run bootstrap: /api/create-admin on an empty table.
  if (args.data?.role === 'admin' && (await args.countPeople()) === 0) return

  if (id) throw new APIError('Discord ID must be 17-19 digits', 400, undefined, true)
  throw new APIError('New people must be created from a Discord member (Discord ID is required)', 400, undefined, true)
}

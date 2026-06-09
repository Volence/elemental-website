export type LogCategory = 'message' | 'joinLeave' | 'member' | 'profile' | 'server'

export interface LoggingConfig {
  enableLogging: boolean
  messageLogChannelId?: string | null
  joinLeaveLogChannelId?: string | null
  memberLogChannelId?: string | null
  profileLogChannelId?: string | null
  serverLogChannelId?: string | null
  newAccountFlagDays: number
  attachProfileLink: boolean
}

type ChannelIdField =
  | 'messageLogChannelId'
  | 'joinLeaveLogChannelId'
  | 'memberLogChannelId'
  | 'profileLogChannelId'
  | 'serverLogChannelId'

const FIELD: Record<LogCategory, ChannelIdField> = {
  message: 'messageLogChannelId',
  joinLeave: 'joinLeaveLogChannelId',
  member: 'memberLogChannelId',
  profile: 'profileLogChannelId',
  server: 'serverLogChannelId',
}

/** Returns the channel id for a category, or null if logging is off or the channel is unset. */
export function resolveLogChannelId(cfg: LoggingConfig, category: LogCategory): string | null {
  if (!cfg.enableLogging) return null
  const value = cfg[FIELD[category]]
  return value ? String(value) : null
}

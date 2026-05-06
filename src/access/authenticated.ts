import type { AccessArgs } from 'payload'

import type { Person } from '@/payload-types'

type isAuthenticated = (args: AccessArgs<Person>) => boolean

export const authenticated: isAuthenticated = ({ req: { user } }) => {
  return Boolean(user)
}

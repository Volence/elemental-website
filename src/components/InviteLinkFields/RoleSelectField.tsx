'use client'

import React from 'react'
import { SelectField } from '@payloadcms/ui'
import type { SelectFieldClientProps } from 'payload'
import { useAccess } from '@/access/useAccess'

/**
 * Custom role select field that filters available options based on the current user's access.
 * Staff managers can only create invites for roles below their level (team-manager, player, user).
 * Admins retain full access to all role options.
 *
 * The old team-manager-only filter (player invites only) is gone: no person can hold that role
 * value any more (team access is now via team relations, not a role string), and InviteLinks'
 * own create hook still enforces its own restriction for non-staff creators.
 */
const RoleSelectField: React.FC<SelectFieldClientProps> = (props) => {
  const { access } = useAccess()
  const isStaffManager = access?.isStaffManager ?? false

  const filteredField = isStaffManager
    ? {
        ...props.field,
        options: (props.field.options || []).filter((opt: any) => {
          const value = typeof opt === 'string' ? opt : opt.value
          return value !== 'admin' && value !== 'staff-manager'
        }),
      }
    : props.field

  return <SelectField {...props} field={filteredField} />
}

export default RoleSelectField

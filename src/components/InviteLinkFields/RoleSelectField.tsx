'use client'

import React from 'react'
import { SelectField, useAuth } from '@payloadcms/ui'
import type { SelectFieldClientProps } from 'payload'

/**
 * Custom role select field that filters available options based on the current user's role.
 * Staff managers can only create invites for roles below their level (team-manager, player, user).
 * Admins retain full access to all role options.
 */
const RoleSelectField: React.FC<SelectFieldClientProps> = (props) => {
  const { user } = useAuth()
  const isStaffManager = user?.role === 'staff-manager'

  // Filter out admin and staff-manager options for non-admin users
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

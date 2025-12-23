'use client'

import React from 'react'
import { useAuth, SelectField } from '@payloadcms/ui'
import { UserRole } from '@/access/roles'

const allCategoryOptions = [
  { label: 'Player Position', value: 'player' },
  { label: 'Team Staff Position', value: 'team-staff' },
  { label: 'Organization Staff Position', value: 'org-staff' },
]

const teamManagerOptions = [
  { label: 'Player Position', value: 'player' },
  { label: 'Team Staff Position', value: 'team-staff' },
]

export const CategorySelectField: React.FC<any> = (props) => {
  const { user } = useAuth()
  
  // Team managers can only see team-related categories (not org-wide)
  const options = user?.role === UserRole.TEAM_MANAGER 
    ? teamManagerOptions 
    : allCategoryOptions

  const fieldWithOptions = {
    ...props.field,
    options,
  }

  return <SelectField {...props} field={fieldWithOptions} />
}

export default CategorySelectField


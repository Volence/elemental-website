'use client'

import React from 'react'
import { SelectField } from '@payloadcms/ui'
import { useAccess } from '@/access/useAccess'

const allCategoryOptions = [
  { label: 'Player Position', value: 'player' },
  { label: 'Team Staff Position', value: 'team-staff' },
  { label: 'Organization Staff Position', value: 'org-staff' },
]

const teamOnlyOptions = [
  { label: 'Player Position', value: 'player' },
  { label: 'Team Staff Position', value: 'team-staff' },
]

export const CategorySelectField: React.FC<any> = (props) => {
  const { access } = useAccess()

  // Team-scoped (non-staff) people can only see team-related categories, not org-wide.
  const options = access && !access.canManagePeople && access.teamIds.size > 0 ? teamOnlyOptions : allCategoryOptions

  const fieldWithOptions = {
    ...props.field,
    options,
  }

  return <SelectField {...props} field={fieldWithOptions} />
}

export default CategorySelectField


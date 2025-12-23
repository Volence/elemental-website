'use client'

import React from 'react'
import { useFormFields, SelectField } from '@payloadcms/ui'

const roleOptions = {
  player: [
    { label: 'Tank', value: 'tank' },
    { label: 'DPS', value: 'dps' },
    { label: 'Support', value: 'support' },
  ],
  'team-staff': [
    { label: 'Coach', value: 'coach' },
    { label: 'Manager', value: 'manager' },
    { label: 'Assistant Coach', value: 'assistant-coach' },
  ],
  'org-staff': [
    { label: 'Moderator', value: 'moderator' },
    { label: 'Event Manager', value: 'event-manager' },
    { label: 'Social Media Manager', value: 'social-manager' },
    { label: 'Graphics Designer', value: 'graphics' },
    { label: 'Media Editor', value: 'media-editor' },
    { label: 'Caster', value: 'caster' },
    { label: 'Observer', value: 'observer' },
    { label: 'Producer', value: 'producer' },
    { label: 'Observer/Producer', value: 'observer-producer' },
  ],
}

export const RoleSelectField: React.FC<any> = (props) => {
  const category = useFormFields(([fields]) => fields?.category?.value as string) || 'player'
  const options = roleOptions[category as keyof typeof roleOptions] || roleOptions.player

  const fieldWithOptions = {
    ...props.field,
    options,
  }

  return <SelectField {...props} field={fieldWithOptions} />
}

export default RoleSelectField


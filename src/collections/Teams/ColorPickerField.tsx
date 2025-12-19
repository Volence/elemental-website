'use client'

import React from 'react'
import { useField, TextInput, FieldLabel } from '@payloadcms/ui'

const ColorPickerField: React.FC = () => {
  const { value, setValue } = useField<string>({ path: 'themeColor' })

  return (
    <div className="field-type">
      <FieldLabel
        htmlFor="themeColor"
        label="Theme Color"
      />
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
        <input
          type="color"
          id="themeColor"
          value={value || '#3b82f6'}
          onChange={(e) => setValue(e.target.value)}
          style={{
            width: '80px',
            height: '40px',
            border: '2px solid var(--theme-elevation-100)',
            borderRadius: '4px',
            cursor: 'pointer',
            backgroundColor: 'transparent',
          }}
        />
        <TextInput
          value={value || ''}
          onChange={setValue}
          path="themeColor"
          placeholder="#3b82f6"
          style={{ flex: 1 }}
        />
      </div>
      <div style={{ 
        marginTop: '8px', 
        fontSize: '12px', 
        color: 'var(--theme-elevation-500)',
        lineHeight: '1.4'
      }}>
        Pick a color that complements your team logo for the hero background gradient. Leave empty to auto-detect based on team name/keywords.
      </div>
    </div>
  )
}

export default ColorPickerField

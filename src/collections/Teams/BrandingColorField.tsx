'use client'

import React from 'react'
import { useField, TextInput, FieldLabel } from '@payloadcms/ui'

interface BrandingColorFieldProps {
  path: string
  label: string
  description?: string
}

const BrandingColorField: React.FC<BrandingColorFieldProps> = ({ path, label, description }) => {
  const { value, setValue } = useField<string>({ path })
  const currentColor = value || '#ffffff'

  return (
    <div className="field-type" style={{ marginBottom: '16px' }}>
      <FieldLabel htmlFor={path} label={label} />
      {description && (
        <div style={{
          fontSize: '12px',
          color: 'var(--theme-elevation-500)',
          marginBottom: '8px',
        }}>
          {description}
        </div>
      )}
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
        <input
          type="color"
          id={path}
          value={currentColor}
          onChange={(e) => setValue(e.target.value)}
          style={{
            width: '48px',
            height: '36px',
            border: '2px solid var(--theme-elevation-100)',
            borderRadius: '4px',
            cursor: 'pointer',
            backgroundColor: 'transparent',
            padding: '2px',
          }}
        />
        <div
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '4px',
            backgroundColor: currentColor,
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: value ? `0 0 12px ${currentColor}66` : 'none',
          }}
          title="Color preview"
        />
        <TextInput
          value={value || ''}
          onChange={setValue}
          path={path}
          placeholder="#FF00FF"
          style={{ flex: 1 }}
        />
      </div>
    </div>
  )
}

export default BrandingColorField

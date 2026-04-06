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
    <div className="field-type branding-color-field">
      <FieldLabel htmlFor={path} label={label} />
      {description && (
        <div className="branding-color-field__description">
          {description}
        </div>
      )}
      <div className="branding-color-field__row">
        {/* Color swatch — native picker hidden inside */}
        <div
          className="branding-color-field__swatch"
          style={{
            backgroundColor: currentColor,
            boxShadow: value ? `0 0 14px ${currentColor}55` : 'none',
          }}
          title="Click to pick color"
        >
          <input
            type="color"
            id={path}
            value={currentColor}
            onChange={(e) => setValue(e.target.value)}
            className="branding-color-field__native-input"
          />
        </div>
        <TextInput
          value={value || ''}
          onChange={setValue}
          path={path}
          placeholder="#FF00FF"
        />
      </div>
    </div>
  )
}

export default BrandingColorField

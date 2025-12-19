'use client'

import React, { useState, useEffect } from 'react'
import { useField, TextInput, FieldLabel } from '@payloadcms/ui'

const ColorPickerField: React.FC = () => {
  const { value, setValue } = useField<string>({ path: 'themeColor' })
  const [lightness, setLightness] = useState(50)
  const [supportsEyeDropper, setSupportsEyeDropper] = useState(false)

  // Check if EyeDropper API is supported
  useEffect(() => {
    setSupportsEyeDropper('EyeDropper' in window)
  }, [])

  // Convert hex to HSL
  const hexToHSL = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    if (!result) return { h: 0, s: 0, l: 50 }

    let r = parseInt(result[1], 16) / 255
    let g = parseInt(result[2], 16) / 255
    let b = parseInt(result[3], 16) / 255

    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    let h = 0, s = 0, l = (max + min) / 2

    if (max !== min) {
      const d = max - min
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break
        case g: h = ((b - r) / d + 2) / 6; break
        case b: h = ((r - g) / d + 4) / 6; break
      }
    }

    return { h: h * 360, s: s * 100, l: l * 100 }
  }

  // Convert HSL to hex
  const hslToHex = (h: number, s: number, l: number) => {
    h = h / 360
    s = s / 100
    l = l / 100

    let r, g, b

    if (s === 0) {
      r = g = b = l
    } else {
      const hue2rgb = (p: number, q: number, t: number) => {
        if (t < 0) t += 1
        if (t > 1) t -= 1
        if (t < 1/6) return p + (q - p) * 6 * t
        if (t < 1/2) return q
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6
        return p
      }

      const q = l < 0.5 ? l * (1 + s) : l + s - l * s
      const p = 2 * l - q
      r = hue2rgb(p, q, h + 1/3)
      g = hue2rgb(p, q, h)
      b = hue2rgb(p, q, h - 1/3)
    }

    const toHex = (x: number) => {
      const hex = Math.round(x * 255).toString(16)
      return hex.length === 1 ? '0' + hex : hex
    }

    return `#${toHex(r)}${toHex(g)}${toHex(b)}`
  }

  // Update lightness when color changes
  useEffect(() => {
    if (value) {
      const hsl = hexToHSL(value)
      setLightness(hsl.l)
    }
  }, [value])

  // Adjust lightness
  const handleLightnessChange = (newLightness: number) => {
    setLightness(newLightness)
    if (value) {
      const hsl = hexToHSL(value)
      const newColor = hslToHex(hsl.h, hsl.s, newLightness)
      setValue(newColor)
    }
  }

  // Open eyedropper
  const handleEyeDropper = async () => {
    if (!supportsEyeDropper) {
      alert('EyeDropper API is not supported in this browser. Please use Chrome, Edge, or another Chromium-based browser.')
      return
    }

    try {
      // @ts-ignore - EyeDropper is not in TypeScript types yet
      const eyeDropper = new EyeDropper()
      const result = await eyeDropper.open()
      setValue(result.sRGBHex)
    } catch (e) {
      // User cancelled or error occurred
      console.log('EyeDropper cancelled or failed:', e)
    }
  }

  const currentColor = value || '#3b82f6'

  return (
    <div className="field-type">
      <FieldLabel
        htmlFor="themeColor"
        label="Theme Color"
      />
      
      {/* Color Picker Row */}
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '12px' }}>
        <input
          type="color"
          id="themeColor"
          value={currentColor}
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
        
        {/* Eyedropper Button */}
        {supportsEyeDropper && (
          <button
            type="button"
            onClick={handleEyeDropper}
            style={{
              width: '40px',
              height: '40px',
              border: '2px solid var(--theme-elevation-100)',
              borderRadius: '4px',
              cursor: 'pointer',
              backgroundColor: 'var(--theme-elevation-0)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '18px',
              transition: 'all 0.2s',
            }}
            title="Pick color from screen (click logo to sample)"
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--theme-elevation-100)'
              e.currentTarget.style.borderColor = 'var(--theme-input-border-color-focused)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--theme-elevation-0)'
              e.currentTarget.style.borderColor = 'var(--theme-elevation-100)'
            }}
          >
            💧
          </button>
        )}
        
        <TextInput
          value={value || ''}
          onChange={setValue}
          path="themeColor"
          placeholder="#3b82f6"
          style={{ flex: 1 }}
        />
      </div>

      {/* Lightness Slider */}
      <div style={{ marginBottom: '12px' }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: '6px'
        }}>
          <label style={{ 
            fontSize: '12px', 
            fontWeight: '600',
            color: 'var(--theme-elevation-800)'
          }}>
            Brightness
          </label>
          <span style={{ 
            fontSize: '11px', 
            color: 'var(--theme-elevation-500)',
            fontFamily: 'monospace'
          }}>
            {Math.round(lightness)}%
          </span>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{ fontSize: '12px' }}>🌑</span>
          <input
            type="range"
            min="10"
            max="90"
            value={lightness}
            onChange={(e) => handleLightnessChange(Number(e.target.value))}
            style={{
              flex: 1,
              height: '6px',
              cursor: 'pointer',
            }}
          />
          <span style={{ fontSize: '12px' }}>☀️</span>
        </div>
      </div>

      {/* Color Preview */}
      <div style={{
        padding: '16px',
        borderRadius: '8px',
        background: `linear-gradient(135deg, ${currentColor}20, ${currentColor}05)`,
        border: `2px solid ${currentColor}30`,
        marginBottom: '8px',
        textAlign: 'center',
        fontSize: '11px',
        color: 'var(--theme-elevation-600)',
        fontWeight: '600'
      }}>
        Hero Background Preview
      </div>
      
      <div style={{ 
        fontSize: '12px', 
        color: 'var(--theme-elevation-500)',
        lineHeight: '1.5'
      }}>
        💡 <strong>Tip:</strong> Use the eyedropper (💧) to pick a color directly from your logo! Then adjust the brightness slider to make it lighter or darker. Leave empty to auto-detect.
      </div>
    </div>
  )
}

export default ColorPickerField

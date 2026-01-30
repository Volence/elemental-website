'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useField, TextInput, FieldLabel } from '@payloadcms/ui'

const ColorPickerField: React.FC = () => {
  const { value, setValue } = useField<string>({ path: 'themeColor' })
  const logoField = useField<string | number | { url?: string }>({ path: 'logo' })
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [lightness, setLightness] = useState(50)
  const [supportsEyeDropper, setSupportsEyeDropper] = useState(false)
  const [browserName, setBrowserName] = useState('Unknown')
  const [isPickingColor, setIsPickingColor] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Fetch logo URL when we have an ID
  useEffect(() => {
    const fetchLogoUrl = async (id: number) => {
      try {
        const response = await fetch(`/api/graphics-assets/${id}?depth=0`)
        if (response.ok) {
          const data = await response.json()
          setLogoUrl(data.url || null)
        }
      } catch (error) {
        console.error('[ColorPickerField] Error fetching logo:', error)
      }
    }

    const logoValue = logoField.value
    if (!logoValue) {
      setLogoUrl(null)
      return
    }

    // If it's a number (ID), fetch the document
    if (typeof logoValue === 'number') {
      fetchLogoUrl(logoValue)
      return
    }

    // If it's a string that looks like an ID, parse and fetch
    if (typeof logoValue === 'string' && !isNaN(Number(logoValue)) && !logoValue.startsWith('/')) {
      fetchLogoUrl(Number(logoValue))
      return
    }

    // If it's a string path (legacy), use directly
    if (typeof logoValue === 'string') {
      setLogoUrl(logoValue)
      return
    }

    // If it's already an object with url
    if (typeof logoValue === 'object' && logoValue !== null && 'url' in logoValue && logoValue.url) {
      setLogoUrl(logoValue.url)
    }
  }, [logoField.value])

  // Detect browser name
  const detectBrowser = () => {
    if (typeof navigator === 'undefined') return 'Unknown'
    
    const ua = navigator.userAgent
    if (ua.includes('Vivaldi')) return 'Vivaldi'
    if (ua.includes('Edg/')) return 'Edge'
    if (ua.includes('Chrome') && !ua.includes('Edg')) return 'Chrome'
    if (ua.includes('Firefox')) return 'Firefox'
    if (ua.includes('Safari') && !ua.includes('Chrome')) return 'Safari'
    if (ua.includes('OPR') || ua.includes('Opera')) return 'Opera'
    return 'Chromium-based'
  }

  // Check if EyeDropper API is supported on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hasEyeDropper = 'EyeDropper' in window
      setSupportsEyeDropper(hasEyeDropper)
      setBrowserName(detectBrowser())
      
      // Debug log
    }
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

  // RGB to Hex conversion
  const rgbToHex = (r: number, g: number, b: number) => {
    return '#' + [r, g, b].map(x => {
      const hex = x.toString(16)
      return hex.length === 1 ? '0' + hex : hex
    }).join('')
  }

  // Get color from image at position
  const getColorFromImage = (img: HTMLImageElement, x: number, y: number) => {
    const canvas = canvasRef.current
    if (!canvas) return null

    const ctx = canvas.getContext('2d')
    if (!ctx) return null

    // Set canvas size to match image
    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight

    // Draw image to canvas
    ctx.drawImage(img, 0, 0)

    // Get pixel data
    const imageData = ctx.getImageData(x, y, 1, 1)
    const pixel = imageData.data

    return rgbToHex(pixel[0], pixel[1], pixel[2])
  }

  // Start custom color picker mode
  const handleCustomEyeDropper = () => {
    setIsPickingColor(true)
  }

  // Open native eyedropper (fallback)
  const handleNativeEyeDropper = async () => {
    if (!supportsEyeDropper) {
      // Use custom picker instead
      handleCustomEyeDropper()
      return
    }

    try {
      // @ts-ignore - EyeDropper is not in TypeScript types yet
      const eyeDropper = new EyeDropper()
      const result = await eyeDropper.open()
      setValue(result.sRGBHex)
    } catch (e) {
      // User cancelled or error occurred
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
        <button
          type="button"
          onClick={handleCustomEyeDropper}
          style={{
            width: '40px',
            height: '40px',
            border: '2px solid var(--theme-elevation-100)',
            borderRadius: '4px',
            cursor: 'pointer',
            backgroundColor: isPickingColor ? 'var(--theme-success-500)' : 'var(--theme-elevation-0)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '18px',
            transition: 'all 0.2s',
            color: isPickingColor ? 'white' : 'inherit',
          }}
          title="Click to activate, then click on your logo preview below to pick a color"
          onMouseEnter={(e) => {
            if (!isPickingColor) {
              e.currentTarget.style.backgroundColor = 'var(--theme-elevation-100)'
              e.currentTarget.style.borderColor = 'var(--theme-input-border-color-focused)'
            }
          }}
          onMouseLeave={(e) => {
            if (!isPickingColor) {
              e.currentTarget.style.backgroundColor = 'var(--theme-elevation-0)'
              e.currentTarget.style.borderColor = 'var(--theme-elevation-100)'
            }
          }}
        >
          💧
        </button>
        
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
        marginBottom: '12px',
        textAlign: 'center',
        fontSize: '11px',
        color: 'var(--theme-elevation-600)',
        fontWeight: '600'
      }}>
        Hero Background Preview
      </div>

      {/* Logo Preview for Color Picking */}
      {logoUrl && (
        <div style={{ marginBottom: '12px' }}>
          <div style={{ 
            fontSize: '12px', 
            fontWeight: '600',
            color: 'var(--theme-elevation-800)',
            marginBottom: '8px'
          }}>
            {isPickingColor ? '👆 Click on your logo to pick a color!' : 'Logo Preview'}
          </div>
          <div style={{
            position: 'relative',
            display: 'inline-block',
            border: isPickingColor ? '3px solid var(--theme-success-500)' : '2px solid var(--theme-elevation-100)',
            borderRadius: '8px',
            padding: '12px',
            backgroundColor: 'var(--theme-elevation-50)',
            cursor: isPickingColor ? 'crosshair' : 'default',
            transition: 'all 0.2s',
            maxWidth: '200px',
          }}>
            <img
              src={logoUrl}
              alt="Team Logo"
              style={{ 
                display: 'block',
                maxWidth: '100%',
                height: 'auto',
                userSelect: 'none',
                pointerEvents: isPickingColor ? 'auto' : 'none',
              }}
              onClick={(e) => {
                if (!isPickingColor) return
                
                const img = e.currentTarget
                const rect = img.getBoundingClientRect()
                const x = Math.floor((e.clientX - rect.left) * (img.naturalWidth / rect.width))
                const y = Math.floor((e.clientY - rect.top) * (img.naturalHeight / rect.height))
                
                const color = getColorFromImage(img, x, y)
                if (color) {
                  setValue(color)
                  setIsPickingColor(false)
                }
              }}
            />
            {isPickingColor && (
              <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                pointerEvents: 'none',
                fontSize: '48px',
                opacity: 0.3,
              }}>
                🎯
              </div>
            )}
          </div>
          {isPickingColor && (
            <button
              type="button"
              onClick={() => setIsPickingColor(false)}
              style={{
                marginTop: '8px',
                padding: '6px 12px',
                fontSize: '11px',
                border: '1px solid var(--theme-elevation-200)',
                borderRadius: '4px',
                backgroundColor: 'var(--theme-elevation-0)',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          )}
        </div>
      )}

      {/* Hidden canvas for color extraction */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      
      <div style={{ 
        fontSize: '12px', 
        color: 'var(--theme-elevation-500)',
        lineHeight: '1.5'
      }}>
        💡 <strong>Tip:</strong> Click the eyedropper (💧) button, then click anywhere on your logo preview to pick that color! Adjust the brightness slider to make it lighter or darker. Leave empty to auto-detect.
      </div>
    </div>
  )
}

export default ColorPickerField


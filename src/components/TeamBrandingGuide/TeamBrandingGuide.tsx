'use client'

import React, { useEffect, useState, useCallback, useRef } from 'react'
import { useStepNav } from '@payloadcms/ui'
import './TeamBrandingGuide.scss'
import { Blend, Circle, Download, GlassWater, Loader2, Palette, RefreshCw, Shuffle, Sparkles, Sun, X } from 'lucide-react'

const EXPORT_SIZE = 1024

/**
 * Serialize an in-DOM SVG element to a standalone SVG string.
 * Inlines computed styles so the exported file looks identical.
 */
function serializeSvg(svgEl: SVGSVGElement): string {
  const clone = svgEl.cloneNode(true) as SVGSVGElement
  // Set explicit width/height and xmlns for standalone rendering
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  clone.setAttribute('width', String(EXPORT_SIZE))
  clone.setAttribute('height', String(EXPORT_SIZE))
  // Remove the CSS custom property style that only works in our page context
  clone.style.removeProperty('--logo-size')
  clone.style.width = `${EXPORT_SIZE}px`
  clone.style.height = `${EXPORT_SIZE}px`
  return new XMLSerializer().serializeToString(clone)
}

/** Download a string as a file */
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/** Convert an SVG element to a raster data URL via Canvas */
function svgToRaster(
  svgEl: SVGSVGElement,
  format: 'png' | 'jpeg',
  bgColor?: string,
): Promise<string> {
  const svgString = serializeSvg(svgEl)
  const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' })
  const blobUrl = URL.createObjectURL(svgBlob)

  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = EXPORT_SIZE
      canvas.height = EXPORT_SIZE
      const ctx = canvas.getContext('2d')!
      if (bgColor) {
        ctx.fillStyle = bgColor
        ctx.fillRect(0, 0, EXPORT_SIZE, EXPORT_SIZE)
      }
      ctx.drawImage(img, 0, 0, EXPORT_SIZE, EXPORT_SIZE)
      URL.revokeObjectURL(blobUrl)
      resolve(canvas.toDataURL(`image/${format}`, format === 'jpeg' ? 0.95 : undefined))
    }
    img.onerror = () => {
      URL.revokeObjectURL(blobUrl)
      reject(new Error('SVG rasterization failed'))
    }
    img.src = blobUrl
  })
}

/** Download buttons for a logo preview */
function LogoDownloadButtons({
  svgRef,
  teamName,
  variant,
  bgColor,
}: {
  svgRef: React.RefObject<SVGSVGElement | null>
  teamName: string
  variant: 'neon' | 'solid'
  bgColor: string
}) {
  const [busy, setBusy] = useState<string | null>(null)
  const slug = teamName.toLowerCase().replace(/\s+/g, '-')

  const handleDownload = async (format: 'svg' | 'png' | 'jpeg') => {
    const svg = svgRef.current
    if (!svg || busy) return
    setBusy(format)
    try {
      const ext = format === 'jpeg' ? 'jpg' : format
      const filename = `elmt-${slug}-${variant}.${ext}`

      if (format === 'svg') {
        const svgString = serializeSvg(svg)
        downloadBlob(new Blob([svgString], { type: 'image/svg+xml' }), filename)
      } else {
        const bg = format === 'jpeg' ? bgColor : undefined
        const dataUrl = await svgToRaster(svg, format, bg)
        const a = document.createElement('a')
        a.href = dataUrl
        a.download = filename
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
      }
    } catch (err) {
      console.error(`[BrandingGuide] Download failed:`, err)
    } finally {
      setBusy(null)
    }
  }

  const btnBase: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: '3px',
    padding: '3px 8px', fontSize: '10px', fontWeight: 600,
    borderRadius: '4px', border: '1px solid rgba(255,255,255,0.15)',
    cursor: 'pointer', transition: 'all 0.2s', lineHeight: 1,
  }

  return (
    <div style={{ display: 'flex', gap: '4px', justifyContent: 'center', marginTop: '4px' }}>
      <button type="button" onClick={() => handleDownload('svg')} disabled={busy !== null}
        style={{ ...btnBase, background: 'rgba(34,197,94,0.15)', color: '#86efac', opacity: busy && busy !== 'svg' ? 0.4 : 1 }}
      >{busy === 'svg' ? <Loader2 size={10} /> : <Download size={10} />} SVG</button>
      <button type="button" onClick={() => handleDownload('png')} disabled={busy !== null}
        style={{ ...btnBase, background: 'rgba(59,130,246,0.15)', color: '#93c5fd', opacity: busy && busy !== 'png' ? 0.4 : 1 }}
      >{busy === 'png' ? <Loader2 size={10} /> : <Download size={10} />} PNG</button>
      <button type="button" onClick={() => handleDownload('jpeg')} disabled={busy !== null}
        style={{ ...btnBase, background: 'rgba(234,179,8,0.15)', color: '#fcd34d', opacity: busy && busy !== 'jpeg' ? 0.4 : 1 }}
      >{busy === 'jpeg' ? <Loader2 size={10} /> : <Download size={10} />} JPG</button>
    </div>
  )
}

interface TeamData {
  id: number
  name: string
  slug?: string
  region?: string
  brandingPrimary?: string | null
  brandingSecondary?: string | null
  logoFilename?: string | null
  themeColor?: string | null
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

const REGION_ORDER = ['NA', 'EMEA', 'SA', 'OCE', 'SEA', 'APAC', 'China', 'Other']
const REGION_LABELS: Record<string, string> = {
  NA: 'North America',
  EMEA: 'EMEA',
  SA: 'South America',
  OCE: 'Oceania',
  SEA: 'Southeast Asia',
  APAC: 'Asia-Pacific',
  China: 'China',
  Other: 'Unassigned',
}

// ELMT pinwheel — exact 8 petal paths extracted from org.ai
// Color mapping: RED group + GREEN group → PRIMARY, BLUE group + ORANGE group → SECONDARY
// Pattern: p,p,s,s,p,p,s,s going clockwise (pairs)
const PETALS: { d: string; color: 'p' | 's' }[] = [
  // RED group → PRIMARY (top area)
  { d: 'M 366.488 385.625 C 354.914 370.113 325.266 362.828 287.316 359.312 C 319.309 312.957 366.570 277.551 422.035 260.062 C 385.609 291.207 361.617 329.793 366.488 385.625 Z', color: 'p' },
  { d: 'M 534.289 326.828 C 494.590 366.621 475.922 405.578 468.449 456.109 C 461.191 452.020 449.672 444.570 438.422 432.309 C 434.559 428.102 430.730 423.320 427.121 417.922 C 408.570 390.148 406.730 362.340 406.609 350.922 C 404.129 309.559 435.070 275.551 499.141 248.840 C 502.910 247.270 506.801 245.719 510.809 244.199 C 548.922 227.840 573.871 198.531 592.012 162.5 C 605.039 237.762 579.961 288.828 534.289 326.828 Z', color: 'p' },
  // BLUE group → SECONDARY (right area)
  { d: 'M 757.566 474.812 C 710.516 419.156 651.734 381.766 565.039 387.805 C 589.227 370.977 600.930 326.781 607.016 270.242 C 688.922 306.477 748.062 383.441 757.566 474.812 Z', color: 's' },
  { d: 'M 545.941 427.953 C 620.676 414.828 671.387 440.086 709.125 486.082 C 748.633 526.059 787.320 544.863 837.5 552.383 C 832.047 562.215 820.559 579.777 799.570 594.008 C 772 612.691 744.379 614.543 733.039 614.664 C 689.547 617.309 654.246 582.215 627.070 509.727 C 610.824 471.352 581.719 446.219 545.941 427.953 Z', color: 's' },
  // GREEN group → PRIMARY (bottom area)
  { d: 'M 715.137 641.781 C 714.160 643.195 713.176 644.602 712.176 646 C 683.199 686.438 642.441 718.172 594.785 736.406 L 594.777 736.406 C 591.906 737.508 589.031 738.551 586.105 739.543 C 620.160 708.156 641.891 669.391 637.121 614.805 C 648.723 630.352 677.754 637.969 715.137 641.781 Z', color: 'p' },
  { d: 'M 413.312 837.5 C 400.281 762.238 425.363 711.168 471.035 673.164 C 510.734 633.379 529.406 594.422 536.875 543.887 C 546.637 549.379 564.078 560.945 578.203 582.086 C 596.758 609.848 598.598 637.664 598.719 649.082 C 601.344 692.883 566.496 728.430 494.512 755.797 C 456.410 772.160 431.449 801.473 413.312 837.5 Z', color: 'p' },
  // ORANGE group → SECONDARY (left area)
  { d: 'M 435.969 617.031 C 412.020 633.688 399.746 675.898 393.070 730.441 C 319.762 697.262 265.043 631.316 248.430 551.762 L 248.430 551.754 C 247.586 547.715 246.840 543.641 246.195 539.531 C 293.496 590.188 352.363 622.855 435.969 617.031 Z', color: 's' },
  { d: 'M 454.059 572.477 C 379.324 585.602 328.613 560.340 290.875 514.348 C 251.367 474.371 212.680 455.562 162.5 448.043 C 167.953 438.215 179.441 420.648 200.430 406.422 C 228 387.738 255.621 385.883 266.961 385.762 C 310.453 383.121 345.754 418.211 372.930 490.703 C 389.176 529.078 418.281 554.211 454.059 572.477 Z', color: 's' },
]

/* ── Solid enhancement toggles ── */
interface SolidEnhancements {
  gradient: boolean    // Gradient fill: bright → darker toward center
  highlight: boolean   // Inner highlight: thin bright stroke on inner edge
  shadow: boolean      // Colored drop shadow behind each petal
  glossy: boolean      // Glossy overlay: white→transparent gradient on top half
  twoTone: boolean     // Two-tone: primary fills with secondary inner shadow/edge
}

const DEFAULT_ENHANCEMENTS: SolidEnhancements = {
  gradient: false,
  highlight: false,
  shadow: false,
  glossy: false,
  twoTone: false,
}

/** Parse hex → RGB */
function hexToRgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16) || 0,
    parseInt(hex.slice(3, 5), 16) || 0,
    parseInt(hex.slice(5, 7), 16) || 0,
  ]
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}

/** Lighten a hex color toward white by a ratio (0–1) */
function lighten(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex)
  return rgbToHex(
    Math.min(255, Math.round(r + (255 - r) * amount)),
    Math.min(255, Math.round(g + (255 - g) * amount)),
    Math.min(255, Math.round(b + (255 - b) * amount)),
  )
}

/** Darken a hex color toward black by a ratio (0–1) */
function darken(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex)
  return rgbToHex(
    Math.round(r * (1 - amount)),
    Math.round(g * (1 - amount)),
    Math.round(b * (1 - amount)),
  )
}

/** Neon variant — the original beloved neon-on-black look, unchanged */
function NeonLogo({ primary, secondary, size = 160, svgRef }: { primary: string; secondary: string; size?: number; svgRef?: React.Ref<SVGSVGElement> }) {
  const filterId = `neon-${primary}-${secondary}-${size}`
  return (
    <svg
      ref={svgRef}
      className="tc__logo-svg"
      viewBox="130 130 740 740"
      style={{ '--logo-size': `${size}px` } as React.CSSProperties}
    >
      <defs>
        <filter id={filterId} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="8" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {/* Glow layer */}
      {PETALS.map((petal, i) => {
        const c = petal.color === 'p' ? primary : secondary
        return (
          <path
            key={`g${i}`}
            d={petal.d}
            fill="none"
            stroke={c}
            strokeWidth="6"
            strokeLinejoin="round"
            filter={`url(#${filterId})`}
            opacity="0.5"
          />
        )
      })}
      {/* Crisp layer — transparent fill */}
      {PETALS.map((petal, i) => {
        const c = petal.color === 'p' ? primary : secondary
        return (
          <path
            key={`c${i}`}
            d={petal.d}
            fill={`${c}30`}
            stroke={c}
            strokeWidth="2"
            strokeLinejoin="round"
          />
        )
      })}
    </svg>
  )
}

/** Solid variant — full color fill with toggleable enhancements */
function SolidLogo({ primary, secondary, size = 160, enhancements, svgRef }: { primary: string; secondary: string; size?: number; enhancements: SolidEnhancements; svgRef?: React.Ref<SVGSVGElement> }) {
  const uid = `solid-${primary}-${secondary}-${size}`
  const { gradient, highlight, shadow, glossy, twoTone } = enhancements

  return (
    <svg
      ref={svgRef}
      className="tc__logo-svg"
      viewBox="130 130 740 740"
      style={{ '--logo-size': `${size}px` } as React.CSSProperties}
    >
      <defs>
        {/* Gradient fills — bright at petal tip, darker toward center (500,500) */}
        {gradient && PETALS.map((petal, i) => {
          const c = petal.color === 'p' ? primary : secondary
          // Calculate rough petal tip position from path (use first M command coords)
          const match = petal.d.match(/^M\s+([\d.]+)\s+([\d.]+)/)
          const tx = match ? parseFloat(match[1]) : 500
          const ty = match ? parseFloat(match[2]) : 500
          return (
            <radialGradient key={`grad${i}`} id={`${uid}-grad-${i}`}
              cx="500" cy="500" r="340"
              fx={String(tx)} fy={String(ty)}
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0%" stopColor={lighten(c, 0.15)} />
              <stop offset="100%" stopColor={darken(c, 0.35)} />
            </radialGradient>
          )
        })}

        {/* Drop shadow filter */}
        {shadow && (
          <filter id={`${uid}-shadow`} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="14" result="blur" />
            <feOffset dx="0" dy="4" result="shifted" />
            <feFlood floodColor={primary} floodOpacity="0.7" result="color" />
            <feComposite in="color" in2="shifted" operator="in" result="shadow" />
            <feMerge>
              <feMergeNode in="shadow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        )}

        {/* Glossy overlay — white gradient on upper portion of each petal */}
        {glossy && (
          <linearGradient id={`${uid}-gloss`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="white" stopOpacity="0.3" />
            <stop offset="40%" stopColor="white" stopOpacity="0.08" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </linearGradient>
        )}
      </defs>

      {/* Main petal fills */}
      {PETALS.map((petal, i) => {
        const c = petal.color === 'p' ? primary : secondary
        const otherC = petal.color === 'p' ? secondary : primary
        const fillColor = gradient ? `url(#${uid}-grad-${i})` : c
        const strokeColor = twoTone ? darken(otherC, 0.2) : darken(c, 0.3)

        return (
          <g key={`petal${i}`}>
            {/* Main shape */}
            <path
              d={petal.d}
              fill={fillColor}
              stroke={strokeColor}
              strokeWidth={twoTone ? '3' : '2'}
              strokeLinejoin="round"
              filter={shadow ? `url(#${uid}-shadow)` : undefined}
            />
            {/* Inner highlight — slightly inset bright stroke */}
            {highlight && (
              <path
                d={petal.d}
                fill="none"
                stroke={lighten(c, 0.5)}
                strokeWidth="2.5"
                strokeLinejoin="round"
                opacity="0.7"
                transform="translate(0, -1.5)"
              />
            )}
            {/* Glossy overlay */}
            {glossy && (
              <path
                d={petal.d}
                fill={`url(#${uid}-gloss)`}
                stroke="none"
              />
            )}
          </g>
        )
      })}
    </svg>
  )
}

/** Small inline logo for the header bar — always uses neon style */
function HeaderLogo({ primary, secondary }: { primary: string; secondary: string }) {
  return <NeonLogo primary={primary} secondary={secondary} size={34} />
}

function TeamCard({
  team,
  onSave,
  bgColor,
  enhancements,
}: {
  team: TeamData
  onSave: (id: number, updates: Record<string, string>) => Promise<void>
  bgColor: string
  enhancements: SolidEnhancements
}) {
  // Saved values (source of truth from server)
  const [savedPrimary, setSavedPrimary] = useState(team.brandingPrimary || team.themeColor || '')
  const [savedSecondary, setSavedSecondary] = useState(team.brandingSecondary || '')

  // Local editing values
  const [primary, setPrimary] = useState(savedPrimary)
  const [secondary, setSecondary] = useState(savedSecondary)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const clearRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sync when team data changes from parent
  useEffect(() => {
    const newPrimary = team.brandingPrimary || team.themeColor || ''
    const newSecondary = team.brandingSecondary || ''
    setSavedPrimary(newPrimary)
    setSavedSecondary(newSecondary)
    setPrimary(newPrimary)
    setSecondary(newSecondary)
  }, [team.brandingPrimary, team.brandingSecondary, team.themeColor])

  const isDirty = primary !== savedPrimary || secondary !== savedSecondary

  const handleSave = useCallback(async () => {
    if (clearRef.current) clearTimeout(clearRef.current)
    setSaveStatus('saving')
    try {
      const updates: Record<string, string> = {}
      if (primary !== savedPrimary) updates.brandingPrimary = primary
      if (secondary !== savedSecondary) updates.brandingSecondary = secondary
      await onSave(team.id, updates)
      setSavedPrimary(primary)
      setSavedSecondary(secondary)
      setSaveStatus('saved')
      clearRef.current = setTimeout(() => setSaveStatus('idle'), 1800)
    } catch (err) {
      console.error(`[BrandingGuide] Save failed for team ${team.id} (${team.name}):`, err)
      setSaveStatus('error')
      clearRef.current = setTimeout(() => setSaveStatus('idle'), 2500)
    }
  }, [team.id, team.name, primary, secondary, savedPrimary, savedSecondary, onSave])

  const handleReset = useCallback(() => {
    setPrimary(savedPrimary)
    setSecondary(savedSecondary)
    setSaveStatus('idle')
  }, [savedPrimary, savedSecondary])

  const p = primary || '#555'
  const s = secondary || '#333'

  const neonRef = useRef<SVGSVGElement>(null)
  const solidRef = useRef<SVGSVGElement>(null)

  return (
    <div className="tc">
      {/* Header bar — name + save/reset */}
      <div
        className="tc__glow"
        style={{
          background: `linear-gradient(135deg, ${s}55, ${p}22)`,
          borderLeft: `3px solid ${p}`,
          boxShadow: `inset 0 0 30px ${s}15, 0 0 20px ${p}15`,
        }}
      >
        <span className="tc__name" style={{ color: p, textShadow: `0 0 14px ${p}88` }}>
          {team.name}
        </span>
        {isDirty && (
          <div className="tc__actions">
            <button type="button" className="tc__btn tc__btn--save" onClick={handleSave} title="Save changes">Save</button>
            <button type="button" className="tc__btn tc__btn--reset" onClick={handleReset} title="Discard changes"><X size={14} /></button>
          </div>
        )}
        {!isDirty && saveStatus !== 'idle' && (
          <span className={`tc__badge tc__badge--${saveStatus}`}>
            {saveStatus === 'saving' ? '…' : saveStatus === 'saved' ? '✓' : '!'}
          </span>
        )}
        <a href={`/admin/collections/teams/${team.id}`} className="tc__edit" title="Edit team">✎</a>
      </div>

      {/* Preview boxes row */}
      <div className="tc__box-row">
        <div className="tc__preview-col">
          <div className="tc__preview-label">Primary · Glow / Stroke</div>
          <div
            className="tc__preview-box"
            style={{
              '--tc-clr': p,
              '--tc-bg': `${p}33`,
              '--tc-glow': primary ? `0 0 12px ${p}44, inset 0 0 12px ${p}22` : 'none',
            } as React.CSSProperties}
          >
            <span className="tc__preview-text" style={{ color: p, textShadow: `0 0 8px ${p}88` }}>
              {team.name}
            </span>
          </div>
        </div>
        <div className="tc__preview-col">
          <div className="tc__preview-label">Secondary · Fill / Shadow</div>
          <div
            className="tc__preview-box"
            style={{
              '--tc-clr': s,
              '--tc-bg': `${s}33`,
              '--tc-glow': secondary ? `0 0 12px ${s}44, inset 0 0 12px ${s}22` : 'none',
            } as React.CSSProperties}
          >
            <span className="tc__preview-text" style={{ color: s, textShadow: `0 0 8px ${s}88` }}>
              {team.name}
            </span>
          </div>
        </div>
      </div>

      {/* Color inputs row */}
      <div className="tc__box-row">
        <div className="tc__color">
          <div className="tc__swatch" style={{ backgroundColor: p, boxShadow: primary ? `0 0 10px ${p}66` : 'none' }}>
            <input
              type="color"
              value={p}
              onChange={(e) => setPrimary(e.target.value)}
              className="tc__native"
              title="Pick primary color"
            />
          </div>
          <input
            type="text"
            value={primary}
            onChange={(e) => setPrimary(e.target.value)}
            placeholder="#—"
            className="tc__hex"
            spellCheck={false}
            maxLength={7}
          />
        </div>
        <div className="tc__color">
          <div className="tc__swatch" style={{ backgroundColor: s, boxShadow: secondary ? `0 0 10px ${s}66` : 'none' }}>
            <input
              type="color"
              value={s}
              onChange={(e) => setSecondary(e.target.value)}
              className="tc__native"
              title="Pick secondary color"
            />
          </div>
          <input
            type="text"
            value={secondary}
            onChange={(e) => setSecondary(e.target.value)}
            placeholder="#—"
            className="tc__hex"
            spellCheck={false}
            maxLength={7}
          />
        </div>
      </div>

      {/* Large pinwheel previews — Neon vs Solid */}
      <div className="tc__pinwheel-row">
        <div className="tc__pinwheel-preview" style={{ backgroundColor: '#000' }}>
          <div className="tc__pinwheel-label">Neon · Dark BG</div>
          <NeonLogo primary={p} secondary={s} size={160} svgRef={neonRef} />
          <div className="tc__pinwheel-desc">Transparent fill + glow · hero usage</div>
          <LogoDownloadButtons svgRef={neonRef} teamName={team.name} variant="neon" bgColor="#000000" />
        </div>
        <div className="tc__pinwheel-preview" style={{ backgroundColor: bgColor }}>
          <div className="tc__pinwheel-label">Solid · Any BG</div>
          <SolidLogo primary={p} secondary={s} size={160} enhancements={enhancements} svgRef={solidRef} />
          <div className="tc__pinwheel-desc">Full color fill · FACEIT, flyers, etc.</div>
          <LogoDownloadButtons svgRef={solidRef} teamName={team.name} variant="solid" bgColor={bgColor} />
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════
   Org Logo Mixer — 4-color / 8-color playground
   ═══════════════════════════════════════════════ */

const ORIGINAL_COLORS = ['#E53935', '#E53935', '#29B6F6', '#29B6F6', '#43A047', '#43A047', '#FB8C00', '#FB8C00']
const GROUP_LABELS_4 = ['Top', 'Right', 'Bottom', 'Left']
const GROUP_LABELS_8 = ['Petal 1', 'Petal 2', 'Petal 3', 'Petal 4', 'Petal 5', 'Petal 6', 'Petal 7', 'Petal 8']
const GROUP_ICONS_4: React.ReactNode[] = [
  <Circle key="r" size={12} fill="#E53935" stroke="#E53935" />,
  <Circle key="b" size={12} fill="#29B6F6" stroke="#29B6F6" />,
  <Circle key="g" size={12} fill="#43A047" stroke="#43A047" />,
  <Circle key="o" size={12} fill="#FB8C00" stroke="#FB8C00" />,
]

/** Neon logo with per-petal colors */
function NeonLogoMulti({ colors, size = 220, svgRef }: { colors: string[]; size?: number; svgRef?: React.Ref<SVGSVGElement> }) {
  const filterId = `neon-org-${size}`
  return (
    <svg ref={svgRef} className="tc__logo-svg" viewBox="130 130 740 740" style={{ '--logo-size': `${size}px` } as React.CSSProperties}>
      <defs>
        <filter id={filterId} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="8" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      {PETALS.map((petal, i) => (
        <path key={`g${i}`} d={petal.d} fill="none" stroke={colors[i]} strokeWidth="6" strokeLinejoin="round" filter={`url(#${filterId})`} opacity="0.5" />
      ))}
      {PETALS.map((petal, i) => (
        <path key={`c${i}`} d={petal.d} fill={`${colors[i]}30`} stroke={colors[i]} strokeWidth="2" strokeLinejoin="round" />
      ))}
    </svg>
  )
}

/** Solid logo with per-petal colors */
function SolidLogoMulti({ colors, size = 220, enhancements, svgRef }: { colors: string[]; size?: number; enhancements: SolidEnhancements; svgRef?: React.Ref<SVGSVGElement> }) {
  const uid = `solid-org-${size}`
  const { gradient, highlight, shadow, glossy, twoTone } = enhancements

  return (
    <svg ref={svgRef} className="tc__logo-svg" viewBox="130 130 740 740" style={{ '--logo-size': `${size}px` } as React.CSSProperties}>
      <defs>
        {gradient && PETALS.map((petal, i) => {
          const match = petal.d.match(/^M\s+([\d.]+)\s+([\d.]+)/)
          const tx = match ? parseFloat(match[1]) : 500
          const ty = match ? parseFloat(match[2]) : 500
          return (
            <radialGradient key={`grad${i}`} id={`${uid}-grad-${i}`} cx="500" cy="500" r="340" fx={String(tx)} fy={String(ty)} gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor={lighten(colors[i], 0.15)} />
              <stop offset="100%" stopColor={darken(colors[i], 0.35)} />
            </radialGradient>
          )
        })}
        {shadow && (
          <filter id={`${uid}-shadow`} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="14" result="blur" />
            <feOffset dx="0" dy="4" result="shifted" />
            <feFlood floodColor={colors[0]} floodOpacity="0.7" result="color" />
            <feComposite in="color" in2="shifted" operator="in" result="shadow" />
            <feMerge><feMergeNode in="shadow" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        )}
        {glossy && (
          <linearGradient id={`${uid}-gloss`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="white" stopOpacity="0.3" />
            <stop offset="40%" stopColor="white" stopOpacity="0.08" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </linearGradient>
        )}
      </defs>
      {PETALS.map((petal, i) => {
        const c = colors[i]
        const oppositeIdx = i % 2 === 0 ? Math.min(i + 1, 7) : Math.max(i - 1, 0)
        const strokeColor = twoTone ? darken(colors[oppositeIdx], 0.2) : darken(c, 0.3)
        return (
          <g key={`petal${i}`}>
            <path d={petal.d} fill={gradient ? `url(#${uid}-grad-${i})` : c} stroke={strokeColor} strokeWidth={twoTone ? '3' : '2'} strokeLinejoin="round" filter={shadow ? `url(#${uid}-shadow)` : undefined} />
            {highlight && <path d={petal.d} fill="none" stroke={lighten(c, 0.5)} strokeWidth="2.5" strokeLinejoin="round" opacity="0.7" transform="translate(0, -1.5)" />}
            {glossy && <path d={petal.d} fill={`url(#${uid}-gloss)`} stroke="none" />}
          </g>
        )
      })}
    </svg>
  )
}

function OrgLogoMixer({ teams, enhancements, bgColor }: { teams: TeamData[]; enhancements: SolidEnhancements; bgColor: string }) {
  const [is8Color, setIs8Color] = useState(false)
  const [colors, setColors] = useState<string[]>([...ORIGINAL_COLORS])
  const neonRef = useRef<SVGSVGElement>(null)
  const solidRef = useRef<SVGSVGElement>(null)

  // Build team palette — all unique branding colors
  const teamPalette = teams
    .flatMap(t => [
      t.brandingPrimary ? { color: t.brandingPrimary, team: t.name, type: 'P' } : null,
      t.brandingSecondary ? { color: t.brandingSecondary, team: t.name, type: 'S' } : null,
    ])
    .filter((x): x is { color: string; team: string; type: string } => x !== null)

  const setSlot = useCallback((idx: number, color: string) => {
    setColors(prev => {
      const next = [...prev]
      if (is8Color) {
        next[idx] = color
      } else {
        const base = idx * 2
        next[base] = color
        next[base + 1] = color
      }
      return next
    })
  }, [is8Color])

  const handlePresetOriginal = () => setColors([...ORIGINAL_COLORS])

  const handlePresetRandom = () => {
    if (teamPalette.length === 0) return
    const pick = () => teamPalette[Math.floor(Math.random() * teamPalette.length)].color
    if (is8Color) {
      setColors(Array.from({ length: 8 }, pick))
    } else {
      const c = Array.from({ length: 4 }, pick)
      setColors([c[0], c[0], c[1], c[1], c[2], c[2], c[3], c[3]])
    }
  }

  const handleTeamFill = (team: TeamData) => {
    const p = team.brandingPrimary || '#555'
    const s = team.brandingSecondary || '#333'
    setColors([p, p, s, s, p, p, s, s])
  }

  const slotCount = is8Color ? 8 : 4
  const slotColors = is8Color ? colors : [colors[0], colors[2], colors[4], colors[6]]
  const slotLabels = is8Color ? GROUP_LABELS_8 : GROUP_LABELS_4

  return (
    <section className="tbg__section">
      <h2 className="tbg__rg">Org Logo Mixer</h2>
      <div style={{
        background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '12px', padding: '24px',
      }}>
        {/* Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap', marginBottom: '16px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#94a3b8', cursor: 'pointer' }}>
            <input type="checkbox" checked={is8Color} onChange={(e) => setIs8Color(e.target.checked)}
              style={{ accentColor: '#8b5cf6', width: '16px', height: '16px' }} />
            <span style={{ fontWeight: 600 }}>8-Color Mode</span>
            <span style={{ fontSize: '11px', opacity: 0.6 }}>(individual petals)</span>
          </label>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button type="button" onClick={handlePresetOriginal} style={{
              padding: '4px 10px', fontSize: '11px', fontWeight: 600, borderRadius: '6px',
              border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)',
              color: '#cbd5e1', cursor: 'pointer',
            }}><RefreshCw size={12} /> Original</button>
            <button type="button" onClick={handlePresetRandom} style={{
              padding: '4px 10px', fontSize: '11px', fontWeight: 600, borderRadius: '6px',
              border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(139,92,246,0.1)',
              color: '#c4b5fd', cursor: 'pointer',
            }}><Shuffle size={12} /> Random</button>
          </div>
        </div>

        {/* Team quick-fill */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '6px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Quick Fill · Team Colors
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
            {teams.filter(t => t.brandingPrimary).map(t => (
              <button key={t.id} type="button" onClick={() => handleTeamFill(t)} title={`Fill with ${t.name} colors`}
                style={{
                  display: 'flex', alignItems: 'center', gap: '4px',
                  padding: '3px 8px', fontSize: '10px', fontWeight: 600, borderRadius: '4px',
                  border: '1px solid rgba(255,255,255,0.1)',
                  background: `linear-gradient(135deg, ${t.brandingPrimary}22, ${t.brandingSecondary || t.brandingPrimary}22)`,
                  color: t.brandingPrimary || '#ccc', cursor: 'pointer',
                }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: t.brandingPrimary || '#555', flexShrink: 0 }} />
                {t.name}
              </button>
            ))}
          </div>
        </div>

        {/* Color slots */}
        <div style={{
          display: 'grid', gridTemplateColumns: is8Color ? 'repeat(4, 1fr)' : 'repeat(4, 1fr)',
          gap: '8px', marginTop: '12px',
        }}>
          {Array.from({ length: slotCount }).map((_, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 600 }}>
                {!is8Color && GROUP_ICONS_4[i]} {slotLabels[i]}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <div style={{
                  width: '28px', height: '28px', borderRadius: '6px', border: '2px solid rgba(255,255,255,0.2)',
                  backgroundColor: slotColors[i], cursor: 'pointer', position: 'relative', overflow: 'hidden',
                  boxShadow: `0 0 8px ${slotColors[i]}44`,
                }}>
                  <input type="color" value={slotColors[i]} onChange={(e) => setSlot(i, e.target.value)}
                    style={{ position: 'absolute', inset: '-4px', width: 'calc(100% + 8px)', height: 'calc(100% + 8px)', opacity: 0, cursor: 'pointer' }} />
                </div>
                <input type="text" value={slotColors[i]} onChange={(e) => setSlot(i, e.target.value)}
                  className="tc__hex" spellCheck={false} maxLength={7} style={{ width: '72px', fontSize: '11px' }} />
              </div>
              {/* Team palette swatches — grouped by team */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, 72px)', gap: '3px', marginTop: '4px' }}>
                {teams.filter(t => t.brandingPrimary).map(t => (
                  <div key={t.id} style={{
                    display: 'flex', alignItems: 'center', gap: '2px', width: '72px',
                    padding: '2px 3px', borderRadius: '4px',
                    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)',
                  }}>
                    {t.brandingPrimary && (
                      <button type="button" onClick={() => setSlot(i, t.brandingPrimary!)}
                        title={`${t.name} Primary: ${t.brandingPrimary}`}
                        style={{
                          width: '12px', height: '12px', borderRadius: '2px', border: '1px solid rgba(255,255,255,0.25)',
                          backgroundColor: t.brandingPrimary, cursor: 'pointer', padding: 0, flexShrink: 0,
                          transition: 'transform 0.15s',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.3)' }}
                        onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
                      />
                    )}
                    {t.brandingSecondary && (
                      <button type="button" onClick={() => setSlot(i, t.brandingSecondary!)}
                        title={`${t.name} Secondary: ${t.brandingSecondary}`}
                        style={{
                          width: '12px', height: '12px', borderRadius: '2px', border: '1px solid rgba(255,255,255,0.25)',
                          backgroundColor: t.brandingSecondary, cursor: 'pointer', padding: 0, flexShrink: 0,
                          transition: 'transform 0.15s',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.3)' }}
                        onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
                      />
                    )}
                    <span style={{ fontSize: '8px', color: '#64748b', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {t.name}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Preview row */}
        <div style={{ display: 'flex', gap: '16px', marginTop: '20px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <div className="tc__pinwheel-preview" style={{ backgroundColor: '#000', minWidth: '240px', flex: '0 1 280px' }}>
            <div className="tc__pinwheel-label">Neon · Dark BG</div>
            <NeonLogoMulti colors={colors} size={220} svgRef={neonRef} />
            <LogoDownloadButtons svgRef={neonRef} teamName="elmt-org" variant="neon" bgColor="#000000" />
          </div>
          <div className="tc__pinwheel-preview" style={{ backgroundColor: bgColor, minWidth: '240px', flex: '0 1 280px' }}>
            <div className="tc__pinwheel-label">Solid · Any BG</div>
            <SolidLogoMulti colors={colors} size={220} enhancements={enhancements} svgRef={solidRef} />
            <LogoDownloadButtons svgRef={solidRef} teamName="elmt-org" variant="solid" bgColor={bgColor} />
          </div>
        </div>
      </div>
    </section>
  )
}

/** Clickable hex code that copies to clipboard */
function CopyHex({ color }: { color: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(color)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <span className="tbg__ref-cell tbg__ref-copy" onClick={copy} title="Click to copy">
      <span className="tbg__ref-dot" style={{ backgroundColor: color }} />
      <code>{color}</code>
      {copied && <span className="tbg__ref-copied">Copied!</span>}
    </span>
  )
}

export default function TeamBrandingGuide() {
  const { setStepNav } = useStepNav()
  const [teams, setTeams] = useState<TeamData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [bgColor, setBgColor] = useState('#000000')
  const [enhancements, setEnhancements] = useState<SolidEnhancements>({ ...DEFAULT_ENHANCEMENTS })

  const toggleEnhancement = useCallback((key: keyof SolidEnhancements) => {
    setEnhancements(prev => ({ ...prev, [key]: !prev[key] }))
  }, [])

  useEffect(() => {
    setStepNav([{ label: 'Graphics' }, { label: 'Team Branding Guide' }])
  }, [setStepNav])

  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch('/api/teams?limit=100&sort=name&depth=0')
        if (!res.ok) throw new Error('Failed to fetch teams')
        setTeams((await res.json()).docs || [])
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const handleSave = useCallback(async (id: number, updates: Record<string, string>) => {
    const res = await fetch(`/api/teams/${id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      console.error(`[BrandingGuide] PATCH /api/teams/${id} failed:`, res.status, text)
      throw new Error(`Save failed: ${res.status}`)
    }
  }, [])

  const grouped = REGION_ORDER.reduce<Record<string, TeamData[]>>((acc, r) => {
    const list = teams.filter((t) =>
      r === 'Other' ? !t.region || !['NA', 'EMEA', 'SA'].includes(t.region) : t.region === r,
    )
    if (list.length) acc[r] = list
    return acc
  }, {})

  if (loading) return <div className="tbg"><p className="tbg__msg">Loading…</p></div>
  if (error) return <div className="tbg"><p className="tbg__msg tbg__msg--err">{error}</p></div>

  return (
    <div className="tbg">
      <div className="tbg__wrap">
        <header className="tbg__hd">
          <h1>Team Branding Guide</h1>
          <p className="tbg__subtitle">Clean Glow · 2-Color System</p>
          <div className="tbg__legend">
            <span><strong>Primary</strong> - Neon glow, outlines, text stroke</span>
            <span><strong>Secondary</strong> - Fills, shadows, dark accents</span>
            <span>Preview backgrounds show each color at 20% opacity over black</span>
            <span><strong>Neon effect</strong> - Each shape is rendered twice: a blurred copy behind (Gaussian blur filter) creates the glow, then a crisp copy is drawn on top</span>
          </div>
          <div className="tbg__bg-picker">
            <label>Preview Background</label>
            <div className="tc__swatch" style={{ backgroundColor: bgColor }}>
              <input
                type="color"
                value={bgColor}
                onChange={(e) => setBgColor(e.target.value)}
                className="tc__native"
                title="Preview background color"
              />
            </div>
            <input
              type="text"
              value={bgColor}
              onChange={(e) => setBgColor(e.target.value)}
              className="tc__hex"
              spellCheck={false}
              maxLength={7}
            />
            {bgColor !== '#000000' && (
              <button className="tbg__bg-reset" onClick={() => setBgColor('#000000')}>Reset</button>
            )}
          </div>
          <div className="tbg__enhancers">
            <label>Solid Fill Enhancements</label>
            <div className="tbg__enhancers-row">
              <button type="button" className={`tbg__enhancer-btn ${enhancements.gradient ? 'tbg__enhancer-btn--active' : ''}`} onClick={() => toggleEnhancement('gradient')} title="Radial gradient from bright at each petal tip to darker toward the center, adds 3D depth"><Blend size={14} /> Gradient Fill</button>
              <button type="button" className={`tbg__enhancer-btn ${enhancements.highlight ? 'tbg__enhancer-btn--active' : ''}`} onClick={() => toggleEnhancement('highlight')} title="Thin bright stroke along the inner edge of each petal, like light catching a chrome surface"><Sparkles size={14} /> Inner Highlight</button>
              <button type="button" className={`tbg__enhancer-btn ${enhancements.shadow ? 'tbg__enhancer-btn--active' : ''}`} onClick={() => toggleEnhancement('shadow')} title="Soft colored drop shadow behind each petal in the primary color, lifts the logo off any background"><Sun size={14} /> Drop Shadow</button>
              <button type="button" className={`tbg__enhancer-btn ${enhancements.glossy ? 'tbg__enhancer-btn--active' : ''}`} onClick={() => toggleEnhancement('glossy')} title="White-to-transparent gradient overlay on the top half of each petal, polished glass look"><GlassWater size={14} /> Glossy Overlay</button>
              <button type="button" className={`tbg__enhancer-btn ${enhancements.twoTone ? 'tbg__enhancer-btn--active' : ''}`} onClick={() => toggleEnhancement('twoTone')} title="Uses the opposite brand color for petal strokes, primary fills get secondary edges and vice versa"><Palette size={14} /> Two-Tone Edges</button>
            </div>
          </div>
        </header>

        {Object.entries(grouped).map(([region, list]) => (
          <section key={region} className="tbg__section">
            <h2 className="tbg__rg">{REGION_LABELS[region]}</h2>
            <div className="tbg__grid" style={{ '--tc-card-bg': bgColor } as React.CSSProperties}>
              {list.map((t) => (
                <TeamCard key={t.id} team={t} onSave={handleSave} bgColor={bgColor} enhancements={enhancements} />
              ))}
            </div>
          </section>
        ))}

        {/* ═══ Org Logo Mixer ═══ */}
        <OrgLogoMixer teams={teams} enhancements={enhancements} bgColor={bgColor} />
        {/* Quick color reference */}
        <section className="tbg__section">
          <h2 className="tbg__rg">Quick Color Reference</h2>
          <table className="tbg__ref-table">
            <thead>
              <tr>
                <th>Team</th>
                <th>Primary</th>
                <th>Secondary</th>
              </tr>
            </thead>
            <tbody>
              {teams.map((t) => (
                <tr key={t.id}>
                  <td className="tbg__ref-name">{t.name}</td>
                  <td>
                    {t.brandingPrimary ? (
                      <CopyHex color={t.brandingPrimary} />
                    ) : (
                      <span className="tbg__ref-cell"><code>—</code></span>
                    )}
                  </td>
                  <td>
                    {t.brandingSecondary ? (
                      <CopyHex color={t.brandingSecondary} />
                    ) : (
                      <span className="tbg__ref-cell"><code>—</code></span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  )
}

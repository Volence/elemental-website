'use client'

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Loader2, Play, Pause, SkipBack, SkipForward, Eye, EyeOff, Crosshair, Zap, Skull, ZoomIn, ZoomOut, Maximize2, Camera, Swords } from 'lucide-react'
import {
  type MapTransform,
  type SubMapConfig,
  resolveSubMapByName,
  detectSubMap,
  worldToImage,
} from '@/lib/scrim-replay/map-config'

// ══════════════════════════════════════════════════════════════════════
// Types
// ══════════════════════════════════════════════════════════════════════

type PlayerFrame = {
  name: string
  hero: string
  team: string
  x: number
  y: number
  z: number
  ultCharge: number
  alive: boolean
  facingX: number | null
  facingZ: number | null
  health: number | null
  inSpawn: boolean | null
  onGround: boolean | null
  // Per-tick cumulative stats (null for old data without these fields)
  heroDmg: number | null
  healing: number | null
  dmgTaken: number | null
  dmgBlocked: number | null
  elimsCum: number | null
  isUlting: boolean | null
}

type TimelineFrame = {
  t: number
  players: PlayerFrame[]
}

type TimelineEvent = {
  t: number
  type: 'kill' | 'ultimate_start' | 'ultimate_end' | 'round_start'
  description: string
  team?: string
  player?: string
  hero?: string
  victim?: string
  victimHero?: string
  ability?: string
  attackerPos?: { x: number; y: number; z: number } | null
  victimPos?: { x: number; y: number; z: number } | null
}

type PositionData = {
  mapName: string
  mapType: string
  team1: string
  team2: string
  hasPositions: boolean
  timeline: TimelineFrame[]
  events: TimelineEvent[]
  totalDuration: number
  playerStats?: Record<string, {
    name: string
    team: string
    heroes: string[]
    finalBlows: number
    deaths: number
    ultsUsed: number
    heroDamage: number
    allDamage: number
    barrierDamage: number
    healingDone: number
    healingReceived: number
    selfHealing: number
    damageTaken: number
    damageBlocked: number
    eliminations: number
    objectiveKills: number
  }>
}

// ══════════════════════════════════════════════════════════════════════
// Constants
// ══════════════════════════════════════════════════════════════════════

const TEAM_COLORS = {
  team1: { fill: '#06b6d4', stroke: '#0891b2', glow: 'rgba(6, 182, 212, 0.4)' },
  team2: { fill: '#ef4444', stroke: '#dc2626', glow: 'rgba(239, 68, 68, 0.4)' },
}

const SPEEDS = [0.25, 0.5, 1, 2, 4]

/** Short hero name for display in badges (3-4 chars) */
const HERO_ABBREVS: Record<string, string> = {
  'Ana': 'Ana', 'Ashe': 'Ash', 'Baptiste': 'Bap', 'Bastion': 'Bas',
  'Brigitte': 'Bri', 'Cassidy': 'Cas', 'D.Va': 'D.Va', 'Doomfist': 'Doom',
  'Echo': 'Echo', 'Genji': 'Gen', 'Hanzo': 'Han', 'Hazard': 'Haz',
  'Illari': 'Ill', 'Junker Queen': 'JQ', 'Junkrat': 'Junk',
  'Juno': 'Jun', 'Kiriko': 'Kir', 'Lifeweaver': 'LW', 'Lúcio': 'Luc',
  'Lucio': 'Luc', 'Mauga': 'Mau', 'Mei': 'Mei', 'Mercy': 'Mer',
  'Moira': 'Moi', 'Orisa': 'Ori', 'Pharah': 'Pha', 'Ramattra': 'Ram',
  'Reaper': 'Rea', 'Reinhardt': 'Rein', 'Roadhog': 'Hog',
  'Sigma': 'Sig', 'Sojourn': 'Soj', 'Soldier: 76': 'S76',
  'Sombra': 'Som', 'Symmetra': 'Sym', 'Torbjörn': 'Torb',
  'Tracer': 'Trc', 'Venture': 'Ven', 'Widowmaker': 'Wid',
  'Winston': 'Win', 'Wrecking Ball': 'WB', 'Zarya': 'Zar',
  'Zenyatta': 'Zen', 'Jetpack Cat': 'JPC', 'Domina': 'Dom',
  'Freja': 'Fre', 'Vendetta': 'Vnd', 'Mizuki': 'Miz', 'Wuyang': 'Wu',
  'Anran': 'Anr', 'Emre': 'Emr',
}

function heroAbbrev(hero: string): string {
  return HERO_ABBREVS[hero] || hero.slice(0, 3)
}

/** Map Workshop hero name → icon filename (without extension) */
function heroIconFile(hero: string): string {
  const special: Record<string, string> = {
    'D.Va': 'dva', 'Soldier: 76': 'soldier-76', 'Junker Queen': 'junker-queen',
    'Wrecking Ball': 'wrecking-ball', 'Lúcio': 'lucio', 'Torbjörn': 'torbjorn',
    'Jetpack Cat': 'jetpack-cat',
  }
  return special[hero] || hero.toLowerCase().replace(/[^a-z0-9]/g, '')
}

/** Hero role for ult economy sorting: tank=0, dps=1, support=2 */
const HERO_ROLES: Record<string, number> = {
  // Tanks
  'D.Va': 0, 'Doomfist': 0, 'Junker Queen': 0, 'Mauga': 0, 'Orisa': 0,
  'Ramattra': 0, 'Reinhardt': 0, 'Roadhog': 0, 'Sigma': 0, 'Winston': 0,
  'Wrecking Ball': 0, 'Zarya': 0, 'Hazard': 0, 'Domina': 0,
  // DPS
  'Ashe': 1, 'Bastion': 1, 'Cassidy': 1, 'Echo': 1, 'Freja': 1,
  'Genji': 1, 'Hanzo': 1, 'Junkrat': 1, 'Mei': 1, 'Pharah': 1,
  'Reaper': 1, 'Sojourn': 1, 'Soldier: 76': 1, 'Sombra': 1, 'Symmetra': 1,
  'Torbjörn': 1, 'Tracer': 1, 'Venture': 1, 'Widowmaker': 1, 'Vendetta': 1,
  'Anran': 1, 'Emre': 1,
  // Support
  'Ana': 2, 'Baptiste': 2, 'Brigitte': 2, 'Illari': 2, 'Juno': 2,
  'Kiriko': 2, 'Lifeweaver': 2, 'Lúcio': 2, 'Lucio': 2, 'Mercy': 2,
  'Moira': 2, 'Zenyatta': 2, 'Mizuki': 2, 'Wuyang': 2, 'Jetpack Cat': 2,
}
function heroRole(hero: string): number { return HERO_ROLES[hero] ?? 1 }

// ══════════════════════════════════════════════════════════════════════
// Utilities
// ══════════════════════════════════════════════════════════════════════

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * Math.max(0, Math.min(1, t))
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function getPlayerAtTime(
  timeline: TimelineFrame[],
  playerName: string,
  currentTime: number,
): PlayerFrame | null {
  if (timeline.length === 0) return null

  // Find surrounding frames
  let prevIdx = 0
  let nextIdx = 0
  for (let i = 0; i < timeline.length; i++) {
    if (timeline[i].t <= currentTime) prevIdx = i
    if (timeline[i].t > currentTime) { nextIdx = i; break }
    nextIdx = i
  }

  const prevFrame = timeline[prevIdx]
  const nextFrame = timeline[nextIdx]
  const prevPlayer = prevFrame?.players.find(p => p.name === playerName)
  const nextPlayer = nextFrame?.players.find(p => p.name === playerName)

  if (!prevPlayer) return nextPlayer || null
  if (!nextPlayer || prevIdx === nextIdx) return prevPlayer

  // If player is dead in prevFrame, freeze at prev position (don't interpolate toward spawn)
  if (!prevPlayer.alive) {
    return {
      ...prevPlayer,
      // Keep the dead player's last ult charge (don't lerp to 0)
      ultCharge: prevPlayer.ultCharge,
    }
  }

  // If player transitions from alive → dead in this segment, use prev (alive) data
  if (prevPlayer.alive && !nextPlayer.alive) {
    return {
      ...prevPlayer,
      alive: false, // Mark as dead
    }
  }

  const t = (currentTime - prevFrame.t) / (nextFrame.t - prevFrame.t)

  return {
    ...prevPlayer,
    x: lerp(prevPlayer.x, nextPlayer.x, t),
    y: lerp(prevPlayer.y, nextPlayer.y, t),
    z: lerp(prevPlayer.z, nextPlayer.z, t),
    ultCharge: Math.round(lerp(prevPlayer.ultCharge, nextPlayer.ultCharge, t)),
    health: prevPlayer.health != null && nextPlayer.health != null
      ? lerp(prevPlayer.health, nextPlayer.health, t)
      : prevPlayer.health,
    alive: prevPlayer.alive,
    facingX: prevPlayer.facingX != null && nextPlayer.facingX != null
      ? lerp(prevPlayer.facingX, nextPlayer.facingX, t)
      : prevPlayer.facingX,
    facingZ: prevPlayer.facingZ != null && nextPlayer.facingZ != null
      ? lerp(prevPlayer.facingZ, nextPlayer.facingZ, t)
      : prevPlayer.facingZ,
  }
}

/**
 * Viewport: a cropped region of the source image to display.
 * Computed from player positions so we auto-zoom to the action area.
 */
type Viewport = {
  /** Top-left corner of the viewport in image pixels */
  srcX: number
  srcY: number
  /** Viewport size in image pixels */
  srcW: number
  srcH: number
}

/**
 * Convert world coordinates → canvas pixel coordinates.
 *
 * When we have a calibrated transform + viewport:
 *   1. World → image pixels (affine)
 *   2. Image pixels → viewport-relative pixels
 *   3. Viewport pixels → canvas pixels (scale to fit)
 *
 * When no transform: simple linear mapping from world bounds.
 */
function worldToCanvas(
  worldX: number,
  worldZ: number,
  transform: MapTransform | null,
  viewport: Viewport | null,
  fallbackBounds: { minX: number; maxX: number; minZ: number; maxZ: number },
  canvasW: number,
  canvasH: number,
): { px: number; py: number } {
  if (transform && viewport) {
    // Step 1: world → image pixels via affine
    const { u, v } = worldToImage(worldX, worldZ, transform)
    // Step 2: image pixels → viewport-relative
    const relU = u - viewport.srcX
    const relV = v - viewport.srcY
    // Step 3: viewport → canvas (scale to fit, preserving aspect ratio)
    const scaleX = canvasW / viewport.srcW
    const scaleY = canvasH / viewport.srcH
    const scale = Math.min(scaleX, scaleY)
    const offsetX = (canvasW - viewport.srcW * scale) / 2
    const offsetY = (canvasH - viewport.srcH * scale) / 2
    return {
      px: relU * scale + offsetX,
      py: relV * scale + offsetY,
    }
  }
  // Fallback: simple linear mapping from world bounds to canvas
  const padding = 40
  const usableW = canvasW - padding * 2
  const usableH = canvasH - padding * 2
  const px = padding + ((worldX - fallbackBounds.minX) / (fallbackBounds.maxX - fallbackBounds.minX)) * usableW
  const py = padding + ((worldZ - fallbackBounds.minZ) / (fallbackBounds.maxZ - fallbackBounds.minZ)) * usableH
  return { px, py }
}

// ══════════════════════════════════════════════════════════════════════
// Component
// ══════════════════════════════════════════════════════════════════════

export default function ReplayTab({ mapId }: { mapId: string }) {
  const [data, setData] = useState<PositionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Playback state
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [speed, setSpeed] = useState(1)
  const [showVisionCones, setShowVisionCones] = useState(false)
  const [hoveredPlayer, setHoveredPlayer] = useState<string | null>(null)
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null)

  // Timeline filter toggles
  const [timelineFilters, setTimelineFilters] = useState({
    kills: true, ults: true, rounds: true, fights: true,
  })
  const toggleFilter = (key: keyof typeof timelineFilters) =>
    setTimelineFilters(prev => ({ ...prev, [key]: !prev[key] }))

  // Zoom/pan state
  const [userZoom, setUserZoom] = useState(1)
  const panRef = useRef({ x: 0, y: 0 })
  const isDraggingRef = useRef(false)
  const lastMouseRef2 = useRef({ x: 0, y: 0 })
  const [panTick, setPanTick] = useState(0) // force re-render on pan

  // Calibration debug mode
  const [calibrateMode, setCalibrateMode] = useState(false)
  const [calibratePoints, setCalibratePoints] = useState<{ imgU: number; imgV: number; canvasX: number; canvasY: number }[]>([])

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animFrameRef = useRef<number | null>(null)
  const lastTimeRef = useRef<number>(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const mapImageRef = useRef<HTMLImageElement | null>(null)
  const [mapImageLoaded, setMapImageLoaded] = useState(false)
  const [activeSubMap, setActiveSubMap] = useState<SubMapConfig | null>(null)

  // Hero icon cache: hero name → loaded Image element (or null if failed)
  const heroIconCache = useRef<Map<string, HTMLImageElement | null>>(new Map())
  const loadHeroIcon = (hero: string): HTMLImageElement | null => {
    const cache = heroIconCache.current
    if (cache.has(hero)) return cache.get(hero)!
    // Start loading
    cache.set(hero, null) // mark as loading
    const img = new Image()
    img.src = `/maps/heroes/${heroIconFile(hero)}.png`
    img.onload = () => { cache.set(hero, img) }
    img.onerror = () => { cache.set(hero, null) }
    return null
  }

  // Fetch data
  useEffect(() => {
    fetch(`/api/scrim-positions?mapId=${mapId}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) setError(d.error)
        else setData(d)
      })
      .catch(() => setError('Failed to fetch position data'))
      .finally(() => setLoading(false))
  }, [mapId])

  // Compute round boundaries and per-round sub-map detection for Control maps
  const roundSubMaps = useMemo<{ startTime: number; subMap: SubMapConfig }[]>(() => {
    if (!data?.mapName || !data.timeline.length) return []

    // Get round_start events
    const roundStarts = (data.events ?? [])
      .filter(e => e.type === 'round_start')
      .sort((a, b) => a.t - b.t)

    // If no round events, treat entire match as one round
    if (roundStarts.length === 0) {
      const subMap = resolveSubMapByName(data.mapName)
      return subMap ? [{ startTime: 0, subMap }] : []
    }

    // For each round, find a representative player position and detect sub-map
    const result: { startTime: number; subMap: SubMapConfig }[] = []
    for (let i = 0; i < roundStarts.length; i++) {
      const roundStart = roundStarts[i].t
      const roundEnd = i < roundStarts.length - 1 ? roundStarts[i + 1].t : Infinity

      // Find first frame after round start with non-objective players
      const sampleFrame = data.timeline.find(f =>
        f.t >= roundStart + 1 && f.t < roundEnd &&
        f.players.some(p => p.team !== '__OBJ__'),
      )

      if (sampleFrame) {
        const player = sampleFrame.players.find(p => p.team !== '__OBJ__')
        if (player) {
          const detected = detectSubMap(data.mapName, player.x, player.z)
          if (detected) {
            result.push({ startTime: roundStart, subMap: detected })
            continue
          }
        }
      }

      // Fallback: use default
      const fallback = resolveSubMapByName(data.mapName)
      if (fallback) result.push({ startTime: roundStart, subMap: fallback })
    }

    return result
  }, [data?.mapName, data?.timeline, data?.events])

  // Determine the active sub-map based on current time + round
  useEffect(() => {
    if (roundSubMaps.length === 0 && data?.mapName) {
      // No round detection available, fall back to static resolution
      setActiveSubMap(resolveSubMapByName(data.mapName))
      return
    }

    // Find which round we're in
    let currentSubMap: SubMapConfig | null = null
    for (let i = roundSubMaps.length - 1; i >= 0; i--) {
      if (currentTime >= roundSubMaps[i].startTime) {
        currentSubMap = roundSubMaps[i].subMap
        break
      }
    }

    if (currentSubMap && currentSubMap.slug !== activeSubMap?.slug) {
      setActiveSubMap(currentSubMap)
    }
  }, [currentTime, roundSubMaps, data?.mapName])

  // Load map background image from the calibrated sub-map
  useEffect(() => {
    if (!activeSubMap) {
      mapImageRef.current = null
      return
    }

    const img = new Image()
    img.onload = () => {
      mapImageRef.current = img
      setMapImageLoaded(true)
    }
    img.onerror = () => {
      // Silently fall back to grid-only view
      mapImageRef.current = null
    }
    img.src = activeSubMap.imagePath
  }, [activeSubMap])

  // Get the active affine transform (null if uncalibrated)
  const activeTransform = activeSubMap?.transform ?? null

  // Compute auto-zoom viewport from ALL player positions mapped to image space.
  // This crops the 8192×8192 source image to just the area where gameplay happens.
  const dataViewport = useMemo<Viewport | null>(() => {
    if (!activeTransform || !data?.timeline.length) return null

    // Map every player position to image-space and find the bounding box
    let minU = Infinity, maxU = -Infinity
    let minV = Infinity, maxV = -Infinity
    for (const frame of data.timeline) {
      for (const p of frame.players) {
        const { u, v } = worldToImage(p.x, p.z, activeTransform)
        if (u < minU) minU = u
        if (u > maxU) maxU = u
        if (v < minV) minV = v
        if (v > maxV) maxV = v
      }
    }

    // Also include kill positions for complete coverage
    if (data.events) {
      for (const e of data.events) {
        if (e.attackerPos) {
          const { u, v } = worldToImage(e.attackerPos.x, e.attackerPos.z, activeTransform)
          if (u < minU) minU = u; if (u > maxU) maxU = u
          if (v < minV) minV = v; if (v > maxV) maxV = v
        }
        if (e.victimPos) {
          const { u, v } = worldToImage(e.victimPos.x, e.victimPos.z, activeTransform)
          if (u < minU) minU = u; if (u > maxU) maxU = u
          if (v < minV) minV = v; if (v > maxV) maxV = v
        }
      }
    }

    // Add 25% padding on each side so dots aren't at the very edge
    const spanU = maxU - minU || 100
    const spanV = maxV - minV || 100
    const padU = spanU * 0.25
    const padV = spanV * 0.25

    // Clamp to image bounds
    const srcX = Math.max(0, minU - padU)
    const srcY = Math.max(0, minV - padV)
    const srcW = Math.min(activeTransform.imageWidth - srcX, spanU + padU * 2)
    const srcH = Math.min(activeTransform.imageHeight - srcY, spanV + padV * 2)

    return { srcX, srcY, srcW, srcH }
  }, [data?.timeline, data?.events, activeTransform])

  // Apply user zoom/pan to the data viewport
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const viewport = useMemo<Viewport | null>(() => {
    void panTick // track pan changes
    if (!dataViewport) return null
    const centerX = dataViewport.srcX + dataViewport.srcW / 2 + panRef.current.x
    const centerY = dataViewport.srcY + dataViewport.srcH / 2 + panRef.current.y
    const newW = dataViewport.srcW / userZoom
    const newH = dataViewport.srcH / userZoom
    return {
      srcX: centerX - newW / 2,
      srcY: centerY - newH / 2,
      srcW: newW,
      srcH: newH,
    }
  }, [dataViewport, userZoom, panTick])

  // Fallback world coordinate bounds (only used if no affine transform)
  const fallbackBounds = useMemo(() => {
    if (activeTransform) return { minX: 0, maxX: 1, minZ: 0, maxZ: 1 }
    if (!data?.timeline.length) return { minX: -50, maxX: 50, minZ: -50, maxZ: 50 }
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity
    for (const frame of data.timeline) {
      for (const p of frame.players) {
        if (p.x < minX) minX = p.x
        if (p.x > maxX) maxX = p.x
        if (p.z < minZ) minZ = p.z
        if (p.z > maxZ) maxZ = p.z
      }
    }
    const padX = (maxX - minX) * 0.1
    const padZ = (maxZ - minZ) * 0.1
    return { minX: minX - padX, maxX: maxX + padX, minZ: minZ - padZ, maxZ: maxZ + padZ }
  }, [data?.timeline, activeTransform])

  // Get all unique player names grouped by team
  const playersByTeam = useMemo(() => {
    if (!data?.timeline.length) return { team1: [] as string[], team2: [] as string[] }
    const team1Set = new Set<string>()
    const team2Set = new Set<string>()
    const firstFrame = data.timeline[0]
    const t1 = data.team1
    for (const p of firstFrame.players) {
      if (p.team === '__OBJ__') continue
      if (p.team === t1) team1Set.add(p.name)
      else team2Set.add(p.name)
    }
    return { team1: [...team1Set], team2: [...team2Set] }
  }, [data?.timeline, data?.team1])

  // ─── Fight Detection ────────────────────────────────────────────────
  type DetectedFight = {
    id: number
    startTime: number
    endTime: number
    kills: Array<{ t: number; type: string; team?: string; player?: string; hero?: string; victim?: string; victimHero?: string }>
    team1Kills: number
    team2Kills: number
    winner: 'team1' | 'team2' | 'draw'
    firstPick: { player: string; hero: string; team: string } | null
    firstDeath: { player: string; hero: string; team: string } | null
  }

  const fights = useMemo<DetectedFight[]>(() => {
    if (!data?.events) return []
    const killEvents = data.events.filter(e => e.type === 'kill')
    if (killEvents.length < 2) return []

    const FIGHT_GAP = 15 // seconds between fights
    const detected: DetectedFight[] = []
    let currentFight: typeof killEvents = [killEvents[0]]

    for (let i = 1; i < killEvents.length; i++) {
      if (killEvents[i].t - currentFight[currentFight.length - 1].t < FIGHT_GAP) {
        currentFight.push(killEvents[i])
      } else {
        if (currentFight.length >= 2) detected.push(buildFight(detected.length + 1, currentFight))
        currentFight = [killEvents[i]]
      }
    }
    if (currentFight.length >= 2) detected.push(buildFight(detected.length + 1, currentFight))
    return detected

    function buildFight(id: number, kills: typeof killEvents): DetectedFight {
      const t1 = data!.team1
      let t1k = 0, t2k = 0
      for (const k of kills) {
        if (k.team === t1) t1k++; else t2k++
      }
      return {
        id, kills,
        startTime: kills[0].t - 2,
        endTime: kills[kills.length - 1].t + 2,
        team1Kills: t1k, team2Kills: t2k,
        winner: t1k > t2k ? 'team1' : t2k > t1k ? 'team2' : 'draw',
        firstPick: kills[0].team ? { player: kills[0].player!, hero: kills[0].hero!, team: kills[0].team } : null,
        firstDeath: kills[0].victim ? { player: kills[0].victim, hero: kills[0].victimHero!, team: kills[0].team === t1 ? 'Team 2' : t1 } : null,
      }
    }
  }, [data?.events, data?.team1])

  // Current fight (if timeline is within one)
  const currentFight = useMemo(() => {
    return fights.find(f => currentTime >= f.startTime && currentTime <= f.endTime + 5) ?? null
  }, [fights, currentTime])

  // Get events near current time for sidebar (filtered)
  const nearbyEvents = useMemo(() => {
    if (!data?.events) return []
    return data.events.filter(e => {
      if (e.t < currentTime - 5 || e.t > currentTime + 15) return false
      if (e.type === 'kill' && !timelineFilters.kills) return false
      if ((e.type === 'ultimate_start' || e.type === 'ultimate_end') && !timelineFilters.ults) return false
      if (e.type === 'round_start' && !timelineFilters.rounds) return false
      return true
    }).slice(0, 12)
  }, [data?.events, currentTime, timelineFilters])

  // Ult economy: extract from current frame using interpolated data (preserves ult on death)
  const ultEconomy = useMemo(() => {
    if (!data?.timeline.length) return { team1: [] as { name: string; hero: string; charge: number; alive: boolean }[], team2: [] as { name: string; hero: string; charge: number; alive: boolean }[] }
    // Get unique players from the first few frames
    const playerSet = new Map<string, { team: string }>()
    for (const frame of data.timeline.slice(0, 5)) {
      for (const p of frame.players) {
        if (p.team === '__OBJ__') continue
        if (!playerSet.has(p.name)) playerSet.set(p.name, { team: p.team })
      }
    }

    const t1players: { name: string; hero: string; charge: number; alive: boolean }[] = []
    const t2players: { name: string; hero: string; charge: number; alive: boolean }[] = []
    for (const [name, info] of playerSet) {
      const p = getPlayerAtTime(data.timeline, name, currentTime)
      if (!p) continue
      const entry = { name: p.name, hero: p.hero, charge: p.ultCharge, alive: p.alive }
      if (info.team === data.team1) t1players.push(entry); else t2players.push(entry)
    }
    // Sort by role: tank (0) → dps (1) → support (2)
    t1players.sort((a, b) => heroRole(a.hero) - heroRole(b.hero))
    t2players.sort((a, b) => heroRole(a.hero) - heroRole(b.hero))
    return { team1: t1players, team2: t2players }
  }, [data?.timeline, data?.team1, currentTime])

  // Snapshot export
  const handleSnapshot = useCallback(() => {
    if (!canvasRef.current || !data) return
    const link = document.createElement('a')
    link.download = `replay_${data.mapName.toLowerCase().replace(/\s+/g, '-')}_${formatTime(currentTime).replace(':', 'm')}s.png`
    link.href = canvasRef.current.toDataURL('image/png')
    link.click()
  }, [data, currentTime])

  // Animation loop
  const animate = useCallback((timestamp: number) => {
    if (!data) return
    if (lastTimeRef.current === 0) lastTimeRef.current = timestamp

    const delta = (timestamp - lastTimeRef.current) / 1000
    lastTimeRef.current = timestamp

    setCurrentTime(prev => {
      const next = prev + delta * speed
      if (next >= data.totalDuration) {
        setPlaying(false)
        return data.totalDuration
      }
      return next
    })

    animFrameRef.current = requestAnimationFrame(animate)
  }, [data, speed])

  // Play/pause control
  useEffect(() => {
    if (playing) {
      lastTimeRef.current = 0
      animFrameRef.current = requestAnimationFrame(animate)
    } else {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    }
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    }
  }, [playing, animate])

  // Canvas rendering
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !data?.timeline.length) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    ctx.scale(dpr, dpr)

    const w = rect.width
    const h = rect.height

    // Draw background: map image or dark canvas
    ctx.fillStyle = '#0f1419'
    ctx.fillRect(0, 0, w, h)

    if (mapImageRef.current && activeTransform && viewport) {
      // Draw the CROPPED viewport region of the source image.
      // The affine transforms were calibrated for the original image size (e.g. 8192×8192)
      // but the actual downloaded images may be smaller (e.g. 2560×2560). Scale the
      // source coordinates to match the actual image dimensions.
      const imgScaleX = mapImageRef.current.naturalWidth / activeTransform.imageWidth
      const imgScaleY = mapImageRef.current.naturalHeight / activeTransform.imageHeight

      const scaleX = w / viewport.srcW
      const scaleY = h / viewport.srcH
      const scale = Math.min(scaleX, scaleY)
      const drawW = viewport.srcW * scale
      const drawH = viewport.srcH * scale
      const offsetX = (w - drawW) / 2
      const offsetY = (h - drawH) / 2

      ctx.globalAlpha = 0.85
      ctx.drawImage(
        mapImageRef.current,
        viewport.srcX * imgScaleX, viewport.srcY * imgScaleY,  // source position (scaled)
        viewport.srcW * imgScaleX, viewport.srcH * imgScaleY,  // source size (scaled)
        offsetX, offsetY, drawW, drawH,                         // destination
      )
      ctx.globalAlpha = 1

      // Very subtle vignette — just softens the edges
      const vignette = ctx.createRadialGradient(w / 2, h / 2, w * 0.3, w / 2, h / 2, w * 0.75)
      vignette.addColorStop(0, 'rgba(0, 0, 0, 0)')
      vignette.addColorStop(1, 'rgba(0, 0, 0, 0.15)')
      ctx.fillStyle = vignette
      ctx.fillRect(0, 0, w, h)
    } else if (mapImageRef.current) {
      // Uncalibrated fallback: stretch to fill
      ctx.globalAlpha = 0.35
      ctx.drawImage(mapImageRef.current, 0, 0, w, h)
      ctx.globalAlpha = 1

      const vignette = ctx.createRadialGradient(w / 2, h / 2, w * 0.2, w / 2, h / 2, w * 0.7)
      vignette.addColorStop(0, 'rgba(0, 0, 0, 0)')
      vignette.addColorStop(1, 'rgba(0, 0, 0, 0.4)')
      ctx.fillStyle = vignette
      ctx.fillRect(0, 0, w, h)
    }
    // Only draw grid/boundary/labels in fallback mode (no calibrated transform)
    if (!activeTransform) {
      // Draw grid lines
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)'
      ctx.lineWidth = 1
      for (let i = 0; i <= 10; i++) {
        const x = (w / 10) * i
        const y = (h / 10) * i
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke()
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke()
      }

      // Draw map boundary
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)'
      ctx.lineWidth = 2
      ctx.strokeRect(40, 40, w - 80, h - 80)

      // Draw coordinate labels
      ctx.fillStyle = 'rgba(255, 255, 255, 0.15)'
      ctx.font = '10px monospace'
      ctx.textAlign = 'center'
      ctx.fillText(`X: ${fallbackBounds.minX.toFixed(0)}`, 40, h - 10)
      ctx.fillText(`X: ${fallbackBounds.maxX.toFixed(0)}`, w - 40, h - 10)
      ctx.textAlign = 'left'
      ctx.fillText(`Z: ${fallbackBounds.minZ.toFixed(0)}`, 5, h - 46)
      ctx.fillText(`Z: ${fallbackBounds.maxZ.toFixed(0)}`, 5, 50)
    }

    // Get interpolated player positions at current time
    const allPlayers = new Set<string>()
    for (const frame of data.timeline) {
      for (const p of frame.players) allPlayers.add(p.name)
    }

    const playerPositions: (PlayerFrame & { px: number; py: number; isTeam1: boolean })[] = []
    for (const name of allPlayers) {
      const player = getPlayerAtTime(data.timeline, name, currentTime)
      if (!player) continue
      const { px, py } = worldToCanvas(player.x, player.z, activeTransform, viewport, fallbackBounds, w, h)
      playerPositions.push({
        ...player,
        px,
        py,
        isTeam1: player.team === data.team1,
      })
    }

    // Separate objective markers from real players
    const objectiveMarkers = playerPositions.filter(p => p.name === '__PAYLOAD__' || p.name === '__OBJECTIVE__')
    const realPlayers = playerPositions.filter(p => p.team !== '__OBJ__')

    // Draw objective markers (payload/push bot) as distinctive icons
    for (const obj of objectiveMarkers) {
      const isPayload = obj.name === '__PAYLOAD__'
      const size = 10
      ctx.save()
      ctx.translate(obj.px, obj.py)

      // Glow
      ctx.shadowColor = isPayload ? 'rgba(255, 200, 50, 0.6)' : 'rgba(50, 200, 255, 0.6)'
      ctx.shadowBlur = 12

      // Diamond shape for payload, circle for objective
      ctx.beginPath()
      if (isPayload) {
        // Diamond
        ctx.moveTo(0, -size)
        ctx.lineTo(size, 0)
        ctx.lineTo(0, size)
        ctx.lineTo(-size, 0)
        ctx.closePath()
      } else {
        ctx.arc(0, 0, size, 0, Math.PI * 2)
      }
      ctx.fillStyle = isPayload ? 'rgba(255, 200, 50, 0.85)' : 'rgba(50, 200, 255, 0.85)'
      ctx.fill()
      ctx.strokeStyle = isPayload ? '#fff' : '#fff'
      ctx.lineWidth = 2
      ctx.stroke()
      ctx.shadowBlur = 0

      // Label
      ctx.font = 'bold 8px Inter, system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = 'rgba(0, 0, 0, 0.8)'
      ctx.fillText(isPayload ? '📦' : '🎯', 0, 0)

      ctx.restore()

      // Text label above
      ctx.font = 'bold 9px Inter, system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillStyle = isPayload ? 'rgba(255, 200, 50, 0.9)' : 'rgba(50, 200, 255, 0.9)'
      ctx.fillText(isPayload ? 'Payload' : 'Objective', obj.px, obj.py - size - 6)
    }

    // Draw vision cones (behind players)
    if (showVisionCones) {
      for (const p of realPlayers) {
        if (!p.alive || p.facingX == null || p.facingZ == null) continue
        const colors = p.isTeam1 ? TEAM_COLORS.team1 : TEAM_COLORS.team2
        const angle = Math.atan2(p.facingZ, p.facingX)
        const coneAngle = Math.PI / 4 // 45° half-angle (90° total FOV for visibility)
        const coneLen = 75

        ctx.beginPath()
        ctx.moveTo(p.px, p.py)
        ctx.arc(p.px, p.py, coneLen, angle - coneAngle, angle + coneAngle)
        ctx.closePath()

        const gradient = ctx.createRadialGradient(p.px, p.py, 0, p.px, p.py, coneLen)
        gradient.addColorStop(0, colors.glow.replace('0.4', '0.3'))
        gradient.addColorStop(0.7, colors.glow.replace('0.4', '0.12'))
        gradient.addColorStop(1, 'transparent')
        ctx.fillStyle = gradient
        ctx.fill()

        // Cone edge lines for clarity
        ctx.beginPath()
        ctx.moveTo(p.px, p.py)
        ctx.lineTo(p.px + Math.cos(angle - coneAngle) * coneLen, p.py + Math.sin(angle - coneAngle) * coneLen)
        ctx.moveTo(p.px, p.py)
        ctx.lineTo(p.px + Math.cos(angle + coneAngle) * coneLen, p.py + Math.sin(angle + coneAngle) * coneLen)
        ctx.strokeStyle = colors.glow.replace('0.4', '0.15')
        ctx.lineWidth = 1
        ctx.stroke()
      }
    }

    // Draw trail for selected player
    if (selectedPlayer) {
      const trail: { px: number; py: number }[] = []
      const trailWindow = 5 // seconds of trail
      for (const frame of data.timeline) {
        if (frame.t < currentTime - trailWindow || frame.t > currentTime) continue
        const p = frame.players.find(pl => pl.name === selectedPlayer)
        if (!p) continue
        trail.push(worldToCanvas(p.x, p.z, activeTransform, viewport, fallbackBounds, w, h))
      }
      if (trail.length > 1) {
        ctx.beginPath()
        ctx.moveTo(trail[0].px, trail[0].py)
        for (let i = 1; i < trail.length; i++) {
          ctx.lineTo(trail[i].px, trail[i].py)
        }
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)'
        ctx.lineWidth = 2
        ctx.setLineDash([4, 4])
        ctx.stroke()
        ctx.setLineDash([])
      }
    }

    // ── Nano Boost detection ─────────────────────────────────────────
    // When Ana activates ult, find the closest ally in her facing direction
    // and show the nano effect on THEM for ~8 seconds.
    const NANO_DURATION = 8
    const nanoBoostedPlayers = new Set<string>()
    if (data.events) {
      for (const event of data.events) {
        if (event.type !== 'ultimate_start') continue
        if (event.hero !== 'Ana') continue
        const elapsed = currentTime - event.t
        if (elapsed < 0 || elapsed > NANO_DURATION) continue

        // Find Ana's position at the time of ult
        const anaPlayer = realPlayers.find(p => p.name === event.player)
        if (!anaPlayer || !anaPlayer.facingX || !anaPlayer.facingZ) continue

        // Find closest teammate in her facing direction
        const anaAngle = Math.atan2(anaPlayer.facingZ, anaPlayer.facingX)
        let bestTarget: string | null = null
        let bestScore = -Infinity

        for (const ally of realPlayers) {
          if (ally.name === event.player) continue // skip Ana herself
          if (ally.isTeam1 !== anaPlayer.isTeam1) continue // must be same team
          if (!ally.alive) continue

          // Direction from Ana to ally (in world space, using world coords)
          const dx = ally.x - anaPlayer.x
          const dz = ally.z - anaPlayer.z
          const dist = Math.hypot(dx, dz)
          if (dist < 0.1) continue

          // Dot product between Ana's facing and direction to ally
          const dot = (Math.cos(anaAngle) * dx + Math.sin(anaAngle) * dz) / dist
          // Score: prefer allies close to facing direction and closer distance
          if (dot > 0.3) { // must be roughly in front of Ana
            const score = dot / (1 + dist * 0.05)
            if (score > bestScore) {
              bestScore = score
              bestTarget = ally.name
            }
          }
        }
        if (bestTarget) nanoBoostedPlayers.add(bestTarget)
      }
    }

    // ── Active ultimate detection ────────────────────────────────────
    // Track players currently in their ult (between ultimate_start and ultimate_end)
    const activeUltPlayers = new Set<string>()
    if (data.events) {
      // Track per-player: last ult_start and ult_end times
      const ultState = new Map<string, { startTime: number; endTime: number; hero: string }>()
      for (const event of data.events) {
        if (event.t > currentTime) break
        if (event.type === 'ultimate_start' && event.player) {
          ultState.set(event.player, { startTime: event.t, endTime: Infinity, hero: event.hero || '' })
        }
        if (event.type === 'ultimate_end' && event.player) {
          const st = ultState.get(event.player)
          if (st) st.endTime = event.t
        }
      }
      for (const [name, st] of ultState) {
        if (currentTime >= st.startTime && currentTime < st.endTime) {
          // Skip Ana — her ult effect is shown on the nano target instead
          if (st.hero !== 'Ana') {
            activeUltPlayers.add(name)
          }
        }
      }
    }

    // Also check per-tick isUlting field (new data format — more reliable)
    for (const p of realPlayers) {
      if (p.isUlting && p.hero !== 'Ana') {
        activeUltPlayers.add(p.name)
      }
    }

    // Draw player hero badges
    for (const p of realPlayers) {
      const colors = p.isTeam1 ? TEAM_COLORS.team1 : TEAM_COLORS.team2
      const isHovered = hoveredPlayer === p.name
      const isSelected = selectedPlayer === p.name
      const radius = isHovered || isSelected ? 13 : 11
      const alpha = p.alive ? 1 : 0.3
      const abbrev = heroAbbrev(p.hero)
      const isNanod = nanoBoostedPlayers.has(p.name)
      const isUlting = activeUltPlayers.has(p.name)

      // Active ult glow (orange pulsing ring)
      if (isUlting && p.alive) {
        const pulse = 0.5 + Math.sin(Date.now() / 180) * 0.3
        ctx.save()
        ctx.shadowColor = 'rgba(255, 165, 0, 0.7)'
        ctx.shadowBlur = 12
        ctx.beginPath()
        ctx.arc(p.px, p.py, radius + 5, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(255, 165, 0, ${pulse})`
        ctx.lineWidth = 2.5
        ctx.stroke()
        ctx.restore()
      }

      // Nano Boost glow (blue pulsing ring on the TARGET)
      if (isNanod && p.alive) {
        const pulse = 0.6 + Math.sin(Date.now() / 150) * 0.3
        ctx.save()
        ctx.shadowColor = 'rgba(50, 120, 255, 0.8)'
        ctx.shadowBlur = 15
        ctx.beginPath()
        ctx.arc(p.px, p.py, radius + 6, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(50, 120, 255, ${pulse})`
        ctx.lineWidth = 3
        ctx.stroke()
        // Inner glow ring
        ctx.beginPath()
        ctx.arc(p.px, p.py, radius + 3, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(150, 200, 255, ${pulse * 0.6})`
        ctx.lineWidth = 1.5
        ctx.stroke()
        ctx.restore()
      }

      // Glow ring for ult-ready (skip Ana if she just used Nano — she won't have 100% anyway)
      if (p.ultCharge >= 100 && p.alive && !isNanod) {
        ctx.beginPath()
        ctx.arc(p.px, p.py, radius + 5, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(255, 215, 0, ${0.6 + Math.sin(Date.now() / 200) * 0.3})`
        ctx.lineWidth = 2.5
        ctx.stroke()
      }

      // Selection ring
      if (isSelected) {
        ctx.beginPath()
        ctx.arc(p.px, p.py, radius + 3, 0, Math.PI * 2)
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)'
        ctx.lineWidth = 2
        ctx.stroke()
      }

      // Badge shadow
      ctx.beginPath()
      ctx.arc(p.px, p.py, radius + 1, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(0, 0, 0, ${0.6 * alpha})`
      ctx.fill()

      ctx.globalAlpha = alpha

      if (p.alive) {
        const heroImg = loadHeroIcon(p.hero)
        if (heroImg) {
          // Draw circular hero portrait
          ctx.save()
          ctx.beginPath()
          ctx.arc(p.px, p.py, radius, 0, Math.PI * 2)
          ctx.clip()
          ctx.drawImage(heroImg, p.px - radius, p.py - radius, radius * 2, radius * 2)
          ctx.restore()

          // Team color border ring
          ctx.beginPath()
          ctx.arc(p.px, p.py, radius, 0, Math.PI * 2)
          ctx.strokeStyle = colors.fill
          ctx.lineWidth = 2.5
          ctx.stroke()
        } else {
          // Fallback: colored circle + text abbreviation
          ctx.beginPath()
          ctx.arc(p.px, p.py, radius, 0, Math.PI * 2)
          ctx.fillStyle = colors.fill
          ctx.fill()
          ctx.strokeStyle = colors.stroke
          ctx.lineWidth = 2
          ctx.stroke()

          const fontSize = abbrev.length > 3 ? 7 : 8
          ctx.font = `bold ${fontSize}px Inter, system-ui, sans-serif`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'
          ctx.fillText(abbrev, p.px, p.py + 0.5)
          ctx.fillStyle = 'rgba(255, 255, 255, 0.95)'
          ctx.fillText(abbrev, p.px, p.py)
        }
      } else {
        // Dead: draw skull death marker
        ctx.font = 'bold 12px sans-serif'
        ctx.fillStyle = '#ef4444'
        ctx.fillText('☠', p.px, p.py + 1)

        // Death marker ring
        ctx.beginPath()
        ctx.arc(p.px, p.py, radius + 2, 0, Math.PI * 2)
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.4)'
        ctx.lineWidth = 1.5
        ctx.setLineDash([3, 3])
        ctx.stroke()
        ctx.setLineDash([])

        // Name label for dead player
        ctx.font = '9px Inter, system-ui, sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'bottom'
        const deadLabel = p.name.slice(0, 6)
        const deadLabelW = ctx.measureText(deadLabel).width
        const deadLabelY = p.py - radius - 4
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)'
        ctx.beginPath()
        ctx.roundRect(p.px - deadLabelW / 2 - 4, deadLabelY - 12, deadLabelW + 8, 14, 3)
        ctx.fill()
        ctx.fillStyle = 'rgba(239, 68, 68, 0.8)'
        ctx.fillText(deadLabel, p.px, deadLabelY)
      }
      ctx.globalAlpha = 1

      // Facing direction indicator (small line)
      if (p.alive && p.facingX != null && p.facingZ != null && !showVisionCones) {
        const angle = Math.atan2(p.facingZ, p.facingX)
        const lineLen = radius + 5
        ctx.beginPath()
        ctx.moveTo(p.px + Math.cos(angle) * radius, p.py + Math.sin(angle) * radius)
        ctx.lineTo(p.px + Math.cos(angle) * lineLen, p.py + Math.sin(angle) * lineLen)
        ctx.strokeStyle = `rgba(255, 255, 255, ${0.6 * alpha})`
        ctx.lineWidth = 2
        ctx.stroke()
      }

      // Health bar (below dot)
      if (p.alive && p.health != null) {
        const barW = radius * 2.5
        const barH = 3
        const barX = p.px - barW / 2
        const barY = p.py + radius + 4

        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)'
        ctx.fillRect(barX, barY, barW, barH)
        
        const healthColor = p.health > 0.5 ? '#22c55e' : p.health > 0.25 ? '#f59e0b' : '#ef4444'
        ctx.fillStyle = healthColor
        ctx.fillRect(barX, barY, barW * p.health, barH)
      }

      // Player name label — always show abbreviated, full on hover/select
      const isHighlighted = isHovered || isSelected
      if (p.alive) {
        ctx.font = isHighlighted ? 'bold 11px Inter, system-ui, sans-serif' : '9px Inter, system-ui, sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'bottom'

        const label = isHighlighted ? `${p.name} (${p.hero})` : p.name.slice(0, 6)
        const textW = ctx.measureText(label).width
        const labelX = p.px
        const labelY = p.py - radius - (isHighlighted ? 8 : 4)

        // Background pill
        const bgH = isHighlighted ? 18 : 14
        ctx.fillStyle = isHighlighted ? 'rgba(0, 0, 0, 0.85)' : 'rgba(0, 0, 0, 0.6)'
        ctx.beginPath()
        ctx.roundRect(labelX - textW / 2 - 4, labelY - bgH + 2, textW + 8, bgH, 3)
        ctx.fill()

        // Text
        ctx.fillStyle = p.isTeam1 ? TEAM_COLORS.team1.fill : TEAM_COLORS.team2.fill
        ctx.fillText(label, labelX, labelY)
      }

      // Ult charge badge on hover/select
      if (isHighlighted && p.alive) {
        const ultText = `${p.ultCharge}%`
        ctx.font = '9px monospace'
        ctx.textAlign = 'center'
        ctx.fillStyle = p.ultCharge >= 100 ? 'rgba(255, 215, 0, 0.9)' : 'rgba(255, 255, 255, 0.6)'
        ctx.fillText(ultText, p.px, p.py + radius + 18)
      }
    }

    // Draw kill markers near current time (within 2 seconds)
    for (const event of data.events) {
      if (event.type !== 'kill') continue
      if (Math.abs(event.t - currentTime) > 2) continue
      if (!event.attackerPos || !event.victimPos) continue

      const attacker = worldToCanvas(event.attackerPos.x, event.attackerPos.z, activeTransform, viewport, fallbackBounds, w, h)
      const victim = worldToCanvas(event.victimPos.x, event.victimPos.z, activeTransform, viewport, fallbackBounds, w, h)

      // Draw kill line
      const age = Math.abs(event.t - currentTime)
      const alpha = 1 - age / 2
      ctx.beginPath()
      ctx.moveTo(attacker.px, attacker.py)
      ctx.lineTo(victim.px, victim.py)
      ctx.strokeStyle = `rgba(255, 100, 100, ${alpha * 0.6})`
      ctx.lineWidth = 1.5
      ctx.setLineDash([6, 3])
      ctx.stroke()
      ctx.setLineDash([])

      // Skull at victim position
      ctx.font = `${14 * alpha}px sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = `rgba(255, 100, 100, ${alpha})`
      ctx.fillText('💀', victim.px, victim.py - 18)
    }

  }, [data, currentTime, activeTransform, viewport, fallbackBounds, showVisionCones, hoveredPlayer, selectedPlayer, mapImageLoaded])

  // Handle canvas mouse interaction
  const handleCanvasMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!data?.timeline.length || !canvasRef.current) return

    // Handle drag-to-pan
    if (isDraggingRef.current && dataViewport) {
      const dx = e.clientX - lastMouseRef2.current.x
      const dy = e.clientY - lastMouseRef2.current.y
      lastMouseRef2.current = { x: e.clientX, y: e.clientY }
      // Convert canvas pixels to viewport-space pixels
      const rect = canvasRef.current.getBoundingClientRect()
      const vpScale = (dataViewport.srcW / userZoom) / rect.width
      panRef.current.x -= dx * vpScale
      panRef.current.y -= dy * vpScale
      setPanTick(t => t + 1)
      return
    }

    const rect = canvasRef.current.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top

    // Find closest player (excluding objective markers)
    const allPlayers = new Set<string>()
    for (const frame of data.timeline) {
      for (const p of frame.players) {
        if (p.team !== '__OBJ__') allPlayers.add(p.name)
      }
    }

    let closest: string | null = null
    let minDist = 20
    for (const name of allPlayers) {
      const player = getPlayerAtTime(data.timeline, name, currentTime)
      if (!player) continue
      const { px, py } = worldToCanvas(player.x, player.z, activeTransform, viewport, fallbackBounds, rect.width, rect.height)
      const dist = Math.hypot(mx - px, my - py)
      if (dist < minDist) {
        minDist = dist
        closest = name
      }
    }
    setHoveredPlayer(closest)
  }, [data, currentTime, activeTransform, viewport, dataViewport, fallbackBounds, userZoom])

  const handleCanvasMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button === 0) {
      isDraggingRef.current = true
      lastMouseRef2.current = { x: e.clientX, y: e.clientY }
    }
  }, [])

  const handleCanvasMouseUp = useCallback(() => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false
    }
  }, [])

  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    // Don't select/deselect if we just finished dragging
    const dx = Math.abs(e.clientX - lastMouseRef2.current.x)
    const dy = Math.abs(e.clientY - lastMouseRef2.current.y)
    if (dx > 3 || dy > 3) return

    if (calibrateMode && canvasRef.current && activeTransform && viewport) {
      // Reverse canvas click → image-space coordinates
      // In calibrate mode, use the FULL image dimensions (not the dynamic viewport)
      // to avoid circular dependency: changing transform → changes viewport → changes calibration
      const rect = canvasRef.current.getBoundingClientRect()
      const canvasX = e.clientX - rect.left
      const canvasY = e.clientY - rect.top
      const w = rect.width
      const h = rect.height
      // Use the full image as the reference frame
      const imgW = activeTransform.imageWidth
      const imgH = activeTransform.imageHeight
      const scaleX = w / (viewport?.srcW ?? imgW)
      const scaleY = h / (viewport?.srcH ?? imgH)
      const scale = Math.min(scaleX, scaleY)
      const offsetX = (w - (viewport?.srcW ?? imgW) * scale) / 2
      const offsetY = (h - (viewport?.srcH ?? imgH) * scale) / 2
      const imgU = ((canvasX - offsetX) / scale) + (viewport?.srcX ?? 0)
      const imgV = ((canvasY - offsetY) / scale) + (viewport?.srcY ?? 0)
      // Also compute what the actual natural pixel of the loaded image is
      const natW = mapImageRef.current?.naturalWidth ?? imgW
      const natH = mapImageRef.current?.naturalHeight ?? imgH
      const natU = imgU * (natW / imgW)
      const natV = imgV * (natH / imgH)
      const pt = { imgU: Math.round(natU), imgV: Math.round(natV), canvasX: Math.round(canvasX), canvasY: Math.round(canvasY) }
      setCalibratePoints(prev => [...prev, pt])
      console.log(`[CALIBRATE] Image pixel (native ${natW}x${natH}): (${pt.imgU}, ${pt.imgV}) | Viewport: srcX=${viewport?.srcX.toFixed(0)} srcY=${viewport?.srcY.toFixed(0)} srcW=${viewport?.srcW.toFixed(0)} srcH=${viewport?.srcH.toFixed(0)}`)
      return
    }

    if (hoveredPlayer) {
      setSelectedPlayer(prev => prev === hoveredPlayer ? null : hoveredPlayer)
    } else {
      setSelectedPlayer(null)
    }
  }, [hoveredPlayer, calibrateMode, activeTransform, viewport])

  // Mouse wheel zoom
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault()
      const factor = e.deltaY > 0 ? 0.85 : 1.18
      setUserZoom(prev => Math.max(0.5, Math.min(8, prev * factor)))
    }
    canvas.addEventListener('wheel', handleWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', handleWheel)
  }, [])

  const resetZoom = useCallback(() => {
    setUserZoom(1)
    panRef.current = { x: 0, y: 0 }
    setPanTick(t => t + 1)
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return
      switch (e.key) {
        case ' ':
          e.preventDefault()
          setPlaying(p => !p)
          break
        case 'ArrowLeft':
          e.preventDefault()
          setCurrentTime(t => Math.max(0, t - 5))
          break
        case 'ArrowRight':
          e.preventDefault()
          setCurrentTime(t => Math.min(data?.totalDuration ?? 0, t + 5))
          break
        case ',':
          e.preventDefault()
          setCurrentTime(t => Math.max(0, t - 0.5))
          break
        case '.':
          e.preventDefault()
          setCurrentTime(t => Math.min(data?.totalDuration ?? 0, t + 0.5))
          break
        case 'v':
          e.preventDefault()
          setShowVisionCones(v => !v)
          break
        case 'r':
          e.preventDefault()
          setUserZoom(1)
          panRef.current = { x: 0, y: 0 }
          setPanTick(t => t + 1)
          break
        case 's':
          e.preventDefault()
          handleSnapshot()
          break
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [data?.totalDuration, handleSnapshot])

  // ── Loading & Error States ──

  if (loading) {
    return (
      <div className="scrim-loading" style={{ padding: '60px 0', textAlign: 'center' }}>
        <Loader2 size={20} style={{ animation: 'spin 1s linear infinite', marginBottom: 8 }} />
        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>Loading position data...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ color: '#ef4444', padding: '40px 0', textAlign: 'center', fontSize: 13 }}>
        {error}
      </div>
    )
  }

  if (!data) return null

  if (!data.hasPositions) {
    return (
      <div className="replay-empty">
        <div className="replay-empty__icon">📍</div>
        <div className="replay-empty__title">No Position Data Available</div>
        <div className="replay-empty__hint">
          This scrim was recorded without position tracking enabled.
          Upload a log from the Elemental ScrimTime fork to see the replay viewer.
        </div>
        {data.events.length > 0 && (
          <div className="replay-empty__events">
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 20 }}>
              {data.events.filter(e => e.type === 'kill').length} kills recorded
              {' • '}
              {data.events.filter(e => e.type === 'ultimate_start').length} ultimates used
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── Main Render ──

  return (
    <div className="replay" ref={containerRef}>
      <div className="replay__layout">
        {/* Map Canvas */}
        <div className="replay__map-container">
          <div className="replay__map-header">
            <span className="replay__map-title">
              {activeSubMap?.displayName ?? data.mapName}
            </span>
            <span className="replay__map-type">{data.mapType}</span>
            {activeTransform && (
              <span className="replay__calibration-badge" title="Coordinates calibrated via parsertime affine transform">
                <Crosshair size={10} />
                <span>Calibrated</span>
              </span>
            )}
            <div className="replay__map-controls">
              <button
                className={`replay__toggle ${showVisionCones ? 'replay__toggle--active' : ''}`}
                onClick={() => setShowVisionCones(v => !v)}
                title="Toggle vision cones (V)"
              >
                {showVisionCones ? <Eye size={14} /> : <EyeOff size={14} />}
                <span>Vision</span>
              </button>
              <button className="replay__toggle" onClick={() => setUserZoom(z => Math.min(8, z * 1.3))} title="Zoom in">
                <ZoomIn size={14} />
              </button>
              <button className="replay__toggle" onClick={() => setUserZoom(z => Math.max(0.5, z / 1.3))} title="Zoom out">
                <ZoomOut size={14} />
              </button>
              {userZoom !== 1 && (
                <button className="replay__toggle" onClick={resetZoom} title="Reset zoom (R)">
                  <Maximize2 size={14} />
                </button>
              )}
              <button className="replay__toggle" onClick={handleSnapshot} title="Screenshot (S)">
                <Camera size={14} />
              </button>
              <button
                className={`replay__toggle ${calibrateMode ? 'replay__toggle--active' : ''}`}
                onClick={() => { setCalibrateMode(v => !v); setCalibratePoints([]) }}
                title="Calibration mode"
                style={calibrateMode ? { background: '#f59e0b', color: '#000' } : {}}
              >
                🎯 Calibrate
              </button>
            </div>
          </div>

          <canvas
            ref={canvasRef}
            className="replay__canvas"
            style={{ width: '100%', height: '500px', cursor: isDraggingRef.current ? 'grabbing' : (userZoom > 1 ? 'grab' : 'default') }}
            onMouseMove={handleCanvasMove}
            onMouseDown={handleCanvasMouseDown}
            onMouseUp={handleCanvasMouseUp}
            onMouseLeave={() => { setHoveredPlayer(null); isDraggingRef.current = false }}
            onClick={handleCanvasClick}
          />

          {/* Calibration overlay */}
          {calibrateMode && data && (
            <div style={{ background: 'rgba(0,0,0,0.85)', color: '#fff', padding: '12px 16px', fontFamily: 'monospace', fontSize: '11px', borderRadius: 8, marginTop: 8, maxHeight: 300, overflowY: 'auto' }}>
              <div style={{ marginBottom: 8, color: '#f59e0b', fontWeight: 'bold' }}>🎯 CALIBRATION MODE — Click map to add reference points</div>
              <div style={{ marginBottom: 8, color: '#94a3b8' }}>Player world coords at t={formatTime(currentTime)}:</div>
              {data.timeline.length > 0 && (() => {
                const frameIdx = data.timeline.findIndex(f => f.t >= currentTime)
                const frame = data.timeline[Math.max(0, frameIdx > 0 ? frameIdx - 1 : 0)]
                return frame?.players.filter(p => p.team !== '__OBJ__').map(p => {
                  const mapped = activeTransform ? worldToImage(p.x, p.z, activeTransform) : null
                  return (
                    <div key={p.name} style={{ color: p.team === data.team1 ? '#67e8f9' : '#f87171' }}>
                      {p.name} ({p.hero}): world=({p.x.toFixed(1)}, {p.z.toFixed(1)})
                      {mapped && <span style={{ color: '#a78bfa' }}> → img=({mapped.u.toFixed(0)}, {mapped.v.toFixed(0)})</span>}
                    </div>
                  )
                })
              })()}
              {calibratePoints.length > 0 && (
                <>
                  <div style={{ marginTop: 10, marginBottom: 4, color: '#f59e0b' }}>Clicked points (image space):</div>
                  {calibratePoints.map((pt, i) => (
                    <div key={i}>Point {i + 1}: image=({pt.imgU}, {pt.imgV})</div>
                  ))}
                  <button
                    onClick={() => setCalibratePoints([])}
                    style={{ marginTop: 8, background: '#374151', border: 'none', color: '#fff', padding: '4px 12px', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}
                  >
                    Clear points
                  </button>
                </>
              )}
            </div>
          )}

          {/* Fight summary overlay */}
          {currentFight && (
            <div className="replay__fight-overlay">
              <div className="replay__fight-overlay-header">
                <Swords size={12} />
                <span>Fight {currentFight.id}</span>
                <span className={`replay__fight-result replay__fight-result--${currentFight.winner}`}>
                  {currentFight.winner === 'team1' ? data.team1 : currentFight.winner === 'team2' ? data.team2 : 'Draw'}
                </span>
              </div>
              <div className="replay__fight-overlay-stats">
                <span style={{ color: TEAM_COLORS.team1.fill }}>{currentFight.team1Kills}K</span>
                <span style={{ color: 'rgba(255,255,255,0.4)' }}>vs</span>
                <span style={{ color: TEAM_COLORS.team2.fill }}>{currentFight.team2Kills}K</span>
              </div>
              {currentFight.firstPick && (
                <div className="replay__fight-overlay-detail">
                  First pick: <strong>{currentFight.firstPick.player}</strong> ({heroAbbrev(currentFight.firstPick.hero)})
                </div>
              )}
              {currentFight.firstDeath && (
                <div className="replay__fight-overlay-detail">
                  First death: <strong>{currentFight.firstDeath.player}</strong> ({heroAbbrev(currentFight.firstDeath.hero)})
                </div>
              )}
            </div>
          )}

          {/* Team legends */}
          <div className="replay__legends">
            <div className="replay__legend">
              <span className="replay__legend-dot" style={{ background: TEAM_COLORS.team1.fill }} />
              <span className="replay__legend-name">{data.team1}</span>
              <span className="replay__legend-players">
                {playersByTeam.team1.map(name => (
                  <button
                    key={name}
                    className={`replay__legend-player ${selectedPlayer === name ? 'replay__legend-player--selected' : ''}`}
                    onClick={() => setSelectedPlayer(prev => prev === name ? null : name)}
                  >
                    {name}
                  </button>
                ))}
              </span>
            </div>
            <div className="replay__legend">
              <span className="replay__legend-dot" style={{ background: TEAM_COLORS.team2.fill }} />
              <span className="replay__legend-name">{data.team2}</span>
              <span className="replay__legend-players">
                {playersByTeam.team2.map(name => (
                  <button
                    key={name}
                    className={`replay__legend-player ${selectedPlayer === name ? 'replay__legend-player--selected' : ''}`}
                    onClick={() => setSelectedPlayer(prev => prev === name ? null : name)}
                  >
                    {name}
                  </button>
                ))}
              </span>
            </div>
          </div>

          {/* Player Focus Card — stats computed up to current time */}
          {selectedPlayer && (() => {
            const currentHero = ultEconomy.team1.find(p => p.name === selectedPlayer)
              ?? ultEconomy.team2.find(p => p.name === selectedPlayer)
            if (!currentHero && !data.playerStats?.[selectedPlayer]) return null

            const isTeam1 = currentHero
              ? ultEconomy.team1.some(p => p.name === selectedPlayer)
              : data.playerStats?.[selectedPlayer]?.team === data.team1
            const teamColor = isTeam1 ? TEAM_COLORS.team1.fill : TEAM_COLORS.team2.fill

            // Compute stats up to currentTime from events
            let fb = 0, deaths = 0, ultsUsed = 0
            const heroesPlayed: string[] = []
            for (const e of data.events) {
              if (e.t > currentTime) break
              if (e.type === 'kill') {
                if (e.player === selectedPlayer) fb++
                if (e.victim === selectedPlayer) deaths++
              }
              if (e.type === 'ultimate_start' && e.player === selectedPlayer) ultsUsed++
            }
            // Get hero list from whole-map data
            if (data.playerStats?.[selectedPlayer]?.heroes) {
              heroesPlayed.push(...data.playerStats[selectedPlayer].heroes)
            }

            return (
              <div className="replay__player-focus" style={{ borderLeftColor: teamColor }}>
                <div className="replay__player-focus-header">
                  <span className="replay__player-focus-name" style={{ color: teamColor }}>{selectedPlayer}</span>
                  <span className="replay__player-focus-hero">{currentHero ? heroAbbrev(currentHero.hero) : heroesPlayed.map(h => heroAbbrev(h)).join(', ')}</span>
                  <button className="replay__player-focus-close" onClick={() => setSelectedPlayer(null)}>✕</button>
                </div>
                <div className="replay__player-focus-stats">
                  <div className="replay__player-focus-stat">
                    <span className="replay__player-focus-stat-value">{fb}</span>
                    <span className="replay__player-focus-stat-label">Final Blows</span>
                  </div>
                  <div className="replay__player-focus-stat">
                    <span className="replay__player-focus-stat-value">{deaths}</span>
                    <span className="replay__player-focus-stat-label">Deaths</span>
                  </div>
                  <div className="replay__player-focus-stat">
                    <span className="replay__player-focus-stat-value">{deaths > 0 ? (fb / deaths).toFixed(1) : (fb > 0 ? '∞' : '–')}</span>
                    <span className="replay__player-focus-stat-label">K/D</span>
                  </div>
                  <div className="replay__player-focus-stat">
                    <span className="replay__player-focus-stat-value">{ultsUsed}</span>
                    <span className="replay__player-focus-stat-label">Ults</span>
                  </div>
                  {currentHero && (
                    <div className="replay__player-focus-stat">
                      <span className="replay__player-focus-stat-value" style={{ color: currentHero.charge >= 100 ? '#fbbf24' : undefined }}>{currentHero.charge}%</span>
                      <span className="replay__player-focus-stat-label">Ult Charge</span>
                    </div>
                  )}
                </div>
                {/* Damage/Healing stats — live from per-tick data, or static from player_stat events */}
                {(() => {
                  const fmt = (n: number | null | undefined) => {
                    if (n == null || isNaN(n)) return '–'
                    return n >= 1000 ? `${(n / 1000).toFixed(1)}K` : Math.round(n).toString()
                  }

                  // Try per-tick data first (live cumulative values)
                  const pFrame = data.timeline.length > 0
                    ? getPlayerAtTime(data.timeline, selectedPlayer, currentTime)
                    : null
                  const hasTickData = pFrame?.heroDmg != null

                  if (hasTickData) {
                    const hasHealing = (pFrame.healing ?? 0) > 0
                    const hasBlock = (pFrame.dmgBlocked ?? 0) > 100
                    return (
                      <>
                        <div className="replay__player-focus-divider">Live Stats</div>
                        <div className="replay__player-focus-stats">
                          <div className="replay__player-focus-stat">
                            <span className="replay__player-focus-stat-value replay__stat--dmg">{fmt(pFrame.heroDmg)}</span>
                            <span className="replay__player-focus-stat-label">Hero Dmg</span>
                          </div>
                          <div className="replay__player-focus-stat">
                            <span className="replay__player-focus-stat-value replay__stat--taken">{fmt(pFrame.dmgTaken)}</span>
                            <span className="replay__player-focus-stat-label">Dmg Taken</span>
                          </div>
                          {hasHealing && (
                            <div className="replay__player-focus-stat">
                              <span className="replay__player-focus-stat-value replay__stat--heal">{fmt(pFrame.healing)}</span>
                              <span className="replay__player-focus-stat-label">Healing</span>
                            </div>
                          )}
                          {hasBlock && (
                            <div className="replay__player-focus-stat">
                              <span className="replay__player-focus-stat-value replay__stat--block">{fmt(pFrame.dmgBlocked)}</span>
                              <span className="replay__player-focus-stat-label">Blocked</span>
                            </div>
                          )}
                          <div className="replay__player-focus-stat">
                            <span className="replay__player-focus-stat-value">{fmt(pFrame.elimsCum)}</span>
                            <span className="replay__player-focus-stat-label">Elims</span>
                          </div>
                        </div>
                      </>
                    )
                  }

                  // Fallback: static end-of-map stats from playerStats
                  const st = data.playerStats?.[selectedPlayer]
                  if (!st) return null
                  const hasHealing = st.healingDone > 0
                  const hasBlock = st.damageBlocked > 100
                  return (
                    <>
                      <div className="replay__player-focus-divider">Final Stats</div>
                      <div className="replay__player-focus-stats">
                        <div className="replay__player-focus-stat">
                          <span className="replay__player-focus-stat-value replay__stat--dmg">{fmt(st.heroDamage)}</span>
                          <span className="replay__player-focus-stat-label">Hero Dmg</span>
                        </div>
                        <div className="replay__player-focus-stat">
                          <span className="replay__player-focus-stat-value replay__stat--taken">{fmt(st.damageTaken)}</span>
                          <span className="replay__player-focus-stat-label">Dmg Taken</span>
                        </div>
                        {hasHealing && (
                          <div className="replay__player-focus-stat">
                            <span className="replay__player-focus-stat-value replay__stat--heal">{fmt(st.healingDone)}</span>
                            <span className="replay__player-focus-stat-label">Healing</span>
                          </div>
                        )}
                        {hasBlock && (
                          <div className="replay__player-focus-stat">
                            <span className="replay__player-focus-stat-value replay__stat--block">{fmt(st.damageBlocked)}</span>
                            <span className="replay__player-focus-stat-label">Blocked</span>
                          </div>
                        )}
                        <div className="replay__player-focus-stat">
                          <span className="replay__player-focus-stat-value">{st.eliminations}</span>
                          <span className="replay__player-focus-stat-label">Elims</span>
                        </div>
                      </div>
                    </>
                  )
                })()}
                {heroesPlayed.length > 1 && (
                  <div className="replay__player-focus-heroes">
                    Played: {heroesPlayed.map((h, i) => {
                      const isCurrent = currentHero && h === currentHero.hero
                      return (
                        <span key={h}>
                          {i > 0 && ' → '}
                          <span style={isCurrent ? { color: teamColor, fontWeight: 600 } : undefined}>
                            {heroAbbrev(h)}
                          </span>
                        </span>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })()}
        </div>

        {/* Event Sidebar */}
        <div className="replay__sidebar">
          <div className="replay__team-key">
            <span className="replay__team-key-item">
              <span className="replay__team-key-dot" style={{ background: TEAM_COLORS.team1.fill }} />
              {data.team1}
            </span>
            <span className="replay__team-key-item">
              <span className="replay__team-key-dot" style={{ background: TEAM_COLORS.team2.fill }} />
              {data.team2}
            </span>
          </div>
          <div className="replay__sidebar-header">Events</div>
          <div className="replay__events">
            {/* Fight header if in a fight */}
            {currentFight && timelineFilters.fights && (
              <div className="replay__fight-header">
                <Swords size={11} />
                Fight {currentFight.id} — {currentFight.team1Kills} vs {currentFight.team2Kills}
              </div>
            )}
            {nearbyEvents.map((event, i) => {
              // Determine team colors for attacker and victim
              const attackerColor = event.team === data.team1 ? TEAM_COLORS.team1.fill : TEAM_COLORS.team2.fill
              const victimColor = event.team === data.team1 ? TEAM_COLORS.team2.fill : TEAM_COLORS.team1.fill

              return (
                <button
                  key={i}
                  className={`replay__event ${event.t <= currentTime ? 'replay__event--past' : ''} replay__event--${event.type}`}
                  onClick={() => { setCurrentTime(event.t); setPlaying(false) }}
                >
                  <span className="replay__event-time">{formatTime(event.t)}</span>
                  <span className="replay__event-icon">
                    {event.type === 'kill' && <Skull size={12} />}
                    {event.type === 'ultimate_start' && <Zap size={12} />}
                    {event.type === 'round_start' && '🏁'}
                  </span>
                  <span className="replay__event-desc">
                    {event.type === 'kill' ? (
                      <>
                        <span style={{ color: attackerColor, fontWeight: 600 }}>{event.player}</span>
                        <span style={{ opacity: 0.5 }}> ({heroAbbrev(event.hero || '')})</span>
                        {' → '}
                        <span style={{ color: victimColor, fontWeight: 600 }}>{event.victim}</span>
                        <span style={{ opacity: 0.5 }}> ({heroAbbrev(event.victimHero || '')})</span>
                      </>
                    ) : event.type === 'ultimate_start' ? (
                      <>
                        <span style={{ color: attackerColor, fontWeight: 600 }}>{event.player}</span>
                        <span style={{ opacity: 0.5 }}> ({heroAbbrev(event.hero || '')})</span>
                        {' activated ultimate'}
                      </>
                    ) : (
                      event.description
                    )}
                  </span>
                </button>
              )
            })}
            {nearbyEvents.length === 0 && (
              <div className="replay__event-empty">No events nearby</div>
            )}
          </div>

          {/* Ult Economy Panel */}
          <div className="replay__ult-economy">
            <div className="replay__sidebar-header">Ult Economy</div>
            <div className="replay__ult-team">
              {ultEconomy.team1.map(p => (
                <div key={p.name} className={`replay__ult-bar-row ${!p.alive ? 'replay__ult-bar-row--dead' : ''}`}>
                  <span className="replay__ult-hero" style={{ color: TEAM_COLORS.team1.fill }}>{heroAbbrev(p.hero)}</span>
                  <div className="replay__ult-bar-bg">
                    <div
                      className={`replay__ult-bar-fill ${p.charge >= 100 ? 'replay__ult-bar-fill--ready' : ''}`}
                      style={{ width: `${Math.min(100, p.charge)}%`, background: p.charge >= 100 ? '#fbbf24' : TEAM_COLORS.team1.fill }}
                    />
                  </div>
                  <span className="replay__ult-pct">{p.charge}%</span>
                </div>
              ))}
            </div>
            <div className="replay__ult-team" style={{ marginTop: 6 }}>
              {ultEconomy.team2.map(p => (
                <div key={p.name} className={`replay__ult-bar-row ${!p.alive ? 'replay__ult-bar-row--dead' : ''}`}>
                  <span className="replay__ult-hero" style={{ color: TEAM_COLORS.team2.fill }}>{heroAbbrev(p.hero)}</span>
                  <div className="replay__ult-bar-bg">
                    <div
                      className={`replay__ult-bar-fill ${p.charge >= 100 ? 'replay__ult-bar-fill--ready' : ''}`}
                      style={{ width: `${Math.min(100, p.charge)}%`, background: p.charge >= 100 ? '#fbbf24' : TEAM_COLORS.team2.fill }}
                    />
                  </div>
                  <span className="replay__ult-pct">{p.charge}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Timeline Controls */}
      <div className="replay__controls">
        <div className="replay__controls-row">
          {/* Play/Pause */}
          <div className="replay__transport">
            <button
              className="replay__btn"
              onClick={() => setCurrentTime(t => Math.max(0, t - 5))}
              title="Skip back 5s (←)"
            >
              <SkipBack size={14} />
            </button>
            <button
              className="replay__btn replay__btn--play"
              onClick={() => {
                if (currentTime >= data.totalDuration) setCurrentTime(0)
                setPlaying(p => !p)
              }}
              title="Play/Pause (Space)"
            >
              {playing ? <Pause size={16} /> : <Play size={16} />}
            </button>
            <button
              className="replay__btn"
              onClick={() => setCurrentTime(t => Math.min(data.totalDuration, t + 5))}
              title="Skip forward 5s (→)"
            >
              <SkipForward size={14} />
            </button>
          </div>

          {/* Speed */}
          <div className="replay__speed">
            {SPEEDS.map(s => (
              <button
                key={s}
                className={`replay__speed-btn ${speed === s ? 'replay__speed-btn--active' : ''}`}
                onClick={() => setSpeed(s)}
              >
                {s}x
              </button>
            ))}
          </div>

          {/* Time display */}
          <div className="replay__time">
            {formatTime(currentTime)} / {formatTime(data.totalDuration)}
          </div>
        </div>

        {/* Scrubber */}
        <div className="replay__scrubber-container">
          {/* Fight segments on timeline */}
          {timelineFilters.fights && fights.map(fight => {
            const startPct = (fight.startTime / data.totalDuration) * 100
            const endPct = (fight.endTime / data.totalDuration) * 100
            const color = fight.winner === 'team1' ? TEAM_COLORS.team1.fill
              : fight.winner === 'team2' ? TEAM_COLORS.team2.fill : 'rgba(255,255,255,0.3)'
            return (
              <div
                key={`fight-${fight.id}`}
                className="replay__fight-segment"
                style={{
                  left: `${startPct}%`,
                  width: `${Math.max(1, endPct - startPct)}%`,
                  background: color,
                }}
                title={`Fight ${fight.id}: ${fight.team1Kills} vs ${fight.team2Kills}`}
                onClick={() => { setCurrentTime(fight.startTime); setPlaying(false) }}
              >
                <span className="replay__fight-label">F{fight.id}</span>
              </div>
            )
          })}

          {/* Round dividers */}
          {timelineFilters.rounds && data.events.filter(e => e.type === 'round_start').map((e, i) => {
            const pct = (e.t / data.totalDuration) * 100
            return (
              <div
                key={`round-${i}`}
                className="replay__round-divider"
                style={{ left: `${pct}%` }}
                title={e.description}
                onClick={() => { setCurrentTime(e.t); setPlaying(false) }}
              />
            )
          })}

          <input
            type="range"
            className="replay__scrubber"
            min={0}
            max={data.totalDuration}
            step={0.1}
            value={currentTime}
            onChange={e => {
              setCurrentTime(Number(e.target.value))
              setPlaying(false)
            }}
          />

          {/* Event markers on timeline (filtered) */}
          <div className="replay__markers">
            {data.events.map((event, i) => {
              // Apply timeline filters
              if (event.type === 'kill' && !timelineFilters.kills) return null
              if ((event.type === 'ultimate_start' || event.type === 'ultimate_end') && !timelineFilters.ults) return null
              if (event.type === 'round_start' && !timelineFilters.rounds) return null
              const pct = (event.t / data.totalDuration) * 100
              return (
                <div
                  key={i}
                  className={`replay__marker replay__marker--${event.type}`}
                  style={{ left: `${pct}%` }}
                  title={`${formatTime(event.t)}: ${event.description}`}
                  onClick={() => { setCurrentTime(event.t); setPlaying(false) }}
                />
              )
            })}
          </div>
        </div>

        {/* Timeline filter chips */}
        <div className="replay__timeline-filters">
          <button className={`replay__filter-chip ${timelineFilters.kills ? 'replay__filter-chip--active' : ''}`} onClick={() => toggleFilter('kills')}>
            <Skull size={10} /> Kills
          </button>
          <button className={`replay__filter-chip ${timelineFilters.ults ? 'replay__filter-chip--active' : ''}`} onClick={() => toggleFilter('ults')}>
            <Zap size={10} /> Ults
          </button>
          <button className={`replay__filter-chip ${timelineFilters.rounds ? 'replay__filter-chip--active' : ''}`} onClick={() => toggleFilter('rounds')}>
            🏁 Rounds
          </button>
          <button className={`replay__filter-chip ${timelineFilters.fights ? 'replay__filter-chip--active' : ''}`} onClick={() => toggleFilter('fights')}>
            <Swords size={10} /> Fights
          </button>
          <span className="replay__shortcuts">
            Space: Play • ←/→: Skip 5s • ,/.: Step • V: Vision • Scroll: Zoom • R: Reset • S: Screenshot
          </span>
        </div>
      </div>
    </div>
  )
}

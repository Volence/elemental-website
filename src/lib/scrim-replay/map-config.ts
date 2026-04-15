/**
 * Map configuration for the Scrim Replay Viewer.
 *
 * Maps OW map names (as they appear in ScrimTime logs) to their
 * image assets and coordinate calibration data.
 *
 * Coordinate transforms are full 6-parameter affine matrices sourced
 * from parsertime's calibration system (MIT licensed).
 * See LICENSE-parsertime.md.
 *
 * The affine transform converts world coordinates (wx, wz) to image
 * pixel coordinates (u, v) via:
 *   u = a * wx + b * wz + tx
 *   v = c * wx + d * wz + ty
 */

// ══════════════════════════════════════════════════════════════════════
// Types
// ══════════════════════════════════════════════════════════════════════

export type MapTransform = {
  /** Affine coefficients: u = a*wx + b*wz + tx */
  a: number
  b: number
  /** Affine coefficients: v = c*wx + d*wz + ty */
  c: number
  d: number
  /** Translation offsets */
  tx: number
  ty: number
  /** Source image dimensions (pixels) */
  imageWidth: number
  imageHeight: number
}

export type SubMapConfig = {
  /** Display name (e.g. "Lijiang Tower: Night Market") */
  displayName: string
  /** Slug for filenames */
  slug: string
  /** Path to the calibrated overhead map image */
  imagePath: string
  /** Affine transform for world→image coordinates */
  transform: MapTransform
}

export type MapConfig = {
  /** Map type */
  type: 'Control' | 'Escort' | 'Hybrid' | 'Push' | 'Flashpoint' | 'Clash'
  /** For non-control maps: single map config. For control maps: null */
  primary: SubMapConfig | null
  /**
   * For control maps: array of sub-maps (one per round/point).
   * Order matches the Overwatch objective_index (0, 1, 2).
   * For non-control maps: empty array.
   */
  subMaps: SubMapConfig[]
}

// ══════════════════════════════════════════════════════════════════════
// Coordinate Transform
// ══════════════════════════════════════════════════════════════════════

/**
 * Convert Overwatch world coordinates to image pixel coordinates using
 * the full 6-parameter affine transform from parsertime's calibration.
 *
 * OW uses X/Z for the horizontal plane (Y is height/elevation).
 * The transform maps (worldX, worldZ) → (pixelU, pixelV).
 */
export function worldToImage(
  worldX: number,
  worldZ: number,
  transform: MapTransform,
): { u: number; v: number } {
  const u = transform.a * worldX + transform.b * worldZ + transform.tx
  const v = transform.c * worldX + transform.d * worldZ + transform.ty
  return { u, v }
}

/**
 * Convert world coordinates to canvas pixel coordinates.
 *
 * Two-step process:
 * 1. World → image pixels (via affine transform)
 * 2. Image pixels → canvas pixels (via scale factor)
 *
 * The source images are large (typically 8192×8192). The canvas is
 * much smaller, so we scale the image coordinates down proportionally.
 */
export function worldToCanvas(
  worldX: number,
  worldZ: number,
  transform: MapTransform,
  canvasWidth: number,
  canvasHeight: number,
): { px: number; py: number } {
  const { u, v } = worldToImage(worldX, worldZ, transform)

  // Scale from image space → canvas space
  const scaleX = canvasWidth / transform.imageWidth
  const scaleY = canvasHeight / transform.imageHeight
  const scale = Math.min(scaleX, scaleY)

  // Center the image in the canvas if aspect ratios differ
  const offsetX = (canvasWidth - transform.imageWidth * scale) / 2
  const offsetY = (canvasHeight - transform.imageHeight * scale) / 2

  return {
    px: u * scale + offsetX,
    py: v * scale + offsetY,
  }
}

// ══════════════════════════════════════════════════════════════════════
// Sub-Map Configs (from parsertime calibration data)
// ══════════════════════════════════════════════════════════════════════

// ── Control sub-maps ──

const LIJIANG_NIGHT_MARKET: SubMapConfig = {
  displayName: 'Lijiang Tower: Night Market',
  slug: 'lijiang-tower-night-market',
  imagePath: '/maps/lijiang-tower-night-market.png',
  transform: { a: 7.471005307, b: 0.004775356348, c: -0.02076315866, d: 7.500876805000001, tx: 1280.024804, ty: 1521.4093350000003, imageWidth: 2560, imageHeight: 2560 },
}

const LIJIANG_GARDEN: SubMapConfig = {
  displayName: 'Lijiang Tower: Garden',
  slug: 'lijiang-tower-garden',
  imagePath: '/maps/lijiang-tower-garden.png',
  transform: { a: 13.535552710000001, b: -0.0157501465, c: 0.02353987657, d: 13.435676450000003, tx: 1280.8042020000003, ty: -332.9255302000001, imageWidth: 2560, imageHeight: 2560 },
}

const LIJIANG_CONTROL_CENTER: SubMapConfig = {
  displayName: 'Lijiang Tower: Control Center',
  slug: 'lijiang-tower-control-center',
  imagePath: '/maps/lijiang-tower-control-center.png',
  transform: { a: 12.40792838, b: 0.012704565000000001, c: -0.05339037572000001, d: 12.4011186, tx: 1276.326451, ty: -2440.779832, imageWidth: 2560, imageHeight: 2560 },
}

const BUSAN_DOWNTOWN: SubMapConfig = {
  displayName: 'Busan: Downtown',
  slug: 'busan-downtown',
  imagePath: '/maps/busan-downtown.png',
  transform: { a: 8.210877683, b: 0.00533911678, c: -0.004005660459, d: 8.1920188, tx: 855.6886736000001, ty: 2276.45322, imageWidth: 2560, imageHeight: 2560 },
}

const BUSAN_MEKA_BASE: SubMapConfig = {
  displayName: 'Busan: Meka Base',
  slug: 'busan-meka-base',
  imagePath: '/maps/busan-meka-base.png',
  transform: { a: 9.372705351, b: 0.10026162890000001, c: 1.368726311, d: 11.14123784, tx: -743.4164503, ty: -1551.6262370000002, imageWidth: 2560, imageHeight: 2560 },
}

const BUSAN_SANCTUARY: SubMapConfig = {
  displayName: 'Busan: Sanctuary',
  slug: 'busan-sanctuary',
  imagePath: '/maps/busan-sanctuary.png',
  transform: { a: 7.375786075000001, b: 0.0013455839700000003, c: -0.008256456029, d: 7.374704591, tx: 3705.0214980000005, ty: 240.95033790000002, imageWidth: 2560, imageHeight: 2560 },
}

const ILIOS_LIGHTHOUSE: SubMapConfig = {
  displayName: 'Ilios: Lighthouse',
  slug: 'ilios-lighthouse',
  imagePath: '/maps/ilios-lighthouse.png',
  transform: { a: 7.2421029830000005, b: 0.01815217681, c: -0.01264015494, d: 7.26614013, tx: -1043.500614, ty: 1546.0283200000001, imageWidth: 2560, imageHeight: 2560 },
}

const ILIOS_RUINS: SubMapConfig = {
  displayName: 'Ilios: Ruins',
  slug: 'ilios-ruins',
  imagePath: '/maps/ilios-ruins.png',
  transform: { a: 10.35751769, b: -0.012215139580000001, c: 0.007498342146000001, d: 10.392874160000002, tx: 987.6491680000001, ty: 2911.186275, imageWidth: 2560, imageHeight: 2560 },
}

const ILIOS_WELL: SubMapConfig = {
  displayName: 'Ilios: Well',
  slug: 'ilios-well',
  imagePath: '/maps/ilios-well.png',
  transform: { a: 12.205200600000001, b: 0.01510059893, c: 0.02451488767, d: 12.203735180000002, tx: 3721.22545, ty: 1430.993069, imageWidth: 2560, imageHeight: 2560 },
}

const NEPAL_SANCTUM: SubMapConfig = {
  displayName: 'Nepal: Sanctum',
  slug: 'nepal-sanctum',
  imagePath: '/maps/nepal-sanctum.png',
  transform: { a: 10.26499648222663, b: -0.01828602358034167, c: -0.1185848629207102, d: 10.15016025413954, tx: 202.1514613046943, ty: 1029.657237630969, imageWidth: 2048, imageHeight: 2048 },
}

const NEPAL_SHRINE: SubMapConfig = {
  displayName: 'Nepal: Shrine',
  slug: 'nepal-shrine',
  imagePath: '/maps/nepal-shrine.png',
  transform: { a: 9.193449961, b: -0.007984868998, c: -0.0005470052556, d: 9.20691896, tx: 1831.3405030000001, ty: 1279.808361, imageWidth: 2560, imageHeight: 2560 },
}

const NEPAL_VILLAGE: SubMapConfig = {
  displayName: 'Nepal: Village',
  slug: 'nepal-village',
  imagePath: '/maps/nepal-village.png',
  transform: { a: -10.7824, b: 0.0838, c: -0.1084, d: 7.9521, tx: 1992, ty: 1293, imageWidth: 2560, imageHeight: 2560 },
}

const OASIS_CITY_CENTER: SubMapConfig = {
  displayName: 'Oasis: City Center',
  slug: 'oasis-city-center',
  imagePath: '/maps/oasis-city-center.png',
  transform: { a: 5.941309786, b: 0.009774496757000001, c: -0.02426058556, d: 5.959703672, tx: 445.6319619000001, ty: -189.2950699, imageWidth: 2560, imageHeight: 2560 },
}

const OASIS_GARDENS: SubMapConfig = {
  displayName: 'Oasis: Gardens',
  slug: 'oasis-gardens',
  imagePath: '/maps/oasis-gardens.png',
  transform: { a: 10.13750482, b: -0.01906552399, c: -0.002350243164, d: 10.1433063, tx: -143.5053188, ty: 3785.4297870000005, imageWidth: 2560, imageHeight: 2560 },
}

const OASIS_UNIVERSITY: SubMapConfig = {
  displayName: 'Oasis: University',
  slug: 'oasis-university',
  imagePath: '/maps/oasis-university.png',
  transform: { a: 9.639393513000002, b: 0.00871401017, c: -0.009871561978, d: 9.673342437, tx: 3014.229223, ty: 1277.907712, imageWidth: 2560, imageHeight: 2560 },
}

const SAMOA_BEACH: SubMapConfig = {
  displayName: 'Samoa: Beach',
  slug: 'samoa-beach',
  imagePath: '/maps/samoa-beach.png',
  transform: { a: 8.471312902, b: -0.012462500450000002, c: 0.002639675223, d: 8.45680305, tx: 4074.7013940000006, ty: 2084.5526250000003, imageWidth: 2560, imageHeight: 2560 },
}

const SAMOA_DOWNTOWN: SubMapConfig = {
  displayName: 'Samoa: Downtown',
  slug: 'samoa-downtown',
  imagePath: '/maps/samoa-downtown.png',
  transform: { a: 7.19760306, b: 0.01747647078, c: -0.015913610760000002, d: 7.202238396, tx: -371.3201952, ty: 3120.8942350000007, imageWidth: 2560, imageHeight: 2560 },
}

const SAMOA_VOLCANO: SubMapConfig = {
  displayName: 'Samoa: Volcano',
  slug: 'samoa-volcano',
  imagePath: '/maps/samoa-volcano.png',
  transform: { a: 11.07805282, b: 0.008710206923000001, c: 0.0060557056700000006, d: 11.06339122, tx: 977.687964, ty: -2537.7420810000003, imageWidth: 2560, imageHeight: 2560 },
}

// ── Non-control maps ──

function makeSubMap(displayName: string, slug: string, t: MapTransform): SubMapConfig {
  return { displayName, slug, imagePath: `/maps/${slug}.png`, transform: t }
}

// ══════════════════════════════════════════════════════════════════════
// Map Registry
// ══════════════════════════════════════════════════════════════════════

/**
 * Master map registry. Keys are base map names as they appear in ScrimTime logs.
 *
 * For Control maps, the `subMaps` array holds per-point configs.
 * The viewer resolves which sub-map to use based on the round/point.
 * When no round context is available, the first sub-map is used as fallback.
 */
export const MAP_CONFIGS: Record<string, MapConfig> = {
  // ── Control ──
  'Aatlis': {
    type: 'Control',
    primary: makeSubMap('Aatlis', 'aatlis', { a: 35.2228697772789, b: -0.005615248664381878, c: -0.8568087469790833, d: 33.94390640096452, tx: 3937.376546560471, ty: 4123.468128844285, imageWidth: 8192, imageHeight: 8192 }),
    subMaps: [],
  },
  'Antarctic Peninsula': {
    type: 'Control',
    primary: null,
    // No calibration data available yet — sub-map images pending
    subMaps: [],
  },
  'Busan': {
    type: 'Control',
    primary: null,
    subMaps: [BUSAN_DOWNTOWN, BUSAN_SANCTUARY, BUSAN_MEKA_BASE],
  },
  'Ilios': {
    type: 'Control',
    primary: null,
    subMaps: [ILIOS_LIGHTHOUSE, ILIOS_WELL, ILIOS_RUINS],
  },
  'Lijiang Tower': {
    type: 'Control',
    primary: null,
    subMaps: [LIJIANG_NIGHT_MARKET, LIJIANG_GARDEN, LIJIANG_CONTROL_CENTER],
  },
  'Nepal': {
    type: 'Control',
    primary: null,
    subMaps: [NEPAL_VILLAGE, NEPAL_SHRINE, NEPAL_SANCTUM],
  },
  'Oasis': {
    type: 'Control',
    primary: null,
    subMaps: [OASIS_CITY_CENTER, OASIS_GARDENS, OASIS_UNIVERSITY],
  },
  'Samoa': {
    type: 'Control',
    primary: null,
    subMaps: [SAMOA_BEACH, SAMOA_DOWNTOWN, SAMOA_VOLCANO],
  },

  // ── Escort ──
  'Circuit Royal': {
    type: 'Escort',
    primary: makeSubMap('Circuit Royal', 'circuit-royal', { a: 23.92135067288426, b: -0.1494674623328473, c: -0.03392143737309024, d: 24.12139322821177, tx: 4096.153435800877, ty: 4095.770513709282, imageWidth: 8192, imageHeight: 8192 }),
    subMaps: [],
  },
  'Dorado': {
    type: 'Escort',
    primary: makeSubMap('Dorado', 'dorado', { a: 24.19367152703596, b: -0.0282090059990147, c: -0.04154162077444704, d: 24.22227349431268, tx: 2150.957730278137, ty: 4241.848050294555, imageWidth: 8192, imageHeight: 8192 }),
    subMaps: [],
  },
  'Havana': {
    type: 'Escort',
    primary: makeSubMap('Havana', 'havana', { a: 15.29885931647297, b: 0.05641540797254747, c: -0.001445672597876347, d: 15.32762580880455, tx: 3763.245424454831, ty: 4740.159280276592, imageWidth: 8192, imageHeight: 8192 }),
    subMaps: [],
  },
  'Junkertown': {
    type: 'Escort',
    primary: makeSubMap('Junkertown', 'junkertown', { a: 25.98447407862766, b: 0.0452038737924354, c: 0.02766995887958248, d: 26.03330002690172, tx: 4929.134915548874, ty: 6122.83505149689, imageWidth: 8192, imageHeight: 8192 }),
    subMaps: [],
  },
  'Rialto': {
    type: 'Escort',
    primary: makeSubMap('Rialto', 'rialto', { a: 17.37833851662217, b: 0.01612576627311333, c: 0.009534690572517567, d: 17.37624692580318, tx: 3749.401663059765, ty: 5311.625738774668, imageWidth: 8192, imageHeight: 8192 }),
    subMaps: [],
  },
  'Route 66': {
    type: 'Escort',
    primary: makeSubMap('Route 66', 'route-66', { a: 27.78222438770802, b: -0.0535284617841734, c: -0.00571115238421163, d: 27.84724764395548, tx: 3401.740762249852, ty: 4095.955033399627, imageWidth: 8192, imageHeight: 8192 }),
    subMaps: [],
  },
  'Shambali Monastery': {
    type: 'Escort',
    primary: makeSubMap('Shambali Monastery', 'shambali-monastery', { a: 21.90268651636016, b: 0.01377641725760393, c: 0.03085319490973609, d: 21.95086947822113, tx: 4094.984878139649, ty: 2779.47546463784, imageWidth: 8192, imageHeight: 8192 }),
    subMaps: [],
  },
  'Watchpoint: Gibraltar': {
    type: 'Escort',
    primary: makeSubMap('Watchpoint: Gibraltar', 'watchpoint-gibraltar', { a: 24.7701277291063, b: 0.002806409230801304, c: 0.01324758313019491, d: 24.79804129714406, tx: 2114.043692347036, ty: 4094.910547174829, imageWidth: 8192, imageHeight: 8192 }),
    subMaps: [],
  },

  // ── Hybrid ──
  'Blizzard World': {
    type: 'Hybrid',
    primary: makeSubMap('Blizzard World', 'blizzard-world', { a: 13.18316123169205, b: 0.01430286469857819, c: -0.01053055536374651, d: 13.17567359654701, tx: 4042.430252279737, ty: 4199.707178761653, imageWidth: 8192, imageHeight: 8192 }),
    subMaps: [],
  },
  'Eichenwalde': {
    type: 'Hybrid',
    primary: makeSubMap('Eichenwalde', 'eichenwalde', { a: 36.60748899551842, b: -0.06375202078422001, c: -0.03392732269520579, d: 36.68871174359622, tx: 2450.071753059757, ty: 6197.712546609264, imageWidth: 8192, imageHeight: 8192 }),
    subMaps: [],
  },
  'Hollywood': {
    type: 'Hybrid',
    primary: makeSubMap('Hollywood', 'hollywood', { a: 20.96864674539472, b: 0.05114469912110928, c: 0.007779470421575933, d: 20.96080252313849, tx: 4096.700761883962, ty: 4724.839908674012, imageWidth: 8192, imageHeight: 8192 }),
    subMaps: [],
  },
  "King's Row": {
    type: 'Hybrid',
    primary: makeSubMap("King's Row", 'kings-row', { a: 23.14871281751457, b: -0.01664238919151203, c: -0.01174323271406306, d: 23.17269827110242, tx: 5253.119496380325, ty: 4674.156158401297, imageWidth: 8192, imageHeight: 8192 }),
    subMaps: [],
  },
  'Midtown': {
    type: 'Hybrid',
    primary: makeSubMap('Midtown', 'midtown', { a: 28.04013022811469, b: -0.03964458492668173, c: -0.06612392844865067, d: 27.97397057309509, tx: 3312.123475316486, ty: 3538.97500825136, imageWidth: 8192, imageHeight: 8192 }),
    subMaps: [],
  },
  'Numbani': {
    type: 'Hybrid',
    primary: makeSubMap('Numbani', 'numbani', { a: 25.02650207399714, b: -0.08242424823834578, c: -0.01699850221309924, d: 25.01515974594845, tx: 2042.774323647489, ty: 3845.368919862618, imageWidth: 8192, imageHeight: 8192 }),
    subMaps: [],
  },
  'Paraíso': {
    type: 'Hybrid',
    primary: null, // No calibration data from parsertime yet
    subMaps: [],
  },

  // ── Push ──
  'Colosseo': {
    type: 'Push',
    primary: makeSubMap('Colosseo', 'colosseo', { a: 23.87057564907908, b: 0.1759875779606723, c: 6.478393945487229, d: 18.39654604394479, tx: 4099.651693097375, ty: 4015.434921780802, imageWidth: 8192, imageHeight: 8192 }),
    subMaps: [],
  },
  'Esperança': {
    type: 'Push',
    primary: makeSubMap('Esperança', 'esperanca', { a: 24.04382149935184, b: 0.01404763647646686, c: 0.01682462995688104, d: 24.11201857216057, tx: 4097.571122676109, ty: 5179.559117311127, imageWidth: 8192, imageHeight: 8192 }),
    subMaps: [],
  },
  'New Queen Street': {
    type: 'Push',
    primary: makeSubMap('New Queen Street', 'new-queen-street', { a: 37.55084321113998, b: 0.2581468804374953, c: -0.02805351617197359, d: 37.79887143673749, tx: 4107.2756318547, ty: 4105.581716014958, imageWidth: 8192, imageHeight: 8192 }),
    subMaps: [],
  },

  // ── Flashpoint ──
  'New Junk City': {
    type: 'Flashpoint',
    primary: makeSubMap('New Junk City', 'new-junk-city', { a: 20.93585727763547, b: 1.274620266152636, c: -0.04304231052704316, d: 18.26110356096052, tx: 4082.750870848546, ty: 4095.846657735549, imageWidth: 8192, imageHeight: 8192 }),
    subMaps: [],
  },
  'Suravasa': {
    type: 'Flashpoint',
    primary: makeSubMap('Suravasa', 'suravasa', { a: 99.89031734569824, b: 145.214132280866, c: -0.1889391116009477, d: 20.98241693408777, tx: 994.4046623936082, ty: 4102.41741435426, imageWidth: 8192, imageHeight: 8192 }),
    subMaps: [],
  },

  // ── Clash ──
  'Hanaoka': {
    type: 'Clash',
    primary: null, // No calibration data yet
    subMaps: [],
  },
  'Throne of Anubis': {
    type: 'Clash',
    primary: null, // No calibration data yet
    subMaps: [],
  },
  'Runasapi': {
    type: 'Clash',
    primary: makeSubMap('Runasapi', 'runasapi', { a: 16.72877424617032, b: -0.1493640557778048, c: -0.02883869628701483, d: 16.83699218222604, tx: 4109.141049627354, ty: 3501.681427807782, imageWidth: 8192, imageHeight: 8192 }),
    subMaps: [],
  },
}

// ══════════════════════════════════════════════════════════════════════
// Aliases for log name variations
// ══════════════════════════════════════════════════════════════════════

// Seasonal/variant map names that map to the same config
const MAP_ALIASES: Record<string, string> = {
  'Lijiang Tower (Lunar New Year)': 'Lijiang Tower',
  'Esperanca': 'Esperança',
  'Paraiso': 'Paraíso',
}

// ══════════════════════════════════════════════════════════════════════
// Lookup Functions
// ══════════════════════════════════════════════════════════════════════

/**
 * Get map config by name, with alias and fuzzy fallback.
 */
export function getMapConfig(mapName: string): MapConfig | null {
  // Direct match
  if (MAP_CONFIGS[mapName]) return MAP_CONFIGS[mapName]

  // Alias match
  if (MAP_ALIASES[mapName] && MAP_CONFIGS[MAP_ALIASES[mapName]]) {
    return MAP_CONFIGS[MAP_ALIASES[mapName]]
  }

  // Case-insensitive match
  const lower = mapName.toLowerCase()
  for (const [key, config] of Object.entries(MAP_CONFIGS)) {
    if (key.toLowerCase() === lower) return config
  }

  // Fuzzy: check if the map name starts with or contains a known key
  for (const [key, config] of Object.entries(MAP_CONFIGS)) {
    if (lower.startsWith(key.toLowerCase())) return config
    if (key.toLowerCase().startsWith(lower)) return config
  }

  return null
}

/**
 * Get the best SubMapConfig for a given map.
 *
 * For non-control maps, returns the primary config.
 * For control maps, returns the sub-map at the given objective index,
 * or the first sub-map as a fallback if no index is given.
 *
 * Returns null if no calibrated sub-map is available.
 */
export function getSubMapConfig(
  mapName: string,
  objectiveIndex?: number,
): SubMapConfig | null {
  const config = getMapConfig(mapName)
  if (!config) return null

  // Non-control map: just return primary
  if (config.subMaps.length === 0) {
    return config.primary
  }

  // Control map with sub-maps:
  if (objectiveIndex != null && objectiveIndex >= 0 && objectiveIndex < config.subMaps.length) {
    return config.subMaps[objectiveIndex]
  }

  // Fallback to first sub-map
  return config.subMaps[0] ?? config.primary
}

/**
 * Get ALL sub-maps for a Control map (e.g. Nepal → [Village, Shrine, Sanctum]).
 * Returns empty array for non-control maps or if map not found.
 */
export function getAllSubMaps(mapName: string): SubMapConfig[] {
  const config = getMapConfig(mapName)
  if (!config) return []
  if (config.subMaps.length > 0) return config.subMaps
  return config.primary ? [config.primary] : []
}

/**
 * Auto-detect which sub-map best matches a world coordinate by checking
 * which transform produces in-bounds image coordinates.
 */
export function detectSubMap(
  mapName: string,
  worldX: number,
  worldZ: number,
): SubMapConfig | null {
  const subMaps = getAllSubMaps(mapName)
  if (subMaps.length <= 1) return subMaps[0] ?? null

  let bestMatch: SubMapConfig | null = null
  let bestScore = Infinity

  for (const sub of subMaps) {
    if (!sub.transform) continue
    const { u, v } = worldToImage(worldX, worldZ, sub.transform)
    const imgW = sub.transform.imageWidth
    const imgH = sub.transform.imageHeight
    // Check if coordinates are within bounds (with some margin)
    const margin = imgW * 0.15
    if (u >= -margin && u <= imgW + margin && v >= -margin && v <= imgH + margin) {
      // Score: distance from center (closer to center = better match)
      const dx = u - imgW / 2
      const dy = v - imgH / 2
      const score = Math.sqrt(dx * dx + dy * dy)
      if (score < bestScore) {
        bestScore = score
        bestMatch = sub
      }
    }
  }

  return bestMatch ?? subMaps[0] ?? null
}

/**
 * Try to resolve a sub-map from a display name like "Lijiang Tower: Night Market"
 * by searching all sub-maps. Falls back to getSubMapConfig with index 0.
 */
export function resolveSubMapByName(mapDisplayName: string): SubMapConfig | null {
  const lower = mapDisplayName.toLowerCase().trim()

  // Search all configs for matching sub-maps
  for (const config of Object.values(MAP_CONFIGS)) {
    // Check primary
    if (config.primary?.displayName.toLowerCase() === lower) {
      return config.primary
    }
    // Check sub-maps
    for (const sub of config.subMaps) {
      if (sub.displayName.toLowerCase() === lower) {
        return sub
      }
    }
  }

  // If the name contains a colon, try the base name (before the colon)
  if (mapDisplayName.includes(':')) {
    const baseName = mapDisplayName.split(':')[0].trim()
    return getSubMapConfig(baseName)
  }

  // Fall back to base lookup
  return getSubMapConfig(mapDisplayName)
}

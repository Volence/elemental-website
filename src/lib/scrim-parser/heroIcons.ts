/**
 * Overwatch hero icon utilities.
 *
 * Fetches hero portrait URLs from the OverFast API (which proxies Blizzard CDN).
 * Portrait URLs use unpredictable SHA256 hashes, so we cache the mapping.
 */

const HERO_SLUG_OVERRIDES: Record<string, string> = {
  'D.Va': 'dva',
  'Soldier: 76': 'soldier-76',
  'Lúcio': 'lucio',
  'Torbjörn': 'torbjorn',
  'Wrecking Ball': 'wrecking-ball',
  'Junker Queen': 'junker-queen',
}

/**
 * Convert a hero display name to a URL-safe slug (matching OverFast API keys).
 */
export function heroNameToSlug(name: string): string {
  if (HERO_SLUG_OVERRIDES[name]) return HERO_SLUG_OVERRIDES[name]
  return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
}

/**
 * In-memory cache of hero portrait URLs, keyed by slug.
 * null = not fetched yet, Map = loaded.
 */
let heroPortraitCache: Map<string, string> | null = null
let fetchPromise: Promise<void> | null = null

/**
 * Load the hero portrait mapping from the OverFast API.
 * Only fetches once; subsequent calls return the cached data.
 */
export async function loadHeroPortraits(): Promise<Map<string, string>> {
  if (heroPortraitCache) return heroPortraitCache

  if (!fetchPromise) {
    fetchPromise = fetch('https://overfast-api.tekrop.fr/heroes')
      .then((r) => r.json())
      .then((heroes: Array<{ key: string; portrait: string }>) => {
        heroPortraitCache = new Map()
        for (const hero of heroes) {
          heroPortraitCache.set(hero.key, hero.portrait)
        }
      })
      .catch(() => {
        heroPortraitCache = new Map() // Empty on error, will use fallback
      })
  }
  await fetchPromise
  return heroPortraitCache!
}

/**
 * Get the hero portrait icon URL from the cache.
 * Returns undefined if not loaded or hero not found.
 */
export function getHeroIconUrl(heroName: string): string | undefined {
  if (!heroPortraitCache) return undefined
  const slug = heroNameToSlug(heroName)
  return heroPortraitCache.get(slug)
}

/**
 * Clean up raw ability strings from scrim export data.
 * "0" is used for primary fire / unknown in the raw data.
 */
export function formatAbility(ability: string): string {
  if (ability === '0') return 'Primary Fire'
  return ability
}

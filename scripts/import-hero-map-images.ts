import { getPayload } from 'payload'
import configPromise from '@payload-config'

const OVERFAST_API = 'https://overfast-api.tekrop.fr'

type FileData = { name: string; data: Buffer; mimetype: string; size: number }

async function fetchImage(url: string, filename: string): Promise<FileData> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`)
  const data = await res.arrayBuffer()
  const ext = url.split('.').pop()?.split('?')[0] ?? 'png'
  return {
    name: filename,
    data: Buffer.from(data),
    mimetype: `image/${ext === 'jpg' ? 'jpeg' : ext}`,
    size: data.byteLength,
  }
}

async function main() {
  const payload = await getPayload({ config: configPromise })

  // Fetch hero data from overfast API
  console.log('Fetching hero data from overfast API...')
  const heroRes = await fetch(`${OVERFAST_API}/heroes`)
  const apiHeroes: Array<{ key: string; name: string; portrait: string; role: string }> = await heroRes.json()

  // Fetch map data from overfast API
  console.log('Fetching map data from overfast API...')
  const mapRes = await fetch(`${OVERFAST_API}/maps`)
  const apiMaps: Array<{ key: string; name: string; screenshot: string }> = await mapRes.json()

  // Get existing heroes from DB
  const dbHeroes = await payload.find({
    collection: 'heroes',
    limit: 100,
    overrideAccess: true,
    depth: 0,
  })

  // Get existing maps from DB
  const dbMaps = await payload.find({
    collection: 'maps',
    limit: 100,
    overrideAccess: true,
    depth: 0,
  })

  // Import hero portraits
  console.log(`\nImporting hero portraits (${dbHeroes.docs.length} heroes in DB)...`)
  let heroSuccess = 0
  let heroSkipped = 0
  let heroFailed = 0

  for (const dbHero of dbHeroes.docs as any[]) {
    if (dbHero.image) {
      console.log(`  [SKIP] ${dbHero.name} - already has image`)
      heroSkipped++
      continue
    }

    const normalizedName = dbHero.name.toLowerCase().replace(/[^a-z0-9]/g, '')
    const apiHero = apiHeroes.find((h) => {
      const apiNormalized = h.name.toLowerCase().replace(/[^a-z0-9]/g, '')
      return apiNormalized === normalizedName
    })

    if (!apiHero) {
      console.log(`  [MISS] ${dbHero.name} - not found in API (custom hero?)`)
      heroFailed++
      continue
    }

    try {
      const file = await fetchImage(apiHero.portrait, `hero-${apiHero.key}.png`)
      const media = await payload.create({
        collection: 'media',
        data: { alt: `${dbHero.name} portrait` },
        file,
        overrideAccess: true,
      })
      await payload.update({
        collection: 'heroes',
        id: dbHero.id,
        data: { image: media.id },
        overrideAccess: true,
      })
      console.log(`  [OK] ${dbHero.name}`)
      heroSuccess++
    } catch (err: any) {
      console.log(`  [FAIL] ${dbHero.name}: ${err.message}`)
      heroFailed++
    }
  }

  // Import map screenshots
  console.log(`\nImporting map images (${dbMaps.docs.length} maps in DB)...`)
  let mapSuccess = 0
  let mapSkipped = 0
  let mapFailed = 0

  for (const dbMap of dbMaps.docs as any[]) {
    if (dbMap.image) {
      console.log(`  [SKIP] ${dbMap.name} - already has image`)
      mapSkipped++
      continue
    }

    const normalizedName = dbMap.name.toLowerCase().replace(/[^a-z0-9]/g, '')
    const apiMap = apiMaps.find((m) => {
      const apiNormalized = m.name.toLowerCase().replace(/[^a-z0-9]/g, '')
      return apiNormalized === normalizedName
    })

    if (!apiMap) {
      console.log(`  [MISS] ${dbMap.name} - not found in API`)
      mapFailed++
      continue
    }

    try {
      const file = await fetchImage(apiMap.screenshot, `map-${apiMap.key}.jpg`)
      const media = await payload.create({
        collection: 'media',
        data: { alt: `${dbMap.name} map` },
        file,
        overrideAccess: true,
      })
      await payload.update({
        collection: 'maps',
        id: dbMap.id,
        data: { image: media.id },
        overrideAccess: true,
      })
      console.log(`  [OK] ${dbMap.name}`)
      mapSuccess++
    } catch (err: any) {
      console.log(`  [FAIL] ${dbMap.name}: ${err.message}`)
      mapFailed++
    }
  }

  console.log(`\nDone!`)
  console.log(`Heroes: ${heroSuccess} imported, ${heroSkipped} skipped, ${heroFailed} failed`)
  console.log(`Maps:   ${mapSuccess} imported, ${mapSkipped} skipped, ${mapFailed} failed`)

  process.exit(0)
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})

/**
 * Run ONE registered migration's up() by name, recording nothing in payload_migrations.
 *   docker exec -w /home/node/app elemental-dev-3100 npx payload run scripts/apply-one-migration.ts 20260905_titles_data
 */
import { getPayload } from 'payload'
import config from '@payload-config'
import { migrations } from '../src/migrations'

const name = process.argv[2]
const migration = migrations.find((m) => m.name === name)
if (!migration) {
  console.error(`Unknown migration ${name}. Known: ${migrations.map((m) => m.name).join(', ')}`)
  process.exit(1)
}
const payload = await getPayload({ config })
try {
  await migration.up({ payload, db: payload.db.drizzle, req: {} as any })
} catch (err) {
  console.error(`[apply-one-migration] ${name} failed:`, err)
  process.exit(1)
}
console.log(`[apply-one-migration] ${name} up() finished`)
process.exit(0)

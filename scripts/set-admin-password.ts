/**
 * Break-glass: set or reset the password of an admin-role person.
 *
 * Run inside the app container:
 *   ADMIN_EMAIL=you@example.com NEW_PASSWORD='...' npx payload run scripts/set-admin-password.ts
 *   ADMIN_DISCORD_ID=1234567890 NEW_PASSWORD='...' npx payload run scripts/set-admin-password.ts
 *
 * Refuses non-admin rows so only admins ever hold a usable password.
 */
import { getPayload } from 'payload'
import type { Where } from 'payload'
import config from '@payload-config'

const email = process.env.ADMIN_EMAIL
const discordId = process.env.ADMIN_DISCORD_ID
const password = process.env.NEW_PASSWORD

if (!password || password.length < 12) {
  console.error('NEW_PASSWORD (min 12 chars) is required')
  process.exit(1)
}
if (!email && !discordId) {
  console.error('ADMIN_EMAIL or ADMIN_DISCORD_ID is required')
  process.exit(1)
}

const payload = await getPayload({ config })
const where: Where = email ? { email: { equals: email } } : { discordId: { equals: discordId as string } }
const found = await payload.find({ collection: 'people', where, limit: 1, depth: 0, overrideAccess: true })
const person = found.docs[0] as any
if (!person) {
  console.error('No person matched')
  process.exit(1)
}
if (person.role !== 'admin') {
  console.error(`Refusing: ${person.name} (#${person.id}) has role ${person.role}, not admin`)
  process.exit(1)
}
if (!person.email && !email) {
  console.error('This admin has no email; set ADMIN_EMAIL to also assign one for break-glass login')
  process.exit(1)
}

await payload.update({
  collection: 'people',
  id: person.id,
  data: { password, ...(email && !person.email ? { email } : {}) },
  overrideAccess: true,
})
console.log(`Password set for ${person.name} (#${person.id}). Log in at /admin/login?breakglass=1`)
process.exit(0)

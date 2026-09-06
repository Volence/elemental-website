/**
 * Read-only preview of what migration B (20260905_titles_data) will do.
 *   docker exec -w /home/node/app elemental-dev-3100 npx payload run scripts/titles-migration-report.ts
 */
import { getPayload } from 'payload'
import config from '@payload-config'
import { sql } from '@payloadcms/db-postgres'
import { productionTypeToTitles, orgRoleToTitle, impliedFlagsForTitles } from '../src/migrations/titlesDataMapping'

const payload = await getPayload({ config })
const db = payload.db.drizzle
const rows = async (q: any) => { const r: any = await db.execute(q); return (r.rows ?? r) as any[] }

const org = await rows(sql`SELECT os.person_id, p.name, r.value AS role FROM organization_staff os JOIN people p ON p.id = os.person_id JOIN organization_staff_roles r ON r.parent_id = os.id ORDER BY p.name`)
console.log(`\n== organization_staff roles -> titles (${org.length})`)
for (const r of org) console.log(`${r.name} (#${r.person_id}): ${r.role} -> ${orgRoleToTitle(r.role) ?? 'DROPPED'}`)

const prod = await rows(sql`SELECT pr.person_id, p.name, pr.type FROM production pr JOIN people p ON p.id = pr.person_id ORDER BY p.name`)
console.log(`\n== production types -> titles (${prod.length})`)
for (const r of prod) console.log(`${r.name} (#${r.person_id}): ${r.type} -> ${productionTypeToTitles(r.type).join(' + ')}`)

const [skipped] = await rows(sql`
  SELECT (SELECT count(*) FROM organization_staff WHERE person_id IS NULL) AS org,
         (SELECT count(*) FROM production WHERE person_id IS NULL) AS prod`)
console.log(`\nREPORT skipped ${Number(skipped?.org ?? 0)} organization_staff row(s) and ${Number(skipped?.prod ?? 0)} production row(s) with null person_id`)

const losingRaw = await rows(sql`
  SELECT p.id, p.name FROM people p
  WHERE p.role = 'team-manager'
    AND NOT EXISTS (SELECT 1 FROM teams_manager tm WHERE tm.person_id = p.id)
    AND NOT EXISTS (SELECT 1 FROM teams_coaches tc WHERE tc.person_id = p.id)
    AND NOT EXISTS (SELECT 1 FROM teams_captain tk WHERE tk.person_id = p.id)
    AND NOT EXISTS (SELECT 1 FROM people_rels pr WHERE pr.parent_id = p.id AND pr.path IN ('teamAccess','assignedTeams'))
  ORDER BY p.name`)

const byPerson = new Map<number, string[]>()
for (const r of org) { const t = orgRoleToTitle(r.role); if (t) byPerson.set(r.person_id, [...(byPerson.get(r.person_id) ?? []), t]) }
for (const r of prod) byPerson.set(r.person_id, [...(byPerson.get(r.person_id) ?? []), ...productionTypeToTitles(r.type)])

// Keep in sync with migration B's `losing` query: a team-manager about to receive a
// region-lead title does not lose team rights, so exclude anyone whose incoming titles
// include region-lead (the migration checks the same via people_titles after insert;
// here that data doesn't exist yet, so we check the titles this preview computed above).
const losing = losingRaw.filter((r) => !(byPerson.get(Number(r.id)) ?? []).includes('region-lead'))
console.log(`\n== team-managers who would lose team rights (${losing.length})`)
for (const r of losing) console.log(`${r.name} (#${r.id})`)

console.log(`\n== department flags that would be cleared as implied by titles`)
for (const [id, titles] of byPerson) {
  const flags = impliedFlagsForTitles(titles as any)
  if (flags.length) console.log(`#${id}: ${flags.join(', ')} (from ${titles.join(', ')})`)
}
console.log(`\n== lead candidates per department title`)
const cands = new Map<string, string[]>()
for (const [id, titles] of byPerson) for (const t of titles) if (['event-manager','social-manager','marketing','graphics','media-editor','caster','producer'].includes(t)) cands.set(t, [...(cands.get(t) ?? []), `#${id}`])
for (const [t, ids] of cands) console.log(`${t}: ${ids.join(', ')}`)
process.exit(0)

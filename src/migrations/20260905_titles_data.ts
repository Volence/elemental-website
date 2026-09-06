import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'
import { randomUUID } from 'crypto'
import { productionTypeToTitles, orgRoleToTitle, impliedFlagsForTitles } from './titlesDataMapping'
import type { TitleValue } from '../access/titles'

const FLAG_COLUMN: Record<string, string> = {
  isProductionStaff: 'departments_is_production_staff',
  isSocialMediaStaff: 'departments_is_social_media_staff',
  isGraphicsStaff: 'departments_is_graphics_staff',
  isVideoStaff: 'departments_is_video_staff',
  isEventsStaff: 'departments_is_events_staff',
  isPugAdmin: 'departments_is_pug_admin',
  isScoutingStaff: 'departments_is_scouting_staff',
}

/**
 * Titles and access, migration B (data, copies only). Run after migration A, before deploy.
 * 1. organization_staff + production rows -> people_titles (combined production types split)
 * 2. role team-manager / player -> user (report who loses team rights first)
 * 3. clear department flags implied by the new titles (report)
 * 4. report lead candidates per department (no is_lead is set)
 * Re-runnable: skips titles a person already has.
 */
export async function up({ payload }: MigrateUpArgs): Promise<void> {
  const db = payload.db.drizzle
  const rows = async (q: any) => { const r: any = await db.execute(q); return (r.rows ?? r) as any[] }
  const log = (m: string) => payload.logger.info(`[titles-b] ${m}`)

  // 1. Titles from organization_staff
  const existing = new Set<string>((await rows(sql`SELECT _parent_id, title FROM people_titles`)).map((r) => `${r._parent_id}|${r.title}`))
  const orderByPerson = new Map<number, number>()
  for (const r of await rows(sql`SELECT _parent_id, MAX(_order) AS m FROM people_titles GROUP BY _parent_id`)) orderByPerson.set(Number(r._parent_id), Number(r.m))
  const insert = async (personId: number, title: TitleValue, regions: string[] = []) => {
    const key = `${personId}|${title}`
    if (existing.has(key)) return false
    const order = (orderByPerson.get(personId) ?? 0) + 1
    orderByPerson.set(personId, order)
    const id = randomUUID()
    await db.execute(sql`INSERT INTO people_titles (_order, _parent_id, id, title, is_lead) VALUES (${order}, ${personId}, ${id}, ${title}, false)`)
    for (let i = 0; i < regions.length; i++) {
      await db.execute(sql`INSERT INTO people_titles_regions ("order", parent_id, value) VALUES (${i + 1}, ${id}, ${regions[i]})`)
    }
    existing.add(key)
    return true
  }

  let inserted = 0
  const org = await rows(sql`
    SELECT os.id, os.person_id, r.value AS role, r."order"
    FROM organization_staff os JOIN organization_staff_roles r ON r.parent_id = os.id
    WHERE os.person_id IS NOT NULL ORDER BY os.person_id, r."order"`)
  const regionsByStaff = new Map<number, string[]>()
  for (const r of await rows(sql`SELECT parent_id, value FROM organization_staff_regions ORDER BY parent_id, "order"`)) {
    regionsByStaff.set(Number(r.parent_id), [...(regionsByStaff.get(Number(r.parent_id)) ?? []), String(r.value)])
  }
  for (const r of org) {
    const title = orgRoleToTitle(String(r.role))
    if (!title) { log(`skip retired org role ${r.role} on person ${r.person_id}`); continue }
    if (await insert(Number(r.person_id), title, title === 'region-lead' ? regionsByStaff.get(Number(r.id)) ?? [] : [])) inserted++
  }

  // 1b. Titles from production
  const prod = await rows(sql`SELECT person_id, type FROM production WHERE person_id IS NOT NULL ORDER BY person_id`)
  for (const r of prod) {
    for (const title of productionTypeToTitles(String(r.type))) if (await insert(Number(r.person_id), title)) inserted++
  }
  log(`inserted ${inserted} title rows`)

  // Rows with no person are unmigratable by definition; say so rather than losing them silently.
  const [skipped] = await rows(sql`
    SELECT (SELECT count(*) FROM organization_staff WHERE person_id IS NULL) AS org,
           (SELECT count(*) FROM production WHERE person_id IS NULL) AS prod`)
  log(`REPORT skipped ${Number(skipped?.org ?? 0)} organization_staff row(s) and ${Number(skipped?.prod ?? 0)} production row(s) with null person_id`)

  // 2. Roles
  const losing = await rows(sql`
    SELECT p.id, p.name FROM people p
    WHERE p.role = 'team-manager'
      AND NOT EXISTS (SELECT 1 FROM teams_manager tm WHERE tm.person_id = p.id)
      AND NOT EXISTS (SELECT 1 FROM teams_coaches tc WHERE tc.person_id = p.id)
      AND NOT EXISTS (SELECT 1 FROM teams_captain tk WHERE tk.person_id = p.id)
      AND NOT EXISTS (SELECT 1 FROM people_rels pr WHERE pr.parent_id = p.id AND pr.path IN ('teamAccess','assignedTeams'))
      AND NOT EXISTS (SELECT 1 FROM people_titles t WHERE t._parent_id = p.id AND t.title = 'region-lead')
    ORDER BY p.name`)
  for (const r of losing) payload.logger.warn(`[titles-b] REPORT team-manager without any team rights after migration: ${r.name} (#${r.id})`)
  log(`REPORT ${losing.length} team-manager(s) would lose team rights`)
  const converted: any = await db.execute(sql`UPDATE people SET role = 'user' WHERE role IN ('team-manager','player')`)
  log(`converted ${converted.rowCount ?? '?'} team-manager/player rows to user`)

  // 3. Clear implied flags
  const titlesByPerson = new Map<number, TitleValue[]>()
  for (const r of await rows(sql`SELECT _parent_id, title FROM people_titles`)) {
    titlesByPerson.set(Number(r._parent_id), [...(titlesByPerson.get(Number(r._parent_id)) ?? []), r.title as TitleValue])
  }
  let cleared = 0
  for (const [personId, titles] of titlesByPerson) {
    for (const flag of impliedFlagsForTitles(titles)) {
      const col = FLAG_COLUMN[flag]
      const res: any = await db.execute(sql.raw(`UPDATE people SET "${col}" = false WHERE id = ${personId} AND "${col}" = true`))
      if ((res.rowCount ?? 0) > 0) { cleared++; log(`cleared ${flag} on person #${personId} (implied by ${titles.join(', ')})`) }
    }
  }
  log(`REPORT cleared ${cleared} redundant department flag(s)`)

  // 4. Lead candidates
  const cands = await rows(sql`
    SELECT t.title, string_agg(p.name || ' (#' || p.id || ')', ', ' ORDER BY p.name) AS people
    FROM people_titles t JOIN people p ON p.id = t._parent_id
    WHERE t.title IN ('event-manager','social-manager','marketing','graphics','media-editor','caster','producer')
    GROUP BY t.title ORDER BY t.title`)
  for (const r of cands) log(`REPORT lead candidates for ${r.title}: ${r.people}`)
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  // Copies only; the source tables are untouched. Titles can be removed with:
  //   DELETE FROM people_titles;  (regions cascade)
  // Roles are not restored automatically (the report lists who was converted).
}

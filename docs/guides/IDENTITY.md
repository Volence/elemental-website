# Identity: people, Discord, and login

One People row per human. Discord ID is the identity key. Discord is the only way in.

## How people are created
- Self-serve: Sign in with Discord. Members of a registered Elemental server get a `user` row keyed by their Discord ID. Non-members are refused and nothing is created.
- Manager path: the Discord member picker (team editor, manage users) creates or reuses the row for a chosen member.
- With `IDENTITY_REQUIRE_DISCORD_ID=true` every other create path is rejected.

## Login
- `/admin/login` shows only the Discord button. `/admin/login?breakglass=1` shows the password form; only admin-role rows carry a password (`scripts/set-admin-password.ts`).
- `GET /api/auth/discord?returnUrl=...` starts OAuth; `link=true` attaches Discord to the current session's person.
- Sessions are minted only by `src/auth/session.ts`.

## Legacy rows without a Discord ID
- `/admin/identity` > Unlinked: suggestions from guild members, one-click link, mark inactive.
- Dashboard banner asks password users to link their own Discord.
- First Discord login with a name match shows `/claim`; an approved claim merges the new row into the legacy one (`src/identity/merge.ts`). Nothing is deleted; the source gets `isInactive` and `mergedInto`.

Scrim ownership is still keyed by email; Discord-only accounts use discord_<id>@elmt.placeholder as the key. Step 2 moves this to person id.

## Rollout order (step 1)
1. Migration 1 + 2 on prod, deploy.
2. Work the Unlinked tab; announce the link deadline.
3. Merge duplicate Discord IDs until the report is clean.
4. Migration 3 on prod, set `IDENTITY_REQUIRE_DISCORD_ID=true`, deploy.

Migration 3 is the unique index. `CREATE INDEX CONCURRENTLY` cannot run inside a transaction, so on prod run it by hand in psql (see `docs/guides/` prod DB access) once step 3 reports no duplicates:

```sql
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS people_discord_id_unique ON people (discord_id) WHERE discord_id IS NOT NULL;
```

Also remove `/api/availability/discord-callback` from the Discord application's redirect URIs: `/api/auth/discord/callback` is the only callback the site uses now, and a leftover redirect URI is a second way in.

## Titles and access (step 2)

What a person *is* and *may do* now lives entirely on the People row: `titles` (array), `departments` (extra access, additive on top of titles), `teamAccess` (access-only, never shown on the site), and a three-value `role` (admin, staff-manager, user). `organization-staff` and `production` are gone; `src/access/titles.ts` is the single source of truth for titles, replacing `src/utilities/orgRoles.ts`. `src/access/resolve.ts` is the single module that answers every permission question (`resolveAccess`, `hasScrimAccess`, `canApplyPersonChange`); nothing else should compare `role === '...'` directly.

### Titles

| Group | Title | Grants | Lead label |
|---|---|---|---|
| Organization | Owner | admin role | none |
| Organization | Co-Owner | admin role | none |
| Organization | Administration | admin role | none |
| Organization | HR | staff-manager role | none |
| Organization | Region Lead | manager rights on every team whose region is in `regions` | none |
| Department | Event Manager | events member, pug member | Events Lead |
| Department | Social Manager | social member | Social Media Lead |
| Department | Marketing | social member, graphics member | Marketing Lead |
| Department | Graphics | graphics member | Graphics Lead |
| Department | Media Editor | video member | Media Editor Lead |
| Production | Caster | production member | Lead Caster |
| Production | Observer | production member | none |
| Production | Producer | production member | Lead Producer |
| Community | Content Creator | none (drives the who's-live surfaces) | none |

A title's departments start at member level; its `isLead` flag raises them to lead. Two roles only: `admin`, `staff-manager`, `user`. A title with `impliesRole` raises the role via a `beforeChange` hook on People and never lowers it automatically - the editor flags when the stored role is higher than the titles imply.

### Team access

Anyone with access to a team has full manager rights on it (roster, staff, scheduling, scrim upload and view, analytics). A person has access to a team when any of: they are in its manager, coaches, or captain array; they hold a Region Lead title covering the team's region; they appear in the team's `teamAccess` list (access-only, added by an admin or staff-manager, not shown publicly).

### Department leads

A lead may add or remove their own department's member-level titles and toggle that department's extra-access flag on other people. Lead flags, roles, other departments, and team access stay with staff-manager and admin. `canApplyPersonChange` in `src/access/resolve.ts` enforces this both in field-level `access` and in `beforeValidate` on People.

### Where to edit

`/admin/edit-person` has a "Titles and access" section: the titles list (add/remove/reorder, lead toggle only on titles with a lead label, regions picker only on Region Lead entries), extra access checkboxes (labeled "granted by <title>" when redundant), the `teamAccess` picker, the role select, and a read-only "Effective access" panel showing the person's resolved role, department levels, and teams with reasons. Controls are hidden (and rejected server-side) when the signed-in staffer isn't allowed to change them.

### Rollout order (step 2)

1. **Prod psql: migration A** (schema, additive, safe before the deploy). Includes the `people_rels` path rename `assignedTeams` -> `teamAccess`. Statements below.
2. **Prod psql: the read-only reports** at the top of `src/migrations/sql/20260905_titles_data.sql` (everything above its `BEGIN`). Read the "would lose team rights" list and fix each person (add them to the team's manager array, or accept the loss) before the writes run. Save the output.
3. **Merge and deploy.** The new image reads titles off People; `organization-staff` and `production` are gone from the admin.
4. **Immediately after the new image is live: prod psql, the writes** in `src/migrations/sql/20260905_titles_data.sql` (its `BEGIN ... COMMIT` block; running the whole file is fine, the reports just print again). `/staff`, the Discord staff cards and every title-derived department stay empty until this runs, so keep the gap short. Save the output.
5. **Set the lead flags** in the person editor for the current leads: Media Editor Lead, Lead Producer, Lead Caster, Social Media Lead, Graphics Lead, Events Lead, Marketing Lead.
6. **After a quiet day, migration C** (archive) in prod psql.

Then check `/staff`, refresh one Discord staff card (`/api/discord/team-cards/refresh-all`), `/admin/edit-person` for a staffer, a caster's and a social staffer's dashboards, and a team manager's `/admin/edit-team`.

Migration B is a plain SQL file because the production image is a standalone Next build with no Payload CLI: `npx payload run` only works in dev, where `src/migrations/20260905_titles_data.ts` and `scripts/titles-migration-report.ts` remain the way to run and preview it. The two are kept in step; the SQL file's inserts were verified to produce byte-identical rows (same person, title and `_order`) to the TS migration's dev run.

New access can take up to 45 seconds to appear for its owner: the server caches the teams list for 30 seconds and the client caches its resolved access for another 15. A hard refresh does not shorten it; wait it out before concluding a grant did not work.

Rollback before C: redeploy the previous image and reverse the `people_rels` path rename. After C: rename the archived tables back.

### Exact psql commands

Migration A (schema, additive - safe before deploy):

```sql
DO $$ BEGIN
  CREATE TYPE "public"."enum_people_titles_title" AS ENUM('owner','co-owner','administration','hr','region-lead','event-manager','social-manager','marketing','graphics','media-editor','caster','observer','producer','content-creator');
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  CREATE TYPE "public"."enum_people_titles_regions" AS ENUM('na','emea','sa','oce','apac','sea');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "people_titles" (
  "_order" integer NOT NULL,
  "_parent_id" integer NOT NULL,
  "id" varchar PRIMARY KEY NOT NULL,
  "title" "enum_people_titles_title" NOT NULL,
  "is_lead" boolean DEFAULT false
);
DO $$ BEGIN
  ALTER TABLE "people_titles" ADD CONSTRAINT "people_titles_parent_id_fk"
    FOREIGN KEY ("_parent_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
CREATE INDEX IF NOT EXISTS "people_titles_order_idx" ON "people_titles" USING btree ("_order");
CREATE INDEX IF NOT EXISTS "people_titles_parent_id_idx" ON "people_titles" USING btree ("_parent_id");
CREATE INDEX IF NOT EXISTS "people_titles_title_idx" ON "people_titles" USING btree ("title");

CREATE TABLE IF NOT EXISTS "people_titles_regions" (
  "order" integer NOT NULL,
  "parent_id" varchar NOT NULL,
  "value" "enum_people_titles_regions",
  "id" varchar PRIMARY KEY NOT NULL DEFAULT gen_random_uuid()::text
);
DO $$ BEGIN
  ALTER TABLE "people_titles_regions" ADD CONSTRAINT "people_titles_regions_parent_fk"
    FOREIGN KEY ("parent_id") REFERENCES "public"."people_titles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
CREATE INDEX IF NOT EXISTS "people_titles_regions_order_idx" ON "people_titles_regions" USING btree ("order");
CREATE INDEX IF NOT EXISTS "people_titles_regions_parent_idx" ON "people_titles_regions" USING btree ("parent_id");

-- The people_rels path rename (assignedTeams -> teamAccess):
UPDATE "people_rels" SET "path" = 'teamAccess' WHERE "path" = 'assignedTeams';
```

Migration B (data, copies only) runs as plain SQL from `src/migrations/sql/20260905_titles_data.sql`. Copy the file onto the server (or paste it into the psql session) and run the reports first, then the writes:

```bash
ssh ubuntu@elmt.gg
# Step 2 of the rollout - reports only (everything above the file's BEGIN):
sed '/^BEGIN;$/,$d' 20260905_titles_data.sql | docker exec -i elemental-website-postgres-1 psql -U payload -d payload
# Step 4, right after the new image is live - the whole file (reports print again, then the writes):
docker exec -i elemental-website-postgres-1 psql -U payload -d payload < 20260905_titles_data.sql
```

The whole file is safe to run repeatedly: the inserts are guarded by `NOT EXISTS (_parent_id, title)`, and the role conversion and flag clearing are idempotent. Nothing is deleted. Save the full output for the record.

In dev the same migration is available through the Payload runner, which prod does not have:

```bash
docker exec -w /home/node/app elemental-dev-3100 node_modules/.bin/payload run scripts/titles-migration-report.ts
docker exec -w /home/node/app elemental-dev-3100 node_modules/.bin/payload run scripts/apply-one-migration.ts 20260905_titles_data
```

Migration C (archive, only after a quiet day post-deploy):

```sql
ALTER TABLE IF EXISTS "organization_staff_regions" RENAME TO "_organization_staff_regions_archived";
ALTER TABLE IF EXISTS "organization_staff_roles" RENAME TO "_organization_staff_roles_archived";
ALTER TABLE IF EXISTS "organization_staff" RENAME TO "_organization_staff_archived";
ALTER TABLE IF EXISTS "production" RENAME TO "_production_archived";
ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "organization_staff_id";
ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "production_id";
```

The two `DROP COLUMN` statements are the only part of the whole rollout that removes anything: they are Payload's lock bookkeeping for the two retired collections, hold no organization data, and are not restored by migration C's `down` (the renamed tables are). Rerunning `payload migrate:create` against the new config would drop them anyway.

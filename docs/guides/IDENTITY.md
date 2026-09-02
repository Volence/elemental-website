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

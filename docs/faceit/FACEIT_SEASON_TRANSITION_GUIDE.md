# FaceIt Season Transition Guide

**For Admins:** moving the org to a new FACEIT season.

## When

FACEIT publishes the next season a few weeks before it starts. The FaceIt
Leagues page (`/admin/collections/faceit-leagues`) shows a status pill:
"On Season 9 - Season 10 available (starts Sep 7)". When you see it, roll over.

## Steps

1. Open **FaceIt Leagues** and click **Roll over to Season N**.
2. Review the plan:
   - **Leagues**: one template per region and division, created from FACEIT's
     season tree. Nothing to paste.
   - **Teams**: each FACEIT-enabled team and the division it registered in,
     looked up from FACEIT's registration lists. Teams marked with a warning
     were not found; pick a division, click a suggested FACEIT team to fix a
     wrong team id, or leave them on Skip.
   - **Housekeeping**: old leagues still active are finalized, disabled teams
     stop pointing at leagues, leftover playoff flags are cleared.
3. Click **Create N leagues, move M teams**. The report lists every step and
   the sync result per team.
4. Skipped teams: fix their FACEIT team id on the team page, then set the
   league on the team's FaceIt Integration tab or run the rollover again (it
   reuses the leagues it already created).

## What happens to the old season

Selecting the new league on a team retires its previous season record
(`isActive: false`) and creates the new one, so history stays on the team
page. Finalizing a league archives each team's match list from FACEIT.

## A team drops out mid-season

On the team's **FaceIt Integration** tab tick **Withdrawn from current
season**. Match sync and Discord posts stop for that team, its upcoming
FACEIT matches are cancelled, and the public page shows "Withdrawn" while
keeping history. The next rollover clears the flag if the team registers.

This is different from unticking **Enable FaceIt**, which hides the
competitive section and history entirely.

## Troubleshooting

- **"Could not reach FACEIT"**: the seasons or tree call failed. Try again in
  a minute; nothing was written.
- **All teams unmatched, warning about FACEIT_API_KEY**: the Data API key is
  missing in the environment. Leagues are still created; assign teams by hand.
- **A team is in two divisions**: FACEIT lists the same team id in two
  championships. Pick the right one in the Teams table.
- **Nightly sync says a team is withdrawn**: expected; untick the flag when
  the team is back.
- **Restore a finalized league**: expand **Finalized Seasons** on the leagues
  page and click Restore on the league or on a single team season.

## For developers

- Planning (pure, unit tested): `src/utilities/faceitRollover.ts`
- Finalize (shared with the old route): `src/utilities/faceitFinalize.ts`
- Apply: `src/discord/services/faceitRolloverApply.ts`
- API: `src/app/api/faceit/rollover/route.ts` (`GET` dry run, `POST` apply)
- UI: `src/components/FaceitLeaguesHeader/` (`index.tsx`, `RolloverModal.tsx`)
- FACEIT endpoints used: `team-leagues/v2/leagues/{id}/seasons`,
  `team-leagues/v2/seasons/tree?entityType=season`, Data API
  `championships/{id}/subscriptions` (needs `FACEIT_API_KEY`)

**Last Updated:** September 4, 2026

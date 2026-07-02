/**
 * Shared opponent-name resolution for scrim analytics views.
 *
 * A scrim's opponent can be described three ways, in decreasing reliability:
 *   1. A linked Payload team (payloadTeamId2, or payloadTeamId when viewing
 *      as the second team) - a structured reference to a real team record.
 *   2. The free-text `opponentName` override typed at upload/rename time.
 *      This is written from the uploader's (primary team's) perspective, so
 *      it must not be shown when rendering the second team's point of view.
 *   3. The raw side names parsed from the workshop log (`team_1_name` /
 *      `team_2_name`), which are frequently the generic "Team 1"/"Team 2".
 *
 * Every view that displays "who did we play" must go through this function so
 * the scrim list and the team analytics tabs can never disagree again.
 */

export type OpponentResolutionInput = {
  /** Team whose perspective is being rendered; null = the scrim's primary team. */
  viewTeamId: number | null
  payloadTeamId: number | null
  payloadTeamId2: number | null
  /** Free-text override entered by the uploader (primary team's perspective). */
  opponentName: string | null
  /** Payload team id -> team name, for whatever linked ids the caller fetched. */
  linkedTeamNames: Map<number, string>
  /** Raw side names from the log's match_start event. */
  rawTeam1: string
  rawTeam2: string
  /** Raw side resolved as "ours" via roster membership, if known. */
  rawOurTeam: string | null
}

export function resolveOpponentName(input: OpponentResolutionInput): string {
  const { viewTeamId, payloadTeamId, payloadTeamId2 } = input

  // 1. Linked opposing Payload team.
  if (payloadTeamId != null && payloadTeamId2 != null) {
    const perspectiveId = viewTeamId ?? payloadTeamId
    const otherLinkedId =
      perspectiveId === payloadTeamId ? payloadTeamId2
      : perspectiveId === payloadTeamId2 ? payloadTeamId
      : null
    const linkedName = otherLinkedId != null ? input.linkedTeamNames.get(otherLinkedId) : undefined
    if (linkedName) return linkedName
  }

  // 2. Free-text override, only from the uploader's perspective.
  if (input.opponentName && (viewTeamId == null || viewTeamId === payloadTeamId)) {
    return input.opponentName
  }

  // 3. Raw log side that isn't ours.
  const ourRaw = input.rawOurTeam ?? input.rawTeam1
  return ourRaw === input.rawTeam1 ? input.rawTeam2 : input.rawTeam1
}

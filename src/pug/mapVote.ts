export function resolveMapVote(
  candidates: number[],
  votes: Record<number, number>,
): number {
  const tallies: Record<number, number> = {}
  for (const mapId of candidates) tallies[mapId] = 0
  for (const mapId of Object.values(votes)) {
    if (tallies[mapId] !== undefined) tallies[mapId]++
  }

  const maxVotes = Math.max(...Object.values(tallies))
  const winners = candidates.filter((id) => tallies[id] === maxVotes)

  return winners[Math.floor(Math.random() * winners.length)]
}

export function drawMapCandidates(eligibleMapIds: number[]): number[] {
  if (eligibleMapIds.length < 3) {
    throw new Error(`Map pool has only ${eligibleMapIds.length} maps; need at least 3`)
  }
  const shuffled = [...eligibleMapIds].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, 3)
}

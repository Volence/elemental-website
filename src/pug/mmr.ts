// @ts-ignore - glicko2 package has no bundled types
import Glicko2Lib from 'glicko2'
import type { PlayerRating, MatchResult } from './types'

export function calculateRatingUpdates(
  team1: PlayerRating[],
  team2: PlayerRating[],
  result: MatchResult,
): PlayerRating[] {
  if (result === 'cancelled') {
    return [...team1, ...team2]
  }

  const ranking = new Glicko2Lib.Glicko2({ tau: 0.5, rating: 1500, rd: 350, vol: 0.06 })

  const makeG2Player = (pr: PlayerRating) =>
    ranking.makePlayer(pr.rating, pr.ratingDeviation, pr.volatility)

  const g2team1 = team1.map(makeG2Player)
  const g2team2 = team2.map(makeG2Player)

  let score1: number, score2: number
  if (result === 'team1') { score1 = 1; score2 = 0 }
  else if (result === 'team2') { score1 = 0; score2 = 1 }
  else { score1 = 0.5; score2 = 0.5 }

  const avg = (arr: any[], fn: (p: any) => number) => arr.reduce((s, p) => s + fn(p), 0) / arr.length
  const team1Avg = ranking.makePlayer(avg(g2team1, (p) => p.getRating()), avg(g2team1, (p) => p.getRd()), avg(g2team1, (p) => p.getVol()))
  const team2Avg = ranking.makePlayer(avg(g2team2, (p) => p.getRating()), avg(g2team2, (p) => p.getRd()), avg(g2team2, (p) => p.getVol()))

  const matches: [any, any, number][] = []
  for (const p1 of g2team1) {
    matches.push([p1, team2Avg, score1])
  }
  for (const p2 of g2team2) {
    matches.push([p2, team1Avg, score2])
  }

  ranking.updateRatings(matches)

  const updated: PlayerRating[] = []
  for (let i = 0; i < team1.length; i++) {
    updated.push({
      payloadPlayerId: team1[i].payloadPlayerId,
      rating: Math.round(g2team1[i].getRating()),
      ratingDeviation: Math.round(g2team1[i].getRd()),
      volatility: g2team1[i].getVol(),
    })
  }
  for (let i = 0; i < team2.length; i++) {
    updated.push({
      payloadPlayerId: team2[i].payloadPlayerId,
      rating: Math.round(g2team2[i].getRating()),
      ratingDeviation: Math.round(g2team2[i].getRd()),
      volatility: g2team2[i].getVol(),
    })
  }
  return updated
}

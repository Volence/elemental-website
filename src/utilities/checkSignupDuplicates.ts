import type { Payload } from 'payload'

function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = []
  for (let i = 0; i <= str2.length; i++) matrix[i] = [i]
  for (let j = 0; j <= str1.length; j++) matrix[0][j] = j
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1,
        )
      }
    }
  }
  return matrix[str2.length][str1.length]
}

function calculateSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2
  const shorter = str1.length > str2.length ? str2 : str1
  if (longer.length === 0) return 1.0
  const distance = levenshteinDistance(longer.toLowerCase(), shorter.toLowerCase())
  return (longer.length - distance) / longer.length
}

export async function checkSignupDuplicates(
  payload: Payload,
  newPersonId: number,
  newPersonName: string,
  source: 'pug-signup' | 'public-signup' | 'auto-login',
): Promise<void> {
  try {
    const drizzle = (payload as any).db?.drizzle
    if (!drizzle) return
    const { sql } = await import('drizzle-orm')

    const allPeople = await payload.find({
      collection: 'people',
      limit: 10000,
      depth: 0,
      overrideAccess: true,
      select: { name: true },
    })

    for (const person of allPeople.docs) {
      if (person.id === newPersonId || !person.name) continue
      const similarity = calculateSimilarity(newPersonName, person.name)
      if (similarity >= 0.8) {
        const existing = await drizzle.execute(sql.raw(
          `SELECT id FROM merge_suggestions WHERE (new_person_id = ${newPersonId} AND existing_person_id = ${person.id}) OR (new_person_id = ${person.id} AND existing_person_id = ${newPersonId}) LIMIT 1`
        ))
        if ((existing.rows ?? existing).length > 0) continue

        const sim = Math.round(similarity * 100)
        const label = `${newPersonName} ~ ${person.name} (${sim}%)`
        await drizzle.execute(sql.raw(
          `INSERT INTO merge_suggestions (new_person_id, existing_person_id, similarity, source, status, label) VALUES (${newPersonId}, ${person.id}, ${sim}, '${source}', 'pending', '${label.replace(/'/g, "''")}')`
        ))
      }
    }
  } catch (err) {
    payload.logger.error(`[Merge Suggestions] Failed to check duplicates for person ${newPersonId}: ${err}`)
  }
}

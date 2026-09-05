import { NextResponse } from 'next/server'
import { authenticateWithAccess, authError } from '@/utilities/apiAuth'
import { getGuildGateway } from '@/identity/guild'
import { rankCandidates } from '@/identity/match'

export async function GET() {
  const auth = await authenticateWithAccess()
  if (!auth.success) return auth.response
  const { payload, access } = auth.data
  if (!access.canManagePeople) return authError(403, 'Forbidden')

  const [people, teams, sessions, gateway] = await Promise.all([
    payload.find({ collection: 'people', where: { isInactive: { not_equals: true } }, limit: 0, depth: 0, overrideAccess: true, showHiddenFields: true, select: { name: true, role: true, discordId: true, hash: true, gameAliases: true, pugBattleTag: true } }),
    payload.find({ collection: 'teams', limit: 500, depth: 0, overrideAccess: true, select: { name: true, roster: true, subs: true, manager: true, coaches: true, captain: true } }),
    payload.find({ collection: 'active-sessions', limit: 5000, sort: '-loginTime', depth: 0, overrideAccess: true, select: { user: true, loginTime: true } }),
    getGuildGateway(),
  ])

  const pid = (e: any) => (typeof e?.person === 'object' ? e.person?.id : e?.person)
  const teamsByPerson = new Map<number, string[]>()
  for (const t of teams.docs as any[]) {
    for (const e of [...(t.roster ?? []), ...(t.subs ?? []), ...(t.manager ?? []), ...(t.coaches ?? []), ...(t.captain ?? [])]) {
      const id = pid(e)
      if (id) teamsByPerson.set(id, [...new Set([...(teamsByPerson.get(id) ?? []), t.name])])
    }
  }
  const lastLogin = new Map<number, string>()
  for (const s of sessions.docs as any[]) {
    const id = typeof s.user === 'object' ? s.user?.id : s.user
    if (id && !lastLogin.has(id)) lastLogin.set(id, s.loginTime)
  }

  const members = await gateway.listAllMembers()
  const all = people.docs as any[]
  const unlinked = all.filter((p) => !p.discordId)
  const rows = unlinked
    .map((p) => {
      const hasPassword = !!p.hash
      const suggestions = rankCandidates(
        members,
        (m) => [m.username, m.displayName, m.nickname],
        [p.name, ...((p.gameAliases ?? []) as any[]).map((a) => a?.alias ?? ''), (p.pugBattleTag ?? '').split('#')[0]],
      ).map((r) => ({ discordId: r.item.id, username: r.item.username, displayName: r.item.displayName, nickname: r.item.nickname, servers: r.item.servers, score: r.score }))
      return { id: p.id, name: p.name, role: p.role ?? 'user', teams: teamsByPerson.get(p.id) ?? [], hasPassword, lastLogin: lastLogin.get(p.id) ?? null, suggestions }
    })
    .sort((a, b) => Number(b.hasPassword) - Number(a.hasPassword) || b.teams.length - a.teams.length || a.name.localeCompare(b.name))

  return NextResponse.json({
    counts: {
      linked: all.length - unlinked.length,
      unlinked: unlinked.length,
      unlinkedWithLogin: rows.filter((r) => r.hasPassword).length,
      unlinkedNoLogin: rows.filter((r) => !r.hasPassword).length,
    },
    rows,
  })
}

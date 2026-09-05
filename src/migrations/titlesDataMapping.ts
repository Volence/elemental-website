import { DEPARTMENT_FLAG, TITLE_BY_VALUE, isTitleValue, type DepartmentFlag, type TitleValue } from '../access/titles'

export function productionTypeToTitles(type: string): TitleValue[] {
  const parts = String(type).split('-')
  const out: TitleValue[] = []
  for (const p of parts) if (isTitleValue(p) && TITLE_BY_VALUE[p].group === 'production') out.push(p)
  return out
}

export function orgRoleToTitle(role: string): TitleValue | null {
  return isTitleValue(role) && TITLE_BY_VALUE[role].group !== 'production' ? role : null
}

export function impliedFlagsForTitles(titles: TitleValue[]): DepartmentFlag[] {
  const out = new Set<DepartmentFlag>()
  for (const t of titles) for (const d of TITLE_BY_VALUE[t].departments) out.add(DEPARTMENT_FLAG[d])
  return [...out]
}

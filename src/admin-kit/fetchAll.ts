/**
 * Fetch every document of a Payload REST list by walking its pages.
 *
 * Single-request loaders with `limit=200` silently cap what a view can show
 * (the Users list did this while People held 900+ rows). Pass the list URL
 * without `page`/`limit`; pages of `pageSize` are requested until Payload
 * reports no next page. `max` is a hard stop so a runaway collection cannot
 * pull the whole database into the browser.
 */
export async function fetchAllDocs<T = unknown>(
  url: string,
  opts: { pageSize?: number; max?: number; init?: RequestInit } = {},
): Promise<T[]> {
  const pageSize = opts.pageSize ?? 500
  const max = opts.max ?? 5000
  const init: RequestInit = { credentials: 'include', ...opts.init }
  const sep = url.includes('?') ? '&' : '?'
  const out: T[] = []
  let page = 1
  for (;;) {
    const res = await fetch(`${url}${sep}limit=${pageSize}&page=${page}`, init)
    if (!res.ok) throw new Error(`Request failed (HTTP ${res.status})`)
    const data = (await res.json()) as { docs?: T[]; hasNextPage?: boolean }
    out.push(...(data.docs ?? []))
    if (!data.hasNextPage || out.length >= max) break
    page += 1
  }
  return out
}

/**
 * Issue a DELETE to a Payload REST endpoint and report the outcome.
 *
 * Returns `null` on success, otherwise a human-readable error message. Callers
 * must check the result before navigating away: a 403 or a foreign-key
 * failure is otherwise indistinguishable from a successful delete.
 */
export async function requestDelete(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { method: 'DELETE', credentials: 'include' })
    if (res.ok) return null

    let message: string | undefined
    try {
      const body = await res.json()
      message = body?.errors?.[0]?.message ?? body?.message ?? body?.error
    } catch {
      // body was not JSON
    }
    return message || `Delete failed (HTTP ${res.status})`
  } catch (err) {
    return err instanceof Error && err.message ? err.message : 'Delete failed'
  }
}

/**
 * setInterval for data refresh that respects the Page Visibility API.
 *
 * - Skips ticks while the document is hidden (background tabs stop hammering the API).
 * - Runs `fn` immediately when the tab becomes visible again, so the view is fresh
 *   without waiting for the next tick.
 * - Returns a stop function suitable for a React effect cleanup.
 *
 * Use for polling fetches. Not for 1-second display timers, which are cheap and
 * would drift if paused.
 */
export function startPolling(fn: () => void, intervalMs: number): () => void {
  if (typeof window === 'undefined') return () => {}

  const tick = () => {
    if (document.hidden) return
    fn()
  }
  const onVisible = () => {
    if (!document.hidden) fn()
  }

  const id = window.setInterval(tick, intervalMs)
  document.addEventListener('visibilitychange', onVisible)

  return () => {
    window.clearInterval(id)
    document.removeEventListener('visibilitychange', onVisible)
  }
}

/**
 * Shared with hooks/titlesAndRole.ts, which needs it to compare a stored slug's normal form
 * against the merged doc without treating normalisation alone as a change (see
 * enforcePersonAccessChange). Kept in its own module (rather than index.ts, which imports from
 * titlesAndRole.ts) so the two never form an import cycle.
 */
export const formatSlug = (value: string): string => {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

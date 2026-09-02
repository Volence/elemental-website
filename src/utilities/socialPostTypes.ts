/** Social media post categories, platforms and calendar colours (client-safe). */

export const SOCIAL_POST_TYPES = [
  { label: 'Match Promo', value: 'Match Promo' },
  { label: 'Stream Announcement', value: 'Stream Announcement' },
  { label: 'Community Engagement', value: 'Community Engagement' },
  { label: 'Original Content', value: 'Original Content' },
  { label: 'Repost/Share', value: 'Repost/Share' },
  { label: 'Other', value: 'Other' },
] as const

export const SOCIAL_PLATFORMS = [
  { label: 'Twitter/X', value: 'Twitter/X' },
  { label: 'Instagram', value: 'Instagram' },
  { label: 'TikTok', value: 'TikTok' },
  { label: 'YouTube', value: 'YouTube' },
  { label: 'Discord', value: 'Discord' },
  { label: 'Other', value: 'Other' },
] as const

export type SocialPostType = (typeof SOCIAL_POST_TYPES)[number]['value']
export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number]['value']

export const POST_TYPE_COLORS: Record<string, string> = {
  'Match Promo': '#3b82f6',
  'Stream Announcement': '#8b5cf6',
  'Community Engagement': '#10b981',
  'Original Content': '#f59e0b',
  'Repost/Share': '#6b7280',
  'Other': '#64748b',
}

/** Neutral colour for tasks that have not been given a post type yet. */
export const UNTYPED_POST_COLOR = '#475569'

export function getPostTypeColor(postType?: string | null): string {
  if (!postType) return UNTYPED_POST_COLOR
  return POST_TYPE_COLORS[postType] || POST_TYPE_COLORS.Other
}
